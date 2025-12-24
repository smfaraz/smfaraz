import { Trainer, Kid, ScheduleItem, SessionType, DayOfWeek, Specialty, StaffStatus, SessionStatus } from "../types";

// --- Configuration ---
const CLINIC_OPEN = 8;  // 8 AM
const CLINIC_CLOSE = 18; // 6 PM

const MIDDLES_ROTATION = [
  { time: "11:00 AM", duration: 30, type: SessionType.SOCIAL, name: "Social Skills" },
  { time: "11:30 AM", duration: 30, type: SessionType.OFFICE, name: "Lunch/Break" },
  { time: "12:00 PM", duration: 30, type: SessionType.OFFICE, name: "Centers" },
  { time: "12:30 PM", duration: 30, type: SessionType.OFFICE, name: "Circle Time" }
];

// --- Improved Helper Functions ---

/** * Robustly parses time strings like "8:30", "9", "4", "12:30 PM" 
 * Handles missing AM/PM by assuming business hours (8-11 is AM, 12-6 is PM)
 */
const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  // Normalize: remove extra spaces, upper case
  let cleanStr = timeStr.trim().toUpperCase();
  
  // Detect explicit AM/PM
  const isPM = cleanStr.includes('PM');
  const isAM = cleanStr.includes('AM');
  
  // Remove text to get numbers
  cleanStr = cleanStr.replace('AM', '').replace('PM', '').trim();
  
  let [hours, minutes] = cleanStr.split(':').map(Number);
  if (isNaN(minutes)) minutes = 0;
  
  // Intelligence Logic for "8:30-4" format (missing AM/PM)
  if (!isAM && !isPM) {
    // If hour is small (1, 2, 3, 4, 5, 6), assume PM (afternoon)
    if (hours >= 1 && hours <= 7) hours += 12;
    // If hour is 12, keep it (Noon)
    // If hour is 8, 9, 10, 11, assume AM
  } else {
    // Standard AM/PM conversion
    if (isPM && hours !== 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  return hours * 60 + minutes;
};

/** Formats minutes back to "08:30 AM" */
const formatTime = (totalMinutes: number): string => {
  let hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  if (hours === 12 && period === 'AM') hours = 12; // Midnight edge case, mostly unused here
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
};

// --- Reservation System ---
class ReservationSystem {
  // Map<ID, Array<{start, end, day}>>
  private occupied = new Map<string, Array<{ start: number, end: number, day: string }>>();

  isFree(id: string, day: string, start: number, end: number): boolean {
    const bookings = this.occupied.get(id) || [];
    // Check for ANY overlap. (StartA < EndB) and (EndA > StartB)
    return !bookings.some(b => b.day === day && start < b.end && end > b.start);
  }

  book(id: string, day: string, start: number, end: number): void {
    const bookings = this.occupied.get(id) || [];
    bookings.push({ start, end, day });
    this.occupied.set(id, bookings);
  }
}

// --- Main Engine ---

export const generateSchedule = async (trainers: Trainer[], kids: Kid[]): Promise<ScheduleItem[]> => {
  const schedule: ScheduleItem[] = [];
  const reservations = new ReservationSystem();
  
  // Reset counters
  const trainerWeeklyMinutes = new Map<string, number>();
  const kidWeeklySessions = new Map<string, number>();
  
  trainers.forEach(t => trainerWeeklyMinutes.set(t.id, 0));
  kids.forEach(k => kidWeeklySessions.set(k.id, 0));

  const workWeek = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];

  for (const day of workWeek) {
    
    // --- PHASE 1: PRE-BOOK MIDDLES (11:00 - 13:00) ---
    // This reserves the time block so nothing else can be scheduled over it.
    
    const kidsByCrew = kids.reduce((acc, kid) => {
      if (!acc[kid.crew]) acc[kid.crew] = [];
      acc[kid.crew].push(kid);
      return acc;
    }, {} as Record<string, Kid[]>);

    for (const crewName in kidsByCrew) {
      const crewKids = kidsByCrew[crewName];
      
      for (const activity of MIDDLES_ROTATION) {
        const start = parseTime(activity.time);
        const end = start + activity.duration;
        
        // Shuffle kids for variety
        const shuffledKids = [...crewKids].sort(() => Math.random() - 0.5);

        for (const kid of shuffledKids) {
          // Find ANY available trainer for this 30 min block
          const availableTrainer = trainers.find(t => 
            t.status === StaffStatus.ACTIVE &&
            t.availableDays.includes(day) &&
            parseTime(t.shiftStart) <= start && 
            parseTime(t.shiftEnd) >= end &&
            reservations.isFree(t.id, day, start, end) &&
            reservations.isFree(kid.id, day, start, end)
          );

          if (availableTrainer) {
            reservations.book(availableTrainer.id, day, start, end);
            reservations.book(kid.id, day, start, end);
            
            schedule.push({
              id: `mid-${day}-${activity.time}-${kid.id}`,
              day,
              timeSlot: activity.time,
              trainerId: availableTrainer.id,
              trainerName: availableTrainer.name,
              kidId: kid.id,
              kidName: kid.name,
              specialty: Specialty.ABA,
              sessionType: activity.type,
              durationMins: activity.duration,
              status: SessionStatus.PENDING,
              crew: kid.crew
            });
            
            // Add to workload
            const tLoad = trainerWeeklyMinutes.get(availableTrainer.id) || 0;
            trainerWeeklyMinutes.set(availableTrainer.id, tLoad + activity.duration);
          }
        }
      }
    }

    // --- PHASE 2: ROLLING WAVE SCHEDULING (08:00 -> 16:30) ---
    // We step through the day in 30-minute increments.
    // If a kid/trainer is free and fits a session, we book it immediately.
    // This catches 8:30 starts, 9:00 starts, etc., sequentially.

    const dayStartMins = CLINIC_OPEN * 60; // 480 (8:00 AM)
    const dayEndMins = CLINIC_CLOSE * 60;  // 1080 (6:00 PM)

    for (let currentTime = dayStartMins; currentTime < dayEndMins; currentTime += 30) {
      
      // Identify kids who still need sessions this week
      const needyKids = [...kids]
        .filter(k => (kidWeeklySessions.get(k.id) || 0) < k.sessionsPerWeek)
        .sort((a, b) => {
           const aNeed = a.sessionsPerWeek - (kidWeeklySessions.get(a.id) || 0);
           const bNeed = b.sessionsPerWeek - (kidWeeklySessions.get(b.id) || 0);
           return bNeed - aNeed; // Prioritize those with most sessions left
        });

      for (const kid of needyKids) {
        const duration = kid.sessionDurationMins; // Usually 90
        const slotEnd = currentTime + duration;

        // 1. Basic Boundary Check
        if (slotEnd > dayEndMins) continue;

        // 2. Kid Availability Check
        if (!reservations.isFree(kid.id, day, currentTime, slotEnd)) continue;

        // 3. Find Trainer
        const requiredSpecialties = kid.requiredSpecialties;
        const preferredId = (kid as any).preferredTrainerId;

        const candidates = trainers.filter(t => 
          t.status === StaffStatus.ACTIVE &&
          t.availableDays.includes(day) &&
          parseTime(t.shiftStart) <= currentTime && 
          parseTime(t.shiftEnd) >= slotEnd &&
          reservations.isFree(t.id, day, currentTime, slotEnd) &&
          // Check Weekly Workload Limit
          ((trainerWeeklyMinutes.get(t.id) || 0) + duration) / 60 <= t.maxHoursPerWeek &&
          // Check Specialty
          t.specialties.some(s => requiredSpecialties.includes(s))
        );

        let selectedTrainer: Trainer | undefined;

        // Preference Logic
        if (preferredId) selectedTrainer = candidates.find(t => t.id === preferredId);
        
        // Load Balancing Fallback
        if (!selectedTrainer && candidates.length > 0) {
          // Pick trainer with lowest current load
          candidates.sort((a, b) => (trainerWeeklyMinutes.get(a.id) || 0) - (trainerWeeklyMinutes.get(b.id) || 0));
          selectedTrainer = candidates[0];
        }

        if (selectedTrainer) {
          // BOOK IT
          reservations.book(selectedTrainer.id, day, currentTime, slotEnd);
          reservations.book(kid.id, day, currentTime, slotEnd);

          schedule.push({
            id: `sess-${day}-${currentTime}-${kid.id}`,
            day,
            timeSlot: formatTime(currentTime),
            trainerId: selectedTrainer.id,
            trainerName: selectedTrainer.name,
            kidId: kid.id,
            kidName: kid.name,
            specialty: selectedTrainer.specialties.find(s => requiredSpecialties.includes(s)) || Specialty.ABA,
            sessionType: SessionType.INDIVIDUAL,
            durationMins: duration,
            status: SessionStatus.PENDING,
            crew: kid.crew
          });

          // Update Counters
          trainerWeeklyMinutes.set(selectedTrainer.id, (trainerWeeklyMinutes.get(selectedTrainer.id) || 0) + duration);
          kidWeeklySessions.set(kid.id, (kidWeeklySessions.get(kid.id) || 0) + 1);
        }
      }
    }
  }

  // Final Sort to ensure UI shows it sequentially
  return schedule.sort((a, b) => {
    // Sort by Day first (Mon -> Fri)
    const days = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI];
    const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    
    // Then by Time
    return parseTime(a.timeSlot) - parseTime(b.timeSlot);
  });
};