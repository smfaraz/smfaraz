import { supabase } from "../lib/supabaseClient";
import { Trainer, Kid, ScheduleItem, KioskLog } from "../types";

// --- UTILITY ---
const clean = (obj: any) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};

// --- MAPPERS ---
const mapTrainerFromDB = (t: any): Trainer => ({
  ...t,
  clinicalRole: t.clinical_role,
  maxHoursPerWeek: t.max_hours_per_week,
  excludeClientGender: t.exclude_client_gender,
  maxDailyHours: t.max_daily_hours || 8,
  is_full_time: t.is_full_time ?? false,
});

const mapTrainerToDB = (t: Partial<Trainer>) =>
  clean({
    id: t.id,
    name: t.name,
    username: t.username,
    password: t.password,
    clinical_role: t.clinicalRole,
    specialties: t.specialties,
    max_hours_per_week: t.maxHoursPerWeek,
    shifts: t.shifts,
    type: t.type,
    status: t.status,
    exclude_client_gender: t.excludeClientGender,
    max_daily_hours: t.maxDailyHours,
    is_full_time: (t as any).is_full_time,
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
  currentStatus: k.current_status || "CHECKED_OUT",
  gender: k.gender,
  inHomeAllowedStaffIds: k.in_home_allowed_staff_ids || [],
  maxSessionMins: k.max_session_mins || 240,
  conflictHistoryKids: k.conflict_history_kids || [],
});

const mapKidToDB = (k: Partial<Kid>) =>
  clean({
    id: k.id,
    name: k.name,
    parent_username: k.parentUsername,
    parent_password: k.parentPassword,
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
    conflict_history_kids: k.conflictHistoryKids,
  });

// ✅ FIX 1: Handle NULL IDs on fetch (prevent UI crashes)
const mapScheduleFromDB = (s: any): ScheduleItem => ({
  ...s,
  timeSlot: s.time_slot,
  dateStr: s.date_str,
  trainerId: s.trainer_id || "unassigned",
  trainerName: s.trainer_name || "Unassigned",
  // If kid_id is null (Break/Office), use a placeholder string
  kidId: s.kid_id || "system_placeholder", 
  kidName: s.kid_name,
  sessionType: s.session_type,
  durationMins: s.duration_mins,
  isLocked: s.is_locked,
});

// ✅ FIX 2: Convert "BREAK" / "OFFICE" IDs to NULL before DB Insert
const mapScheduleToDB = (s: Partial<ScheduleItem>) => {
  // Check if ID is a fake system ID
  const isSystemId = (id?: string) => id === "BREAK" || id === "OFFICE" || id === "ADMIN";

  return clean({
    id: s.id,
    day: s.day,
    time_slot: s.timeSlot,
    date_str: s.dateStr,
    trainer_id: s.trainerId === "unassigned" ? null : s.trainerId,
    trainer_name: s.trainerName,
    // 🔥 CRITICAL FIX: Send NULL if it's a Break/Office slot
    kid_id: isSystemId(s.kidId) ? null : s.kidId,
    kid_name: s.kidName,
    specialty: s.specialty,
    session_type: s.sessionType,
    duration_mins: s.durationMins,
    status: s.status,
    is_locked: s.isLocked,
  });
};

const mapLogFromDB = (l: any): KioskLog => ({
  ...l,
  kidId: l.kid_id,
  kidName: l.kid_name,
  dateStr: l.date_str,
  timestamp: Number(l.timestamp),
});

const mapLogToDB = (l: KioskLog) =>
  clean({
    id: l.id,
    kid_id: l.kidId,
    kid_name: l.kidName,
    action: l.action,
    timestamp: l.timestamp,
    date_str: l.dateStr,
    photo: l.photo,
    method: l.method,
  });

