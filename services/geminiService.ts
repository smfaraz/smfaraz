import { Trainer, Kid, ScheduleItem, DayOfWeek, SessionType, SessionStatus, Specialty } from "../types";
import { apiService } from "./apiService";

// ============================================================================
// PART 1: HELPER FUNCTIONS
// ============================================================================

const parseTimeStr = (t: string): number => {
  if (!t) return 0;
  const upper = t.toUpperCase();
  const isPM = upper.includes("PM");
  const isAM = upper.includes("AM");
  const clean = upper.replace(/AM|PM/g, "").trim();
  let [h, m] = clean.split(":").map(Number);
  if (isNaN(m)) m = 0;
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  if (!isAM && !isPM && h >= 1 && h <= 7) h += 12;
  return h * 60 + m;
};

// 🔥 FIX: Handle Split Shifts (e.g. "8-12 & 1-5") by taking the full range
const parseShift = (timeStr?: string): { start: number; end: number; isHome?: boolean } | null => {
  if (!timeStr || timeStr === "OFF" || timeStr === "X") return null;

  let isHome = false;
  let cleanStr = timeStr;
  if (timeStr.includes("In home") || timeStr.includes("HOM")) {
    isHome = true;
    cleanStr = timeStr.replace(/In home|HOM/g, "").trim();
  }

  // Split by "&" to handle multiple blocks
  const blocks = cleanStr.split("&");
  
  let minStart = 24 * 60;
  let maxEnd = 0;
  let valid = false;

  blocks.forEach(block => {
      const parts = block.split("-").map(s => s.trim());
      if (parts.length >= 2) {
          const s = parseTimeStr(parts[0]);
          const e = parseTimeStr(parts[1]);
          if (s < e) {
              if (s < minStart) minStart = s;
              if (e > maxEnd) maxEnd = e;
              valid = true;
          }
      }
  });

  if (!valid) return null;
  return { start: minStart, end: maxEnd, isHome };
};

const formatTime = (totalMins: number): string => {
  let h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
};

// ============================================================================
// PART 2: SCORING & VALIDATION
// ============================================================================

type LocationTracker = Map<string, { time: number; location: "CLINIC" | "HOME"; zip?: string }>;

const DURATION_CHOICES = [120, 90, 60, 45, 30, 15] as const; 
const MAX_BURNOUT_MINS = 120; 

const isFullTime = (trainer: Trainer) => (trainer as any).is_full_time === true;

// 🔥 ONLY HARD CONSTRAINTS HERE (Gender, Home Rules)
const isCandidateValid = (
  trainer: Trainer,
  kid: Kid,
  sessionType: SessionType
): boolean => {
  // 1. Gender Block (Hard Rule)
  if (trainer.excludeClientGender && kid.gender) {
    if (trainer.excludeClientGender === kid.gender) return false;
  }

  // 2. In-Home Constraints (Hard Rule)
  if (sessionType === SessionType.HOME) {
    if (kid.inHomeAllowedStaffIds && kid.inHomeAllowedStaffIds.length > 0) {
      if (!kid.inHomeAllowedStaffIds.includes(trainer.id)) return false;
    }
  }

  return true;
};

const calculateScore = (
  trainer: Trainer,
  kid: Kid,
  time: number,
  incumbentId: string | undefined,
  minutesWorked: number,
  trainerHistory: Set<string>,
  lastLocations: LocationTracker,
  sessionType: SessionType
): number => {
  let score = 100;

  // 1. CONTINUITY
  if (trainer.id === incumbentId) score += 50;

  // 2. FULL TIME PRIORITY
  if (isFullTime(trainer)) score += 30;

  // 3. CONFLICT HISTORY (Now a SOFT RULE - Penalty instead of Block)
  if (kid.conflictHistoryKids && kid.conflictHistoryKids.length > 0) {
    for (const avoidId of kid.conflictHistoryKids) {
      if (trainerHistory.has(avoidId)) score -= 1000; // Heavy penalty, but allows if desperate
    }
  }

  // 4. TRAVEL BUFFER (Now a SOFT RULE for Clinic)
  const lastLoc = lastLocations.get(trainer.id);
  if (lastLoc) {
    const isCurrentHome = sessionType === SessionType.HOME;
    const wasHome = lastLoc.location === "HOME";
    if (isCurrentHome !== wasHome) {
      const gap = time - lastLoc.time;
      if (gap < 30) score -= 500; // Penalty for rushing
    }
  }

  // 5. PREFERENCE
  if (kid.inHomeAllowedStaffIds?.includes(trainer.id)) score += 20;

  // 6. WORKLOAD
  score -= (minutesWorked / 60) * 5;

  return score;
};

const pickBestWithTieBreak = (candidates: Trainer[], getScore: (t: Trainer) => number) => {
  if (candidates.length === 0) return null;
  let bestScore = -Infinity;
  let best: Trainer[] = [];
  for (const c of candidates) {
    const s = getScore(c);
    if (s > bestScore) {
      bestScore = s;
      best = [c];
    } else if (s === bestScore) {
      best.push(c);
    }
  }
  return best[Math.floor(Math.random() * best.length)];
};

