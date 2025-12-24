import React, { useState } from 'react'; // Removed duplicate imports
import Papa from 'papaparse';
import { Trainer, Kid, Specialty, DayOfWeek, StaffStatus, ClinicalRole, Crew } from '../types';
import { EditIcon, TrashIcon, PlusIcon, DocumentUploadIcon } from './Icons';
import { apiService } from '../services/apiService';

interface Props {
  trainers: Trainer[];
  setTrainers: (t: Trainer[]) => void;
  kids: Kid[];
  setKids: (k: Kid[]) => void;
  onImport: (newTrainers: Trainer[], newKids: Kid[]) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<Props> = ({ trainers, setTrainers, kids, setKids, onImport }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'students'>('staff');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isImportingStaff, setIsImportingStaff] = useState(false);
  const [isImportingStudents, setIsImportingStudents] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Trainer | Kid | null>(null);
  const [newPassword, setNewPassword] = useState('');
  
  const [newStaff, setNewStaff] = useState<Partial<Trainer>>({
    name: '',
    username: '',
    password: 'password123',
    clinicalRole: ClinicalRole.BT,
    crew: Crew.ALPHA,
    specialties: [Specialty.ABA],
    shiftStart: '08:00 AM',
    shiftEnd: '04:00 PM',
    availableDays: [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI],
    maxHoursPerWeek: 40,
    status: StaffStatus.ACTIVE
  });

  const [newStudent, setNewStudent] = useState<Partial<Kid>>({
    name: '',
    crew: Crew.ALPHA,
    parentUsername: '',
    parentPassword: 'password123',
    supervisionGoalWeekly: 2,
    insuranceCapHours: 40,
    insuranceUsedHours: 0
  });

