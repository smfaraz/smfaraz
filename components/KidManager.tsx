import React, { useState } from 'react';
import { Kid, KioskLog } from '../types';
import { UserIcon, EditIcon, TrashIcon, CalendarIcon } from './Icons';

interface Props {
  kids: Kid[];
  kioskLogs: KioskLog[];
  setKids: React.Dispatch<React.SetStateAction<Kid[]>>;
}

export const KidManager: React.FC<Props> = ({ kids, kioskLogs, setKids }) => {
  const [selectedKidLogs, setSelectedKidLogs] = useState<KioskLog[] | null>(null);

  const viewLogs = (kidId: string) => {
    const logs = kioskLogs.filter(l => l.kidId === kidId).sort((a,b) => b.timestamp - a.timestamp);
    setSelectedKidLogs(logs);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase tracking-tight dark:text-white">Student Roster</h2>
        <button className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-brand-700">+ New Student</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {kids.map(kid => (
          <div key={kid.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl flex flex-col gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${kid.currentStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                  {kid.name.substring(0, 1)}
                </div>
                <div>
                  <h3 className="font-bold text-lg dark:text-white">{kid.name}</h3>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${kid.currentStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                    {kid.currentStatus === 'CHECKED_IN' ? 'Checked In' : 'Checked Out'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
               <button onClick={() => viewLogs(kid.id)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-zinc-200">View History</button>
               <button className="p-2 text-zinc-400 hover:text-brand-600 bg-zinc-50 dark:bg-black/20 rounded-lg"><EditIcon className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
      </div>

      {selectedKidLogs && (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase dark:text-white">Attendance Logs</h3>
              <button onClick={() => setSelectedKidLogs(null)} className="text-zinc-400 hover:text-rose-500 font-bold">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {selectedKidLogs.length === 0 ? (
                <p className="text-center text-zinc-400 py-8 font-bold">No records found.</p>
              ) : (
                selectedKidLogs.map(log => (
                  <div key={log.id} className="flex gap-4 p-4 bg-zinc-50 dark:bg-black/20 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="w-16 h-16 bg-zinc-200 rounded-xl overflow-hidden shrink-0">
                      {log.photo ? <img src={log.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">No Img</div>}
                    </div>
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest mb-1 ${log.action === 'DROP_OFF' ? 'text-indigo-600' : 'text-emerald-600'}`}>{log.action.replace('_', ' ')}</p>
                      <p className="font-bold text-sm dark:text-white">{log.dateStr}</p>
                      <p className="text-[10px] text-zinc-400 mt-1 uppercase font-bold">Method: {log.method}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};