// --- API SERVICE ---
export const apiService = {
  fetchTrainers: async (): Promise<Trainer[]> => {
    const { data, error } = await supabase.from("trainers").select("*");
    if (error) { console.error("Error fetching trainers:", error); return []; }
    return (data || []).map(mapTrainerFromDB);
  },
  createTrainer: async (trainer: Trainer): Promise<Trainer[]> => {
    const { error } = await supabase.from("trainers").insert(mapTrainerToDB(trainer));
    if (error) console.error("Error creating trainer:", error);
    return apiService.fetchTrainers();
  },
  updateTrainer: async (id: string, updates: Partial<Trainer>): Promise<Trainer[]> => {
    const { error } = await supabase.from("trainers").update(mapTrainerToDB(updates)).eq("id", id);
    if (error) console.error("Error updating trainer:", error);
    return apiService.fetchTrainers();
  },
  deleteTrainer: async (id: string): Promise<Trainer[]> => {
    const { error } = await supabase.from("trainers").delete().eq("id", id);
    if (error) console.error("Error deleting trainer:", error);
    return apiService.fetchTrainers();
  },
  fetchKids: async (): Promise<Kid[]> => {
    const { data, error } = await supabase.from("kids").select("*");
    if (error) { console.error("Error fetching kids:", error); return []; }
    return (data || []).map(mapKidFromDB);
  },
  createKid: async (kid: Kid): Promise<Kid[]> => {
    const { error } = await supabase.from("kids").insert(mapKidToDB(kid));
    if (error) console.error("Error creating kid:", error);
    return apiService.fetchKids();
  },
  updateKid: async (id: string, updates: Partial<Kid>): Promise<Kid[]> => {
    const { error } = await supabase.from("kids").update(mapKidToDB(updates)).eq("id", id);
    if (error) console.error("Error updating kid:", error);
    return apiService.fetchKids();
  },
  deleteKid: async (id: string): Promise<Kid[]> => {
    const { error } = await supabase.from("kids").delete().eq("id", id);
    if (error) console.error("Error deleting kid:", error);
    return apiService.fetchKids();
  },
  fetchSchedule: async (): Promise<ScheduleItem[]> => {
    const { data, error } = await supabase.from("schedule_items").select("*");
    if (error) { console.error("Error fetching schedule:", error); return []; }
    return (data || []).map(mapScheduleFromDB);
  },
  
  clearScheduleRange: async (startDate: string, endDate: string): Promise<void> => {
     const { error } = await supabase.from("schedule_items").delete().gte('date_str', startDate).lte('date_str', endDate);
     if (error) console.error("Error clearing range:", error);
  },

  saveSchedule: async (schedule: ScheduleItem[]): Promise<void> => {
    if (schedule.length > 0) {
      const dbItems = schedule.map(mapScheduleToDB);
      const { error } = await supabase.from("schedule_items").upsert(dbItems);
      if (error) console.error("Error saving schedule:", error);
    }
  },
  updateScheduleItem: async (id: string, updates: Partial<ScheduleItem>): Promise<ScheduleItem[]> => {
    const { error } = await supabase.from("schedule_items").update(mapScheduleToDB(updates)).eq("id", id);
    if (error) console.error("Error updating item:", error);
    return apiService.fetchSchedule();
  },
  deleteScheduleItem: async (id: string): Promise<ScheduleItem[]> => {
    const { error } = await supabase.from("schedule_items").delete().eq("id", id);
    if (error) console.error("Error deleting item:", error);
    return apiService.fetchSchedule();
  },
  fetchKioskLogs: async (): Promise<KioskLog[]> => {
    const { data, error } = await supabase.from("kiosk_logs").select("*").order("created_at", { ascending: false });
    if (error) { console.error("Error fetching logs:", error); return []; }
    return (data || []).map(mapLogFromDB);
  },
  logKioskAction: async (log: KioskLog): Promise<{ success: boolean; updatedKid: Kid }> => {
    const { error: logError } = await supabase.from("kiosk_logs").insert(mapLogToDB(log));
    if (logError) { console.error("Log insert failed:", logError); return { success: false, updatedKid: {} as Kid }; }
    const newStatus = log.action === "DROP_OFF" ? "CHECKED_IN" : "CHECKED_OUT";
    const { data: kidData, error: kidError } = await supabase.from("kids").update({ current_status: newStatus }).eq("id", log.kidId).select().single();
    if (kidError || !kidData) { console.error("Kid status update failed:", kidError); return { success: false, updatedKid: {} as Kid }; }
    return { success: true, updatedKid: mapKidFromDB(kidData) };
  },
};