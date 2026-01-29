import { apiService } from './apiService';
import { mainScheduler } from './geminiService'; 
import { DayOfWeek, ScheduleItem, Kid } from '../types';

export type GenerationScope = 'DAY' | 'WEEK' | '3-WEEKS';

// --- FIXED HELPERS (TIMEZONE SAFE) ---

const getMonday = (d: Date) => {
  const date = new Date(d);
  date.setHours(12, 0, 0, 0); 
  const day = date.getDay(); 
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
};

const addDaysAndFormat = (baseDate: Date, daysToAdd: number) => {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + daysToAdd);
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DayToOffset: Record<DayOfWeek, number> = {
  [DayOfWeek.MON]: 0, [DayOfWeek.TUE]: 1, [DayOfWeek.WED]: 2,
  [DayOfWeek.THU]: 3, [DayOfWeek.FRI]: 4, [DayOfWeek.SAT]: 5, [DayOfWeek.SUN]: 6
};

// --- DATA ADAPTER: Convert DB String -> Scheduler Grid ---

// The 14 discrete slots required by mainScheduler
const SLOT_DEFS = [
  { idx: 0, start: 480, end: 540 },   // 8:00-9:00 (60)
  { idx: 1, start: 540, end: 600 },   // 9:00-10:00 (60)
  { idx: 2, start: 600, end: 660 },   // 10:00-11:00 (60)
  { idx: 3, start: 660, end: 690 },   // 11:00-11:30 (30)
  { idx: 4, start: 690, end: 720 },   // 11:30-12:00 (30)
  { idx: 5, start: 720, end: 750 },   // 12:00-12:30 (30)
  { idx: 6, start: 750, end: 780 },   // 12:30-1:00 (30)
  { idx: 7, start: 780, end: 810 },   // 1:00-1:30 (30)
  { idx: 8, start: 810, end: 840 },   // 1:30-2:00 (30)
  { idx: 9, start: 840, end: 900 },   // 2:00-3:00 (60)
  { idx: 10, start: 900, end: 960 },  // 3:00-4:00 (60)
  { idx: 11, start: 960, end: 1020 }, // 4:00-5:00 (60)
  { idx: 12, start: 1020, end: 1080 },// 5:00-6:00 (60)
  { idx: 13, start: 1080, end: 1140 } // 6:00-7:00 (60)
];

const parseTimeStr = (t: string): number => {
  if (!t) return 0;
  // Clean string: "HOM 3:00 PM - 7:00 PM" -> "3:00"
  const cleanStr = t.replace(/HOM|IN HOME|In-home|In-center|TRAVEL/gi, "").trim();
  const startOnly = cleanStr.includes("-") ? cleanStr.split("-")[0].trim() : cleanStr;
  
  let [h, m] = startOnly.split(":").map((n) => Number(n));
  if (isNaN(h)) return 0;
  if (isNaN(m)) m = 0;

  const upper = t.toUpperCase();
  // 12 PM is 12, 1 PM is 13. 12 AM is 0. 
  // Heuristic: 1-6 is PM, 7-11 is AM (unless marked PM), 12 is PM (unless marked AM)
  if (upper.includes("PM") && h !== 12) h += 12;
  if (upper.includes("AM") && h === 12) h = 0;
  if (!upper.includes("AM") && !upper.includes("PM")) {
      if (h >= 1 && h <= 6) h += 12; // Infer PM for 1-6
  }
  
  return h * 60 + m;
};

const getDurationMins = (t: string): number => {
  // Extract "3:00 PM - 7:00 PM"
  const cleanStr = t.replace(/HOM|IN HOME|In-home|In-center|TRAVEL/gi, "").trim();
  const parts = cleanStr.split("-");
  if (parts.length < 2) return 60; // Default

  const start = parseTimeStr(parts[0]);
  
  // Parse End manually to handle "7:00 PM" context
  let endStr = parts[1].trim();
  let [h, m] = endStr.split(":").map(n => Number(n.replace(/\D/g,''))); // remove non-digits
  if (isNaN(h)) return 60;
  if (isNaN(m)) m = 0;
  
  const upper = endStr.toUpperCase();
  if (upper.includes("PM") && h !== 12) h += 12;
  if (upper.includes("AM") && h === 12) h = 0;
  if (!upper.includes("AM") && !upper.includes("PM")) {
      if (h >= 1 && h <= 7) h += 12; 
  }
  
  const end = h * 60 + m;
  return end - start;
};

