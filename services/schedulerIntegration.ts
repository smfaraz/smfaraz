import { apiService } from './apiService';
import { generateSchedule } from './geminiService'; 
import { DayOfWeek, ScheduleItem } from '../types';

export type GenerationScope = 'DAY' | 'WEEK' | '3-WEEKS';

// --- UTILITY: Safe UUID Polyfill ---
const safeUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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

  for (let i = 0; i < iterations; i++) {
    const currentMonday = new Date(mondayOfTarget);
    if (scope === '3-WEEKS') {
        const todayMonday = getMonday(new Date());
        currentMonday.setDate(todayMonday.getDate() + (i * 7));
    }

    console.log(`⚡ Generating logic for week of: ${currentMonday.toDateString()}`);
    const weeklyRaw = await generateSchedule(trainers, kids, [], []);

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
              id: safeUUID(), // ✅ FIXED: Uses safe UUID generator
              dateStr: itemDateStr,
              isLocked: false 
            });
        }
      }
    });
  }

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