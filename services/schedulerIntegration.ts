// services/schedulerIntegration.ts
import { apiService } from './apiService';
import { generateSchedule } from '../lib/scheduler-engine/scheduler'; // Point to your file
import { DayOfWeek } from '../types';

export const runAutoScheduler = async (targetDay: DayOfWeek) => {
  console.log(`🚀 Starting Scheduler for ${targetDay}...`);

  // 1. FETCH DATA FROM SUPABASE
  const [trainers, kids, currentSchedule] = await Promise.all([
    apiService.fetchTrainers(),
    apiService.fetchKids(),
    apiService.fetchSchedule()
  ]);

  // 2. RUN YOUR LOGIC ENGINE
  // Note: We filter the current schedule to pass any 'locked' items if needed
  const newSchedule = await generateSchedule(
    trainers, 
    kids, 
    currentSchedule, // Passing existing schedule allows logic to respect locks
    [] // Locked days can be passed here if you have that state
  );

  // 3. SAVE RESULT TO SUPABASE
  // This replaces the old schedule for that day with the new optimized one
  await apiService.saveSchedule(newSchedule);

  console.log(`✅ Schedule saved! Generated ${newSchedule.length} sessions.`);
  return newSchedule;
};