import React, { useState } from 'react';
import Papa from 'papaparse';
// REMOVED: Crew import
import { Trainer, Kid, Specialty, DayOfWeek, StaffStatus, ClinicalRole, KioskLog } from '../types';
import { EditIcon, TrashIcon, PlusIcon, DocumentUploadIcon, CalendarIcon, CheckIcon } from './Icons';
import { apiService } from '../services/apiService';

// --- SEED DATA FOR RESTORE (Crew Removed) ---
// --- SEED DATA FOR RESTORE ---

const SEED_TRAINERS: any[] = [
  // 1. Jose (RBT TC) - No Girls, Specific In-Home Rules
  { 
    id: 't_jose', 
    name: 'Jose', 
    clinicalRole: 'RBT-TC', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    excludeClientGender: 'Female', // "Not be scheduled with girls"
    shifts: { 
      Monday: '08:00 AM - 04:15 PM', 
      Tuesday: '08:00 AM - 04:15 PM', 
      Wednesday: '10:45 AM - 06:00 PM', 
      Thursday: '10:00 AM - 06:00 PM', // In-Home
      Friday: '08:00 AM - 04:15 PM' 
    }, 
    username: 'jose', 
    password: '123' 
  },
  // 2. Edin (BT) - No Girls, No In-Home
  { 
    id: 't_edin', 
    name: 'Edin', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 30, 
    status: 'Active', 
    excludeClientGender: 'Female', // "No girls"
    shifts: { 
      Monday: '07:50 AM - 12:45 PM', 
      Tuesday: '07:50 AM - 12:45 PM', 
      Wednesday: '07:50 AM - 12:45 PM', 
      Thursday: '07:50 AM - 12:45 PM' 
      // Friday OFF
    }, 
    username: 'edin', 
    password: '123' 
  },
  // 3. Juliana (BT) - Combination Schedule
  { 
    id: 't_juliana', 
    name: 'Juliana', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:50 AM - 07:00 PM', 
      Wednesday: '07:50 AM - 07:00 PM', 
      Friday: '10:00 AM - 06:00 PM' // In-Home
      // Tue, Thu OFF
    }, 
    username: 'juliana', 
    password: '123' 
  },
  // 4. Sabrina R (BT) - No In-Home
  { 
    id: 't_sabrina', 
    name: 'Sabrina R', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 30, 
    status: 'Active', 
    shifts: { 
      Monday: '08:15 AM - 04:15 PM', 
      Wednesday: '08:15 AM - 04:15 PM', 
      Friday: '08:15 AM - 04:15 PM' 
    }, 
    username: 'sabrina', 
    password: '123' 
  },
  // 5. Dahlida (BT) - AC/NK In-Home Only
  { 
    id: 't_dahlida', 
    name: 'Dahlida', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:50 AM - 07:00 PM', 
      Wednesday: '07:50 AM - 07:00 PM', 
      Friday: '07:50 AM - 07:00 PM' 
    }, 
    username: 'dahlida', 
    password: '123' 
  },
  // 6. Sarah (BT) - No In-Home
  { 
    id: 't_sarah', 
    name: 'Sarah', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '08:15 AM - 04:15 PM', 
      Tuesday: '08:15 AM - 04:15 PM', 
      Wednesday: '08:15 AM - 04:15 PM', 
      Thursday: '08:15 AM - 04:15 PM', 
      Friday: '08:15 AM - 04:15 PM' 
    }, 
    username: 'sarah', 
    password: '123' 
  },
  // 7. Amanda (BT) - AC In-Home Only
  { 
    id: 't_amanda', 
    name: 'Amanda', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 06:00 PM', 
      Tuesday: '07:45 AM - 06:00 PM', 
      Wednesday: '07:45 AM - 06:00 PM', 
      Thursday: '07:45 AM - 06:00 PM', 
      Friday: '07:45 AM - 06:00 PM' 
    }, 
    username: 'amanda', 
    password: '123' 
  },
  // 8. Kajal (BT) - No In-Home
  { 
    id: 't_kajal', 
    name: 'Kajal', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '08:30 AM - 04:15 PM', 
      Tuesday: '08:30 AM - 04:15 PM', 
      Wednesday: '08:30 AM - 04:15 PM', 
      Thursday: '08:30 AM - 04:15 PM', 
      Friday: '08:30 AM - 04:15 PM' 
    }, 
    username: 'kajal', 
    password: '123' 
  },
  // 9. Nairaah (BT) - AC/NK In-Home Only
  { 
    id: 't_nairaah', 
    name: 'Nairaah', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 06:30 PM', 
      Thursday: '07:45 AM - 06:30 PM', 
      Friday: '07:45 AM - 06:30 PM',
      Saturday: '10:30 AM - 02:30 PM', // Weekend for NK
      Sunday: '10:30 AM - 02:30 PM'    // Weekend for NK
    }, 
    username: 'nairaah', 
    password: '123' 
  },
  // 10. Alicia (BT) - No In-Home
  { 
    id: 't_alicia', 
    name: 'Alicia', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 04:15 PM', 
      Tuesday: '07:45 AM - 04:15 PM', 
      Wednesday: '07:45 AM - 04:15 PM', 
      Thursday: '07:45 AM - 04:15 PM', 
      Friday: '07:45 AM - 04:15 PM' 
    }, 
    username: 'alicia', 
    password: '123' 
  },
  // 11. Valentina (BT) - No In-Home
  { 
    id: 't_valentina', 
    name: 'Valentina', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 30, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 04:15 PM', 
      Wednesday: '07:45 AM - 04:15 PM', 
      Friday: '07:45 AM - 04:15 PM' 
    }, 
    username: 'valentina', 
    password: '123' 
  },
  // 12. Christeena (BT) - Trainer
  { 
    id: 't_christeena', 
    name: 'Christeena', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:50 AM - 04:15 PM', 
      Tuesday: '07:50 AM - 04:15 PM', 
      Wednesday: '10:00 AM - 06:00 PM', // In-Home
      Thursday: '10:45 AM - 06:00 PM', 
      Friday: '07:50 AM - 04:15 PM' 
    }, 
    username: 'christeena', 
    password: '123' 
  },
  // 13. Haadiya (BT) - No In-Home
  { 
    id: 't_haadiya', 
    name: 'Haadiya', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 32, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 04:15 PM', 
      Tuesday: '07:45 AM - 04:15 PM', 
      Wednesday: '07:45 AM - 04:15 PM', 
      Thursday: '07:45 AM - 04:15 PM' 
    }, 
    username: 'haadiya', 
    password: '123' 
  },
  // 14. Hamza (BT) - No Girls, No In-Home
  { 
    id: 't_hamza', 
    name: 'Hamza', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 30, 
    status: 'Active', 
    excludeClientGender: 'Female', // "Not be scheduled with girls"
    shifts: { 
      Monday: '01:00 PM - 04:15 PM', 
      Tuesday: '01:30 PM - 04:15 PM', 
      Wednesday: '01:00 PM - 04:15 PM', 
      Thursday: '01:30 PM - 04:15 PM', 
      Friday: '07:45 AM - 04:15 PM' 
    }, 
    username: 'hamza', 
    password: '123' 
  },
  // 15. Sonja (BT) - No In-Home
  { 
    id: 't_sonja', 
    name: 'Sonja', 
    clinicalRole: 'BT', 
    specialties: ['ABA'], 
    maxHoursPerWeek: 40, 
    status: 'Active', 
    shifts: { 
      Monday: '07:45 AM - 04:15 PM', 
      Tuesday: '07:45 AM - 04:15 PM', 
      Wednesday: '07:45 AM - 04:15 PM', 
      Thursday: '07:45 AM - 04:15 PM', 
      Friday: '07:45 AM - 04:15 PM' 
    }, 
    username: 'sonja', 
    password: '123' 
  },
  // 16. Buffer Techs (Inactive)
  { id: 't_aayush', name: 'Aayush', clinicalRole: 'BT', specialties: ['ABA'], maxHoursPerWeek: 0, status: 'Active', shifts: {}, username: 'aayush', password: '123' },
  { id: 't_nadia', name: 'Nadia', clinicalRole: 'BT', specialties: ['ABA'], maxHoursPerWeek: 0, status: 'Active', shifts: {}, username: 'nadia', password: '123' },
];

