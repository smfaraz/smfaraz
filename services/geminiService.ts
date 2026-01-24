import {
  Trainer,
  Kid,
  ScheduleItem,
  DayOfWeek,
  SessionType,
  SessionStatus,
  Specialty
} from "../types";
import { apiService } from "./apiService";

// ============================================================================
// CONFIGURATION
// ============================================================================
const DEFAULT_DURATION_CHOICES = [240, 120, 90, 60] as const; 

const BREAK_DURATION = 30;
// ✅ UPDATED: Travel Buffer is now 60 minutes
const TRAVEL_BUFFER_MINS = 60; 

const MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK = 2; 
const BREAKS_MAX_PER_DAY = 1;
const MIN_TIME_REMAINING_FOR_BREAK = 90; 

const CLINIC_DAY_START = 465; // 7:45 AM
const CLINIC_DAY_END = 1110;  // 6:30 PM
const CONSTRAINT_10_AM_MINS = 600; 
const ANCHOR_2PM_MINS = 14 * 60; // 840 mins

// ============================================================================
// UTILITIES
// ============================================================================
const safeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const parseTimeStr = (t: string): number => {
  if (!t) return 0;
  const cleanStr = t.replace(/HOM|IN HOME|In-home|In-center|TRAVEL/gi, "").trim();
  const startOnly = cleanStr.includes(" - ") ? cleanStr.split(" - ")[0].trim() : cleanStr.trim();
  const upper = startOnly.toUpperCase();
  const isPM = upper.includes("PM");
  const isAM = upper.includes("AM");
  const cleanTime = upper.replace(/AM|PM/g, "").trim();
  let [h, m] = cleanTime.split(":").map((n) => Number(n));
  if (isNaN(h)) return 0;
  if (isNaN(m)) m = 0;
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  if (!isAM && !isPM && h >= 1 && h <= 7) h += 12; 
  return h * 60 + m;
};

const formatTime = (totalMins: number): string => {
  let h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
};

const buildTimeSlotRange = (startMins: number, durationMins: number) => {
  return `${formatTime(startMins)} - ${formatTime(startMins + durationMins)}`;
};

const enumNames = (e: any) => Object.keys(e).filter((k) => isNaN(Number(k)));
const enumValues = <T>(e: any): T[] => enumNames(e).map((n) => e[n]) as T[];

const enumNameFromValue = (e: any, value: any): string | undefined => {
  for (const k of enumNames(e)) {
    if (e[k] === value) return k;
  }
  return undefined;
};

// ============================================================================
// PARSING
// ============================================================================
const parseShift = (timeStr?: string): { start: number; end: number; isHome?: boolean } | null => {
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  if (s === "OFF" || s === "X") return null;
  let clean = s;
  let isHome = false;
  const up = clean.toUpperCase();
  if (up.includes("IN HOME") || up.includes("IN-HOME") || up.includes("HOM")) {
    isHome = true;
    clean = clean.replace(/IN HOME|IN-HOME|HOM/gi, "").trim();
  }
  const blocks = clean.split(/&|\|/).map((b) => b.trim()).filter(Boolean);
  let minStart = 24 * 60;
  let maxEnd = 0;
  let anyValid = false;
  for (const block of blocks) {
    const parts = block.split("-").map((p) => p.trim());
    if (parts.length >= 2) {
      const st = parseTimeStr(parts[0]);
      const en = parseTimeStr(parts[1]);
      if (st < en) {
        anyValid = true;
        if (st < minStart) minStart = st;
        if (en > maxEnd) maxEnd = en;
      }
    }
  }
  if (!anyValid) return null;
  return { start: minStart, end: maxEnd, isHome };
};

const getDayStringOrValueFromShifts = (shiftsObj: any, dayValue: any) => {
  if (!shiftsObj) return undefined;
  if (shiftsObj[dayValue] !== undefined) return shiftsObj[dayValue];
  const dayName = enumNameFromValue(DayOfWeek, dayValue);
  if (dayName && shiftsObj[dayName] !== undefined) return shiftsObj[dayName];
  if (dayName && shiftsObj[dayName.toLowerCase()] !== undefined) return shiftsObj[dayName.toLowerCase()];
  return undefined;
};

// ============================================================================
// HELPERS
// ============================================================================
type LocationTracker = Map<string, { time: number; location: "CLINIC" | "HOME" }>;

const isFullTime = (trainer: Trainer) => trainer.is_full_time === true;

