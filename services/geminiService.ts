import { Trainer, Kid, ScheduleItem, DayOfWeek, SessionType, SessionStatus, Specialty } from "../types";
import { apiService } from "./apiService";

// ============================================================================
// PART 1: HELPER FUNCTIONS (Time & Parsing)
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

const parseShift = (timeStr?: string): { start: number; end: number; isHome?: boolean } | null => {
  if (!timeStr || timeStr === "OFF" || timeStr === "X") return null;

  let isHome = false;
  let cleanStr = timeStr;

  if (timeStr.includes("In home") || timeStr.includes("HOM")) {
    isHome = true;
    cleanStr = timeStr.replace(/In home|HOM/g, "").trim();
  }

  if (cleanStr.includes("&")) {
    cleanStr = cleanStr.split("&")[0].trim();
  }

  const parts = cleanStr.split("-").map((s) => s.trim());
  if (parts.length < 2) return null;

  const start = parseTimeStr(parts[0]);
  const end = parseTimeStr(parts[1]);

  if (start >= end) return null;
  return { start, end, isHome };
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
// PART 2: ADVANCED SCORING & VALIDATION
// ============================================================================

type LocationTracker = Map<string, { time: number; location: "CLINIC" | "HOME"; zip?: string }>;

const TRAVEL_BUFFER_MINS = 30;

// Session timing constraints
const MIN_SESSION_MINS = 60;
const MAX_SESSION_MINS = 120;
const DURATION_CHOICES = [MAX_SESSION_MINS, MIN_SESSION_MINS] as const;

// Full-time first (DB driven)
const isFullTime = (trainer: Trainer) => (trainer as any).is_full_time === true;

// 🔥 NEW CONSTRAINT: force rotation (don’t repeat same kid back-to-back for a trainer)
const ROTATE_KID_AFTER_SESSION = true;

const isCandidateValid = (
  trainer: Trainer,
  kid: Kid,
  sessionType: SessionType,
  time: number,
  duration: number,
  trainerHistory: Set<string>,
  lastLocations: LocationTracker,
  lastKidForTrainer: Map<string, string>
): boolean => {
  const rules = trainer.rules || {};

  // 0. Rotation Constraint: Trainer should not get same kid back-to-back
  if (ROTATE_KID_AFTER_SESSION) {
    const lastKid = lastKidForTrainer.get(trainer.id);
    if (lastKid && lastKid === kid.id) return false;
  }

  // 1. Gender Block
  if (trainer.excludeClientGender && kid.gender) {
    if (trainer.excludeClientGender === kid.gender) return false;
  }

  // 2. In-Home Constraints
  if (sessionType === SessionType.HOME) {
    if (kid.inHomeAllowedStaffIds && kid.inHomeAllowedStaffIds.length > 0) {
      if (!kid.inHomeAllowedStaffIds.includes(trainer.id)) return false;
    }
  }

  // 3. Conflict History
  if (kid.conflictHistoryKids && kid.conflictHistoryKids.length > 0) {
    for (const avoidId of kid.conflictHistoryKids) {
      if (trainerHistory.has(avoidId)) return false;
    }
  }

  // 4. TRAVEL TIME CHECK (Home <-> Clinic)
  const lastLoc = lastLocations.get(trainer.id);
  if (lastLoc) {
    const isCurrentHome = sessionType === SessionType.HOME;
    const wasHome = lastLoc.location === "HOME";

    if (isCurrentHome !== wasHome) {
      const gap = time - lastLoc.time;
      if (gap < TRAVEL_BUFFER_MINS) return false;
    }
  }

  return true;
};

const calculateScore = (
  trainer: Trainer,
  kid: Kid,
  time: number,
  incumbentId: string | undefined,
  minutesWorked: number
): number => {
  let score = 100;

  // 1. CONTINUITY
  if (trainer.id === incumbentId) score += 50;

  // 2. PREFERENCE
  if (kid.inHomeAllowedStaffIds?.includes(trainer.id)) score += 20;

  // 3. WORKLOAD BALANCING
  score -= (minutesWorked / 60) * 5;

  // 4. ROLE MATCHING
  if (trainer.clinicalRole === "RBT") score += 5;

  return score;
};

// Randomize only among top-scoring ties
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

// Full-time first wrapper
const pickFullTimeFirst = (candidates: Trainer[], getScore: (t: Trainer) => number) => {
  const fullTimers = candidates.filter(isFullTime);
  const partTimers = candidates.filter((t) => !isFullTime(t));

  return pickBestWithTieBreak(fullTimers.length > 0 ? fullTimers : partTimers, getScore);
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
// PART 3: SCHEDULER ENGINE (Rotation Enabled)
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

  // minutes worked per trainer
  const dailyWorkload = new Map<string, number>();

  const bookMinute = (trainerId: string, kidId: string, day: DayOfWeek, t: number) => {
    bookedMap.add(`${trainerId}-${day}-${t}`);
    bookedMap.add(`${kidId}-${day}-${t}`);
    dailyWorkload.set(trainerId, (dailyWorkload.get(trainerId) || 0) + 1);
  };

  const isBooked = (id: string, day: DayOfWeek, t: number) => {
    return bookedMap.has(`${id}-${day}-${t}`);
  };

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

    // prevent mixing home kids into clinic sessions
    const homeKidsScheduled = new Set<string>();

    // 🔥 Track last kid per trainer for rotation
    const lastKidForTrainer = new Map<string, string>();

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

    // ---------------- PHASE 1: HOME SESSIONS ----------------
    kidsToday.sort((a, b) => a.avail.start - b.avail.start);

    for (const kid of kidsToday) {
      if (!(kid.avail.isHome || isWeekend)) continue;

      const availDuration = kid.avail.end - kid.avail.start;
      if (availDuration < MIN_SESSION_MINS) continue;

      const sessionStart = kid.avail.start;

      for (const duration of DURATION_CHOICES) {
        const sessionEnd = sessionStart + duration;
        if (sessionEnd > kid.avail.end) continue;

        let candidates = availableStaff.filter(
          (staff) =>
            staff.shift.start <= sessionStart &&
            staff.shift.end >= sessionEnd &&
            isTrainerFreeForDuration(staff.id, day, sessionStart, duration, isBooked) &&
            isKidFreeForDuration(kid.id, day, sessionStart, duration, isBooked)
        );

        candidates = candidates.filter((staff) =>
          isCandidateValid(
            staff,
            kid,
            SessionType.HOME,
            sessionStart,
            duration,
            getTrainerDayHistory(day, staff.id),
            lastLocations,
            lastKidForTrainer
          )
        );

        const selected = pickFullTimeFirst(candidates, (t) =>
          calculateScore(t, kid, sessionStart, undefined, dailyWorkload.get(t.id) || 0)
        );

        if (!selected) continue;

        for (let t = sessionStart; t < sessionEnd; t += 15) {
          bookMinute(selected.id, kid.id, day, t);
        }

        getTrainerDayHistory(day, selected.id).add(kid.id);
        lastLocations.set(selected.id, { time: sessionEnd, location: "HOME" });

        // 🔥 Update rotation tracker
        lastKidForTrainer.set(selected.id, kid.id);

        schedule.push({
          id: crypto.randomUUID(),
          day,
          timeSlot: formatTime(sessionStart),
          trainerId: selected.id,
          trainerName: selected.name,
          kidId: kid.id,
          kidName: kid.name,
          specialty: Specialty.ABA,
          sessionType: SessionType.HOME,
          durationMins: duration,
          status: SessionStatus.CONFIRMED,
        });

        homeKidsScheduled.add(kid.id);
        break;
      }
    }

    if (isWeekend) continue;

    // ---------------- PHASE 2: CLINIC SESSIONS ----------------
    const clinicKids = kidsToday.filter((k) => !k.avail.isHome && !homeKidsScheduled.has(k.id));
    const clinicStaff = availableStaff.filter((t) => !t.shift.isHome);

    const kidIncumbents = new Map<string, string>();
    const consecutiveMinutes = new Map<string, number>();

    for (let time = 465; time < 1080; time += MIN_SESSION_MINS) {
      const isCircleTime = time >= 540 && time < 600;

      const kidsPresent = clinicKids.filter((k) => time >= k.avail.start && time < k.avail.end);

      for (const kid of kidsPresent) {
        if (isBooked(kid.id, day, time)) continue;

        let limit = kid.maxSessionMins || 120;
        if (kid.name.includes("Massimilliano")) limit = 60;

        const incumbentId = kidIncumbents.get(kid.id);
        const currentDuration = consecutiveMinutes.get(kid.id) || 0;

        let selectedTrainer: Trainer | null = null;
        let selectedDuration = MIN_SESSION_MINS;

        for (const duration of DURATION_CHOICES) {
          const endTime = time + duration;

          if (endTime > kid.avail.end) continue;
          if (currentDuration + duration > limit) continue;

          // 1) Try to keep incumbent (ONLY if rotation allows it)
          if (incumbentId) {
            const incumbent = clinicStaff.find((t) => t.id === incumbentId);
            if (
              incumbent &&
              time >= incumbent.shift.start &&
              endTime <= incumbent.shift.end &&
              isTrainerFreeForDuration(incumbent.id, day, time, duration, isBooked) &&
              isKidFreeForDuration(kid.id, day, time, duration, isBooked) &&
              isCandidateValid(
                incumbent,
                kid,
                SessionType.INDIVIDUAL,
                time,
                duration,
                getTrainerDayHistory(day, incumbent.id),
                lastLocations,
                lastKidForTrainer
              )
            ) {
              selectedTrainer = incumbent;
              selectedDuration = duration;
              break;
            }
          }

          // 2) Pick best candidate (full-time first)
          let candidates = clinicStaff.filter(
            (t) =>
              time >= t.shift.start &&
              endTime <= t.shift.end &&
              t.id !== incumbentId &&
              isTrainerFreeForDuration(t.id, day, time, duration, isBooked) &&
              isKidFreeForDuration(kid.id, day, time, duration, isBooked)
          );

          candidates = candidates.filter((t) =>
            isCandidateValid(
              t,
              kid,
              SessionType.INDIVIDUAL,
              time,
              duration,
              getTrainerDayHistory(day, t.id),
              lastLocations,
              lastKidForTrainer
            )
          );

          const picked = pickFullTimeFirst(candidates, (t) =>
            calculateScore(t, kid, time, incumbentId, dailyWorkload.get(t.id) || 0)
          );

          if (picked) {
            selectedTrainer = picked;
            selectedDuration = duration;
            break;
          }
        }

        if (selectedTrainer) {
          const endTime = time + selectedDuration;

          for (let t = time; t < endTime; t += 15) {
            bookMinute(selectedTrainer.id, kid.id, day, t);
          }

          kidIncumbents.set(kid.id, selectedTrainer.id);
          getTrainerDayHistory(day, selectedTrainer.id).add(kid.id);

          lastLocations.set(selectedTrainer.id, { time: endTime, location: "CLINIC" });

          const current = consecutiveMinutes.get(kid.id) || 0;
          consecutiveMinutes.set(kid.id, current + selectedDuration);

          // 🔥 Update rotation tracker
          lastKidForTrainer.set(selectedTrainer.id, kid.id);

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
// PART 4: SUPABASE INTEGRATION
// ============================================================================

export const runAutoScheduler = async (targetDay: DayOfWeek) => {
  console.log(`🚀 Starting Advanced Scheduler for ${targetDay}...`);

  try {
    const [trainers, kids, currentSchedule] = await Promise.all([
      apiService.fetchTrainers(),
      apiService.fetchKids(),
      apiService.fetchSchedule(),
    ]);

    const newSchedule = await generateSchedule(trainers, kids, currentSchedule, []);

    await apiService.saveSchedule(newSchedule);

    console.log(`✅ Schedule saved! Generated ${newSchedule.length} sessions.`);
    return { success: true, count: newSchedule.length };
  } catch (error) {
    console.error("Scheduler failed:", error);
    return { success: false, error };
  }
};