const isTrainerFreeForDuration = (
  trainerId: string,
  day: DayOfWeek,
  start: number,
  duration: number,
  isBooked: (id: string, day: DayOfWeek, t: number) => boolean
) => {
  for (let t = start; t < start + duration; t += 15) {
    if (isBooked(trainerId, day, t)) return false;
  }
  return true;
};

const isKidFreeForDuration = (
  kidId: string,
  day: DayOfWeek,
  start: number,
  duration: number,
  isBooked: (id: string, day: DayOfWeek, t: number) => boolean
) => {
  for (let t = start; t < start + duration; t += 15) {
    if (isBooked(kidId, day, t)) return false;
  }
  return true;
};

// ============================================================================
// PART 3: SCHEDULER ENGINE
// ============================================================================

export const generateSchedule = async (
  trainers: Trainer[],
  kids: Kid[],
  currentSchedule: ScheduleItem[] = [],
  lockedDays: DayOfWeek[] = []
): Promise<ScheduleItem[]> => {
  const schedule: ScheduleItem[] = currentSchedule.filter((item) => lockedDays.includes(item.day));
  const activeTrainers = trainers.filter((t) => t.status === "Active");

  const bookedMap = new Set<string>();
  const dailyHistory = new Map<DayOfWeek, Map<string, Set<string>>>();
  const dailyWorkload = new Map<string, number>();

  const bookMinute = (trainerId: string, kidId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
    bookedMap.add(`${kidId}-${day}-${t}`);
    dailyWorkload.set(trainerId, (dailyWorkload.get(trainerId) || 0) + 1);
  };
  const isBooked = (id: string, day: DayOfWeek, t: number) => bookedMap.has(`${id}-${day}-${t}`);
  const getTrainerDayHistory = (day: DayOfWeek, trainerId: string) => {
    if (!dailyHistory.has(day)) dailyHistory.set(day, new Map());
    const dayMap = dailyHistory.get(day)!;
    if (!dayMap.has(trainerId)) dayMap.set(trainerId, new Set());
    return dayMap.get(trainerId)!;
  };

  const days = Object.values(DayOfWeek);

  for (const day of days) {
    if (lockedDays.includes(day)) continue;
    const isWeekend = day === DayOfWeek.SAT || day === DayOfWeek.SUN;
    const lastLocations: LocationTracker = new Map();
    const homeKidsScheduled = new Set<string>();

    const availableStaff = activeTrainers
      .map((t) => {
        const shift = parseShift(t.shifts ? t.shifts[day] : undefined);
        return shift ? { ...t, shift } : null;
      })
      .filter((t) => t !== null) as (Trainer & { shift: { start: number; end: number; isHome?: boolean } })[];

    const kidsToday = kids
      .map((k) => {
        const avail = parseShift(k.availability ? k.availability[day] : undefined);
        return avail ? { ...k, avail } : null;
      })
      .filter((k) => k !== null) as (Kid & { avail: { start: number; end: number; isHome?: boolean } })[];

    // --- PHASE 1: HOME SESSIONS ---
    kidsToday.sort((a, b) => a.avail.start - b.avail.start);
    for (const kid of kidsToday) {
      if (!(kid.avail.isHome || isWeekend)) continue;
      const availDuration = kid.avail.end - kid.avail.start;
      if (availDuration < 60) continue;
      const sessionStart = kid.avail.start;
      const HOME_DURATIONS = [120, 90, 60] as const;

      for (const duration of HOME_DURATIONS) {
        const sessionEnd = sessionStart + duration;
        if (sessionEnd > kid.avail.end) continue;
        
        let candidates = availableStaff.filter((staff) =>
            staff.shift.start <= sessionStart &&
            staff.shift.end >= sessionEnd &&
            isTrainerFreeForDuration(staff.id, day, sessionStart, duration, isBooked) &&
            isKidFreeForDuration(kid.id, day, sessionStart, duration, isBooked) &&
            isCandidateValid(staff, kid, SessionType.HOME) // Only hard rules
        );

        const selected = pickBestWithTieBreak(candidates, (t) => 
          calculateScore(t, kid, sessionStart, undefined, dailyWorkload.get(t.id) || 0, getTrainerDayHistory(day, t.id), lastLocations, SessionType.HOME)
        );
        
        if (selected) {
          for (let t = sessionStart; t < sessionEnd; t += 15) bookMinute(selected.id, kid.id, day, t);
          getTrainerDayHistory(day, selected.id).add(kid.id);
          lastLocations.set(selected.id, { time: sessionEnd, location: "HOME" });
          schedule.push({ id: crypto.randomUUID(), day, timeSlot: formatTime(sessionStart), trainerId: selected.id, trainerName: selected.name, kidId: kid.id, kidName: kid.name, specialty: Specialty.ABA, sessionType: SessionType.HOME, durationMins: duration, status: SessionStatus.CONFIRMED });
          homeKidsScheduled.add(kid.id);
          break;
        }
      }
    }
    if (isWeekend) continue;

    // --- PHASE 2: CLINIC SESSIONS (GUARANTEED COVERAGE) ---
    const clinicKids = kidsToday.filter((k) => !k.avail.isHome && !homeKidsScheduled.has(k.id));
    const clinicStaff = availableStaff.filter((t) => !t.shift.isHome);
    const kidIncumbents = new Map<string, string>();
    const consecutiveMinutes = new Map<string, number>();

    // Step every 15 mins
    for (let time = 465; time < 1080; time += 15) { 
      const isCircleTime = time >= 540 && time < 600;
      const kidsPresent = clinicKids.filter((k) => time >= k.avail.start && time < k.avail.end);

      for (const kid of kidsPresent) {
        if (isBooked(kid.id, day, time)) continue;

        const incumbentId = kidIncumbents.get(kid.id);
        const currentConsecutive = consecutiveMinutes.get(kid.id) || 0;
        let selectedTrainer: Trainer | null = null;
        let selectedDuration = 15;

        for (const duration of DURATION_CHOICES) {
          const endTime = time + duration;
          if (endTime > kid.avail.end) continue;

          // Burnout Check
          let isIncumbentAllowed = true;
          if (incumbentId && currentConsecutive >= MAX_BURNOUT_MINS) {
             isIncumbentAllowed = false;
          }

          // Filter Candidates
          let candidates = clinicStaff.filter((t) =>
            time >= t.shift.start &&
            endTime <= t.shift.end &&
            (isIncumbentAllowed ? true : t.id !== incumbentId) && 
            isTrainerFreeForDuration(t.id, day, time, duration, isBooked) &&
            isKidFreeForDuration(kid.id, day, time, duration, isBooked) &&
            isCandidateValid(t, kid, SessionType.INDIVIDUAL) // Hard rules only
          );

          // FALLBACK 1: If empty, Try Incumbent even if Burned Out
          if (candidates.length === 0 && incumbentId) {
             const incumbent = clinicStaff.find(t => t.id === incumbentId);
             if (incumbent && time >= incumbent.shift.start && endTime <= incumbent.shift.end && isTrainerFreeForDuration(incumbent.id, day, time, duration, isBooked)) {
                 candidates = [incumbent];
             }
          }

          // FALLBACK 2: If STILL empty, Try ANYONE (even incumbent from before) by reducing duration
          // This happens naturally by the loop trying smaller durations (e.g. 15 mins)

          const picked = pickBestWithTieBreak(candidates, (t) => 
             calculateScore(t, kid, time, incumbentId, dailyWorkload.get(t.id) || 0, getTrainerDayHistory(day, t.id), lastLocations, SessionType.INDIVIDUAL)
          );

          if (picked) {
            selectedTrainer = picked;
            selectedDuration = duration;
            break;
          }
        }

        if (selectedTrainer) {
          const endTime = time + selectedDuration;
          for (let t = time; t < endTime; t += 15) bookMinute(selectedTrainer.id, kid.id, day, t);

          const isSameTrainer = selectedTrainer.id === incumbentId;
          kidIncumbents.set(kid.id, selectedTrainer.id);
          getTrainerDayHistory(day, selectedTrainer.id).add(kid.id);
          lastLocations.set(selectedTrainer.id, { time: endTime, location: "CLINIC" });

          const newTotal = isSameTrainer ? (currentConsecutive + selectedDuration) : selectedDuration;
          consecutiveMinutes.set(kid.id, newTotal);

          schedule.push({
            id: crypto.randomUUID(),
            day,
            timeSlot: formatTime(time),
            trainerId: selectedTrainer.id,
            trainerName: selectedTrainer.name,
            kidId: kid.id,
            kidName: kid.name,
            specialty: Specialty.ABA,
            sessionType: isCircleTime ? SessionType.SOCIAL : SessionType.INDIVIDUAL,
            durationMins: selectedDuration,
            status: SessionStatus.CONFIRMED,
          });
        } else {
          // If a gap happens, it means NO ONE is available even for 15 mins. 
          // We reset incumbent tracking to allow fresh picking next loop.
          kidIncumbents.delete(kid.id);
          consecutiveMinutes.set(kid.id, 0);
        }
      }
    }
  }

  schedule.sort((a, b) => {
    const dayOrder = Object.values(DayOfWeek);
    const dDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    const tA = parseTimeStr(a.timeSlot);
    const tB = parseTimeStr(b.timeSlot);
    return tA - tB;
  });

  return schedule;
};

// ============================================================================
// PART 4: INTEGRATION
// ============================================================================

export const runAutoScheduler = async (targetDay: DayOfWeek) => {
  console.log(`🚀 Starting Scheduler for ${targetDay}...`);
  try {
    const [trainers, kids, currentSchedule] = await Promise.all([
      apiService.fetchTrainers(),
      apiService.fetchKids(),
      apiService.fetchSchedule(),
    ]);
    const newSchedule = await generateSchedule(trainers, kids, currentSchedule, []);
    await apiService.saveSchedule(newSchedule);
    return { success: true, count: newSchedule.length };
  } catch (error) {
    console.error("Scheduler failed:", error);
    return { success: false, error };
  }
};