const SEED_KIDS: any[] = [
  // 1. Noah Khan
  { 
    id: 'k_nk', 
    name: 'Noah Khan (NK)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 7, 
    sessionDurationMins: 240, // 4 hours
    inHomeAllowedStaffIds: ['t_nairaah', 't_dahlida', 't_juliana'],
    availability: { 
      Monday: '03:00 PM - 07:00 PM', 
      Tuesday: '03:00 PM - 07:00 PM', 
      Wednesday: '03:00 PM - 07:00 PM', 
      Thursday: '03:00 PM - 07:00 PM', 
      Friday: '03:00 PM - 07:00 PM', 
      Saturday: '10:30 AM - 02:30 PM', 
      Sunday: '10:30 AM - 02:30 PM' 
    }, 
    parentUsername: 'nk', 
    parentPassword: '123' 
  },
  // 2. Massimilliano Abella (MA) - 1 hour sessions
  { 
    id: 'k_ma', 
    name: 'Massimilliano Abella (MA)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 60, // STRICT: "In-center sessiosn for MA must be for 1 hour only"
    availability: { 
      Monday: '09:00 AM - 03:00 PM', 
      Tuesday: '09:00 AM - 03:00 PM', 
      Wednesday: '09:00 AM - 03:00 PM', 
      Thursday: '09:00 AM - 03:00 PM', 
      Friday: '09:00 AM - 03:00 PM' 
    }, 
    parentUsername: 'ma', 
    parentPassword: '123' 
  },
  // 3. Taha Hasanuddin (TH) - Hybrid
  { 
    id: 'k_th', 
    name: 'Taha Hasanuddin (TH)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    inHomeAllowedStaffIds: ['t_jose', 't_christeena', 't_juliana'],
    availability: { 
      Monday: '08:30 AM - 04:00 PM', 
      Tuesday: '08:30 AM - 04:00 PM', 
      Wednesday: '10:00 AM - 04:00 PM', // Combined In-Home Blocks
      Thursday: '10:00 AM - 04:00 PM', 
      Friday: '10:00 AM - 04:00 PM' 
    }, 
    parentUsername: 'th', 
    parentPassword: '123' 
  },
  // 4. Humza Hasanuddin (HH) - Hybrid
  { 
    id: 'k_hh', 
    name: 'Humza Hasanuddin (HH)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    inHomeAllowedStaffIds: ['t_christeena', 't_juliana'], // Jose does NOT do HH
    availability: { 
      Monday: '08:30 AM - 04:00 PM', 
      Tuesday: '08:30 AM - 04:00 PM', 
      Wednesday: '04:00 PM - 06:00 PM', 
      Thursday: '04:00 PM - 06:00 PM', 
      Friday: '04:00 PM - 06:00 PM' 
    }, 
    parentUsername: 'hh', 
    parentPassword: '123' 
  },
  // 5. Yahya Hasanuddin (YH) - Hybrid
  { 
    id: 'k_yh', 
    name: 'Yahya Hasanuddin (YH)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    inHomeAllowedStaffIds: ['t_jose'],
    availability: { 
      Monday: '08:30 AM - 04:00 PM', 
      Tuesday: '08:30 AM - 04:00 PM', 
      Thursday: '04:00 PM - 06:00 PM' 
    }, 
    parentUsername: 'yh', 
    parentPassword: '123' 
  },
  // 6. Josiah Davis (JoDa) - Biweekly
  { 
    id: 'k_joda', 
    name: 'Josiah Davis (JoDa)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    availability: { 
      Monday: '08:00 AM - 04:00 PM', 
      Tuesday: '08:00 AM - 04:00 PM', 
      Wednesday: '08:00 AM - 04:00 PM', 
      Thursday: '08:00 AM - 04:00 PM', 
      Friday: '08:00 AM - 04:00 PM' 
    }, 
    parentUsername: 'joda', 
    parentPassword: '123' 
  },
  // 7. Jariah Davis (JaDa) - Biweekly
  { 
    id: 'k_jada', 
    name: 'Jariah Davis (JaDa)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    availability: { 
      Monday: '08:00 AM - 04:00 PM', 
      Tuesday: '08:00 AM - 04:00 PM', 
      Wednesday: '08:00 AM - 04:00 PM', 
      Thursday: '08:00 AM - 04:00 PM', 
      Friday: '08:00 AM - 04:00 PM' 
    }, 
    parentUsername: 'jada', 
    parentPassword: '123' 
  },
  // 8. Juliet Gonzales (JuG)
  { 
    id: 'k_jug', 
    name: 'Juliet Gonzales (JuG)', 
    gender: 'Female',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    availability: { 
      Monday: '08:30 AM - 12:30 PM', 
      Tuesday: '08:30 AM - 03:00 PM', 
      Wednesday: '08:30 AM - 03:00 PM', 
      Thursday: '08:30 AM - 12:30 PM', 
      Friday: '08:30 AM - 12:30 PM' 
    }, 
    parentUsername: 'jug', 
    parentPassword: '123' 
  },
  // 9. Aubrey Ford (AF)
  { 
    id: 'k_af', 
    name: 'Aubrey Ford (AF)', 
    gender: 'Female',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    availability: { 
      Monday: '08:00 AM - 04:00 PM', 
      Tuesday: '08:00 AM - 04:00 PM', 
      Wednesday: '08:00 AM - 04:00 PM', 
      Thursday: '08:00 AM - 04:00 PM', 
      Friday: '08:00 AM - 04:00 PM' 
    }, 
    parentUsername: 'af', 
    parentPassword: '123' 
  },
  // 10. Areeb Chowdhury (AC) - In-Home
  { 
    id: 'k_ac', 
    name: 'Areeb Chowdhury (AC)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    inHomeAllowedStaffIds: ['t_amanda', 't_nairaah', 't_dahlida', 't_jose'],
    availability: { 
      Monday: '04:00 PM - 06:00 PM', 
      Tuesday: '04:00 PM - 06:00 PM', 
      Wednesday: '04:00 PM - 06:00 PM', 
      Thursday: '04:00 PM - 06:00 PM', 
      Friday: '04:00 PM - 06:00 PM' 
    }, 
    parentUsername: 'ac', 
    parentPassword: '123' 
  },
  // 11. Emanuela Meron (EM)
  { 
    id: 'k_em', 
    name: 'Emanuela Meron (EM)', 
    gender: 'Female',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    conflictHistoryKids: ['k_ma'], // "EM cannot be scheduled with any tech who has had MA before her"
    availability: { 
      Monday: '08:45 AM - 04:00 PM', 
      Tuesday: '08:45 AM - 04:00 PM', 
      Wednesday: '08:45 AM - 04:00 PM', 
      Thursday: '08:45 AM - 04:00 PM', 
      Friday: '08:45 AM - 04:00 PM' 
    }, 
    parentUsername: 'em', 
    parentPassword: '123' 
  },
  // 12. Zain Dheyaa (ZD)
  { 
    id: 'k_zd', 
    name: 'Zain Dheyaa (ZD)', 
    gender: 'Male',
    requiredSpecialties: ['ABA'], 
    sessionsPerWeek: 5, 
    sessionDurationMins: 120,
    availability: { 
      Monday: '10:00 AM - 03:00 PM', 
      Tuesday: '10:00 AM - 03:00 PM', 
      Wednesday: '10:00 AM - 03:00 PM', 
      Thursday: '10:00 AM - 03:00 PM', 
      Friday: '10:00 AM - 03:00 PM' 
    }, 
    parentUsername: 'zd', 
    parentPassword: '123' 
  }
];

