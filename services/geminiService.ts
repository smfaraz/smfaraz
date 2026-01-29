import { Trainer, Kid, ScheduleItem, SessionType, DayOfWeek, SessionStatus, ClinicalRole } from '../types';

// ============================================================================
// 1. HARDCODED MASTER SCHEDULE (The Logic Source)
// ============================================================================
const MASTER_CSV = `
ac,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
3:00-4:00,travel ,travel ,travel ,travel ,travel ,,
4:00-6:00,home session,home session,home session,home session,home session,,
6:00-7:00,,,,,,,
,,,,,,,

af,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1,session 1,session 1,session 1,session 1,,
10:00-11:30,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
11:30-1:00,session 3,session 3,session 3,session 3,session 3,,
1:00-2:00,session 4,session 4,session 4,session 4,session 4,,
2:00-4:00,session 5,session 5,session 5,session 5,session 5,,
,,,,,,,

em,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1 start 8:45,session 1 start 8:45,session 1 start 8:45,session 1 start 8:45,session 1 start 8:45,,
10:00-11:30,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
11:30-1:00,session 3,session 3,session 3,session 3,session 3,,
1:00-2:00,session 4,session 4,session 4,session 4,session 4,,
2:00-4:00,session 5,session 5,session 5,session 5,session 5,,
,,,,,,,

hh,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1 start 8:30,session 1 start 8:30,,,,,
10:00-11:30,session 2 ,session 2 ,,,,,
11:30-1:00,session 3,session 3,,,,,
1:00-2:00,session 4,session 4,,,,,
2:00-4:00,session 5,session 5,Travel,Travel,Travel,,
4:00-6:00,,,home session,home session,home session,,
6:00-7:00,,,,,,,
,,,,,,,

jada,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1,session 1,session 1,session 1,session 1,,
10:00-11:30,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
11:30-1:00,session 3,session 3,session 3,session 3,session 3,,
1:00-2:00,session 4,session 4,session 4,session 4,session 4,,
2:00-4:00,session 5,session 5,session 5,session 5,session 5,,
,,,,,,,

joda,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1,session 1,session 1,session 1,session 1,,
10:00-11:30,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
11:30-1:00,session 3,session 3,session 3,session 3,session 3,,
1:00-2:00,session 4,session 4,session 4,session 4,session 4,,
2:00-4:00,session 5,session 5,session 5,session 5,session 5,,
,,,,,,,

JuG,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1 start 8:30,session 1 start 8:30,session 1 start 8:30,session 1 start 8:30,session 1 start 8:30,,
10:00-12:30,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
12:30-2:00,,session 3,,session 3,,,
2:00-3:00,,session 4,,session 4,,,
3:00-4:00,,,,,,,
,,,,,,,

ma,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-9:00,,,,,,,
9:00-10:00,session 1,session 1,session 1,session 1,session 1,,
10:00-11:00,session 2 ,session 2 ,session 2 ,session 2 ,session 2 ,,
11:00-12:00,session 3,session 3,session 3,session 3,session 3,,
12:00-1:00,session 4,session 4,session 4,session 4,session 4,,
1:00-2:00,session 5,session 5,session 5,session 5,session 5,,
2:00-3:00,session 6,session 6,session 6,session 6,session 6,,
3:00-4:00,,,,,,,
,,,,,,,

nk,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
10:00-2:00,,,,,,home session,home session
2:00-3:00,travel ,travel ,travel ,travel ,travel ,home session 2:30 session end,home session 2:30 session end
3:00-6:00,home session,home session,home session,home session,home session,,
6:00-7:00,home session,home session,home session,home session,home session,,
,,,,,,,

th,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1 start 8:30,session 1 start 8:30,travel,travel,travel,,
10:00-11:30,session 2 ,session 2 ,home session,home session,home session,,
11:30-1:00,session 3,session 3,home session,home session,home session,,
1:00-2:00,session 4,session 4,home session,home session,home session,,
2:00-4:00,session 5,session 5,home session,home session,home session,,
,,,,,,,

yh,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,session 1 start 8:30,session 1 start 8:30,,,,,
10:00-11:30,session 2 ,session 2 ,,,,,
11:30-1:00,session 3,session 3,,,,,
1:00-2:00,session 4,session 4,,,,,
2:00-4:00,session 5,session 5,,Travel,,,
4:00-6:00,,,,home session,,,
,,,,,,,

zd,Monday ,Tuesday,Wednesday,Thursday,Friday,Saturday,Sunday
8:00-10:00,,,,,,,
10:00-11:30,session 1,session 1,session 1,session 1,session 1,,
11:30-1:00,session 2,session 2,session 2,session 2,session 2,,
1:00-3:00,session 3,session 3,session 3,session 3,session 3,,
3:00-4:00,,,,,,,
`;

