
import { Trainer, Kid, ScheduleItem, StaffStatus, Specialty, DayOfWeek, ClinicalRole, Crew } from '../types';

const KEYS = {
  TRAINERS: 'clinic_os_v6_staff',
  KIDS: 'clinic_os_v6_roster',
  SCHEDULE: 'clinic_os_v6_timeline'
};

const INITIAL_TRAINERS: Trainer[] = [
  { id: 't1', name: 'Dr. Sarah Miller', username: 'sarah', password: 'password', clinicalRole: ClinicalRole.BCBA, crew: Crew.ALPHA, specialties: [Specialty.ABA], maxHoursPerWeek: 40, shiftStart: '08:00 AM', shiftEnd: '04:00 PM', availableDays: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI], type: 'Full-Time', status: StaffStatus.ACTIVE },
  { id: 't2', name: 'James Chen, RBT', username: 'james', password: 'password', clinicalRole: ClinicalRole.RBT, crew: Crew.ALPHA, specialties: [Specialty.ABA], maxHoursPerWeek: 40, shiftStart: '08:30 AM', shiftEnd: '05:00 PM', availableDays: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI], type: 'Full-Time', status: StaffStatus.ACTIVE },
  { id: 't3', name: 'Elena Rodriguez', username: 'elena', password: 'password', clinicalRole: ClinicalRole.BT, crew: Crew.BRAVO, specialties: [Specialty.ABA], maxHoursPerWeek: 30, shiftStart: '09:00 AM', shiftEnd: '03:00 PM', availableDays: [DayOfWeek.MON, DayOfWeek.WED, DayOfWeek.FRI], type: 'Contract', status: StaffStatus.ACTIVE },
  { id: 't4', name: 'Marcus Wright, TC', username: 'marcus', password: 'password', clinicalRole: ClinicalRole.RBT_TC, crew: Crew.BRAVO, specialties: [Specialty.ABA], maxHoursPerWeek: 40, shiftStart: '08:00 AM', shiftEnd: '04:30 PM', availableDays: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI], type: 'Full-Time', status: StaffStatus.ACTIVE }
];

const INITIAL_KIDS: Kid[] = [
  { id: 'k1', name: 'Liam Johnson', parentUsername: 'liam_parent', parentPassword: 'password', crew: Crew.ALPHA, requiredSpecialties: [Specialty.ABA], sessionsPerWeek: 5, sessionDurationMins: 90, insuranceCapHours: 40, insuranceUsedHours: 12, supervisionGoalWeekly: 2 },
  { id: 'k2', name: 'Noah Williams', parentUsername: 'noah_parent', parentPassword: 'password', crew: Crew.ALPHA, requiredSpecialties: [Specialty.ABA], sessionsPerWeek: 5, sessionDurationMins: 90, insuranceCapHours: 100, insuranceUsedHours: 85, supervisionGoalWeekly: 5 },
  { id: 'k3', name: 'Sophia Garcia', parentUsername: 'sophia_parent', parentPassword: 'password', crew: Crew.BRAVO, requiredSpecialties: [Specialty.ABA], sessionsPerWeek: 5, sessionDurationMins: 90, insuranceCapHours: 50, insuranceUsedHours: 5, supervisionGoalWeekly: 2 },
  { id: 'k4', name: 'Oliver Smith', parentUsername: 'oliver_parent', parentPassword: 'password', crew: Crew.BRAVO, requiredSpecialties: [Specialty.ABA], sessionsPerWeek: 5, sessionDurationMins: 90, insuranceCapHours: 20, insuranceUsedHours: 18, supervisionGoalWeekly: 1 }
];

export const apiService = {
  _get: <T>(key: string, defaultValue: T): T => {
    const local = localStorage.getItem(key);
    if (!local) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    try {
      return JSON.parse(local);
    } catch (e) {
      return defaultValue;
    }
  },

  _set: (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  },

  fetchTrainers: async (): Promise<Trainer[]> => apiService._get<Trainer[]>(KEYS.TRAINERS, INITIAL_TRAINERS),
  createTrainer: async (trainer: Trainer): Promise<Trainer[]> => {
    const trainers = await apiService.fetchTrainers();
    const updated = [...trainers, trainer];
    apiService._set(KEYS.TRAINERS, updated);
    return updated;
  },
 // services/apiService.ts

updateTrainer: async (id: string, updates: Partial<Trainer>): Promise<Trainer[]> => {
  const trainers = await apiService.fetchTrainers();
  const updated = trainers.map(t => t.id === id ? { ...t, ...updates } : t);
  apiService._set(KEYS.TRAINERS, updated); // Save to localStorage
  return updated;
},
  deleteTrainer: async (id: string): Promise<Trainer[]> => {
    const trainers = await apiService.fetchTrainers();
    const updated = trainers.filter(t => t.id !== id);
    apiService._set(KEYS.TRAINERS, updated);
    return updated;
  },

  fetchKids: async (): Promise<Kid[]> => apiService._get<Kid[]>(KEYS.KIDS, INITIAL_KIDS),
  createKid: async (kid: Kid): Promise<Kid[]> => {
    const kids = await apiService.fetchKids();
    const updated = [...kids, kid];
    apiService._set(KEYS.KIDS, updated);
    return updated;
  },
  updateKid: async (id: string, updates: Partial<Kid>): Promise<Kid[]> => {
    const kids = await apiService.fetchKids();
    const updated = kids.map(k => k.id === id ? { ...k, ...updates } : k);
    apiService._set(KEYS.KIDS, updated);
    return updated;
  },
  deleteKid: async (id: string): Promise<Kid[]> => {
    const kids = await apiService.fetchKids();
    const updated = kids.filter(k => k.id !== id);
    apiService._set(KEYS.KIDS, updated);
    return updated;
  },

  fetchSchedule: async (): Promise<ScheduleItem[]> => apiService._get<ScheduleItem[]>(KEYS.SCHEDULE, []),
  saveSchedule: async (newSchedule: ScheduleItem[]): Promise<void> => apiService._set(KEYS.SCHEDULE, newSchedule),
  updateScheduleItem: async (id: string, updates: Partial<ScheduleItem>): Promise<ScheduleItem[]> => {
    const schedule = await apiService.fetchSchedule();
    const updated = schedule.map(s => s.id === id ? { ...s, ...updates } : s);
    apiService._set(KEYS.SCHEDULE, updated);
    return updated;
  },
  deleteScheduleItem: async (id: string): Promise<ScheduleItem[]> => {
    const schedule = await apiService.fetchSchedule();
    const updated = schedule.filter(s => s.id !== id);
    apiService._set(KEYS.SCHEDULE, updated);
    return updated;
  }
};
