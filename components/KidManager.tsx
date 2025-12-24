
import React, { useState } from 'react';
import { Kid, Specialty, Crew } from '../types';
import { UserGroupIcon, PlusIcon, TrashIcon } from './Icons';

interface Props {
  kids: Kid[];
  setKids: React.Dispatch<React.SetStateAction<Kid[]>>;
}

export const KidManager: React.FC<Props> = ({ kids, setKids }) => {
  const [isAdding, setIsAdding] = useState(false);
  // Fixed: Added missing Kid properties to initialization
  const [newKid, setNewKid] = useState<Partial<Kid>>({
    name: '',
    parentUsername: '',
    parentPassword: 'password',
    requiredSpecialties: [],
    sessionsPerWeek: 2,
    sessionDurationMins: 45,
    crew: Crew.ALPHA,
    supervisionGoalWeekly: 2
  });

  const handleAddKid = () => {
    if (newKid.name && newKid.parentUsername && newKid.requiredSpecialties?.length) {
      // Fixed: Included all mandatory Kid properties in object creation
      const kid: Kid = {
        id: `k-${Date.now()}`,
        name: newKid.name!,
        parentUsername: newKid.parentUsername!,
        parentPassword: newKid.parentPassword || 'password',
        requiredSpecialties: newKid.requiredSpecialties!,
        sessionsPerWeek: newKid.sessionsPerWeek || 2,
        sessionDurationMins: (newKid.sessionDurationMins as any) || 45,
        insuranceCapHours: 40,
        insuranceUsedHours: 0,
        crew: newKid.crew || Crew.ALPHA,
        supervisionGoalWeekly: newKid.supervisionGoalWeekly || 2
      };
      setKids([...kids, kid]);
      setIsAdding(false);
      setNewKid({ 
        name: '', 
        parentUsername: '', 
        parentPassword: 'password', 
        requiredSpecialties: [], 
        sessionsPerWeek: 2, 
        sessionDurationMins: 45,
        crew: Crew.ALPHA,
        supervisionGoalWeekly: 2
      });
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Student Roster</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Enrollment & Authorization</p>
        </div>
        <button onClick={() => setIsAdding(!isAdding)} className="bg-pink-600 text-white p-2 rounded-xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-pink-100">
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isAdding && (
          <div className="bg-gray-50 border border-pink-100 rounded-3xl p-6 mb-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">New Student Enrollment</h3>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Student Name" className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newKid.name} onChange={e => setNewKid({...newKid, name: e.target.value})} />
              <input placeholder="Parent Login" className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newKid.parentUsername} onChange={e => setNewKid({...newKid, parentUsername: e.target.value})} />
            </div>
            {/* Added: UI fields for crew synchronization and supervision goals */}
            <div className="grid grid-cols-2 gap-4">
              <select className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newKid.crew} onChange={e => setNewKid({...newKid, crew: e.target.value as Crew})}>
                {Object.values(Crew).map(crew => <option key={crew} value={crew}>{crew} Crew</option>)}
              </select>
              <input type="number" placeholder="Supervision Goal (Hrs)" className="p-3 bg-white border border-gray-200 rounded-xl text-sm" value={newKid.supervisionGoalWeekly} onChange={e => setNewKid({...newKid, supervisionGoalWeekly: parseInt(e.target.value)})} />
            </div>
            <div className="flex gap-2 flex-wrap">
               {Object.values(Specialty).map(s => (
                 <button key={s} onClick={() => {
                   const cur = newKid.requiredSpecialties || [];
                   setNewKid({...newKid, requiredSpecialties: cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]})
                 }} className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${newKid.requiredSpecialties?.includes(s) ? 'bg-pink-600 border-pink-600 text-white' : 'bg-white text-gray-400'}`}>{s}</button>
               ))}
            </div>
            <button onClick={handleAddKid} className="w-full bg-pink-600 text-white font-bold py-3 rounded-xl">Enroll Student</button>
          </div>
        )}

        {kids.map(k => (
          <div key={k.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 group">
             <div>
                <h4 className="font-bold text-gray-900">{k.name}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parent: {k.parentUsername} • {k.requiredSpecialties.join('/')}</p>
             </div>
             <button onClick={() => setKids(kids.filter(x => x.id !== k.id))} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2"><TrashIcon className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