// ============================================================================
// 2. CONFIGURATION & TYPES
// ============================================================================

const CONFIG = {
  TRAVEL_BUFFER_MINS: 60,
  MAX_CONSECUTIVE_SESSIONS: 2,
  MAX_BREAKS_PER_DAY: 1,
  BREAK_DURATION: 30,
  MIN_TIME_REMAINING_FOR_BREAK: 90,
};

interface Demand {
  kidId: string;
  kidName: string;
  day: DayOfWeek;
  startMins: number;
  endMins: number;
  type: SessionType;
  label: string; 
}

interface TrainerState {
  consecutiveSessions: number;
  breaksTaken: number;
  fatiguedUntil: number; // Time until which trainer cannot work
  lastKidId?: string; // To avoid repeating trainer for same kid (Rule 7.2 context: avoid same trainer for consecutive slots of a kid)
}

// ============================================================================
// 3. HELPERS
// ============================================================================

const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  const part = timeStr.split('-')[0].trim();
  const [hStr, mStr] = part.split(':');
  let h = parseInt(hStr);
  const m = parseInt(mStr) || 0;
  if (h >= 1 && h <= 7) h += 12; 
  return h * 60 + m;
};

const formatTime = (mins: number) => {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const p = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${p}`;
};

const overlaps = (startA: number, endA: number, startB: number, endB: number) => {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB)) > 0;
};

const parseOverrideTime = (cell: string, defaultStart: number, defaultEnd: number) => {
  let start = defaultStart;
  let end = defaultEnd;
  const lower = cell.toLowerCase();

  const startMatch = lower.match(/start\s+(\d{1,2}):(\d{2})/);
  if (startMatch) {
    let h = parseInt(startMatch[1]);
    const m = parseInt(startMatch[2]);
    if (h >= 1 && h <= 6) h += 12; 
    start = h * 60 + m;
  }

  const endMatch = lower.match(/end\s+(\d{1,2}):(\d{2})/);
  if (endMatch) {
    let h = parseInt(endMatch[1]);
    const m = parseInt(endMatch[2]);
    // Contextual PM inference for End time
    if (lower.includes('pm') && h !== 12) h += 12;
    if (!lower.includes('am') && !lower.includes('pm') && h >= 1 && h <= 8) h += 12;
    end = h * 60 + m;
  }
  return { start, end };
};

const getShiftBounds = (shiftStr: string): { start: number, end: number } | null => {
  if (!shiftStr || shiftStr === 'OFF' || shiftStr === 'X') return null;
  // Handle multi-block? Prompt says: "Compressed to earliest start, latest end"
  // Ex: "9-12, 1-5" -> 9am to 5pm
  // Our shifts format is usually "08:00 AM - 04:00 PM"
  
  // Clean separators
  const parts = shiftStr.split(/,|&/).map(s => s.trim());
  let globalStart = 24 * 60;
  let globalEnd = 0;

  let valid = false;
  parts.forEach(part => {
    const [startStr, endStr] = part.split('-').map(s => s.trim());
    if (!startStr || !endStr) return;

    const parsePart = (t: string) => {
       const [hm, period] = t.split(' ');
       let [h, m] = hm.split(':').map(Number);
       if (period === 'PM' && h !== 12) h += 12;
       if (period === 'AM' && h === 12) h = 0;
       return h * 60 + m;
    };
    
    try {
      const s = parsePart(startStr);
      const e = parsePart(endStr);
      if (s < globalStart) globalStart = s;
      if (e > globalEnd) globalEnd = e;
      valid = true;
    } catch (e) {}
  });

  return valid ? { start: globalStart, end: globalEnd } : null;
};

// ============================================================================
// 4. PARSER (CSV to Demands)
// ============================================================================

const parseMasterCsv = (kids: Kid[]): Demand[] => {
  const demands: Demand[] = [];
  const lines = MASTER_CSV.split('\n').map(l => l.trim());
  let currentKid: Kid | null = null;
  const DAYS = [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI, DayOfWeek.SAT, DayOfWeek.SUN];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim());

    // Header Detection
    if (cols[1]?.toLowerCase().startsWith('mon')) {
      const code = cols[0];
      currentKid = kids.find(k => k.id === `k_${code}` || k.name.toLowerCase() === code.toLowerCase()) || null;
      continue;
    }

    if (!currentKid) continue;

    const timeRange = cols[0];
    if (timeRange.includes('-') || timeRange.includes(':')) {
      const defaultStart = parseTime(timeRange);
      const [_, endPart] = timeRange.split('-');
      
      let defaultEnd = defaultStart + 60;
      if (endPart) {
        const [hStr, mStr] = endPart.trim().split(':');
        let h = parseInt(hStr);
        const m = parseInt(mStr);
        if (h >= 1 && h <= 8) h += 12; // Loose PM inference
        defaultEnd = h * 60 + m;
      }

      for (let d = 0; d < 7; d++) {
        const cell = cols[d + 1];
        if (!cell) continue;

        // Rule 3.1: Check DB Availability for Kid
        const kidAvail = currentKid.availability[DAYS[d]];
        if (!kidAvail || kidAvail === 'OFF' || kidAvail === 'X') continue;

        const lower = cell.toLowerCase();
        let type = SessionType.INDIVIDUAL;
        if (lower.includes('home')) type = SessionType.HOME;
        else if (lower.includes('travel')) type = SessionType.ADMIN;
        else if (lower.includes('social')) type = SessionType.SOCIAL;

        const { start, end } = parseOverrideTime(cell, defaultStart, defaultEnd);
        
        if (end > start) {
          demands.push({
            kidId: currentKid.id,
            kidName: currentKid.name,
            day: DAYS[d],
            startMins: start,
            endMins: end,
            type,
            label: cell
          });
        }
      }
    }
  }

  // Merging Logic (Consecutive HOME slots)
  const grouped = new Map<string, Demand[]>();
  demands.forEach(d => {
    const key = `${d.kidId}|${d.day}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  const mergedDemands: Demand[] = [];
  grouped.forEach(group => {
    group.sort((a, b) => a.startMins - b.startMins);
    let current = group[0];
    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      // Merge if HOME and Touching
      if (current.type === SessionType.HOME && next.type === SessionType.HOME && current.endMins === next.startMins) {
        current.endMins = next.endMins;
        current.label += ` + ${next.label}`;
      } else {
        mergedDemands.push(current);
        current = next;
      }
    }
    mergedDemands.push(current);
  });

  return mergedDemands;
};

