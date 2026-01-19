import React from 'react';
import { Trainer, Kid, ScheduleItem, StaffStatus, SessionType } from '../types';
import { UserGroupIcon, UserIcon, CalendarIcon, CheckIcon } from './Icons';

interface Props {
  trainers: Trainer[];
  kids: Kid[];
  schedule: ScheduleItem[];
}

export const DirectorDashboard: React.FC<Props> = ({ trainers, kids, schedule }) => {
  const activeStaff = trainers.filter(t => t.status === StaffStatus.ACTIVE).length;
  const availableTechs = trainers.length - activeStaff; 
  
  const todayDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const kidsToday = new Set(schedule.filter(s => s.day === todayDay).map(s => s.kidId)).size;

  const socialBlockCount = schedule.filter(s => s.sessionType === SessionType.SOCIAL).length;
  const targetSocialCount = kids.length * 5; 
  const compliancePercent = targetSocialCount > 0 ? Math.min(100, (socialBlockCount / targetSocialCount) * 100) : 100;

  const stats = [
    { label: 'Active Staff', val: `${activeStaff}/${trainers.length}`, sub: 'Currently clocked in', icon: UserGroupIcon, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'Standby Techs', val: availableTechs, sub: 'Available for cover', icon: UserIcon, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Daily Roster', val: kidsToday, sub: 'Students scheduled today', icon: CalendarIcon, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Social Compliance', val: `${compliancePercent.toFixed(0)}%`, sub: 'Target hours met', icon: CheckIcon, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
               <div className={`p-3 rounded-lg ${s.bg} ${s.color}`}>
                 <s.icon className="w-5 h-5" />
               </div>
               {i === 3 && parseInt(s.val) < 80 && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">Attention</span>}
            </div>
            <div>
              <h4 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{s.val}</h4>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
              <p className="text-xs text-slate-400 mt-2">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* COMPLIANCE TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
           <h3 className="font-semibold text-slate-900 dark:text-white">Compliance Monitor</h3>
         </div>
         <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {kids.map(k => (
                     <div key={k.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {k.name.substring(0,2)}
                          </div>
                          <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{k.name}</span>
                        </div>
                        {/* Example status indicator */}
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                     </div>
                 ))}
             </div>
         </div>
      </div>
    </div>
  );
};