const isCandidateValid = (trainer: Trainer, kid: Kid, sessionType: SessionType): boolean => {
  if (trainer.excludeClientGender && kid.gender) {
    if (trainer.excludeClientGender === kid.gender) return false;
  }
  if (sessionType === SessionType.HOME) {
    if (kid.inHomeAllowedStaffIds && kid.inHomeAllowedStaffIds.length > 0) {
      if (!kid.inHomeAllowedStaffIds.includes(trainer.id)) return false;
    }
  }
  return true;
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

const getKidMaxDurationChoices = (kid: Kid) => {
  const max = Number(kid.sessionDurationMins || 60);
  return DEFAULT_DURATION_CHOICES.filter((d) => d <= max);
};

// ============================================================================
// CORE ALGORITHM
// ============================================================================
export const generateSchedule = async (
  trainers: Trainer[],
  kids: Kid[],
  currentSchedule: ScheduleItem[] = [],
  lockedDays: DayOfWeek[] = [],
  kidsToReschedule: Kid[] = []
): Promise<ScheduleItem[]> => {
  const isRepairMode = kidsToReschedule.length > 0;
  const schedule: ScheduleItem[] = [...currentSchedule];
  const activeTrainers = trainers.filter((t) => String(t.status) === "Active");

  const bookedMap = new Set<string>();
  const weeklyWorkloadMinutes = new Map<string, number>();
  const dailyWorkloadMinutes = new Map<string, number>();
  const consecutiveSessionsCount = new Map<string, number>(); 
  const breaksUsedToday = new Map<string, number>();          
  const fatiguedUntil = new Map<string, number>();            
  const lastLocations: LocationTracker = new Map();

  const bookMinute = (trainerId: string, kidId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
    bookedMap.add(`${kidId}-${day}-${t}`);
    weeklyWorkloadMinutes.set(trainerId, (weeklyWorkloadMinutes.get(trainerId) || 0) + 15);
    dailyWorkloadMinutes.set(`${trainerId}-${day}`, (dailyWorkloadMinutes.get(`${trainerId}-${day}`) || 0) + 15);
  };

  const bookTrainerOnly = (trainerId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
  };

  const isBooked = (id: string, day: DayOfWeek, t: number) => bookedMap.has(`${id}-${day}-${t}`);

  // Seed existing
  for (const item of schedule) {
    const start = parseTimeStr(item.timeSlot);
    const end = start + item.durationMins;
    for (let t = start; t < end; t += 15) {
      bookedMap.add(`${item.trainerId}-${item.day}-${t}`);
      if (item.kidId) bookedMap.add(`${item.kidId}-${item.day}-${t}`);
      weeklyWorkloadMinutes.set(item.trainerId, (weeklyWorkloadMinutes.get(item.trainerId) || 0) + 15);
      dailyWorkloadMinutes.set(`${item.trainerId}-${item.day}`, (dailyWorkloadMinutes.get(`${item.trainerId}-${item.day}`) || 0) + 15);
    }
  }

  const ALL_DAYS = enumValues<DayOfWeek>(DayOfWeek);

  for (const day of ALL_DAYS) {
    if (lockedDays.includes(day)) continue;

    lastLocations.clear();
    consecutiveSessionsCount.clear();
    fatiguedUntil.clear();
    breaksUsedToday.clear();

    const dayExisting = schedule.filter((s) => s.day === day);
    for (const s of dayExisting) {
      const start = parseTimeStr(s.timeSlot);
      const end = start + s.durationMins;
      lastLocations.set(s.trainerId, {
        time: end,
        location: s.sessionType === SessionType.HOME ? "HOME" : "CLINIC"
      });
    }

    const availableStaff = activeTrainers
      .map((t) => {
        const raw = getDayStringOrValueFromShifts(t.shifts, day);
        const shift = parseShift(raw);
        return shift ? { ...t, shift: { start: shift.start, end: shift.end } } : null;
      })
      .filter(Boolean) as (Trainer & { shift: { start: number; end: number } })[];

    let kidsToProcess = isRepairMode ? kidsToReschedule : kids.map((k) => {
      const raw = getDayStringOrValueFromShifts(k.availability, day);
      const avail = parseShift(raw);
      return avail ? { ...k, avail } : null;
    }).filter(Boolean) as any[];

    if (!isRepairMode) {
      kidsToProcess = kidsToProcess.filter((k) => !schedule.some((s) => s.day === day && s.kidId === k.id));
    }

    kidsToProcess.sort((a, b) => {
        if (a.avail.isHome !== b.avail.isHome) return a.avail.isHome ? 1 : -1;
        return (b.avail.end - b.avail.start) - (a.avail.end - a.avail.start);
    });

    for (const kid of kidsToProcess) {
      let currentTime = Math.max(kid.avail.start, CLINIC_DAY_START);
      const endTime = Math.min(kid.avail.end, CLINIC_DAY_END);
      let isFirstSession = true;
      let lastTrainerId: string | null = null; 

      // --------------------------------------------------------
      // SPECIAL PROTOCOL: 120 MINUTE KIDS (2 PM ANCHOR)
      // --------------------------------------------------------
      const is120MinProtocol = kid.sessionDurationMins === 120;
      if (is120MinProtocol && !kid.avail.isHome) {
          if (!isBooked(kid.id, day, ANCHOR_2PM_MINS)) {
             const anchorStart = ANCHOR_2PM_MINS;
             const anchorDur = 120;
             
             const anchorCandidates = availableStaff.filter(t => {
                 if (t.shift.start > anchorStart || t.shift.end < anchorStart + anchorDur) return false;
                 if (!isTrainerFreeForDuration(t.id, day, anchorStart, anchorDur, isBooked)) return false;
                 if (!isCandidateValid(t, kid, SessionType.INDIVIDUAL)) return false;
                 return true;
             });

             if (anchorCandidates.length > 0) {
                 anchorCandidates.sort((a,b) => (a.id === lastTrainerId ? 1 : 0) - (b.id === lastTrainerId ? 1 : 0));
                 const picked = anchorCandidates[0];
                 
                 for (let t = anchorStart; t < anchorStart + anchorDur; t += 15) bookMinute(picked.id, kid.id, day, t);
                 schedule.push({
                    id: safeUUID(), day, timeSlot: buildTimeSlotRange(anchorStart, anchorDur),
                    trainerId: picked.id, trainerName: picked.name,
                    kidId: kid.id, kidName: kid.name, specialty: Specialty.ABA,
                    sessionType: SessionType.INDIVIDUAL, durationMins: anchorDur, status: SessionStatus.CONFIRMED
                 });
                 
                 const key = `${picked.id}-${day}`;
                 consecutiveSessionsCount.set(key, (consecutiveSessionsCount.get(key)||0)+1);
             }
          }
      }

      // --------------------------------------------------------
      // IN-HOME WITH TRAVEL BUFFER (60 MINS)
      // --------------------------------------------------------
      if (kid.avail.isHome) {
         const durations = getKidMaxDurationChoices(kid);
         for (const dur of durations) {
            let placed = false;
            for (let st = currentTime; st + dur <= endTime; st += 15) {
                
                // ✅ Calculate Travel Buffer
                const bufferStart = st - TRAVEL_BUFFER_MINS;

                const candidates = availableStaff.filter(t => {
                    // 1. Shift MUST cover Travel + Session
                    if (t.shift.start > bufferStart || t.shift.end < st + dur) return false;
                    
                    // 2. Must be free for Travel AND Session
                    if (!isTrainerFreeForDuration(t.id, day, bufferStart, TRAVEL_BUFFER_MINS, isBooked)) return false;
                    if (!isTrainerFreeForDuration(t.id, day, st, dur, isBooked)) return false;

                    if (!isCandidateValid(t, kid, SessionType.HOME)) return false;
                    
                    // No travel buffer check needed here since we explicitly book travel
                    return true;
                });
                
                if (candidates.length > 0) {
                    const picked = candidates[0];

                    // A. Book Travel Tile
                    for (let t = bufferStart; t < st; t+=15) bookTrainerOnly(picked.id, day, t);
                    schedule.push({
                        id: safeUUID(),
                        day,
                        timeSlot: buildTimeSlotRange(bufferStart, TRAVEL_BUFFER_MINS),
                        trainerId: picked.id,
                        trainerName: picked.name,
                        kidId: "ADMIN", // Use ADMIN ID to prevent DB issues
                        kidName: "TRAVEL", // Visible Label
                        specialty: Specialty.ABA,
                        sessionType: SessionType.ADMIN,
                        durationMins: TRAVEL_BUFFER_MINS,
                        status: SessionStatus.CONFIRMED
                    });

                    // B. Book Session
                    for (let t = st; t < st + dur; t += 15) bookMinute(picked.id, kid.id, day, t);
                    schedule.push({
                        id: safeUUID(),
                        day,
                        timeSlot: buildTimeSlotRange(st, dur),
                        trainerId: picked.id,
                        trainerName: picked.name,
                        kidId: kid.id,
                        kidName: kid.name,
                        specialty: Specialty.ABA,
                        sessionType: SessionType.HOME,
                        durationMins: dur,
                        status: SessionStatus.CONFIRMED
                    });

                    placed = true;
                    break;
                }
            }
            if (placed) break; 
         }
         continue; 
      }

      // --- CLINIC LOOP ---
      while (currentTime < endTime) {
        
        if (isBooked(kid.id, day, currentTime)) {
            currentTime += 15;
            continue;
        }

        let bestDuration = 60;
        
        if (is120MinProtocol) {
            bestDuration = 90; // Fillers are 90 mins for these kids
        } else {
            const remaining = endTime - currentTime;
            let maxAllowedDuration = remaining;
            if (isFirstSession && currentTime < CONSTRAINT_10_AM_MINS) {
                const timeTo10 = CONSTRAINT_10_AM_MINS - currentTime;
                maxAllowedDuration = Math.min(remaining, timeTo10);
            }
            const validDurations = getKidMaxDurationChoices(kid).filter(d => d <= maxAllowedDuration);
            if (validDurations.length > 0) bestDuration = Math.max(...validDurations);
            else {
                if (maxAllowedDuration >= 30) bestDuration = maxAllowedDuration; 
                else { currentTime += 15; continue; }
            }
        }

        const candidates = availableStaff.filter(t => {
            if (t.shift.start > currentTime || t.shift.end < currentTime + bestDuration) return false;
            if (!isTrainerFreeForDuration(t.id, day, currentTime, bestDuration, isBooked)) return false;
            if (!isCandidateValid(t, kid, SessionType.INDIVIDUAL)) return false;
            
            const fatigueKey = `${t.id}-${day}`;
            if (currentTime < (fatiguedUntil.get(fatigueKey) || 0)) return false;

            const sessionsDone = consecutiveSessionsCount.get(fatigueKey) || 0;
            const breaksDone = breaksUsedToday.get(fatigueKey) || 0;
            if (sessionsDone >= MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK && breaksDone < BREAKS_MAX_PER_DAY) {
                const minsRemainingInShift = t.shift.end - currentTime;
                if (minsRemainingInShift > MIN_TIME_REMAINING_FOR_BREAK) return false; 
            }

            const weekMins = weeklyWorkloadMinutes.get(t.id) || 0;
            const maxWeek = (t.maxHoursPerWeek || 0) * 60;
            if (maxWeek > 0 && weekMins + bestDuration > maxWeek) return false;

            return true;
        });

        // SHUFFLE & ROTATE
        const freshCandidates = candidates.filter(t => t.id !== lastTrainerId);
        const repeatCandidates = candidates.filter(t => t.id === lastTrainerId);
        const pool = freshCandidates.length > 0 ? freshCandidates : repeatCandidates;

        pool.sort((a, b) => {
            const ftA = isFullTime(a) ? 1 : 0;
            const ftB = isFullTime(b) ? 1 : 0;
            if (ftA !== ftB) return ftB - ftA;
            return Math.random() - 0.5; 
        });

        if (pool.length > 0) {
            const picked = pool[0];
            lastTrainerId = picked.id; 

            for (let t = currentTime; t < currentTime + bestDuration; t += 15) {
                bookMinute(picked.id, kid.id, day, t);
            }

            schedule.push({
                id: safeUUID(), day, timeSlot: buildTimeSlotRange(currentTime, bestDuration),
                trainerId: picked.id, trainerName: picked.name, kidId: kid.id, kidName: kid.name,
                specialty: Specialty.ABA, sessionType: SessionType.INDIVIDUAL, durationMins: bestDuration, status: SessionStatus.CONFIRMED
            });

            isFirstSession = false;

            const key = `${picked.id}-${day}`;
            const newCount = (consecutiveSessionsCount.get(key) || 0) + 1;
            consecutiveSessionsCount.set(key, newCount);
            lastLocations.set(picked.id, { time: currentTime + bestDuration, location: "CLINIC" });

            const breaks = breaksUsedToday.get(key) || 0;
            if (newCount >= MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK && breaks < BREAKS_MAX_PER_DAY) {
                const breakStart = currentTime + bestDuration;
                const trainerShiftEnd = picked.shift.end;
                const minsRemainingInShift = trainerShiftEnd - breakStart;
                
                if (minsRemainingInShift > MIN_TIME_REMAINING_FOR_BREAK) {
                    const duration = BREAK_DURATION;
                    if (isTrainerFreeForDuration(picked.id, day, breakStart, duration, isBooked)) {
                        for (let t = breakStart; t < breakStart + duration; t+=15) bookTrainerOnly(picked.id, day, t);
                        
                        schedule.push({
                            id: safeUUID(), day, timeSlot: buildTimeSlotRange(breakStart, duration),
                            trainerId: picked.id, trainerName: picked.name, kidId: "BREAK", kidName: "BREAK",
                            specialty: Specialty.ABA, sessionType: SessionType.BREAK, durationMins: duration, status: SessionStatus.CONFIRMED
                        });

                        consecutiveSessionsCount.set(key, 0);
                        breaksUsedToday.set(key, breaks + 1);
                        fatiguedUntil.set(key, breakStart + duration);
                    }
                } else {
                    consecutiveSessionsCount.set(key, 0);
                }
            }
            currentTime += bestDuration;

        } else {
            // RUBBER-BANDING
            let gapFilled = false;
            const lastSessionIndex = schedule.findIndex(s => s.kidId === kid.id && s.day === day && parseTimeStr(s.timeSlot) + s.durationMins === currentTime);

            if (lastSessionIndex !== -1) {
                const lastSession = schedule[lastSessionIndex];
                const trainer = activeTrainers.find(t => t.id === lastSession.trainerId);
                const extendBy = 15;
                const newDuration = lastSession.durationMins + extendBy;
                const newEndTime = currentTime + extendBy;

                if (trainer) {
                   const shiftRaw = getDayStringOrValueFromShifts(trainer.shifts, day);
                   const shift = parseShift(shiftRaw);
                   const isShiftValid = shift && shift.end >= newEndTime;
                   const isTrainerFree = !isBooked(trainer.id, day, currentTime); 
                   const isWithinMaxDaily = ((dailyWorkloadMinutes.get(`${trainer.id}-${day}`) || 0) + extendBy) <= ((trainer.maxDailyHours || 8) * 60);

                   if (isShiftValid && isTrainerFree && isWithinMaxDaily) {
                       bookMinute(trainer.id, kid.id, day, currentTime);
                       schedule[lastSessionIndex] = {
                           ...lastSession, durationMins: newDuration,
                           timeSlot: buildTimeSlotRange(parseTimeStr(lastSession.timeSlot), newDuration)
                       };
                       weeklyWorkloadMinutes.set(trainer.id, (weeklyWorkloadMinutes.get(trainer.id) || 0) + extendBy);
                       dailyWorkloadMinutes.set(`${trainer.id}-${day}`, (dailyWorkloadMinutes.get(`${trainer.id}-${day}`) || 0) + extendBy);
                       lastLocations.set(trainer.id, { time: newEndTime, location: "CLINIC" });
                       currentTime += extendBy;
                       gapFilled = true;
                   }
                }
            }
            if (!gapFilled) {
                currentTime += 15;
            }
        }
      }
    }
  }

  // ==========================================================================
  // POST-PROCESSING: CLEANUP OFFICE WORK
  // ==========================================================================
  for (const day of ALL_DAYS) {
      for (const trainer of activeTrainers) {
          const shiftRaw = getDayStringOrValueFromShifts(trainer.shifts, day);
          const shift = parseShift(shiftRaw);
          if (!shift) continue;

          const sessions = schedule.filter(s => s.day === day && s.trainerId === trainer.id);
          if (sessions.length === 0) continue;

          sessions.sort((a,b) => parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot));
          
          const lastSession = sessions[sessions.length - 1];
          if (lastSession.sessionType === SessionType.BREAK) {
              const newDuration = shift.end - parseTimeStr(lastSession.timeSlot);
              lastSession.sessionType = SessionType.ADMIN;
              lastSession.kidName = "OFFICE WORK";
              lastSession.kidId = "OFFICE";
              lastSession.durationMins = newDuration;
              lastSession.timeSlot = buildTimeSlotRange(parseTimeStr(lastSession.timeSlot), newDuration);
          }
      }
  }

  schedule.sort((a, b) => {
    const dDiff = ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    return parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot);
  });

  return schedule;
};