// ============================================================================
// 5. MAIN SCHEDULER ENGINE
// ============================================================================

export const mainScheduler = (trainers: Trainer[], kids: Kid[], lockedDays: DayOfWeek[] = []): ScheduleItem[] => {
  const allDemands = parseMasterCsv(kids);
  const items: ScheduleItem[] = [];
  
  // Sort Demands: Day -> StartTime (Critical for consecutive logic)
  const DAY_ORDER = { [DayOfWeek.MON]: 0, [DayOfWeek.TUE]: 1, [DayOfWeek.WED]: 2, [DayOfWeek.THU]: 3, [DayOfWeek.FRI]: 4, [DayOfWeek.SAT]: 5, [DayOfWeek.SUN]: 6 };
  allDemands.sort((a, b) => {
    const dDiff = DAY_ORDER[a.day] - DAY_ORDER[b.day];
    return dDiff !== 0 ? dDiff : a.startMins - b.startMins;
  });

  // Tracking State per Trainer per Day
  // Map<"TrainerID|Day", State>
  const trainerStates = new Map<string, TrainerState>();
  const getState = (tid: string, day: DayOfWeek) => {
    const key = `${tid}|${day}`;
    if (!trainerStates.has(key)) {
      trainerStates.set(key, { consecutiveSessions: 0, breaksTaken: 0, fatiguedUntil: 0 });
    }
    return trainerStates.get(key)!;
  };

  // Helper to check collision with existing items
  const isBlocked = (tid: string, day: DayOfWeek, start: number, end: number) => {
    return items.some(i => i.trainerId === tid && i.day === day && overlaps(parseTime(i.timeSlot.split('-')[0]), parseTime(i.timeSlot.split('-')[1]), start, end));
  };
  
  const isKidBlocked = (kidId: string, day: DayOfWeek, start: number, end: number) => {
    return items.some(i => i.kidId === kidId && i.day === day && overlaps(parseTime(i.timeSlot.split('-')[0]), parseTime(i.timeSlot.split('-')[1]), start, end));
  };

  // --- PROCESSING LOOP ---
  for (const demand of allDemands) {
    // Rule 1: Locked Days
    if (lockedDays.includes(demand.day)) continue;

    // Rule 4.2: Kid Double Booking
    if (isKidBlocked(demand.kidId, demand.day, demand.startMins, demand.endMins)) continue;

    // Find Candidates
    let candidates = trainers.filter(t => {
      // Rule 2.1: Active Only
      if (t.status !== 'Active') return false;

      // Rule 2.2 & 2.3: Shift Coverage
      const shift = getShiftBounds(t.shifts[demand.day]);
      if (!shift) return false;
      
      // Shift must cover session
      if (shift.start > demand.startMins || shift.end < demand.endMins) return false;

      // Rule 5: Travel Logic
      if (demand.type === SessionType.HOME) {
        // 5.2 Shift Coverage for Travel (Start - 60)
        if (shift.start > (demand.startMins - CONFIG.TRAVEL_BUFFER_MINS)) return false;
        
        // 5.3 Availability for Travel (Admin Block)
        // Check if 60 mins before is free
        if (isBlocked(t.id, demand.day, demand.startMins - CONFIG.TRAVEL_BUFFER_MINS, demand.startMins)) return false;

        // Home Constraint (Allowed IDs)
        const kid = kids.find(k => k.id === demand.kidId);
        if (kid?.inHomeAllowedStaffIds?.length && !kid.inHomeAllowedStaffIds.includes(t.id)) return false;
      }

      // Rule 4.1: Trainer Double Booking
      if (isBlocked(t.id, demand.day, demand.startMins, demand.endMins)) return false;

      // Rule 6.6: Fatigue
      const state = getState(t.id, demand.day);
      if (state.fatiguedUntil > demand.startMins) return false;

      return true;
    });

    // Rule 7.1: Priority (Full Time > Part Time)
    // Assuming t.type === 'Full-Time' exists or inferred
    // Actually using `is_full_time` from db (parsed as boolean usually, strictly type says string 'Full-Time')
    
    // Rule 7.2: Avoid Repeating Trainer (Last Kid context)
    // We need to know who the kid had LAST.
    // Let's create a map for Kid's last trainer on this day
    // Actually, simply checking the `items` list for this kid's last session is enough.
    const lastSession = items.filter(i => i.kidId === demand.kidId && i.day === demand.day).pop();
    const lastTrainerId = lastSession?.trainerId;

    // Rule 8: Randomization
    candidates.sort((a, b) => {
      // 1. Priority (Full Time first)
      const aFT = a.type === 'Full-Time' ? 1 : 0;
      const bFT = b.type === 'Full-Time' ? 1 : 0;
      if (aFT !== bFT) return bFT - aFT;

      // 2. Preference (Avoid Repeat)
      if (lastTrainerId) {
        const aRepeat = a.id === lastTrainerId ? 1 : 0;
        const bRepeat = b.id === lastTrainerId ? 1 : 0;
        if (aRepeat !== bRepeat) return aRepeat - bRepeat; // Prefer non-repeat (0)
      }

      // 3. Random
      return Math.random() - 0.5;
    });

    const selected = candidates[0];

    if (selected) {
      // --- BOOKING ---
      
      // 1. Book Travel (if Home)
      if (demand.type === SessionType.HOME) {
        items.push({
          id: crypto.randomUUID(),
          day: demand.day,
          timeSlot: `${formatTime(demand.startMins - 60)} - ${formatTime(demand.startMins)}`,
          trainerId: selected.id,
          trainerName: selected.name,
          kidId: 'ADMIN',
          kidName: 'TRAVEL',
          specialty: 'Travel',
          sessionType: SessionType.ADMIN,
          durationMins: 60,
          status: SessionStatus.CONFIRMED,
          isLocked: true
        });
      }

      // 2. Book Session
      items.push({
        id: crypto.randomUUID(),
        day: demand.day,
        timeSlot: `${formatTime(demand.startMins)} - ${formatTime(demand.endMins)}`,
        trainerId: selected.id,
        trainerName: selected.name,
        kidId: demand.kidId,
        kidName: demand.kidName,
        specialty: 'ABA',
        sessionType: demand.type,
        durationMins: demand.endMins - demand.startMins,
        status: SessionStatus.CONFIRMED,
        isLocked: true
      });

      // --- STATE UPDATES & BREAK LOGIC ---
      const state = getState(selected.id, demand.day);
      state.consecutiveSessions++;
      
      // Rule 6: Break Insertion
      if (state.consecutiveSessions >= CONFIG.MAX_CONSECUTIVE_SESSIONS && state.breaksTaken < CONFIG.MAX_BREAKS_PER_DAY) {
         // Check Remaining Shift Time
         const shift = getShiftBounds(selected.shifts[demand.day])!;
         const breakStart = demand.endMins;
         const breakEnd = breakStart + CONFIG.BREAK_DURATION;
         const remaining = shift.end - breakEnd;

         if (remaining >= CONFIG.MIN_TIME_REMAINING_FOR_BREAK) {
            // Check if slot is free
            if (!isBlocked(selected.id, demand.day, breakStart, breakEnd)) {
               items.push({
                 id: crypto.randomUUID(),
                 day: demand.day,
                 timeSlot: `${formatTime(breakStart)} - ${formatTime(breakEnd)}`,
                 trainerId: selected.id,
                 trainerName: selected.name,
                 kidId: 'BREAK',
                 kidName: 'BREAK',
                 specialty: 'Break',
                 sessionType: SessionType.BREAK,
                 durationMins: CONFIG.BREAK_DURATION,
                 status: SessionStatus.CONFIRMED,
                 isLocked: true
               });
               
               state.breaksTaken++;
               state.consecutiveSessions = 0;
               state.fatiguedUntil = breakEnd;
            }
         }
      }
    }
  }

  // Rule 9: End-of-Day Break Conversion
  // If last item for a trainer is BREAK, convert to OFFICE WORK
  // Group items by trainer
  const trainerItems = new Map<string, ScheduleItem[]>();
  items.forEach(i => {
    if (!trainerItems.has(i.trainerId)) trainerItems.set(i.trainerId, []);
    trainerItems.get(i.trainerId)!.push(i);
  });

  trainerItems.forEach((tItems, tid) => {
    // Sort by time
    tItems.sort((a, b) => parseTime(a.timeSlot.split('-')[0]) - parseTime(b.timeSlot.split('-')[0]));
    
    // Check last item PER DAY
    // We are processing multiple days potentially, so group by day internally
    const dayGroups = new Map<DayOfWeek, ScheduleItem[]>();
    tItems.forEach(i => {
       if(!dayGroups.has(i.day)) dayGroups.set(i.day, []);
       dayGroups.get(i.day)!.push(i);
    });

    dayGroups.forEach((dItems, day) => {
        dItems.sort((a, b) => parseTime(a.timeSlot.split('-')[0]) - parseTime(b.timeSlot.split('-')[0]));
        const last = dItems[dItems.length - 1];
        
        if (last.sessionType === SessionType.BREAK) {
             const trainer = trainers.find(t => t.id === tid);
             if (trainer) {
                const shift = getShiftBounds(trainer.shifts[day]);
                if (shift) {
                   const breakStart = parseTime(last.timeSlot.split('-')[0]);
                   // Extend to Shift End
                   last.sessionType = SessionType.ADMIN;
                   last.kidName = "OFFICE WORK";
                   last.kidId = "ADMIN";
                   last.durationMins = shift.end - breakStart;
                   last.timeSlot = `${formatTime(breakStart)} - ${formatTime(shift.end)}`;
                }
             }
        }
    });
  });

  return items;
};

// ============================================================================
// 6. RUNNER STUB
// ============================================================================
export type GenerationScope = 'DAY' | 'WEEK' | '3-WEEKS';
export const runAutoScheduler = async (scope: GenerationScope, targetDate: Date) => { return []; };