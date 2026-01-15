import { supabase } from '../lib/supabaseClient';
import { Trainer, Kid, ScheduleItem, KioskLog } from '../types';

// --- UTILITY: REMOVE UNDEFINED KEYS ---
const clean = (obj: any) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
};

// --- DATA MAPPERS ---
const mapTrainerFromDB = (t: any): Trainer => ({
  ...t,
  clinicalRole: t.clinical_role,
  maxHoursPerWeek: t.max_hours_per_week,
  excludeClientGender: t.exclude_client_gender,
  maxDailyHours: t.max_daily_hours || 8
  // REMOVED: crew mapping
});

const mapTrainerToDB = (t: Partial<Trainer>) => clean({
  id: t.id,
  name: t.name,
  username: t.username,
  password: t.password,
  clinical_role: t.clinicalRole,
  // REMOVED: crew: t.crew,
  specialties: t.specialties,
  max_hours_per_week: t.maxHoursPerWeek,
  shifts: t.shifts,
  type: t.type,
  status: t.status,
  exclude_client_gender: t.excludeClientGender,
  max_daily_hours: t.maxDailyHours
});

const mapKidFromDB = (k: any): Kid => ({
  ...k,
  parentUsername: k.parent_username,
  parentPassword: k.parent_password,
  requiredSpecialties: k.required_specialties,
  sessionsPerWeek: k.sessions_per_week,
  sessionDurationMins: k.session_duration_mins,
  insuranceCapHours: k.insurance_cap_hours,
  insuranceUsedHours: k.insurance_used_hours,
  supervisionGoalWeekly: k.supervision_goal_weekly,
  currentStatus: k.current_status || 'CHECKED_OUT',
  gender: k.gender,
  inHomeAllowedStaffIds: k.in_home_allowed_staff_ids || [],
  maxSessionMins: k.max_session_mins || 240,
  conflictHistoryKids: k.conflict_history_kids || []
  // REMOVED: crew mapping
});

const mapKidToDB = (k: Partial<Kid>) => clean({
  id: k.id,
  name: k.name,
  parent_username: k.parentUsername,
  parent_password: k.parentPassword,
  // REMOVED: crew: k.crew,
  required_specialties: k.requiredSpecialties,
  sessions_per_week: k.sessionsPerWeek,
  session_duration_mins: k.sessionDurationMins,
  insurance_cap_hours: k.insuranceCapHours,
  insurance_used_hours: k.insuranceUsedHours,
  supervision_goal_weekly: k.supervisionGoalWeekly,
  availability: k.availability,
  current_status: k.currentStatus,
  gender: k.gender,
  in_home_allowed_staff_ids: k.inHomeAllowedStaffIds,
  max_session_mins: k.maxSessionMins,
  conflict_history_kids: k.conflictHistoryKids
});

const mapScheduleFromDB = (s: any): ScheduleItem => ({
  ...s,
  timeSlot: s.time_slot,
  trainerId: s.trainer_id || 'unassigned', 
  trainerName: s.trainer_name || 'Unassigned',
  kidId: s.kid_id,
  kidName: s.kid_name,
  sessionType: s.session_type,
  durationMins: s.duration_mins,
  isLocked: s.is_locked
  // REMOVED: crew mapping
});

const mapScheduleToDB = (s: Partial<ScheduleItem>) => clean({
  id: s.id,
  day: s.day,
  time_slot: s.timeSlot,
  trainer_id: s.trainerId === 'unassigned' ? null : s.trainerId,
  trainer_name: s.trainerName,
  kid_id: s.kidId,
  kid_name: s.kidName,
  specialty: s.specialty,
  session_type: s.sessionType,
  duration_mins: s.durationMins,
  status: s.status,
  // REMOVED: crew: s.crew,
  is_locked: s.isLocked
});

// ... rest of the file (Kiosk Log logic remains unchanged)



const mapLogFromDB = (l: any): KioskLog => ({
  ...l,
  kidId: l.kid_id,
  kidName: l.kid_name,
  dateStr: l.date_str,
  timestamp: Number(l.timestamp)
});

const mapLogToDB = (l: KioskLog) => clean({
  id: l.id,
  kid_id: l.kidId,
  kid_name: l.kidName,
  action: l.action,
  timestamp: l.timestamp,
  date_str: l.dateStr,
  photo: l.photo,
  method: l.method
});