// Converts {"Monday": "HOM 3:00 PM - 7:00 PM"} -> { "Monday": [null, ..., "home", "home"] }
const transformAvailabilityToDemands = (kid: Kid) => {
  const demands: any = {};
  const avail = kid.availability as Record<string, string>;

  if (!avail) return {};

  Object.entries(avail).forEach(([day, timeStr]) => {
    if (!timeStr || timeStr === "OFF" || timeStr === "X") return;

    // Is it a Home session?
    const isHome = timeStr.toUpperCase().includes("HOM");
    
    // Only map HOME sessions (per user requirement for this specific scheduler logic)
    // If you want to schedule Clinic too, remove the check, but prompt said "Consecutive HOME slots"
    // Let's assume all slots in string are valid demands, just marking 'home' if strictly home.
    // Actually, prompt constraint #3: "Cell values: 'home' -> HOME, anything else -> ignore"
    // So if it's NOT home, we must ignore it or mark it as something else?
    // Let's mark it as "home" if isHome, otherwise leave null?
    // If the kid IS home, we fill the grid.
    
    if (isHome) {
        const startMins = parseTimeStr(timeStr);
        const duration = getDurationMins(timeStr);
        const endMins = startMins + duration;

        const daySlots = new Array(14).fill(null);
        
        // Fill matching slots
        SLOT_DEFS.forEach((slot) => {
             // Overlap check: Slot is inside the availability window
             // Loose check: If slot overlaps with window
             const overlap = Math.max(0, Math.min(slot.end, endMins) - Math.max(slot.start, startMins));
             if (overlap >= 15) { // If at least 15 mins overlap
                 daySlots[slot.idx] = "home";
             }
        });
        
        demands[day] = daySlots;
    }
  });

  return demands;
};

// --- MAIN ENGINE ---

export const runAutoScheduler = async (scope: GenerationScope, targetDate: Date) => {
  console.log(`🚀 Scheduler triggered. Scope: ${scope}, Target: ${targetDate.toDateString()}`);

  const [trainers, kids, currentSchedule] = await Promise.all([
    apiService.fetchTrainers(),
    apiService.fetchKids(),
    apiService.fetchSchedule()
  ]);

  const finalItems: ScheduleItem[] = [];
  const mondayOfTarget = getMonday(targetDate);
  const iterations = scope === '3-WEEKS' ? 3 : 1;

  // ✅ PREPARE DATA: Convert DB Strings to Grid Arrays
  const kidsWithDemands = kids.map(k => ({
    ...k,
    demands: transformAvailabilityToDemands(k)
  }));

  for (let i = 0; i < iterations; i++) {
    const currentMonday = new Date(mondayOfTarget);
    if (scope === '3-WEEKS') {
        const todayMonday = getMonday(new Date());
        currentMonday.setDate(todayMonday.getDate() + (i * 7));
    }

    console.log(`⚡ Generating logic for week of: ${currentMonday.toDateString()}`);

    // Call the Main Scheduler
    const weeklyRaw = mainScheduler(trainers, kidsWithDemands);
    console.log(`   -> Generated ${weeklyRaw.length} raw items`);

    weeklyRaw.forEach(item => {
      const dayOffset = DayToOffset[item.day];
      if (dayOffset !== undefined) {
        const itemDateStr = addDaysAndFormat(currentMonday, dayOffset);
        
        let shouldKeep = true;
        if (scope === 'DAY') {
             const targetStr = addDaysAndFormat(targetDate, 0);
             if (itemDateStr !== targetStr) shouldKeep = false;
        }

        if (shouldKeep) {
            finalItems.push({
              ...item,
              id: crypto.randomUUID(),
              dateStr: itemDateStr,
              isLocked: false 
            });
        }
      }
    });
  }

  // --- DB SYNC ---
  let clearStart: string;
  let clearEnd: string;

  if (scope === '3-WEEKS') {
      const startM = getMonday(new Date());
      clearStart = addDaysAndFormat(startM, 0);
      clearEnd = addDaysAndFormat(startM, 20); 
  } else if (scope === 'WEEK') {
      clearStart = addDaysAndFormat(mondayOfTarget, 0);
      clearEnd = addDaysAndFormat(mondayOfTarget, 6);
  } else {
      const targetStr = addDaysAndFormat(targetDate, 0);
      clearStart = targetStr;
      clearEnd = targetStr;
  }

  console.log(`🧹 Clearing DB Range: ${clearStart} -> ${clearEnd}`);
  await apiService.clearScheduleRange(clearStart, clearEnd);

  console.log(`💾 Saving ${finalItems.length} items...`);
  await apiService.saveSchedule(finalItems);

  return finalItems;
};