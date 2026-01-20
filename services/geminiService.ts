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
// CONFIG
// ============================================================================
const DEFAULT_DURATION_CHOICES = [240, 120, 90, 60] as const;

const BREAK_DURATION = 30;
const TRAVEL_BUFFER_MINS = 60; // 1 hour for HOME
const MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK = 2;
const BREAKS_MAX_PER_DAY = 1;

// Clinic day bounds
const CLINIC_DAY_START = 465; // 7:45 AM
const CLINIC_DAY_END = 1080;  // 6:00 PM

// First clinic session must end by 10:00 AM
const FIRST_SESSION_MUST_END_BY = 600; // 10:00 AM

// ============================================================================
// UTILITIES
// ============================================================================
const safeUUID = () =>
  (globalThis as any).crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

// Enum helpers
const enumNames = (e: any) => Object.keys(e).filter((k) => isNaN(Number(k)));
const enumValues = <T>(e: any): T[] => enumNames(e).map((n) => e[n]) as T[];

const enumNameFromValue = (e: any, value: any): string | undefined => {
  for (const k of enumNames(e)) {
    if (e[k] === value) return k;
  }
  return undefined;
};

// ============================================================================
// PARSING SHIFTS / AVAILABILITY
// Supports: "9:00-12:00 & 1:00-5:00", "IN HOME 4-7"
// NOTE: For KIDS: IN HOME matters (home session)
// NOTE: For TRAINERS: IN HOME should NOT force them home-only (we ignore isHome for trainer shift usage)
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

const getDayStringOrValueFromShifts = (shiftsObj: any, dayValue: any) => {
  if (!shiftsObj) return undefined;
  if (shiftsObj[dayValue] !== undefined) return shiftsObj[dayValue];
  const dayName = enumNameFromValue(DayOfWeek, dayValue);
  if (dayName && shiftsObj[dayName] !== undefined) return shiftsObj[dayName];
  if (dayName && shiftsObj[dayName.toLowerCase()] !== undefined)
    return shiftsObj[dayName.toLowerCase()];
  return undefined;
};

// ============================================================================
// VALIDATION / HELPERS
// ============================================================================
type LocationTracker = Map<string, { time: number; location: "CLINIC" | "HOME" }>;

const isFullTime = (trainer: Trainer) => (trainer as any).is_full_time === true;

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
  const homeInvolved = last.location === "HOME" || currentLoc === "HOME";
  if (!homeInvolved) return true;

  const gap = startTime - last.time;
  return gap >= TRAVEL_BUFFER_MINS;
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

const wouldRepeatSameKidBackToBack = (
  trainerId: string,
  kidId: string,
  day: DayOfWeek,
  startTime: number,
  schedule: ScheduleItem[]
) => {
  const sameTrainerDay = schedule
    .filter((s) => s.day === day && s.trainerId === trainerId && s.kidId && s.kidId !== "BREAK")
    .slice()
    .sort((a, b) => parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot));

  const prev = sameTrainerDay
    .filter((s) => parseTimeStr(s.timeSlot) + s.durationMins <= startTime)
    .slice(-1)[0];

  if (!prev) return false;
  return prev.kidId === kidId;
};

const getKidMaxDurationChoices = (kid: Kid) => {
  const max = Number(kid.sessionDurationMins || 60);
  // allowed: 60/90/120/240 but <= max
  return DEFAULT_DURATION_CHOICES.filter((d) => d <= max);
};