interface Props {
  trainers: Trainer[];
  setTrainers: (t: Trainer[]) => void;
  kids: Kid[];
  setKids: (k: Kid[]) => void;
  kioskLogs: KioskLog[];
  onImport: (newTrainers: Trainer[], newKids: Kid[]) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<Props> = ({ trainers, setTrainers, kids, setKids, kioskLogs, onImport }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'students' | 'system'>('staff');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  // Removed unused import states if they aren't used in the simplified snippet, keeping mostly consistent with your code structure
  const [selectedKidLogs, setSelectedKidLogs] = useState<KioskLog[] | null>(null);
  
  // --- SYSTEM DIAGNOSTICS ---
  const [restoreStatus, setRestoreStatus] = useState('');

  const handleRestoreData = async () => {
    setRestoreStatus('Restoring...');
    try {
      // Restore Trainers
      for (const t of SEED_TRAINERS) {
        await apiService.createTrainer(t);
      }
      // Restore Kids
      for (const k of SEED_KIDS) {
        await apiService.createKid(k);
      }
      
      const newTrainers = await apiService.fetchTrainers();
      const newKids = await apiService.fetchKids();
      setTrainers(newTrainers);
      setKids(newKids);
      setRestoreStatus('Success! Database Populated.');
    } catch (e: any) {
      setRestoreStatus(`Error: ${e.message}`);
    }
  };

  const handleViewLogs = (kidId: string) => {
    const logs = kioskLogs.filter(l => l.kidId === kidId).sort((a,b) => b.timestamp - a.timestamp);
    setSelectedKidLogs(logs);
  };

  // UPDATED: Initial state removed 'crew'
  const [newStaff, setNewStaff] = useState<Partial<Trainer>>({ 
    name: '', 
    username: '', 
    password: '123', 
    clinicalRole: ClinicalRole.BT, 
    // Crew removed
    specialties: [Specialty.ABA], 
    shiftStart: '08:00 AM', 
    shiftEnd: '04:00 PM', 
    availableDays: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI], 
    maxHoursPerWeek: 40, 
    status: StaffStatus.ACTIVE 
  });