  const handleAddStaff = async () => {
    if (!newStaff.name || !newStaff.username) return;
    const trainer: Trainer = {
      ...newStaff as Trainer,
      id: `t-${Date.now()}`,
    };
    const updated = await apiService.createTrainer(trainer);
    setTrainers(updated);
    setIsAddingStaff(false);
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.parentUsername) return;
    const kid: Kid = {
      ...newStudent as Kid,
      id: `k-${Date.now()}`,
      requiredSpecialties: [Specialty.ABA],
      sessionsPerWeek: 5,
      sessionDurationMins: 90
    };
    const updated = await apiService.createKid(kid);
    setKids(updated);
    setIsAddingStudent(false);
  };

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword) return;

    if (activeTab === 'staff') {
      const updated = await apiService.updateTrainer(selectedUser.id, { password: newPassword });
      setTrainers(updated);
    } else {
      const updated = await apiService.updateKid(selectedUser.id, { parentPassword: newPassword });
      setKids(updated);
    }

    setIsChangingPassword(false);
    setSelectedUser(null);
    setNewPassword('');
  };

  const handleImportStaff = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const importedTrainers: Trainer[] = results.data.map((row: any, index: number) => ({
          id: `t-import-${Date.now()}-${index}`,
          name: row.name,
          username: row.username,
          password: 'password123',
          clinicalRole: row.clinicalRole as ClinicalRole,
          crew: row.crew as Crew,
          specialties: row.specialties ? row.specialties.split(',').map((s: string) => s.trim() as Specialty) : [Specialty.ABA],
          shiftStart: row.shiftStart,
          shiftEnd: row.shiftEnd,
          availableDays: row.availableDays ? row.availableDays.split(',').map((d: string) => d.trim() as DayOfWeek) : [DayOfWeek.MON, DayOfWeek.TUE, DayOfWeek.WED, DayOfWeek.THU, DayOfWeek.FRI],
          maxHoursPerWeek: parseInt(row.maxHoursPerWeek) || 40,
          type: row.type as 'Full-Time' | 'Contract',
          status: row.status as StaffStatus
        }));

        for (const trainer of importedTrainers) {
          await apiService.createTrainer(trainer);
        }
        const updated = await apiService.fetchTrainers();
        setTrainers(updated);
        setIsImportingStaff(false);
      }
    });
  };

  const handleImportStudents = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const importedKids: Kid[] = results.data.map((row: any, i: number) => ({
          id: `k-import-${Date.now()}-${i}`,
          name: row.name,
          parentUsername: row.parentUsername,
          parentPassword: 'password123',
          crew: row.crew as Crew,
          requiredSpecialties: [Specialty.ABA],
          sessionsPerWeek: 5,
          sessionDurationMins: 90,
          insuranceCapHours: 40,
          insuranceUsedHours: 0,
          supervisionGoalWeekly: 2
        }));

        for (const kid of importedKids) {
          await apiService.createKid(kid);
        }

        const updatedKids = await apiService.fetchKids();

        // 🔥 FIX APPLIED: Pass 'trainers' (current state) instead of [] so we don't wipe staff
        onImport(trainers, updatedKids);
        setKids(updatedKids);

        setIsImportingStudents(false);
      }
    });
  };

  // Determine which list to render and ensure it is an array
  const listToRender = activeTab === 'staff' ? trainers : (kids || []);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex bg-zinc-200 dark:bg-white/5 p-2 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <button onClick={() => setActiveTab('staff')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'staff' ? 'bg-brand-600 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-800'}`}>Staff Node</button>
          <button onClick={() => setActiveTab('students')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'students' ? 'bg-brand-600 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-800'}`}>Student Roster</button>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => activeTab === 'staff' ? setIsImportingStaff(true) : setIsImportingStudents(true)}
            className="bg-zinc-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl"
          >
            <DocumentUploadIcon className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={() => activeTab === 'staff' ? setIsAddingStaff(true) : setIsAddingStudent(true)}
            className="bg-brand-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-2xl"
          >
            <PlusIcon className="w-4 h-4" />
            Enroll {activeTab === 'staff' ? 'Provider' : 'Student'}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-[3.5rem] p-8 border border-zinc-200 dark:border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listToRender.map((item: any) => (
            <div key={item.id} className="p-8 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-brand-600/10 rounded-2xl flex items-center justify-center text-brand-600 font-black text-xs">
                  {/* Safety check: use optional chaining (?.) and fallback */}
                  {activeTab === 'staff' ? item.clinicalRole : (item.crew?.[0] || '?')}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setSelectedUser(item);
                    setIsChangingPassword(true);
                  }} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-300 hover:text-brand-500 transition-all"><EditIcon className="w-4 h-4" /></button>
                  <button onClick={async () => {
                    if (activeTab === 'staff') {
                      const updated = await apiService.deleteTrainer(item.id);
                      setTrainers(updated);
                    } else {
                      const updated = await apiService.deleteKid(item.id);
                      setKids(updated);
                    }
                  }} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-300 hover:text-rose-500 transition-all"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
              <h4 className="font-black text-xl tracking-tight dark:text-white mb-1 leading-none">{item.name}</h4>
              <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-6">
                {item.crew || 'No'} Crew Sync
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="bg-brand-600/10 text-brand-600 text-[8px] font-black px-2 py-1 rounded-lg uppercase">
                  {activeTab === 'staff' ? item.shiftStart : `${item.supervisionGoalWeekly || 0}h Supervise`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {isChangingPassword && selectedUser && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-xl rounded-[4rem] p-12 bg-white dark:bg-zinc-950">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-3xl font-black uppercase dark:text-white">Change Password for {selectedUser.name}</h3>
              <button onClick={() => setIsChangingPassword(false)} className="text-4xl text-zinc-400">&times;</button>
            </div>
            <div className="space-y-6">
              <input 
                type="password" 
                placeholder="New Password" 
                className="w-full p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)} 
              />
              <button onClick={handleChangePassword} className="w-full py-6 bg-brand-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl">Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ENROLL PROVIDER MODAL */}
      {isAddingStaff && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-xl rounded-[4rem] p-12 bg-white dark:bg-zinc-950">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-black uppercase dark:text-white">Enroll Provider</h3>
               <button onClick={() => setIsAddingStaff(false)} className="text-4xl text-zinc-400">&times;</button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Full Name" className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                <input placeholder="Username" className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white" value={newStaff.clinicalRole} onChange={e => setNewStaff({...newStaff, clinicalRole: e.target.value as ClinicalRole})}>
                  {Object.values(ClinicalRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white" value={newStaff.crew} onChange={e => setNewStaff({...newStaff, crew: e.target.value as Crew})}>
                  {Object.values(Crew).map(c => <option key={c} value={c}>{c} Crew</option>)}
                </select>
              </div>
              <button onClick={handleAddStaff} className="w-full py-6 bg-brand-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl">Establish Provider ID</button>
            </div>
          </div>
        </div>
      )}

      {/* ENROLL STUDENT MODAL */}
      {isAddingStudent && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-xl rounded-[4rem] p-12 bg-white dark:bg-zinc-950">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-black uppercase dark:text-white">Enroll Student</h3>
               <button onClick={() => setIsAddingStudent(false)} className="text-4xl text-zinc-400">&times;</button>
            </div>
            <div className="space-y-6">
              <input placeholder="Student Name" className="w-full p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
              <input placeholder="Parent Username" className="w-full p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" value={newStudent.parentUsername} onChange={e => setNewStudent({...newStudent, parentUsername: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <select className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white" value={newStudent.crew} onChange={e => setNewStudent({...newStudent, crew: e.target.value as Crew})}>
                  {Object.values(Crew).map(c => <option key={c} value={c}>{c} Crew</option>)}
                </select>
                <input placeholder="Supervision Goal (Hrs)" type="number" className="p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white outline-none focus:ring-2 ring-brand-600" value={newStudent.supervisionGoalWeekly} onChange={e => setNewStudent({...newStudent, supervisionGoalWeekly: parseInt(e.target.value)})} />
              </div>
              <div onClick={handleAddStudent} className="w-full py-6 bg-brand-600 text-white font-black uppercase tracking-widest rounded-3xl shadow-xl text-center cursor-pointer">Confirm Enrollment</div>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT STAFF MODAL */}
      {isImportingStaff && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-2xl rounded-[4rem] p-12 bg-white dark:bg-zinc-950">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-black uppercase dark:text-white">Import Staff CSV</h3>
               <button onClick={() => setIsImportingStaff(false)} className="text-4xl text-zinc-400">&times;</button>
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-3xl">
                <h4 className="font-black text-lg mb-4 dark:text-white">Expected CSV Layout:</h4>
                <pre className="text-[10px] font-mono dark:text-zinc-300">
                  name,username,clinicalRole,crew,specialties,shiftStart,shiftEnd,availableDays,maxHoursPerWeek,type,status
                  John Doe,john,BCBA,Alpha,ABA,08:00 AM,04:00 PM,Monday,Tuesday,Wednesday,Thursday,Friday,40,Full-Time,Active
                  Jane Smith,jane,RBT,Beta,ABA,09:00 AM,05:00 PM,Monday,Wednesday,Friday,30,Contract,Active
                </pre>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-4">Note: specialties and availableDays should be comma-separated if multiple values.</p>
              </div>
              <input type="file" accept=".csv" onChange={handleImportStaff} className="w-full p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white" />
            </div>
          </div>
        </div>
      )}

      {/* IMPORT STUDENTS MODAL */}
      {isImportingStudents && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-3xl flex items-center justify-center p-6">
          <div className="glass-panel w-full max-w-2xl rounded-[4rem] p-12 bg-white dark:bg-zinc-950">
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-black uppercase dark:text-white">Import Students CSV</h3>
               <button onClick={() => setIsImportingStudents(false)} className="text-4xl text-zinc-400">&times;</button>
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-zinc-100 dark:bg-zinc-800 rounded-3xl">
                <h4 className="font-black text-lg mb-4 dark:text-white">Expected CSV Layout:</h4>
                <pre className="text-[10px] font-mono dark:text-zinc-300">
                  name,parentUsername,crew,requiredSpecialties,sessionsPerWeek,sessionDurationMins,insuranceCapHours,insuranceUsedHours,supervisionGoalWeekly
                  Alice Johnson,alice_parent,Alpha,ABA,5,90,40,0,2
                  Bob Wilson,bob_parent,Beta,ABA,5,90,50,10,3
                </pre>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-4">Note: requiredSpecialties should be comma-separated if multiple values.</p>
              </div>
              <input type="file" accept=".csv" onChange={handleImportStudents} className="w-full p-5 bg-zinc-100 dark:bg-black rounded-3xl dark:text-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};