export enum Role {
  DIRECTOR = 'Director',
  STAFF = 'Staff',
  PARENT = 'Parent',
  KIOSK = 'Kiosk'
}

export enum ClinicalRole {
  BT = 'BT',
  RBT = 'RBT',
  RBT_TC = 'RBT-TC',
  BCBA = 'BCBA'
}

export enum Specialty {
  SPEECH = 'Speech Therapy',
  OT = 'Occupational Therapy',
  PT = 'Physical Therapy',
  ABA = 'Applied Behavior Analysis'
}

export enum SessionType {
  INDIVIDUAL = 'Individual (97153)',
  SOCIAL = 'Social Group (97154)',
  SUPERVISE = 'Supervision (97155)',
  OBSERVE = 'Observation (97151)',
  OFFICE = 'Office Work',
  BREAK = 'Break',
  TRAINING = 'Training',
  HOME = 'In-Home Session',
  ADMIN = 'Admin / Cleaning',
  ABSENT = 'Client Absent'
}

export enum DayOfWeek {
  MON = 'Monday',
  TUE = 'Tuesday',
  WED = 'Wednesday',
  THU = 'Thursday',
  FRI = 'Friday',
  SAT = 'Saturday',
  SUN = 'Sunday'
}

export enum StaffStatus {
  ACTIVE = 'Active',
  SICK = 'Sick',
  PTO = 'PTO'
}

export enum SessionStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed'
}

export type WeeklySchedule = {
  [key in DayOfWeek]?: string; 
};

export interface Trainer {
  rules: {};
  id: string;
  name: string;
  username: string;
  password: string;
  clinicalRole: ClinicalRole;
  specialties: Specialty[];
  maxHoursPerWeek: number;
  shifts: WeeklySchedule; 
  type: 'Full-Time' | 'Contract';
  status: StaffStatus;
  excludeClientGender?: string;
  maxDailyHours?: number;
  is_full_time?: boolean; // ✅ Added to match your DB/CSV
}

export interface Kid {
  demands: {};
  id: string;
  name: string;
  parentUsername: string;
  parentPassword: string;
  requiredSpecialties: Specialty[];
  sessionsPerWeek: number;
  sessionDurationMins: number;
  insuranceCapHours: number;
  insuranceUsedHours: number;
  supervisionGoalWeekly: number;
  availability: WeeklySchedule;
  currentStatus?: 'CHECKED_IN' | 'CHECKED_OUT';
  gender?: string;
  inHomeAllowedStaffIds?: string[]; // ✅ Added to match your DB/CSV
  maxSessionMins?: number;
  conflictHistoryKids?: string[];
}

export interface ScheduleItem {
  id: string;
  day: DayOfWeek;
  dateStr?: string;
  timeSlot: string;
  trainerId: string;
  trainerName: string;
  kidId: string;
  kidName: string;
  specialty: Specialty | string;
  sessionType: SessionType;
  durationMins: number;
  status: SessionStatus;
  isLocked?: boolean; 
  isManuallyEdited?: boolean;
  manualUpdatedAt?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface KioskLog {
  id: string;
  kidId: string;
  kidName: string;
  action: 'DROP_OFF' | 'PICK_UP';
  timestamp: number;
  dateStr: string;
  photo?: string;
  method: 'PIN' | 'BIOMETRIC';
}