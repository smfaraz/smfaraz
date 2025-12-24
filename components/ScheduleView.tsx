import React, { useState, useMemo } from 'react';
import { ScheduleItem, DayOfWeek, Trainer, Kid } from '../types';
import { CalendarIcon, EditIcon, TrashIcon, UserIcon, SparklesIcon, UserGroupIcon } from './Icons';

interface Props {
  schedule: ScheduleItem[];
  trainers: Trainer[];
  kids: Kid[];
  isLoading: boolean;
  onUpdateItem: (id: string, updates: Partial<ScheduleItem>) => void;
  onDeleteItem: (id: string) => void;
}

// Helper to convert "08:00 AM" or "01:00 PM" into minutes for sorting
const parseTimeValue = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  
  // Handle 12 PM (Noon) vs 12 AM (Midnight)
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
};

const DayColumn: React.FC<{ 
  day: DayOfWeek; 
  items: ScheduleItem[]; 
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}> = ({ day, items, onEdit, onDelete }) => {
  // FIXED: Sort by numeric time value, not alphabetical string
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => parseTimeValue(a.timeSlot) - parseTimeValue(b.timeSlot));
  }, [items]);

  return (
    <div className="w-[80vw] sm:w-[320px] lg:w-[350px] flex-shrink-0 flex flex-col gap-6 snap-center lg:snap-start">
      <div className="glass-panel py-4 rounded-[2rem] text-center border border-zinc-200 dark:border-white/10 shadow-md bg-white/80 dark:bg-black/80">
        <span className="font-black text-[10px] lg:text-xs uppercase tracking-[0.4em] dark:text-white">{day}</span>
      </div>
      
      <div className="space-y-6 flex-1 min-h-[500px]">
        {sortedItems.length === 0 ? (
          <div className="glass-panel h-full flex flex-col items-center justify-center rounded-[3rem] border-dashed border-zinc-200 dark:border-zinc-800 opacity-40 p-8 transition-all hover:opacity-60 group bg-zinc-50 dark:bg-zinc-900/50">
            <div className="p-4 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
              <SparklesIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] text-center leading-loose">No Active Sessions</p>
          </div>
        ) : (
          sortedItems.map(item => (
            <div key={item.id} className="glass-panel p-6 lg:p-8 rounded-[2.5rem] bg-white dark:bg-zinc-900 hover:scale-[1.01] transition-all hover:shadow-xl hover:border-brand-500/40 relative overflow-hidden group/card border border-zinc-200 dark:border-white/10 shadow-lg">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-600 opacity-60" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="font-black text-xl lg:text-2xl tracking-tighter leading-none dark:text-white block mb-1">{item.timeSlot}</span>
                  <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{item.durationMins}m Session</p>
                </div>
                <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-colors ${
                  item.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700'
                }`}>
                  {item.status}
                </span>
              </div>

              <div className="space-y-3 mb-8">
                <h5 className="font-black text-lg lg:text-xl tracking-tight uppercase truncate leading-none dark:text-white">{item.kidName}</h5>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-brand-600 rounded-full shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                   <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{item.specialty}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-500/10 rounded-xl flex items-center justify-center border border-brand-500/20">
                    <UserIcon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mb-0.5">Provider</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200 truncate max-w-[80px]">{item.trainerName}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => onEdit(item)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-brand-600 transition-all"><EditIcon className="w-4 h-4" /></button>
                  <button onClick={() => onDelete(item.id)} className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-400 hover:text-rose-500 transition-all"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const ScheduleView: React.FC<Props> = ({ schedule, trainers, kids, isLoading, onUpdateItem, onDeleteItem }) => {
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [kidFilter, setKidFilter] = useState<string>('all');

  const filteredItems = useMemo(() => {
    return schedule.filter(item => {
      const matchTrainer = trainerFilter === 'all' || item.trainerId === trainerFilter;
      const matchKid = kidFilter === 'all' || item.kidId === kidFilter;
      return matchTrainer && matchKid;
    });
  }, [schedule, trainerFilter, kidFilter]);

  if (isLoading) {
    return (
      <div className="glass-panel rounded-[3rem] min-h-[500px] flex flex-col items-center justify-center space-y-8 border-brand-500/20 bg-white/40 dark:bg-black/40 animate-in fade-in duration-500">
        <div className="neural-ring scale-[1.2]"></div>
        <div className="text-center space-y-4">
          <h3 className="text-2xl lg:text-3xl font-black uppercase tracking-[0.4em] dark:text-white">Balancing</h3>
          <p className="text-[9px] font-black text-brand-600 uppercase tracking-[0.2em] animate-pulse">Synchronizing Multi-Domain Clinical Constraints</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-center gap-4 px-4 lg:px-6">
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-600 transition-colors">
              <UserGroupIcon className="w-4 h-4" />
            </div>
            <select 
              value={trainerFilter}
              onChange={(e) => setTrainerFilter(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-black text-[9px] uppercase tracking-widest outline-none focus:ring-4 ring-brand-500/10 transition-all dark:text-white appearance-none cursor-pointer"
            >
              <option value="all">All Clinical Providers</option>
              {trainers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="relative group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-600 transition-colors">
              <UserIcon className="w-4 h-4" />
            </div>
            <select 
              value={kidFilter}
              onChange={(e) => setKidFilter(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-black text-[9px] uppercase tracking-widest outline-none focus:ring-4 ring-brand-500/10 transition-all dark:text-white appearance-none cursor-pointer"
            >
              <option value="all">All Student Roster</option>
              {kids.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {(trainerFilter !== 'all' || kidFilter !== 'all') && (
          <button 
            onClick={() => { setTrainerFilter('all'); setKidFilter('all'); }}
            className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-brand-600 transition-colors px-3 py-1"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="relative overflow-x-auto pb-12 cursor-grab active:cursor-grabbing snap-x snap-mandatory scrollbar-hide scroll-smooth">
        <div className="flex gap-6 min-w-max px-4 lg:px-6">
          {Object.values(DayOfWeek).map(day => (
            <DayColumn 
              key={day} 
              day={day} 
              items={filteredItems.filter(s => s.day === day)} 
              onEdit={setEditingItem}
              onDelete={onDeleteItem}
            />
          ))}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-[1000] bg-zinc-950/80 backdrop-blur-3xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-md rounded-[3rem] overflow-hidden border border-white/20 p-8 bg-white/95 dark:bg-zinc-900/95 shadow-2xl scale-in-center">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black tracking-tighter uppercase dark:text-white">Slot Override</h3>
               <button onClick={() => setEditingItem(null)} className="text-zinc-400 hover:text-rose-500 text-4xl font-light leading-none transition-colors">&times;</button>
            </div>
            
            <div className="space-y-8">
               <div className="space-y-3">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.3em] ml-1">Clinical Verification</label>
                  <select 
                      className="w-full p-6 bg-zinc-100 dark:bg-black/60 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] font-black text-xs uppercase tracking-widest outline-none focus:ring-4 ring-brand-500/20 transition-all dark:text-white"
                      value={editingItem.status}
                      onChange={(e) => setEditingItem({...editingItem, status: e.target.value as any})}
                  >
                    <option value="Pending">Awaiting Authorization</option>
                    <option value="Confirmed">Authorize Session</option>
                    <option value="Cancelled">Void Time Slot</option>
                  </select>
               </div>
               
               <div className="pt-4 flex flex-col gap-3">
                 <button onClick={() => { onUpdateItem(editingItem.id, editingItem); setEditingItem(null); }} className="w-full py-5 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-brand-500/40 hover:bg-brand-700 transition-all">Apply Override</button>
                 <button onClick={() => setEditingItem(null)} className="w-full py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] hover:text-zinc-800 dark:hover:text-zinc-200 transition-all">Discard</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};