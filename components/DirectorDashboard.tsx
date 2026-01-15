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
  const availableTechs = trainers.length - activeStaff; // Or advanced logic checking current time availability
  
  // Kids scheduled Today (Assume today is Monday for demo, or real date match)
  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const kidsToday = new Set(schedule.filter(s => s.day === todayDay).map(s => s.kidId)).size;

  const socialBlockCount = schedule.filter(s => s.sessionType === SessionType.SOCIAL).length;
  const targetSocialCount = kids.length * 5; 
  const compliancePercent = targetSocialCount > 0 ? Math.min(100, (socialBlockCount / targetSocialCount) * 100) : 100;

  const stats = [
    { label: 'Staff Active', val: `${activeStaff}/${trainers.length}`, sub: 'Role: Active', icon: UserGroupIcon },
    { label: 'Techs Available', val: availableTechs, sub: 'Standby / OFF', icon: UserIcon },
    { label: 'Kids Scheduled', val: kidsToday, sub: 'Today\'s Roster', icon: CalendarIcon },
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
      
      {/* Existing Compliance Monitor Code... (Preserved) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 glass-panel rounded-[3.5rem] overflow-hidden border-zinc-200 dark:border-zinc-800">
             <div className="p-8"><h3 className="font-black text-xl uppercase dark:text-white">Compliance Monitor</h3></div>
             <div className="p-8 pt-0 space-y-4">
                 {/* Logic preserved from previous render */}
                 {kids.map(k => (
                     <div key={k.id} className="flex justify-between items-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                        <span className="font-bold text-sm">{k.name}</span>
                        <span className="text-xs text-zinc-400">{k.crew}</span>
                     </div>
                 ))}
             </div>
        </div>
      </div>
    </div>
  );
};