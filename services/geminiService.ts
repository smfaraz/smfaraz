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
const TRAVEL_BUFFER_MINS = 30; 
const MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK = 2; // Strict limit
const BREAKS_MAX_PER_DAY = 1;

// If less than 45 mins remain in shift, don't force a break.
const MIN_TIME_REMAINING_FOR_BREAK = 45; 

const CLINIC_DAY_START = 465; // 7:45 AM
const CLINIC_DAY_END = 1110;  // 6:30 PM

const CONSTRAINT_10_AM_MINS = 600; 

// ============================================================================
// UTILITIES
// ============================================================================
const safeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const parseTimeStr = (t: string): number => {
  if (!t) return 0;
  const cleanStr = t.replace(/HOM|IN HOME|In-home|In-center/gi, "").trim();
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
// VALIDATION & HELPERS
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

const respectsTravelBuffer = (
  trainerId: string,
  startTime: number,
  sessionType: SessionType,
  lastLocations: LocationTracker
) => {
  const last = lastLocations.get(trainerId);
  if (!last) return true;
  const currentLoc = sessionType === SessionType.HOME ? "HOME" : "CLINIC";
  if (last.location !== currentLoc) {
      const gap = startTime - last.time;
      return gap >= TRAVEL_BUFFER_MINS;
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

  // Seed existing schedule
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
      let lastTrainerId: string | null = null; // ✅ Track previous trainer to shuffle

      // --- IN-HOME ---
      if (kid.avail.isHome) {
         const durations = getKidMaxDurationChoices(kid);
         for (const dur of durations) {
            let placed = false;
            for (let st = currentTime; st + dur <= endTime; st += 15) {
                const candidates = availableStaff.filter(t => {
                    if (t.shift.start > st || t.shift.end < st + dur) return false;
                    if (!isTrainerFreeForDuration(t.id, day, st, dur, isBooked)) return false;
                    if (!isCandidateValid(t, kid, SessionType.HOME)) return false;
                    if (!respectsTravelBuffer(t.id, st, SessionType.HOME, lastLocations)) return false;
                    return true;
                });
                
                if (candidates.length > 0) {
                    const picked = candidates[0];
                    for (let t = st; t < st + dur; t += 15) bookMinute(picked.id, kid.id, day, t);
                    for (let t = st - TRAVEL_BUFFER_MINS; t < st; t+=15) bookTrainerOnly(picked.id, day, t);
                    for (let t = st + dur; t < st + dur + TRAVEL_BUFFER_MINS; t+=15) bookTrainerOnly(picked.id, day, t);

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

      // --- CLINIC ---
      while (currentTime < endTime) {
        
        let bestDuration = 60;
        const remaining = endTime - currentTime;

        // 10 AM Constraint
        let maxAllowedDuration = remaining;
        if (isFirstSession && currentTime < CONSTRAINT_10_AM_MINS) {
            const timeTo10 = CONSTRAINT_10_AM_MINS - currentTime;
            maxAllowedDuration = Math.min(remaining, timeTo10);
        }

        const validDurations = getKidMaxDurationChoices(kid).filter(d => d <= maxAllowedDuration);
        if (validDurations.length > 0) bestDuration = Math.max(...validDurations);
        else {
             if (maxAllowedDuration >= 30) bestDuration = maxAllowedDuration; 
             else break; 
        }

        const candidates = availableStaff.filter(t => {
            // 1. Basic Validity
            if (t.shift.start > currentTime || t.shift.end < currentTime + bestDuration) return false;
            if (!isTrainerFreeForDuration(t.id, day, currentTime, bestDuration, isBooked)) return false;
            if (!isCandidateValid(t, kid, SessionType.INDIVIDUAL)) return false;
            
            const fatigueKey = `${t.id}-${day}`;
            
            // 2. Strict Fatigue Check: Are they currently on a mandatory break?
            if (currentTime < (fatiguedUntil.get(fatigueKey) || 0)) return false;

            // 3. 🔥 CRITICAL BREAK ENFORCEMENT: 
            // If they have hit the limit, they CANNOT be a candidate unless it's end of shift.
            const sessionsDone = consecutiveSessionsCount.get(fatigueKey) || 0;
            const breaksDone = breaksUsedToday.get(fatigueKey) || 0;
            
            if (sessionsDone >= MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK && breaksDone < BREAKS_MAX_PER_DAY) {
                const minsRemainingInShift = t.shift.end - currentTime;
                
                // If they have substantial time left, they MUST take a break now.
                // Therefore, they are NOT a candidate for a kid session.
                if (minsRemainingInShift > MIN_TIME_REMAINING_FOR_BREAK) {
                    return false;
                }
                // If < 45 mins left, we allow them to power through (End of Day exception)
            }

            // 4. Workload Check
            const weekMins = weeklyWorkloadMinutes.get(t.id) || 0;
            const maxWeek = (t.maxHoursPerWeek || 0) * 60;
            if (maxWeek > 0 && weekMins + bestDuration > maxWeek) return false;

            return true;
        });

        // ✅ 5. SHUFFLE / ROTATION LOGIC
        candidates.sort((a, b) => {
            // A. Avoid immediate repeats (Burnout Prevention)
            const isRepeatA = a.id === lastTrainerId;
            const isRepeatB = b.id === lastTrainerId;
            if (isRepeatA && !isRepeatB) return 1; // A is repeat, push down
            if (!isRepeatA && isRepeatB) return -1; // B is repeat, push down

            // B. Priority: Full Time Staff
            const ftA = isFullTime(a) ? 1 : 0;
            const ftB = isFullTime(b) ? 1 : 0;
            if (ftA !== ftB) return ftB - ftA;

            // C. Randomness
            return Math.random() - 0.5; 
        });

        if (candidates.length > 0) {
            const picked = candidates[0];
            lastTrainerId = picked.id; // ✅ Update last trainer

            for (let t = currentTime; t < currentTime + bestDuration; t += 15) {
                bookMinute(picked.id, kid.id, day, t);
            }

            schedule.push({
                id: safeUUID(),
                day,
                timeSlot: buildTimeSlotRange(currentTime, bestDuration),
                trainerId: picked.id,
                trainerName: picked.name,
                kidId: kid.id,
                kidName: kid.name,
                specialty: Specialty.ABA,
                sessionType: SessionType.INDIVIDUAL,
                durationMins: bestDuration,
                status: SessionStatus.CONFIRMED
            });

            isFirstSession = false;

            const key = `${picked.id}-${day}`;
            const newCount = (consecutiveSessionsCount.get(key) || 0) + 1;
            consecutiveSessionsCount.set(key, newCount);
            lastLocations.set(picked.id, { time: currentTime + bestDuration, location: "CLINIC" });

            // ✅ TRIGGER BREAK / ADMIN
            const breaks = breaksUsedToday.get(key) || 0;

            if (newCount >= MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK && breaks < BREAKS_MAX_PER_DAY) {
                const breakStart = currentTime + bestDuration;
                const trainerShiftEnd = picked.shift.end;
                const minsRemainingInShift = trainerShiftEnd - breakStart;
                
                // Only insert break if NOT end of day
                if (minsRemainingInShift > MIN_TIME_REMAINING_FOR_BREAK) {
                    // Logic: Is it End of Day?
                    let isEndOfDay = false;
                    if (breakStart + BREAK_DURATION >= trainerShiftEnd - 15) isEndOfDay = true;

                    const sessionType = isEndOfDay ? SessionType.ADMIN : SessionType.BREAK;
                    const sessionName = isEndOfDay ? "Admin / Cleaning" : "BREAK";
                    const kidName = isEndOfDay ? "ADMIN" : "BREAK";
                    
                    const duration = isEndOfDay ? Math.min(minsRemainingInShift, 60) : BREAK_DURATION;

                    if (duration > 0 && isTrainerFreeForDuration(picked.id, day, breakStart, duration, isBooked)) {
                        for (let t = breakStart; t < breakStart + duration; t+=15) bookTrainerOnly(picked.id, day, t);
                        
                        schedule.push({
                            id: safeUUID(),
                            day,
                            timeSlot: buildTimeSlotRange(breakStart, duration),
                            trainerId: picked.id,
                            trainerName: picked.name,
                            kidId: kidName,
                            kidName: kidName,
                            specialty: Specialty.ABA,
                            sessionType: sessionType,
                            durationMins: duration,
                            status: SessionStatus.CONFIRMED
                        });

                        consecutiveSessionsCount.set(key, 0);
                        breaksUsedToday.set(key, breaks + 1);
                        fatiguedUntil.set(key, breakStart + duration);
                    }
                } else {
                    // Reset count to allow them to finish shift
                    consecutiveSessionsCount.set(key, 0);
                }
            }
            currentTime += bestDuration;

        } else {
            // RUBBER-BANDING
            let gapFilled = false;
            
            const lastSessionIndex = schedule.findIndex(s => 
                s.kidId === kid.id && 
                s.day === day && 
                parseTimeStr(s.timeSlot) + s.durationMins === currentTime
            );

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
                   // Rubber banding ignores fatigue momentarily to fill a small gap
                   const isWithinMaxDaily = ((dailyWorkloadMinutes.get(`${trainer.id}-${day}`) || 0) + extendBy) <= ((trainer.maxDailyHours || 8) * 60);

                   if (isShiftValid && isTrainerFree && isWithinMaxDaily) {
                       bookMinute(trainer.id, kid.id, day, currentTime);
                       schedule[lastSessionIndex] = {
                           ...lastSession,
                           durationMins: newDuration,
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
                console.log(`⚠️ Unfillable Gap for ${kid.name} at ${formatTime(currentTime)}`);
                currentTime += 15;
            }
        }
      }
    }
  }

  const dayOrder = enumValues<DayOfWeek>(DayOfWeek);
  schedule.sort((a, b) => {
    const dDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    return parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot);
  });

  return schedule;
};