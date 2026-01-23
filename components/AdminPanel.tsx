import React, { useState } from 'react';
import { Trainer, Kid, StaffStatus, ClinicalRole, KioskLog } from '../types';
import { PlusIcon, TrashIcon, CalendarIcon } from './Icons';
import { apiService } from '../services/apiService';

interface Props {
  trainers: Trainer[];
  setTrainers: (t: Trainer[]) => void;
  kids: Kid[];
  setKids: (k: Kid[]) => void;
  kioskLogs: KioskLog[];
  onImport: (newTrainers: Trainer[], newKids: Kid[]) => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<Props> = ({ trainers, setTrainers, kids, setKids, kioskLogs }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'students' | 'system'>('staff');
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      
      {/* TABS & ACTIONS */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex gap-6">
           <button onClick={() => setActiveTab('staff')} className={`text-sm font-semibold pb-4 -mb-4 transition-all border-b-2 ${activeTab === 'staff' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>Staff Management</button>
           <button onClick={() => setActiveTab('students')} className={`text-sm font-semibold pb-4 -mb-4 transition-all border-b-2 ${activeTab === 'students' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>Student Roster</button>
           <button onClick={() => setActiveTab('system')} className={`text-sm font-semibold pb-4 -mb-4 transition-all border-b-2 ${activeTab === 'system' ? 'text-brand-600 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>System Health</button>
        </div>
        <button onClick={() => setIsAddingStaff(true)} className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-brand-700 shadow-sm transition-all">
            <PlusIcon className="w-4 h-4" /> Add Record
        </button>
      </div>

      {/* DATA GRID */}
      {activeTab !== 'system' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
           <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                 <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name</th>
                 <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Role / ID</th>
                 <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                 <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {(activeTab === 'staff' ? trainers : kids).map((item: any) => (
                 <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                   <td className="p-4">
                     <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                   </td>
                   <td className="p-4 text-sm text-slate-500">
                     {activeTab === 'staff' ? 
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{item.clinicalRole}</span> : 
                        <span className="font-mono text-xs">{item.id}</span>
                     }
                   </td>
                   <td className="p-4">
                      {activeTab === 'students' && (
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${item.currentStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                             {item.currentStatus === 'CHECKED_IN' ? 'In Clinic' : 'Away'}
                          </span>
                      )}
                      {activeTab === 'staff' && (
                        <span className="text-xs text-slate-500">Active</span>
                      )}
                   </td>
                   <td className="p-4 text-right">
                      <button className="text-slate-400 hover:text-red-500 p-1"><TrashIcon className="w-4 h-4"/></button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      )}

      {/* ADD MODAL (Standardized) */}
      {isAddingStaff && (
         <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white p-6 rounded-xl w-96 shadow-xl">
               <h3 className="text-lg font-bold mb-4">Add New Record</h3>
               <input className="w-full border p-2 rounded mb-4" placeholder="Full Name" value={newStaffName} onChange={e => setNewStaffName(e.target.value)} />
               <div className="flex gap-2">
                 <button onClick={() => setIsAddingStaff(false)} className="flex-1 bg-slate-100 py-2 rounded font-semibold text-slate-600">Cancel</button>
                 <button className="flex-1 bg-brand-600 text-white py-2 rounded font-semibold">Create</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};