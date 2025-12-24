
import React from 'react';
import { Trainer, Kid, ScheduleItem, StaffStatus, SessionType } from '../types';
import { ChartBarIcon, UserGroupIcon, UserIcon, CalendarIcon, SparklesIcon, CheckIcon } from './Icons';

interface Props {
  trainers: Trainer[];
  kids: Kid[];
  schedule: ScheduleItem[];
}

export const DirectorDashboard: React.FC<Props> = ({ trainers, kids, schedule }) => {
  const activeStaff = trainers.filter(t => t.status === StaffStatus.ACTIVE).length;
  
  // Compliance Logic
  const socialBlockCount = schedule.filter(s => s.sessionType === SessionType.SOCIAL).length;
  const targetSocialCount = kids.length * 5; // 1 per day per kid
  const compliancePercent = targetSocialCount > 0 ? Math.min(100, (socialBlockCount / targetSocialCount) * 100) : 100;

  const stats = [
    { label: 'Staff Node', val: trainers.length, sub: `${activeStaff} Active`, icon: UserGroupIcon },
    { label: 'Sync Crews', val: '3 Nodes', sub: 'Alpha/Bravo/Charlie', icon: SparklesIcon },
    { label: 'Total Slots', val: schedule.length, sub: 'AI Balanced', icon: CalendarIcon },
    { label: 'Compliance', val: `${compliancePercent.toFixed(0)}%`, sub: 'Social Hours', icon: CheckIcon },
  ];

  return (
    <div className="space-y-8 lg:space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="glass-panel p-8 lg:p-10 rounded-[2.5rem] group hover:scale-[1.03] transition-all hover:border-brand-500/30">
            <div className="flex justify-between items-start mb-8">
               <div className="p-4 bg-brand-600/10 dark:bg-brand-600/20 text-brand-600 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-all shadow-xl shadow-brand-500/5">
                 <s.icon className="w-6 h-6" />
               </div>
               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{s.label}</span>
            </div>
            <h4 className="text-4xl font-black tracking-tighter dark:text-white mb-2">{s.val}</h4>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 glass-panel rounded-[3.5rem] overflow-hidden border-zinc-200 dark:border-zinc-800">
          <div className="p-8 lg:p-10 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-50/50 dark:bg-white/5">
            <div>
              <h3 className="font-black text-xl tracking-tighter uppercase dark:text-white">Compliance Monitor</h3>
              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mt-1">90-Min Session & Social Audit</p>
            </div>
          </div>
          <div className="p-8 space-y-6">
             {kids.map(k => {
               const kidSessions = schedule.filter(s => s.kidId === k.id);
               const longSessions = kidSessions.filter(s => s.durationMins === 90).length;
               const hasSocial = kidSessions.some(s => s.sessionType === SessionType.SOCIAL);
               
               return (
                 <div key={k.id} className="flex items-center justify-between p-6 bg-zinc-100/50 dark:bg-white/5 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${longSessions >= 3 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                      <div>
                        <p className="font-black text-sm dark:text-white">{k.name}</p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">{k.crew} Crew</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-xs font-black dark:text-white">{longSessions}/3</p>
                        <p className="text-[8px] font-black text-zinc-500 uppercase">90m Goals</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-black dark:text-white">{hasSocial ? 'YES' : 'NO'}</p>
                        <p className="text-[8px] font-black text-zinc-500 uppercase">Social Hr</p>
                      </div>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>

        <div className="glass-panel rounded-[3.5rem] p-12 bg-zinc-950 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden group min-h-[450px]">
           <div className="relative z-10">
              <div className="bg-brand-600 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] mb-12 inline-block">Sync Protocol</div>
              <h3 className="text-5xl font-black tracking-tighter leading-[0.85] mb-8">Crew Synchronization Active</h3>
              <p className="text-sm font-medium opacity-60 leading-relaxed max-w-sm">Transition windows are locked at 09:30, 11:00, 1:00, and 2:30. Ensure Alpha/Bravo staff are prepped for switch.</p>
           </div>
           
           <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span>Next Rotation</span>
                <span className="text-brand-400">11:00 AM (Social Block)</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full">
                <div className="h-full bg-brand-600 w-1/4 animate-pulse"></div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
