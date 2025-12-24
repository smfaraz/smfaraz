
import React, { useState } from 'react';
import { Trainer, Specialty, DayOfWeek, StaffStatus, ClinicalRole, Crew } from '../types';
import { UserIcon, PlusIcon, TrashIcon, EditIcon } from './Icons';
import { apiService } from '../services/apiService';

interface Props {
  trainers: Trainer[];
  setTrainers: React.Dispatch<React.SetStateAction<Trainer[]>>;
}

export const TrainerManager: React.FC<Props> = ({ trainers, setTrainers }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [newPassword, setNewPassword] = useState('');
  // Fixed: Added missing Trainer properties to initialization
  const [newTrainer, setNewTrainer] = useState<Partial<Trainer>>({
    name: '',
    username: '',
    password: 'password',
    specialties: [],
    availableDays: [],
    maxHoursPerWeek: 30,
    type: 'Full-Time',
    clinicalRole: ClinicalRole.BT,
    crew: Crew.ALPHA,
    shiftStart: '08:00 AM',
    shiftEnd: '04:30 PM'
  });

  const handleAddTrainer = () => {
    if (newTrainer.name && newTrainer.username && newTrainer.specialties?.length) {
      // Fixed: Included all mandatory Trainer properties in object creation
      const trainer: Trainer = {
        id: `t-${Date.now()}`,
        name: newTrainer.name!,
        username: newTrainer.username!,
        password: newTrainer.password || 'password',
        specialties: newTrainer.specialties!,
        availableDays: newTrainer.availableDays!,
        maxHoursPerWeek: newTrainer.maxHoursPerWeek || 30,
        type: newTrainer.type as 'Full-Time' | 'Contract' || 'Full-Time',
        status: StaffStatus.ACTIVE,
        clinicalRole: newTrainer.clinicalRole || ClinicalRole.BT,
        crew: newTrainer.crew || Crew.ALPHA,
        shiftStart: newTrainer.shiftStart || '08:00 AM',
        shiftEnd: newTrainer.shiftEnd || '04:30 PM'
      };
      setTrainers([...trainers, trainer]);
      setIsAdding(false);
      setNewTrainer({ 
        name: '', 
        username: '', 
        password: 'password', 
        specialties: [], 
        availableDays: [], 
        maxHoursPerWeek: 30, 
        type: 'Full-Time',
        clinicalRole: ClinicalRole.BT,
        crew: Crew.ALPHA,
        shiftStart: '08:00 AM',
        shiftEnd: '04:30 PM'
      });
    }
  };

  const removeTrainer = (id: string) => {
    setTrainers(trainers.filter(t => t.id !== id));
  };

  const handleChangePassword = async () => {
    if (!selectedTrainer || !newPassword) return;
    const updated = await apiService.updateTrainer(selectedTrainer.id, { password: newPassword });
    setTrainers(updated);
    setIsChangingPassword(false);
    setSelectedTrainer(null);
    setNewPassword('');
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2 uppercase tracking-tighter">
            Staff Directory
          </h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Resource Pool Management</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 text-white p-2 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-indigo-100"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isAdding && (
          <div className="bg-gray-50 border border-indigo-100 rounded-3xl p-6 mb-6 shadow-inner space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Create New Staff Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Name" className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newTrainer.name} onChange={e => setNewTrainer({...newTrainer, name: e.target.value})} />
              <input placeholder="Username" className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newTrainer.username} onChange={e => setNewTrainer({...newTrainer, username: e.target.value})} />
            </div>
            {/* Added: UI fields for clinical role and crew synchronization */}
            <div className="grid grid-cols-2 gap-4">
              <select className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newTrainer.clinicalRole} onChange={e => setNewTrainer({...newTrainer, clinicalRole: e.target.value as ClinicalRole})}>
                {Object.values(ClinicalRole).map(role => <option key={role} value={role}>{role}</option>)}
              </select>
              <select className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newTrainer.crew} onChange={e => setNewTrainer({...newTrainer, crew: e.target.value as Crew})}>
                {Object.values(Crew).map(crew => <option key={crew} value={crew}>{crew} Crew</option>)}
              </select>
            </div>
            <div className="flex gap-2 flex-wrap">
               {Object.values(Specialty).map(s => (
                 <button key={s} onClick={() => {
                   const cur = newTrainer.specialties || [];
                   setNewTrainer({...newTrainer, specialties: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]})
                 }} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${newTrainer.specialties?.includes(s) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white text-gray-400'}`}>{s}</button>
               ))}
            </div>
            <button onClick={handleAddTrainer} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">Save Therapist</button>
          </div>
        )}

        {trainers.map(t => (
          <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group">
             <div>
                <h4 className="font-bold text-gray-900">{t.name}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.username} • {t.specialties.join('/')}</p>
             </div>
             <div className="flex gap-2">
                <button onClick={() => {
                  setSelectedTrainer(t);
                  setIsChangingPassword(true);
                }} className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all p-2"><EditIcon className="w-4 h-4" /></button>
                <button onClick={() => removeTrainer(t.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><TrashIcon className="w-4 h-4" /></button>
              </div>
          </div>
        ))}
      </div>

      {isChangingPassword && selectedTrainer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-3xl shadow-xl p-8 space-y-4 w-full max-w-md">
            <h3 className="font-bold text-gray-900 text-lg">Change Password for {selectedTrainer.name}</h3>
            <input 
              type="password"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm"
            />
            <div className="flex justify-end gap-4">
              <button onClick={() => setIsChangingPassword(false)} className="text-gray-500 font-bold">Cancel</button>
              <button onClick={handleChangePassword} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