// ============================================================================
// HARD VALIDATOR
// ============================================================================
const assertScheduleValid = (schedule: ScheduleItem[]) => {
  const trainerSeen = new Set<string>();
  const kidSeen = new Set<string>();

  for (const s of schedule) {
    const start = parseTimeStr(s.timeSlot);
    const end = start + s.durationMins;
    if (end <= start) throw new Error(`Invalid duration for ${s.id}`);

    const isBreak = s.sessionType === SessionType.BREAK;
    if (isBreak) {
      if (s.durationMins !== BREAK_DURATION)
        throw new Error(`Break must be ${BREAK_DURATION} mins: ${s.id}`);
    } else {
      if (![60, 90, 120, 240].includes(s.durationMins))
        throw new Error(`Invalid session duration ${s.durationMins} for ${s.id}`);
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
// CORE: generateSchedule
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

  const weeklyWorkloadMinutes = new Map<string, number>(); // trainerId -> mins
  const dailyWorkloadMinutes = new Map<string, number>();  // `${trainerId}-${day}` -> mins

  const consecutiveSessionsCount = new Map<string, number>(); // `${trainerId}-${day}` -> count
  const breaksUsedToday = new Map<string, number>();          // `${trainerId}-${day}` -> breaks count

  const fatiguedUntil = new Map<string, number>();            // `${trainerId}-${day}` -> blocked until

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

  const bookTrainerBlock = (trainerId: string, day: DayOfWeek, start: number, end: number) => {
    const st = clamp(start, 0, 24 * 60);
    const en = clamp(end, 0, 24 * 60);
    for (let t = st; t < en; t += 15) bookTrainerOnly(trainerId, day, t);
  };

  // Seed bookedMap + workloads from currentSchedule
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

    const lastLocations: LocationTracker = new Map();

    const dayExisting = schedule
      .filter((s) => s.day === day)
      .slice()
      .sort((a, b) => parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot));

    for (const s of dayExisting) {
      const start = parseTimeStr(s.timeSlot);
      const end = start + s.durationMins;
      lastLocations.set(s.trainerId, {
        time: end,
        location: s.sessionType === SessionType.HOME ? "HOME" : "CLINIC"
      });
    }

    // Staff shifts
    const availableStaff = activeTrainers
      .map((t) => {
        const raw = getDayStringOrValueFromShifts((t as any).shifts, day);
        const shift = parseShift(raw);
        if (!shift) return null;

        // IMPORTANT: trainer shift is not home-only. ignore shift.isHome
        return { ...t, shift: { start: shift.start, end: shift.end } };
      })
      .filter(Boolean) as (Trainer & { shift: { start: number; end: number } })[];

    // Kids availability
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

    // ======================================================================
    // BREAK INSERTION (mandatory after 2 consecutive sessions, only once/day)
    // ======================================================================
    const tryInsertBreak = (trainer: Trainer, afterTime: number) => {
      const key = `${trainer.id}-${day}`;
      const count = consecutiveSessionsCount.get(key) || 0;
      const used = breaksUsedToday.get(key) || 0;

      if (used >= BREAKS_MAX_PER_DAY) return false;
      if (count < MAX_CONSECUTIVE_SESSIONS_BEFORE_BREAK) return false;

      // Find a break slot soon after, but only if it fits inside shift
      // and doesn't overlap anything
      for (let st = afterTime; st <= afterTime + 180; st += 15) {
        if (!isTrainerFreeForDuration(trainer.id, day, st, BREAK_DURATION, isBooked)) continue;

        // place break
        for (let t = st; t < st + BREAK_DURATION; t += 15) bookTrainerOnly(trainer.id, day, t);

        schedule.push({
          id: safeUUID(),
          day,
          timeSlot: buildTimeSlotRange(st, BREAK_DURATION),
          trainerId: trainer.id,
          trainerName: trainer.name,
          kidId: "BREAK",
          kidName: "BREAK",
          specialty: Specialty.ABA,
          sessionType: SessionType.BREAK,
          durationMins: BREAK_DURATION,
          status: SessionStatus.CONFIRMED
        });

        consecutiveSessionsCount.set(key, 0);
        breaksUsedToday.set(key, used + 1);
        fatiguedUntil.set(key, st + BREAK_DURATION);
        return true;
      }

      // Hard enforcement: block them until they can rest
      fatiguedUntil.set(key, afterTime + BREAK_DURATION);
      return false;
    };

    // ======================================================================
    // PHASE A: CLINIC FIRST SESSION PRIORITY (must end by 10 AM)
    // ======================================================================
    const clinicKids = kidsToProcess.filter((k: any) => !k.avail?.isHome);
    const homeKids = kidsToProcess.filter((k: any) => k.avail?.isHome);

    // Schedule first clinic sessions early
    const clinicKidsEarly = shuffle(clinicKids).sort((a, b) => a.avail.start - b.avail.start);

    for (const kid of clinicKidsEarly) {
      // already scheduled?
      if (schedule.some((s) => s.day === day && s.kidId === kid.id)) continue;

      const choices = getKidMaxDurationChoices(kid);
      if (choices.length === 0) continue;

      // try to place a session that ends by 10
      let placed = false;

      for (const duration of choices) {
        // start must be within availability and end <= 10 AM (priority)
        const latestStart = Math.min(kid.avail.end - duration, FIRST_SESSION_MUST_END_BY - duration);
        for (let st = kid.avail.start; st <= latestStart; st += 15) {
          if (st < CLINIC_DAY_START) continue;
          if (st + duration > CLINIC_DAY_END) continue;

          // pick trainer
          let candidates = availableStaff.filter((t) => {
            if (t.shift.start > st || t.shift.end < st + duration) return false;

            const fatigueKey = `${t.id}-${day}`;
            const blockedUntil = fatiguedUntil.get(fatigueKey) || 0;
            if (st < blockedUntil) return false;

            if (!isTrainerFreeForDuration(t.id, day, st, duration, isBooked)) return false;
            if (!isKidFreeForDuration(kid.id, day, st, duration, isBooked)) return false;

            if (!isCandidateValid(t, kid, SessionType.INDIVIDUAL)) return false;
            if (wouldRepeatSameKidBackToBack(t.id, kid.id, day, st, schedule)) return false;
            if (!respectsTravelBuffer(t.id, st, SessionType.INDIVIDUAL, lastLocations)) return false;

            const weekMins = weeklyWorkloadMinutes.get(t.id) || 0;
            const dayMins = dailyWorkloadMinutes.get(`${t.id}-${day}`) || 0;

            const maxWeek = (t.maxHoursPerWeek || 0) * 60;
            const maxDay = ((t as any).maxDailyHours || 8) * 60;

            if (maxWeek > 0 && weekMins + duration > maxWeek) return false;
            if (maxDay > 0 && dayMins + duration > maxDay) return false;

            return true;
          });

          // prioritize full-time, but allow others
          candidates = candidates.sort((a, b) => Number(isFullTime(b)) - Number(isFullTime(a)));
          const picked = candidates[0];
          if (!picked) continue;

          // book
          for (let t = st; t < st + duration; t += 15) bookMinute(picked.id, kid.id, day, t);

          const key = `${picked.id}-${day}`;
          consecutiveSessionsCount.set(key, (consecutiveSessionsCount.get(key) || 0) + 1);

          lastLocations.set(picked.id, { time: st + duration, location: "CLINIC" });

          schedule.push({
            id: safeUUID(),
            day,
            timeSlot: buildTimeSlotRange(st, duration),
            trainerId: picked.id,
            trainerName: picked.name,
            kidId: kid.id,
            kidName: kid.name,
            specialty: Specialty.ABA,
            sessionType: SessionType.INDIVIDUAL,
            durationMins: duration,
            status: SessionStatus.CONFIRMED
          });

          // break enforcement
          tryInsertBreak(picked, st + duration);

          placed = true;
          break;
        }
        if (placed) break;
      }
    }

    // ======================================================================
    // PHASE B: CLINIC REMAINING SESSIONS (normal)
    // ======================================================================
    for (let time = CLINIC_DAY_START; time < CLINIC_DAY_END; time += 15) {
      const isCircleTime = time >= 540 && time < 600; // 9-10
      const desiredType = isCircleTime ? SessionType.SOCIAL : SessionType.INDIVIDUAL;

      const kidsPresent = shuffle(
        clinicKids.filter((k: any) => time >= k.avail.start && time < k.avail.end && !isBooked(k.id, day, time))
      );

      for (const kid of kidsPresent) {
        if (isBooked(kid.id, day, time)) continue;

        const choices = getKidMaxDurationChoices(kid);
        if (choices.length === 0) continue;

        let chosenTrainer: Trainer | null = null;
        let chosenDuration = 60;

        for (const duration of choices) {
          const endTime = time + duration;
          if (endTime > kid.avail.end) continue;

          let candidates = availableStaff.filter((t) => {
            if (t.shift.start > time || t.shift.end < endTime) return false;

            const fatigueKey = `${t.id}-${day}`;
            const blockedUntil = fatiguedUntil.get(fatigueKey) || 0;
            if (time < blockedUntil) return false;

            if (!isTrainerFreeForDuration(t.id, day, time, duration, isBooked)) return false;
            if (!isKidFreeForDuration(kid.id, day, time, duration, isBooked)) return false;

            if (!isCandidateValid(t, kid, desiredType)) return false;
            if (wouldRepeatSameKidBackToBack(t.id, kid.id, day, time, schedule)) return false;
            if (!respectsTravelBuffer(t.id, time, desiredType, lastLocations)) return false;

            const weekMins = weeklyWorkloadMinutes.get(t.id) || 0;
            const dayMins = dailyWorkloadMinutes.get(`${t.id}-${day}`) || 0;

            const maxWeek = (t.maxHoursPerWeek || 0) * 60;
            const maxDay = ((t as any).maxDailyHours || 8) * 60;

            if (maxWeek > 0 && weekMins + duration > maxWeek) return false;
            if (maxDay > 0 && dayMins + duration > maxDay) return false;

            return true;
          });

          candidates = candidates.sort((a, b) => Number(isFullTime(b)) - Number(isFullTime(a)));
          if (candidates.length === 0) continue;

          chosenTrainer = candidates[0];
          chosenDuration = duration;
          break;
        }

        if (!chosenTrainer) continue;

        for (let t = time; t < time + chosenDuration; t += 15) {
          bookMinute(chosenTrainer.id, kid.id, day, t);
        }

        const key = `${chosenTrainer.id}-${day}`;
        consecutiveSessionsCount.set(key, (consecutiveSessionsCount.get(key) || 0) + 1);

        lastLocations.set(chosenTrainer.id, { time: time + chosenDuration, location: "CLINIC" });

        schedule.push({
          id: safeUUID(),
          day,
          timeSlot: buildTimeSlotRange(time, chosenDuration),
          trainerId: chosenTrainer.id,
          trainerName: chosenTrainer.name,
          kidId: kid.id,
          kidName: kid.name,
          specialty: Specialty.ABA,
          sessionType: desiredType,
          durationMins: chosenDuration,
          status: SessionStatus.CONFIRMED
        });

        tryInsertBreak(chosenTrainer, time + chosenDuration);
      }
    }

    // ======================================================================
    // PHASE C: HOME SESSIONS (after clinic scheduling)
    // ======================================================================
    const homeKidsSorted = homeKids.slice().sort((a: any, b: any) => a.avail.start - b.avail.start);

    for (const kid of homeKidsSorted) {
      let scheduledHome = false;

      const choices = getKidMaxDurationChoices(kid);
      if (choices.length === 0) continue;

      for (const duration of choices) {
        const possibleStarts: number[] = [];
        for (let st = kid.avail.start; st + duration <= kid.avail.end; st += 15) possibleStarts.push(st);

        for (const st of shuffle(possibleStarts)) {
          let candidates = availableStaff.filter((t) => {
            if (t.shift.start > st || t.shift.end < st + duration) return false;

            const fatigueKey = `${t.id}-${day}`;
            const blockedUntil = fatiguedUntil.get(fatigueKey) || 0;
            if (st < blockedUntil) return false;

            if (!isTrainerFreeForDuration(t.id, day, st, duration, isBooked)) return false;
            if (!isKidFreeForDuration(kid.id, day, st, duration, isBooked)) return false;

            if (!isCandidateValid(t, kid, SessionType.HOME)) return false;
            if (wouldRepeatSameKidBackToBack(t.id, kid.id, day, st, schedule)) return false;

            if (!respectsTravelBuffer(t.id, st, SessionType.HOME, lastLocations)) return false;

            const weekMins = weeklyWorkloadMinutes.get(t.id) || 0;
            const dayMins = dailyWorkloadMinutes.get(`${t.id}-${day}`) || 0;

            const maxWeek = (t.maxHoursPerWeek || 0) * 60;
            const maxDay = ((t as any).maxDailyHours || 8) * 60;

            if (maxWeek > 0 && weekMins + duration > maxWeek) return false;
            if (maxDay > 0 && dayMins + duration > maxDay) return false;

            return true;
          });

          candidates = candidates.sort((a, b) => Number(isFullTime(b)) - Number(isFullTime(a)));
          const picked = candidates[0];
          if (!picked) continue;

          // book session minutes
          for (let tt = st; tt < st + duration; tt += 15) bookMinute(picked.id, kid.id, day, tt);

          // travel buffers (trainer-only blocks)
          bookTrainerBlock(picked.id, day, st - TRAVEL_BUFFER_MINS, st);
          bookTrainerBlock(picked.id, day, st + duration, st + duration + TRAVEL_BUFFER_MINS);

          const key = `${picked.id}-${day}`;
          consecutiveSessionsCount.set(key, (consecutiveSessionsCount.get(key) || 0) + 1);

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
            status: SessionStatus.CONFIRMED
          });

          tryInsertBreak(picked, st + duration);

          scheduledHome = true;
          break;
        }

        if (scheduledHome) break;
      }
    }
  }

  // Final sort
  const dayOrder = enumValues<DayOfWeek>(DayOfWeek);
  schedule.sort((a, b) => {
    const dDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dDiff !== 0) return dDiff;
    return parseTimeStr(a.timeSlot) - parseTimeStr(b.timeSlot);
  });

  assertScheduleValid(schedule);
  return schedule;
};

// ============================================================================
// ORCHESTRATOR
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

      await Promise.all(displacedItems.map((i) => apiService.deleteScheduleItem(i.id)));

      const keepers = currentSchedule.filter((item) => {
        if (item.dateStr !== targetDateStr) return true;
        return !displacedItems.find((d) => d.id === item.id);
      });

      const finalKeepers = keepers.filter((k) => k.id !== manualItem.id);
      finalKeepers.push(manualItem);

      const displacedKidIds = new Set(
        displacedItems.map((i) => i.kidId).filter((id) => id && id !== "BREAK")
      );
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

    // Delete only auto sessions
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
