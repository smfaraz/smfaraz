export enum Role {
  DIRECTOR = 'Director',
  STAFF = 'Staff',
  PARENT = 'Parent'
}

export enum ClinicalRole {
  BT = 'BT',
  RBT = 'RBT',
  RBT_TC = 'RBT-TC',
  BCBA = 'BCBA'
}

export enum Crew {
  ALPHA = 'Alpha',
  BRAVO = 'Bravo',
  CHARLIE = 'Charlie'
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
  TRAINING = 'Training'
}

export enum DayOfWeek {
  MON = 'Monday',
  TUE = 'Tuesday',
  WED = 'Wednesday',
  THU = 'Thursday',
  FRI = 'Friday'
}

export enum StaffStatus {
  ACTIVE = 'Active',
  SICK = 'Sick',
  PTO = 'PTO'
}

export enum SessionStatus {
  PENDING = 'Pending',
  CONFIRMED = 'Confirmed',
  CANCELLED = 'Cancelled'
}

export interface Trainer {
  id: string;
  name: string;
  username: string;
  password: string;
  clinicalRole: ClinicalRole;
  crew: Crew;
  specialties: Specialty[];
  maxHoursPerWeek: number;
  shiftStart: string;
  shiftEnd: string;
  availableDays: DayOfWeek[];
  type: 'Full-Time' | 'Contract';
  status: StaffStatus;
}

export interface Kid {
  id: string;
  name: string;
  parentUsername: string;
  parentPassword: string;
  crew: Crew;
  requiredSpecialties: Specialty[];
  sessionsPerWeek: number;
  sessionDurationMins: 30 | 45 | 60 | 90;
  insuranceCapHours: number;
  insuranceUsedHours: number;
  supervisionGoalWeekly: number;
}

export interface ScheduleItem {
  id: string;
  day: DayOfWeek;
  timeSlot: string;
  trainerId: string;
  trainerName: string;
  kidId: string;
  kidName: string;
  specialty: Specialty | string;
  sessionType: SessionType;
  durationMins: number;
  status: SessionStatus;
  crew: Crew;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}