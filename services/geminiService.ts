import { Trainer, Kid, ScheduleItem, DayOfWeek, SessionType, SessionStatus, Specialty } from "../types";
import { apiService } from "./apiService";

// ============================================================================
// CONFIG
// ============================================================================
const DURATION_CHOICES = [120, 90, 60] as const;
const BREAK_DURATION = 30;
const TRAVEL_BUFFER_MINS = 30;
const MAX_BURNOUT_MINS = 120;

// ============================================================================
// UTILITIES (TIME, SHUFFLE, UUID, ENUM HELPERS)
// ============================================================================
const safeUUID = () =>
  (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// parseTimeStr supports "09:00 AM" or "09:00 AM - 10:00 AM"
const parseTimeStr = (t: string): number => {
  if (!t) return 0;
  const startOnly = t.includes(" - ") ? t.split(" - ")[0].trim() : t.trim();
  const upper = startOnly.toUpperCase();
  const isPM = upper.includes("PM");
  const isAM = upper.includes("AM");
  const clean = upper.replace(/AM|PM/g, "").trim();
  let [h, m] = clean.split(":").map((n) => Number(n));
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

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  return aStart < bEnd && bStart < aEnd;
};

// Enum helpers (works for numeric & string enums)
const enumNames = (e: any) => Object.keys(e).filter((k) => isNaN(Number(k)));
const enumValues = <T>(e: any): T[] => enumNames(e).map((n) => e[n]) as T[];

// Get enum name from value
const enumNameFromValue = (e: any, value: any): string | undefined => {
  for (const k of enumNames(e)) {
    if (e[k] === value) return k;
  }
  return undefined;
};

// ============================================================================
// PARSING SHIFTS & AVAILABILITIES (robust to formats like "9:00-12:00 & 1:00-5:00", "IN HOME 9-12")
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

  const blocks = clean.split("&").map((b) => b.trim()).filter(Boolean);
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

// Helper to retrieve a shift/availability entry for an entity that might store keys as enum names or enum values
const getDayStringOrValueFromShifts = (shiftsObj: any, dayValue: any) => {
  if (!shiftsObj) return undefined;
  // Direct lookup (works if shifts keyed by enum value)
  if (shiftsObj[dayValue] !== undefined) return shiftsObj[dayValue];
  // Try lookup by enum name (works if shifts keyed by strings like "MON")
  const dayName = enumNameFromValue(DayOfWeek, dayValue);
  if (dayName && shiftsObj[dayName] !== undefined) return shiftsObj[dayName];
  // Try lowercase name
  if (dayName && shiftsObj[dayName.toLowerCase()] !== undefined) return shiftsObj[dayName.toLowerCase()];
  return undefined;
};

// ============================================================================
// VALIDATION & SCORING
// ============================================================================
type LocationTracker = Map<string, { time: number; location: "CLINIC" | "HOME" }>;

const isFullTime = (trainer: Trainer) => (trainer as any).is_full_time === true;

const respectsTravelBuffer = (trainerId: string, time: number, sessionType: SessionType, lastLocations: LocationTracker) => {
  const last = lastLocations.get(trainerId);
  if (!last) return true;
  const isCurrentHome = sessionType === SessionType.HOME;
  const wasHome = last.location === "HOME";
  const gap = time - last.time;
  if (isCurrentHome !== wasHome && gap < TRAVEL_BUFFER_MINS) return false;
  if (isCurrentHome && wasHome && gap < TRAVEL_BUFFER_MINS) return false;
  return true;
};

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

const calculateScore = (
  trainer: Trainer,
  kid: Kid,
  time: number,
  incumbentId: string | undefined,
  minutesWorked: number,
  trainerHistory: Set<string>,
  sessionType: SessionType
): number => {
  let score = 100;
  score += Math.random() * 8; // small random noise for distribution

  if (trainer.id === incumbentId) score += 50;
  if (isFullTime(trainer)) score += 30;

  if (kid.conflictHistoryKids && kid.conflictHistoryKids.length > 0) {
    for (const avoid of kid.conflictHistoryKids) {
      if (trainerHistory.has(avoid)) score -= 1000;
    }
  }

  if (kid.inHomeAllowedStaffIds?.includes(trainer.id)) score += 20;

  score -= (minutesWorked / 60) * 5;

  if ((trainer as any).clinicalRole === "RBT") score += 5;

  return score;
};

const pickBestWithTieBreak = (candidates: Trainer[], getScore: (t: Trainer) => number) => {
  if (candidates.length === 0) return null;
  const shuffled = shuffle(candidates);
  let bestScore = -Infinity;
  let best: Trainer[] = [];
  for (const c of shuffled) {
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

const isTrainerFreeForDuration = (trainerId: string, day: DayOfWeek, start: number, duration: number, isBooked: (id: string, day: DayOfWeek, t: number) => boolean) => {
  for (let t = start; t < start + duration; t += 15) {
    if (isBooked(trainerId, day, t)) return false;
  }
  return true;
};

const isKidFreeForDuration = (kidId: string, day: DayOfWeek, start: number, duration: number, isBooked: (id: string, day: DayOfWeek, t: number) => boolean) => {
  for (let t = start; t < start + duration; t += 15) {
    if (isBooked(kidId, day, t)) return false;
  }
  return true;
};

// HARD VALIDATOR to catch overlap / invalid duration
const assertScheduleValid = (schedule: ScheduleItem[]) => {
  const trainerSeen = new Set<string>();
  const kidSeen = new Set<string>();
  for (const s of schedule) {
    const start = parseTimeStr(s.timeSlot);
    const end = start + s.durationMins;
    if (end <= start) throw new Error(`Invalid duration for ${s.id}`);
    const isBreak = s.sessionType === SessionType.BREAK;
    if (isBreak) {
      if (s.durationMins !== BREAK_DURATION) throw new Error(`Break must be ${BREAK_DURATION} mins: ${s.id}`);
    } else {
      if (![60, 90, 120].includes(s.durationMins)) throw new Error(`Invalid session duration ${s.durationMins} for ${s.id}`);
    }
    for (let t = start; t < end; t += 15) {
      const tKey = `${s.trainerId}-${s.day}-${t}`;
      if (trainerSeen.has(tKey)) throw new Error(`Trainer overlap: ${tKey}`);
      trainerSeen.add(tKey);
      if (s.kidId && s.kidId !== "BREAK") {
        const kKey = `${s.kidId}-${s.day}-${t}`;
        if (kidSeen.has(kKey)) throw new Error(`Kid overlap: ${kKey}`);
        kidSeen.add(kKey);
      }
    }
  }
};

// ============================================================================
// CORE: generateSchedule (bug-resistant, real-world friendly)
// ============================================================================
export const generateSchedule = async (
  trainers: Trainer[],
  kids: Kid[],
  currentSchedule: ScheduleItem[] = [],
  lockedDays: DayOfWeek[] = [],
  kidsToReschedule: Kid[] = []
): Promise<ScheduleItem[]> => {
  const isRepairMode = kidsToReschedule.length > 0;

  // KEEP current schedule items (manual/locked break etc.)
  const schedule: ScheduleItem[] = [...currentSchedule];

  const activeTrainers = trainers.filter((t) => t.status === "Active");

  const bookedMap = new Set<string>();
  const dailyHistory = new Map<string, Map<string, Set<string>>>(); // dayKey -> trainerId -> Set<kidId>
  const dailyWorkloadMinutes = new Map<string, number>(); // trainerId -> minutes

  const bookMinute = (trainerId: string, kidId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
    bookedMap.add(`${kidId}-${day}-${t}`);
    dailyWorkloadMinutes.set(trainerId, (dailyWorkloadMinutes.get(trainerId) || 0) + 15);
  };
  const bookTrainerOnly = (trainerId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
  };
  const isBooked = (id: string, day: DayOfWeek, t: number) => bookedMap.has(`${id}-${day}-${t}`);

  const getTrainerDayHistory = (day: DayOfWeek, trainerId: string) => {
    const dayKey = String(day);
    if (!dailyHistory.has(dayKey)) dailyHistory.set(dayKey, new Map());
    const map = dailyHistory.get(dayKey)!;
    if (!map.has(trainerId)) map.set(trainerId, new Set());
    return map.get(trainerId)!;
  };

  // Seed bookedMap from currentSchedule
  for (const item of schedule) {
    const start = parseTimeStr(item.timeSlot);
    const end = start + item.durationMins;
    for (let t = start; t < end; t += 15) {
      bookedMap.add(`${item.trainerId}-${item.day}-${t}`);
      if (item.kidId) bookedMap.add(`${item.kidId}-${item.day}-${t}`);
      dailyWorkloadMinutes.set(item.trainerId, (dailyWorkloadMinutes.get(item.trainerId) || 0) + 15);
    }
  }

  // Build week days from enum robustly
  const ALL_DAYS = enumValues<DayOfWeek>(DayOfWeek);

  for (const day of ALL_DAYS) {
    if (lockedDays.includes(day)) continue;

    const lastLocations: LocationTracker = new Map();

    // Seed lastLocations from existing schedule items for that day
    const dayExisting = schedule.filter((s) => s.day === day).slice().sort((a, b) => parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot));
    for (const s of dayExisting) {
      const start = parseTimeStr(s.timeSlot);
      const end = start + s.durationMins;
      lastLocations.set(s.trainerId, { time: end, location: s.sessionType === SessionType.HOME ? "HOME" : "CLINIC" });
    }

    // Resolve trainer shifts for this day (robust lookup for shift key format)
    const availableStaff = activeTrainers
      .map((t) => {
        const raw = getDayStringOrValueFromShifts((t as any).shifts, day);
        const shift = parseShift(raw);
        return shift ? { ...t, shift } : null;
      })
      .filter(Boolean) as (Trainer & { shift: { start: number; end: number; isHome?: boolean } })[];

    // Build kids list for this day (robust)
    let kidsToProcess: any[] = isRepairMode
      ? kidsToReschedule
      : kids
          .map((k) => {
            const raw = getDayStringOrValueFromShifts((k as any).availability, day);
            const avail = parseShift(raw);
            return avail ? { ...k, avail } : null;
          })
          .filter(Boolean);

    if (!isRepairMode) {
      kidsToProcess = kidsToProcess.filter((k) => !schedule.some((s) => s.day === day && s.kidId === k.id));
    }

    // ------------------------------
    // BREAKS (clinic staff only)
    // ------------------------------
    const breaksPerSlot = new Map<number, number>();
    schedule.filter((s) => s.day === day && s.sessionType === SessionType.BREAK).forEach((s) => {
      const start = parseTimeStr(s.timeSlot);
      for (let t = start; t < start + s.durationMins; t += 15) breaksPerSlot.set(t, (breaksPerSlot.get(t) || 0) + 1);
    });

    const clinicStaffForBreaks = availableStaff.filter((t) => !t.shift.isHome);
    for (const staff of shuffle(clinicStaffForBreaks)) {
      const shiftLen = staff.shift.end - staff.shift.start;
      if (shiftLen <= 240) continue;
      const hasBreak = schedule.some((s) => s.day === day && s.trainerId === staff.id && s.sessionType === SessionType.BREAK);
      if (hasBreak) continue;

      let bestSlot = -1;
      let bestScore = -Infinity;
      let earliest = staff.shift.start + 120;
      let latest = staff.shift.end - 45;
      if (earliest >= latest) latest = staff.shift.end - 30;

      for (let t = earliest; t <= latest - BREAK_DURATION; t += 15) {
        if (!isTrainerFreeForDuration(staff.id, day, t, BREAK_DURATION, isBooked)) continue;
        let score = 0;
        if (t >= 660 && t <= 810) score += 20;
        const overlap = Math.max(breaksPerSlot.get(t) || 0, breaksPerSlot.get(t + 15) || 0);
        score -= overlap * 100;
        if (score > bestScore) {
          bestScore = score;
          bestSlot = t;
        }
      }

      if (bestSlot !== -1) {
        for (let t = bestSlot; t < bestSlot + BREAK_DURATION; t += 15) {
          breaksPerSlot.set(t, (breaksPerSlot.get(t) || 0) + 1);
          bookTrainerOnly(staff.id, day, t);
        }
        schedule.push({
          id: safeUUID(),
          day,
          timeSlot: buildTimeSlotRange(bestSlot, BREAK_DURATION),
          trainerId: staff.id,
          trainerName: staff.name,
          kidId: "BREAK",
          kidName: "BREAK",
          specialty: Specialty.ABA,
          sessionType: SessionType.BREAK,
          durationMins: BREAK_DURATION,
          status: SessionStatus.CONFIRMED
        });
      }
    }

    // ------------------------------
    // HOME SESSIONS (respect durations 60/90/120)
    // ------------------------------
    // First schedule kids whose availability indicates home blocks
    const homeKids = kidsToProcess.filter((k: any) => k.avail?.isHome);
    // priority: earliest start first (helps travel sequencing)
    homeKids.sort((a, b) => a.avail.start - b.avail.start);

    for (const kid of homeKids) {
      // For each kid, try to schedule a single session of 60/90/120 inside availability
      let scheduled = false;
      for (const duration of DURATION_CHOICES) {
        const possibleStarts: number[] = [];
        // generate possible start times (every 15 min) within availability that allow duration to fit
        for (let st = kid.avail.start; st + duration <= kid.avail.end; st += 15) possibleStarts.push(st);
        // shuffle starts to vary
        for (const st of shuffle(possibleStarts)) {
          // find trainers who can do a home session that fully covers [st, st+duration)
          let candidates = availableStaff.filter(
            (t) =>
              t.shift.start <= st &&
              t.shift.end >= st + duration &&
              !Array.from({ length: duration / 15 }, (_, i) => st + i * 15).some((tt) => isBooked(t.id, day, tt)) &&
              isCandidateValid(t, kid, SessionType.HOME) &&
              respectsTravelBuffer(t.id, st, SessionType.HOME, lastLocations)
          );
          candidates = shuffle(candidates);
          const picked = pickBestWithTieBreak(candidates, (t) =>
            calculateScore(t, kid, st, undefined, dailyWorkloadMinutes.get(t.id) || 0, getTrainerDayHistory(day, t.id), SessionType.HOME)
          );
          if (picked) {
            for (let tt = st; tt < st + duration; tt += 15) bookMinute(picked.id, kid.id, day, tt);
            getTrainerDayHistory(day, picked.id).add(kid.id);
            lastLocations.set(picked.id, { time: st + duration, location: "HOME" });
            schedule.push({
              id: safeUUID(),
              day,
              timeSlot: buildTimeSlotRange(st, duration),
              trainerId: picked.id,
              trainerName: picked.name,
              kidId: kid.id,
              kidName: kid.name,
              specialty: Specialty.ABA,
              sessionType: SessionType.HOME,
              durationMins: duration,
              status: SessionStatus.CONFIRMED,
              crew: (kid as any).crew
            });
            scheduled = true;
            break;
          }
        }
        if (scheduled) break;
      }
      // note: if not scheduled, we'll leave for clinic/rescue later
    }

    // Remove scheduled home kids from kidsToProcess so clinic phase doesn't attempt them
    kidsToProcess = kidsToProcess.filter((k: any) => !k.avail?.isHome);

    // ------------------------------
    // CLINIC SESSIONS (main engine, 60/90/120 durations)
    // ------------------------------
    const clinicKids = kidsToProcess.filter((k: any) => !k.avail?.isHome);
    const clinicStaff = availableStaff.filter((t) => !t.shift.isHome);

    const kidIncumbents = new Map<string, string>();
    const consecutiveMinutes = new Map<string, number>();

    // window 7:45 (465) to 18:00 (1080)
    for (let time = 465; time < 1080; time += 15) {
      const isCircleTime = time >= 540 && time < 600; // 9:00 - 10:00
      const desiredType = isCircleTime ? SessionType.SOCIAL : SessionType.INDIVIDUAL;

      // kids present at this minute and not booked at this minute
      const kidsPresent = shuffle(
        clinicKids.filter((k: any) => time >= k.avail.start && time < k.avail.end && !isBooked(k.id, day, time))
      );

      for (const kid of kidsPresent) {
        if (isBooked(kid.id, day, time)) continue;

        const incumbentId = kidIncumbents.get(kid.id);
        const currentConsecutive = consecutiveMinutes.get(kid.id) || 0;

        let selectedTrainer: Trainer | null = null;
        let selectedDuration = 60;

        // Try longer durations first (prefer longer contiguous sessions when possible)
        for (const duration of DURATION_CHOICES) {
          const endTime = time + duration;
          if (endTime > kid.avail.end) continue;

          let isIncumbentAllowed = true;
          if (incumbentId && currentConsecutive >= MAX_BURNOUT_MINS) isIncumbentAllowed = false;

          let candidates = clinicStaff.filter(
            (t) =>
              time >= t.shift.start &&
              endTime <= t.shift.end &&
              (isIncumbentAllowed ? true : t.id !== incumbentId) &&
              isTrainerFreeForDuration(t.id, day, time, duration, isBooked) &&
              isKidFreeForDuration(kid.id, day, time, duration, isBooked) &&
              isCandidateValid(t, kid, desiredType) &&
              respectsTravelBuffer(t.id, time, desiredType, lastLocations)
          );

          // Fallback: allow incumbent only if nothing else fits (but must still satisfy travel buffer)
          if (candidates.length === 0 && incumbentId) {
            const inc = clinicStaff.find((t) => t.id === incumbentId);
            if (
              inc &&
              time >= (inc as any).shift.start &&
              endTime <= (inc as any).shift.end &&
              isTrainerFreeForDuration(inc.id, day, time, duration, isBooked) &&
              isKidFreeForDuration(kid.id, day, time, duration, isBooked) &&
              respectsTravelBuffer(inc.id, time, desiredType, lastLocations)
            ) {
              candidates = [inc];
            }
          }

          if (candidates.length === 0) continue;

          // Shuffle then score & pick
          const picked = pickBestWithTieBreak(candidates, (t) =>
            calculateScore(t, kid, time, incumbentId, dailyWorkloadMinutes.get(t.id) || 0, getTrainerDayHistory(day, t.id), desiredType)
          );

          if (picked) {
            selectedTrainer = picked;
            selectedDuration = duration;
            break;
          }
        }

        if (!selectedTrainer) {
          // couldn't find trainer for any duration at this minute
          kidIncumbents.delete(kid.id);
          consecutiveMinutes.set(kid.id, 0);
          continue;
        }

        const endTime = time + selectedDuration;
        // final hard checks
        if (!isTrainerFreeForDuration(selectedTrainer.id, day, time, selectedDuration, isBooked)) continue;
        if (!isKidFreeForDuration(kid.id, day, time, selectedDuration, isBooked)) continue;
        if (!respectsTravelBuffer(selectedTrainer.id, time, desiredType, lastLocations)) continue;

        for (let t = time; t < endTime; t += 15) bookMinute(selectedTrainer.id, kid.id, day, t);

        const isSameTrainer = selectedTrainer.id === incumbentId;
        kidIncumbents.set(kid.id, selectedTrainer.id);
        getTrainerDayHistory(day, selectedTrainer.id).add(kid.id);

        lastLocations.set(selectedTrainer.id, { time: endTime, location: "CLINIC" });

        const newTotal = isSameTrainer ? (consecutiveMinutes.get(kid.id) || 0) + selectedDuration : selectedDuration;
        consecutiveMinutes.set(kid.id, newTotal);

        // Attempt to merge with last schedule item for same trainer+k id contiguous
        const lastItem = schedule.length ? schedule[schedule.length - 1] : undefined;
        if (
          lastItem &&
          lastItem.kidId === kid.id &&
          lastItem.trainerId === selectedTrainer.id &&
          lastItem.day === day &&
          lastItem.sessionType !== SessionType.HOME
        ) {
          const lastStart = parseTimeStr(lastItem.timeSlot);
          if (lastStart + lastItem.durationMins === time) {
            // can extend, but keep duration choices intact => extend in multiples of 15 until it matches 60/90/120
            lastItem.durationMins += selectedDuration;
            // If extension causes duration to go beyond allowed max, it will be caught by final validator
          } else {
            schedule.push({
              id: safeUUID(),
              day,
              timeSlot: buildTimeSlotRange(time, selectedDuration),
              trainerId: selectedTrainer.id,
              trainerName: selectedTrainer.name,
              kidId: kid.id,
              kidName: kid.name,
              specialty: Specialty.ABA,
              sessionType: desiredType,
              durationMins: selectedDuration,
              status: SessionStatus.CONFIRMED,
              crew: (kid as any).crew
            });
          }
        } else {
          schedule.push({
            id: safeUUID(),
            day,
            timeSlot: buildTimeSlotRange(time, selectedDuration),
            trainerId: selectedTrainer.id,
            trainerName: selectedTrainer.name,
            kidId: kid.id,
            kidName: kid.name,
            specialty: Specialty.ABA,
            sessionType: desiredType,
            durationMins: selectedDuration,
            status: SessionStatus.CONFIRMED,
            crew: (kid as any).crew
          });
        }
      } // end for kid
    } // end time loop
  } // end day loop

  // Final sort
  const dayOrder = enumValues<DayOfWeek>(DayOfWeek);
  schedule.sort((a, b) => {
    const dDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    return parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot);
  });

  // Final hard validation
  assertScheduleValid(schedule);

  return schedule;
};

// ============================================================================
// ORCHESTRATOR (REPAIR + DAY/WEEK)
/*
  - Keeps manual & locked & break sessions
  - Deletes only auto sessions for regenerate
*/
// ============================================================================
export const runAutoScheduler = async (
  scope: "DAY" | "WEEK" | "REPAIR",
  targetDate: Date,
  manualItem?: ScheduleItem
) => {
  console.log(`🚀 Starting Scheduler: ${scope}`);

  try {
    const [trainers, kids, currentSchedule] = await Promise.all([
      apiService.fetchTrainers(),
      apiService.fetchKids(),
      apiService.fetchSchedule()
    ]);

    const getDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const targetDateStr = getDateStr(targetDate);

    // --- REPAIR MODE ---
    if (scope === "REPAIR" && manualItem) {
      console.log("🔧 Surgical Repair Mode Active");

      const manualStart = parseTimeStr(manualItem.timeSlot);
      const manualEnd = manualStart + manualItem.durationMins;

      const displacedItems = currentSchedule.filter((item) => {
        if (item.dateStr !== targetDateStr) return false;
        if (item.id === manualItem.id) return false;
        const itemStart = parseTimeStr(item.timeSlot);
        const itemEnd = itemStart + item.durationMins;
        const overlap = overlaps(manualStart, manualEnd, itemStart, itemEnd);
        if (item.trainerId === manualItem.trainerId && overlap) return true;
        if (item.kidId === manualItem.kidId && overlap) return true;
        return false;
      });

      // remove displaced
      await Promise.all(displacedItems.map((i) => apiService.deleteScheduleItem(i.id)));

      const keepers = currentSchedule.filter((item) => {
        if (item.dateStr !== targetDateStr) return true;
        return !displacedItems.find((d) => d.id === item.id);
      });

      const finalKeepers = keepers.filter((k) => k.id !== manualItem.id);
      finalKeepers.push(manualItem);

      const displacedKidIds = new Set(displacedItems.map((i) => i.kidId).filter((id) => id && id !== "BREAK"));
      const kidsToReschedule = kids.filter((k) => displacedKidIds.has(k.id));

      if (kidsToReschedule.length === 0) {
        console.log("✅ No collisions. Manual edit clean.");
        return { success: true };
      }

      console.log(`♻️ Rescheduling ${kidsToReschedule.length} displaced kids...`);

      const newSchedule = await generateSchedule(trainers, kids, finalKeepers, [], kidsToReschedule);
      const itemsToSave = newSchedule.filter((n) => !finalKeepers.find((k) => k.id === n.id));
      await apiService.saveSchedule(itemsToSave);

      return { success: true, count: itemsToSave.length };
    }

    // --- STANDARD MODE ---
    let datesToRegenerate: string[] = [];
    if (scope === "DAY") datesToRegenerate = [getDateStr(targetDate)];
    else if (scope === "WEEK") {
      const start = new Date(targetDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        datesToRegenerate.push(getDateStr(d));
      }
    }

    // Keep manual + locked + breaks
    const itemsToKeep = currentSchedule.filter((item) => {
      if (!datesToRegenerate.includes(item.dateStr || "")) return true;
      return item.isLocked || item.isManuallyEdited || item.sessionType === SessionType.BREAK;
    });

    // Delete only auto sessions (not locked/manual/break)
    const idsToDelete = currentSchedule
      .filter((item) => datesToRegenerate.includes(item.dateStr || "") && !item.isLocked && !item.isManuallyEdited)
      .filter((item) => item.sessionType !== SessionType.BREAK)
      .map((item) => item.id);

    await Promise.all(idsToDelete.map((id) => apiService.deleteScheduleItem(id)));

    const newSchedule = await generateSchedule(trainers, kids, itemsToKeep, []);
    const delta = newSchedule.filter((n) => !itemsToKeep.find((k) => k.id === n.id));
    await apiService.saveSchedule(delta);

    return { success: true, count: delta.length };
  } catch (error) {
    console.error("Scheduler failed:", error);
    return { success: false, error };
  }
};
