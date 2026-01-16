// optischedule-ai/services/schedulerIntegration.ts
import { apiService } from './apiService';
// ✅ Ensure this matches your actual AI service file path
import { generateSchedule } from './geminiService'; 
import { DayOfWeek, ScheduleItem } from '../types';

export type GenerationScope = 'DAY' | 'WEEK' | '3-WEEKS';

// --- FIXED HELPERS (TIMEZONE SAFE) ---

// 1. Get Monday using Local Time (Not UTC)
const getMonday = (d: Date) => {
  const date = new Date(d);
  // Reset time to Noon to avoid DST/Timezone edge cases when subtracting days
  date.setHours(12, 0, 0, 0); 
  
  const day = date.getDay(); // 0=Sun, 1=Mon...
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
};

// 2. Add Days & Return YYYY-MM-DD (Local Time)
const addDaysAndFormat = (baseDate: Date, daysToAdd: number) => {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + daysToAdd);
  
  // ❌ BAD: result.toISOString().split('T')[0] (Uses UTC, causes day shifts)
  
  // ✅ GOOD: Manual Local Formatting
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Offset Map to ensure Mon=0, Sun=6
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
  
  // Determine iterations: 3-WEEKS gets 3 loops, others get 1
  const iterations = scope === '3-WEEKS' ? 3 : 1;

  for (let i = 0; i < iterations; i++) {
    // Calculate the Monday for THIS specific loop iteration
    const currentMonday = new Date(mondayOfTarget);
    if (scope === '3-WEEKS') {
        // If 3-Weeks, we start from "Today's Monday" and move forward
        const todayMonday = getMonday(new Date());
        currentMonday.setDate(todayMonday.getDate() + (i * 7));
    }

    console.log(`⚡ Generating logic for week of: ${currentMonday.toDateString()}`);

    // Generate fresh schedule for this week (Pass empty array to ignore old slots)
    const weeklyRaw = await generateSchedule(trainers, kids, [], []);

    // Assign Dates
    weeklyRaw.forEach(item => {
      const dayOffset = DayToOffset[item.day];
      if (dayOffset !== undefined) {
        // ✅ USE FIXED DATE FORMATTER
        const itemDateStr = addDaysAndFormat(currentMonday, dayOffset);
        
        // Scope Filtering
        let shouldKeep = true;
        if (scope === 'DAY') {
             // Only keep items that match the exact target date
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

  // --- DATABASE SYNC ---
  
  let clearStart: string;
  let clearEnd: string;

  // Calculate clear range using the Safe Formatter
  if (scope === '3-WEEKS') {
      const startM = getMonday(new Date());
      clearStart = addDaysAndFormat(startM, 0);
      clearEnd = addDaysAndFormat(startM, 20); // approx 3 weeks
  } else if (scope === 'WEEK') {
      clearStart = addDaysAndFormat(mondayOfTarget, 0);
      clearEnd = addDaysAndFormat(mondayOfTarget, 6);
  } else {
      // Scope === DAY
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