// --- API SERVICE ---
export const apiService = {
  // TRAINERS
  fetchTrainers: async (): Promise<Trainer[]> => {
    const { data, error } = await supabase.from('trainers').select('*');
    if (error) { console.error('Error fetching trainers:', error); return []; }
    return (data || []).map(mapTrainerFromDB);
  },
  createTrainer: async (trainer: Trainer): Promise<Trainer[]> => {
    const { error } = await supabase.from('trainers').insert(mapTrainerToDB(trainer));
    if (error) console.error('Error creating trainer:', error);
    return apiService.fetchTrainers();
  },
  updateTrainer: async (id: string, updates: Partial<Trainer>): Promise<Trainer[]> => {
    const { error } = await supabase.from('trainers').update(mapTrainerToDB(updates)).eq('id', id);
    if (error) console.error('Error updating trainer:', error);
    return apiService.fetchTrainers();
  },
  deleteTrainer: async (id: string): Promise<Trainer[]> => {
    const { error } = await supabase.from('trainers').delete().eq('id', id);
    if (error) console.error('Error deleting trainer:', error);
    return apiService.fetchTrainers();
  },

  // KIDS
  fetchKids: async (): Promise<Kid[]> => {
    const { data, error } = await supabase.from('clients_2026').select('*');
    if (error) { console.error('Error fetching kids:', error); return []; }
    return (data || []).map(mapKidFromDB);
  },
  createKid: async (kid: Kid): Promise<Kid[]> => {
    const { error } = await supabase.from('clients_2026').insert(mapKidToDB(kid));
    if (error) console.error('Error creating kid:', error);
    return apiService.fetchKids();
  },
  updateKid: async (id: string, updates: Partial<Kid>): Promise<Kid[]> => {
    const { error } = await supabase.from('clients_2026').update(mapKidToDB(updates)).eq('id', id);
    if (error) console.error('Error updating kid:', error);
    return apiService.fetchKids();
  },
  deleteKid: async (id: string): Promise<Kid[]> => {
    const { error } = await supabase.from('clients_2026').delete().eq('id', id);
    if (error) console.error('Error deleting kid:', error);
    return apiService.fetchKids();
  },

  // SCHEDULE
  fetchSchedule: async (): Promise<ScheduleItem[]> => {
    const { data, error } = await supabase.from('schedule_items').select('*');
    if (error) { console.error('Error fetching schedule:', error); return []; }
    return (data || []).map(mapScheduleFromDB);
  },
  saveSchedule: async (schedule: ScheduleItem[]): Promise<void> => {
    const { error: deleteError } = await supabase.from('schedule_items').delete().neq('id', '0');
    if (deleteError) {
      console.error('Error clearing schedule:', deleteError);
      return;
    }
    if (schedule.length > 0) {
      const dbItems = schedule.map(mapScheduleToDB);
      const { error } = await supabase.from('schedule_items').insert(dbItems);
      if (error) console.error('Error saving schedule:', error); 
    }
  },
  updateScheduleItem: async (id: string, updates: Partial<ScheduleItem>): Promise<ScheduleItem[]> => {
    const { error } = await supabase.from('schedule_items').update(mapScheduleToDB(updates)).eq('id', id);
    if (error) console.error('Error updating item:', error);
    return apiService.fetchSchedule();
  },
  deleteScheduleItem: async (id: string): Promise<ScheduleItem[]> => {
    const { error } = await supabase.from('schedule_items').delete().eq('id', id);
    if (error) console.error('Error deleting item:', error);
    return apiService.fetchSchedule();
  },

  // KIOSK LOGS
  fetchKioskLogs: async (): Promise<KioskLog[]> => {
    const { data, error } = await supabase.from('kiosk_logs').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Error fetching logs:', error); return []; }
    return (data || []).map(mapLogFromDB);
  },
  logKioskAction: async (log: KioskLog): Promise<{ success: boolean; updatedKid: Kid }> => {
    const { error: logError } = await supabase.from('kiosk_logs').insert(mapLogToDB(log));
    if (logError) {
      console.error('Log insert failed:', logError);
      return { success: false, updatedKid: {} as Kid };
    }
    const newStatus = log.action === 'DROP_OFF' ? 'CHECKED_IN' : 'CHECKED_OUT';
    const { data: kidData, error: kidError } = await supabase
      .from('clients_2026')
      .update({ current_status: newStatus })
      .eq('id', log.kidId)
      .select()
      .single();

    if (kidError || !kidData) {
      console.error('Kid status update failed:', kidError);
      return { success: false, updatedKid: {} as Kid };
    }
    return { success: true, updatedKid: mapKidFromDB(kidData) };
  }
};