import React from 'react';
import { Trainer, ScheduleItem, DayOfWeek, StaffStatus } from '../types';
import { ChartBarIcon, UserIcon, CalendarIcon, SparklesIcon } from './Icons';

interface Props {
  trainer: Trainer;
  schedule: ScheduleItem[];
  onUpdateStatus: (status: StaffStatus) => void;
}

export const StaffDashboard: React.FC<Props> = ({ trainer, schedule, onUpdateStatus }) => {
  const totalMinutes = schedule.reduce((acc, s) => acc + s.durationMins, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const loadPercentage = Math.min(100, (Number(totalHours) / trainer.maxHoursPerWeek) * 100);
  
  const uniquePatientIds = new Set(schedule.map(s => s.kidId));
  const patientCount = uniquePatientIds.size;

  const todayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
  const todaySessions = schedule.filter(s => s.day === todayName as DayOfWeek);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* AVAILABILITY TOGGLE */}
      <div className="glass-panel p-8 rounded-[3rem] border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full animate-pulse ${trainer.status === StaffStatus.ACTIVE ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]'}`} />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400 mb-1">Current Status</p>
            <h4 className="text-xl font-black uppercase tracking-tight dark:text-white">{trainer.status}</h4>
          </div>
        </div>
        <div className="flex bg-zinc-100 dark:bg-black/40 p-2 rounded-[2rem] border border-zinc-200 dark:border-zinc-800">
          {Object.values(StaffStatus).map((status) => (
            <button
              key={status}
              onClick={() => onUpdateStatus(status)}
              className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
                trainer.status === status 
                  ? 'bg-brand-600 text-white shadow-lg' 
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* STATS HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-8 rounded-[3rem] border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-brand-600/10 dark:bg-brand-600/20 text-brand-600 rounded-2xl">
              <ChartBarIcon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Weekly Load</span>
          </div>
          <h4 className="text-4xl font-black tracking-tighter dark:text-white mb-4">{totalHours}h <span className="text-lg text-zinc-500 font-medium">/ {trainer.maxHoursPerWeek}h</span></h4>
          <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-600 transition-all duration-1000" 
              style={{ width: `${loadPercentage}%` }} 
            />
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[3rem] border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 rounded-2xl">
              <UserIcon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Patients</span>
          </div>
          <h4 className="text-4xl font-black tracking-tighter dark:text-white mb-2">{patientCount}</h4>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Clinical Caseload</p>
        </div>

        <div className="glass-panel p-8 rounded-[3rem] border-zinc-200 dark:border-zinc-800">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 rounded-2xl">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Today's Load</span>
          </div>
          <h4 className="text-4xl font-black tracking-tighter dark:text-white mb-2">{todaySessions.length}</h4>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Scheduled Sessions</p>
        </div>
      </div>

      {/* TODAY'S TIMELINE */}
      <div className="glass-panel rounded-[4rem] overflow-hidden border-zinc-200 dark:border-zinc-800">
        <div className="p-10 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-white/5">
          <div>
            <h3 className="font-black text-xl tracking-tighter uppercase dark:text-white">Today's Path</h3>
            <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">{todayName} Clinical Sequence {trainer.status !== StaffStatus.ACTIVE && '(In-Active)'}</p>
          </div>
          <div className={`px-5 py-2 text-white text-[10px] font-black uppercase rounded-xl tracking-widest ${trainer.status === StaffStatus.ACTIVE ? 'bg-brand-600' : 'bg-rose-500'}`}>
            {trainer.status === StaffStatus.ACTIVE ? 'Active' : 'Offline'}
          </div>
        </div>

        <div className="p-10">
          {todaySessions.length === 0 ? (
            <div className="text-center py-20 opacity-40">
              <CalendarIcon className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
              <p className="font-black text-xs uppercase tracking-widest">No Sessions Assigned for Today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todaySessions.sort((a,b) => a.timeSlot.localeCompare(b.timeSlot)).map(session => (
                <div key={session.id} className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-white dark:bg-zinc-900/50 rounded-3xl border border-zinc-100 dark:border-zinc-800 hover:border-brand-500/30 transition-all group">
                  <div className="w-full sm:w-28 text-center sm:text-left">
                    <p className="text-lg font-black dark:text-white">{session.timeSlot}</p>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase">{session.durationMins}m</p>
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-black text-sm uppercase tracking-tight dark:text-white group-hover:text-brand-600 transition-colors">{session.kidName}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{session.specialty}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[9px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                      {session.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};