  const [newStudent, setNewStudent] = useState<Partial<Kid>>({ 
    name: '', 
    // Crew removed
    parentUsername: '', 
    parentPassword: '123', 
    supervisionGoalWeekly: 2, 
    insuranceCapHours: 40, 
    insuranceUsedHours: 0 
  });

  const handleAddStaff = async () => { 
    if (!newStaff.name) return; 
    const t = { ...newStaff as Trainer, id: `t-${Date.now()}` }; 
    const updated = await apiService.createTrainer(t); 
    setTrainers(updated); 
    setIsAddingStaff(false); 
  };

  const handleAddStudent = async () => { 
    if (!newStudent.name) return; 
    const k = { 
      ...newStudent as Kid, 
      id: `k-${Date.now()}`, 
      requiredSpecialties: [Specialty.ABA], 
      sessionsPerWeek: 5, 
      sessionDurationMins: 90, 
      currentStatus: 'CHECKED_OUT' as const 
    }; 
    const updated = await apiService.createKid(k); 
    setKids(updated); 
    setIsAddingStudent(false); 
  };

  return (
    <div className="flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
        <div className="flex bg-zinc-100 dark:bg-white/5 p-1 rounded-xl border border-zinc-200/50 dark:border-white/5">
          <button onClick={() => setActiveTab('staff')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'staff' ? 'bg-white dark:bg-zinc-800 text-brand-600 shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500'}`}>Staff Node</button>
          <button onClick={() => setActiveTab('students')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'students' ? 'bg-white dark:bg-zinc-800 text-brand-600 shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500'}`}>Student Roster</button>
          <button onClick={() => setActiveTab('system')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'system' ? 'bg-white dark:bg-zinc-800 text-brand-600 shadow-sm border border-zinc-200 dark:border-zinc-700' : 'text-zinc-500'}`}>System</button>
        </div>
        
        {activeTab !== 'system' && (
          <div className="flex gap-2">
             <button onClick={() => activeTab === 'staff' ? setIsAddingStaff(true) : setIsAddingStudent(true)} className="bg-brand-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-brand-700 shadow-lg"><PlusIcon className="w-3.5 h-3.5" /> Enroll</button>
          </div>
        )}
      </div>

      {/* --- SYSTEM TAB --- */}
      {activeTab === 'system' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-8 rounded-3xl">
           <h3 className="text-xl font-black uppercase tracking-tight dark:text-white mb-4">Database Diagnostics</h3>
           <p className="text-sm text-zinc-500 mb-8">Use this to populate the database if the roster is empty.</p>
           
           <div className="flex gap-4 items-center">
             <button onClick={handleRestoreData} className="bg-zinc-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-transform">
               Run One-Click Repair / Seed Data
             </button>
             {restoreStatus && <span className="font-bold text-brand-600 animate-pulse">{restoreStatus}</span>}
           </div>
           
           <div className="mt-8 p-4 bg-zinc-50 dark:bg-black/20 rounded-2xl border border-zinc-100 dark:border-zinc-800">
             <p className="text-xs font-mono text-zinc-400">Current Counts:</p>
             <div className="flex gap-8 mt-2">
               <span className="font-bold dark:text-white">Staff: {trainers.length}</span>
               <span className="font-bold dark:text-white">Students: {kids.length}</span>
               <span className="font-bold dark:text-white">Logs: {kioskLogs.length}</span>
             </div>
           </div>
        </div>
      )}

      {/* --- ROSTER GRIDS --- */}
      {activeTab !== 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {(activeTab === 'staff' ? trainers : kids).map((item: any) => (
            <div key={item.id} className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-xl transition-all">
              <div className="flex justify-between items-start mb-4">
                {/* UPDATED: Removed Crew Display. Shows Role for Staff, First Initial for Students */}
                <div className="w-10 h-10 bg-brand-600/10 rounded-xl flex items-center justify-center text-brand-600 font-black text-[10px] border border-brand-600/20">
                  {activeTab === 'staff' ? item.clinicalRole : (item.name?.[0]?.toUpperCase() || 'S')}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={async () => {
                    if (activeTab === 'staff') setTrainers(await apiService.deleteTrainer(item.id));
                    else setKids(await apiService.deleteKid(item.id));
                  }} className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-zinc-400 hover:text-rose-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h4 className="font-black text-sm tracking-tight dark:text-white mb-0.5 truncate">{item.name}</h4>
              
              {activeTab === 'students' && (
                 <>
                   <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${item.currentStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                      {item.currentStatus === 'CHECKED_IN' ? 'IN CLINIC' : 'AWAY'}
                   </span>
                   <button onClick={() => handleViewLogs(item.id)} className="w-full mt-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-brand-600 text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2">
                     <CalendarIcon className="w-3 h-3" /> View Logs
                   </button>
                 </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --- ADD MODALS --- */}
      {(isAddingStaff || isAddingStudent) && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-10 border border-zinc-200 dark:border-zinc-800">
             <h3 className="text-lg font-black uppercase tracking-widest dark:text-white mb-4">Quick Add</h3>
             <input placeholder="Name" className="w-full p-4 bg-zinc-50 dark:bg-black rounded-2xl text-xs font-bold mb-4" 
               onChange={e => isAddingStaff ? setNewStaff({...newStaff, name: e.target.value}) : setNewStudent({...newStudent, name: e.target.value})} 
             />
             <div className="flex gap-2">
               <button onClick={() => { setIsAddingStaff(false); setIsAddingStudent(false); }} className="flex-1 py-4 bg-zinc-100 text-zinc-500 font-bold rounded-2xl">Cancel</button>
               <button onClick={isAddingStaff ? handleAddStaff : handleAddStudent} className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-2xl">Create</button>
             </div>
          </div>
        </div>
      )}

      {/* --- LOGS MODAL --- */}
      {selectedKidLogs && (
        <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 flex flex-col max-h-[80vh]">
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-black uppercase dark:text-white tracking-widest">Attendance Logs</h3>
               <button onClick={() => setSelectedKidLogs(null)} className="text-zinc-400 hover:text-rose-500 font-bold">&times;</button>
             </div>
             <div className="flex-1 overflow-y-auto space-y-4 pr-2">
               {selectedKidLogs.length === 0 ? <p className="text-center text-zinc-400 py-8 font-bold text-xs">No records.</p> : selectedKidLogs.map(log => (
                   <div key={log.id} className="flex gap-4 p-4 bg-zinc-50 dark:bg-black/20 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                     <div className="w-16 h-16 bg-zinc-200 rounded-xl overflow-hidden shrink-0 border">
                       {log.photo ? <img src={log.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px]">NO IMG</div>}
                     </div>
                     <div>
                       <p className={`text-[10px] font-black uppercase tracking-widest ${log.action === 'DROP_OFF' ? 'text-indigo-600' : 'text-emerald-600'}`}>{log.action.replace('_', ' ')}</p>
                       <p className="font-bold text-sm dark:text-white">{log.dateStr}</p>
                       <p className="text-[9px] text-zinc-400 mt-1 uppercase font-bold">Method: {log.method}</p>
                     </div>
                   </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};