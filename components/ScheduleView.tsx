import React, { useState, useMemo } from 'react';
import { ScheduleItem, DayOfWeek, Trainer, Kid, SessionType } from '../types';
import { EditIcon, TrashIcon, UserIcon, LockIcon, DocumentUploadIcon, SparklesIcon } from './Icons';
import { runAutoScheduler, GenerationScope } from '../services/schedulerIntegration';
// ✅ IMPORT THE NEW EXCEL SERVICE
import { generateClinicalExcel } from '../services/excelExportService';

interface Props {
  schedule: ScheduleItem[];
  trainers: Trainer[];
  kids: Kid[];
  isLoading: boolean;
  lockedDays: DayOfWeek[];
  onToggleLock: (day: DayOfWeek) => void;
  onUpdateItem: (id: string, updates: Partial<ScheduleItem>) => void;
  onDeleteItem: (id: string) => void;
  onRefresh: () => void;
}

// ✅ STRICT OFFSET MAP
const DayToOffset: Record<DayOfWeek, number> = {
  [DayOfWeek.MON]: 0,
  [DayOfWeek.TUE]: 1,
  [DayOfWeek.WED]: 2,
  [DayOfWeek.THU]: 3,
  [DayOfWeek.FRI]: 4,
  [DayOfWeek.SAT]: 5,
  [DayOfWeek.SUN]: 6
};

// ============================================================================
// PART 1: HELPER FUNCTIONS
// ============================================================================

const parseTimeValue = (timeStr: string): number => {
  if (timeStr === "In-Home" || timeStr === "All Day") return -1; 
  if (!timeStr) return 0;
  const [time, period] = timeStr.split(' ');
  if (!time || !period) return 0;
  let [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const formatTimeRange = (startStr: string, durationMins: number): string => {
  if (!startStr || startStr.startsWith("In-Home") || startStr.includes("All Day")) return startStr;
  const [time, period] = startStr.split(' ');
  if (!time || !period) return startStr;
  let [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return startStr;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  const startTotalMins = hours * 60 + minutes;
  const endTotalMins = startTotalMins + durationMins;
  let endH = Math.floor(endTotalMins / 60);
  const endM = endTotalMins % 60;
  const endPeriod = endH >= 12 ? 'PM' : 'AM';
  if (endH > 12) endH -= 12;
  if (endH === 0) endH = 12;

  return `${startStr} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} ${endPeriod}`;
};

// ============================================================================
// PART 2: SUB-COMPONENTS
// ============================================================================

const CompactSessionCard: React.FC<{
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
  isPast: boolean;
}> = ({ item, onEdit, onDelete, isPast }) => {
  
  const isHome = item.sessionType === SessionType.HOME;
  const isBreak = item.sessionType === SessionType.BREAK;

  if (isBreak) {
    return (
      <div className={`group relative border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-3 bg-zinc-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center gap-1 cursor-default transition-all ${isPast ? 'opacity-40' : 'opacity-60 hover:opacity-100'}`}>
        <span className="text-xs font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em]">BREAK</span>
        <span className="text-[10px] font-bold text-zinc-400/70">{formatTimeRange(item.timeSlot, item.durationMins)}</span>
      </div>
    );
  }
  
  const opacityClass = isPast ? "opacity-60 grayscale-[0.8]" : "opacity-100";
  const cursorClass = isPast ? "cursor-not-allowed" : "cursor-pointer";
  const hoverClass = isPast ? "" : "hover:shadow-md hover:border-brand-500/50";

  return (
    <div className={`group relative border rounded-xl p-2.5 transition-all shadow-sm ${opacityClass} ${cursorClass} ${hoverClass}
      ${isHome 
        ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' 
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
    }`} onClick={() => !isPast && onEdit(item)}>
      
      {isPast && (
        <div className="absolute top-1 right-1 z-10 text-zinc-400">
           <LockIcon className="w-3 h-3" />
        </div>
      )}

      <div className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full ${
        isHome ? 'bg-orange-400' :
        item.status === 'Confirmed' ? 'bg-emerald-500' : 
        item.status === 'Pending' ? 'bg-amber-400' : 
        'bg-rose-500'
      }`} />

      <div className="pl-2.5 flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className={`font-black text-xs tracking-tight whitespace-nowrap ${isHome ? 'text-orange-900 dark:text-orange-100' : 'text-zinc-700 dark:text-zinc-200'}`}>
            {formatTimeRange(item.timeSlot, item.durationMins)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 truncate">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isHome ? 'bg-orange-400' : 'bg-black'}`} />
          <span className={`font-black text-xs truncate ${isHome ? 'text-orange-800 dark:text-orange-200' : 'text-indigo-700 dark:text-indigo-300'}`}>
            {item.kidName}
          </span>
        </div>

        <div className="flex justify-between items-center mt-0.5">
          <span className={`text-xs font-bold truncate max-w-[80px] ${isHome ? 'text-orange-700 dark:text-orange-300' : 'text-black-700 dark:text-fuchsia-400'}`}>
            {item.trainerName}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
            isHome ? 'bg-orange-200 text-orange-700' : 'text-black dark:text-teal-400 bg-zinc-100 dark:bg-zinc-800'
          }`}>
            {isHome ? 'HOME' : item.sessionType.slice(0, 3)}
          </span>
        </div>
      </div>
    </div>
  );
};

const DayColumn: React.FC<{ 
  day: DayOfWeek; 
  dateStr: string;
  items: ScheduleItem[]; 
  isLocked: boolean;
  onToggleLock: () => void;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (id: string) => void;
}> = ({ day, dateStr, items, isLocked, onToggleLock, onEdit, onDelete }) => {
  
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => parseTimeValue(a.timeSlot) - parseTimeValue(b.timeSlot));
  }, [items]);

  const isPast = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    if (!dateStr) return false;
    const colDate = new Date(dateStr + 'T00:00:00');
    return colDate < today;
  }, [dateStr]);

  const displayDate = dateStr 
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className={`flex flex-col h-full rounded-2xl border overflow-hidden transition-colors ${
      isPast ? 'bg-zinc-100/50 border-zinc-200 dark:bg-black/40 dark:border-zinc-800' :
      isLocked ? 'bg-zinc-100/80 border-zinc-300 dark:bg-zinc-900 dark:border-zinc-700' : 
      'bg-zinc-50/50 border-zinc-200/50 dark:bg-white/5 dark:border-white/5'
    }`}>
      <div className={`p-3 border-b flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm ${
          isPast ? 'bg-zinc-100/90 border-zinc-200 dark:bg-zinc-950/90 dark:border-zinc-800' : 
          'bg-white/90 dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800'
      }`}>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-black text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{day}</span>
            <span className="text-[10px] font-bold text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
          </div>
          <span className={`text-[10px] font-bold mt-0.5 ${isPast ? 'text-rose-400' : 'text-zinc-400'}`}>
            {displayDate} {isPast && "(Closed)"}
          </span>
        </div>
        {!isPast && (
            <button onClick={onToggleLock} className={`transition-colors ${isLocked ? 'text-rose-500' : 'text-zinc-300 hover:text-zinc-500'}`}>
            <LockIcon className="w-4 h-4" />
            </button>
        )}
      </div>
      
      <div className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200">
        {sortedItems.map(item => (
          <CompactSessionCard key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} isPast={isPast} />
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// PART 3: MAIN COMPONENT
// ============================================================================

export const ScheduleView: React.FC<Props> = ({ schedule, trainers, kids, isLoading, lockedDays, onToggleLock, onUpdateItem, onDeleteItem, onRefresh }) => {
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [kidFilter, setKidFilter] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenMenu, setShowGenMenu] = useState(false);
  
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // --- LOGIC: Calculate Weekly Dates (Fixed Local Time) ---
  const { mondayDate, weekDates } = useMemo(() => {
    const today = new Date();
    // Do NOT setHours here. Use system clock raw.

    const currentDay = today.getDay(); // 0=Sun, 1=Mon...
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay; 
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + (currentWeekOffset * 7));
    
    // Manual Local Format (YYYY-MM-DD)
    const dates: Record<string, string> = {};
    (Object.keys(DayToOffset) as DayOfWeek[]).forEach((day) => {
       const offset = DayToOffset[day];
       const d = new Date(monday);
       d.setDate(monday.getDate() + offset);
       
       const year = d.getFullYear();
       const month = String(d.getMonth() + 1).padStart(2, '0');
       const dateVal = String(d.getDate()).padStart(2, '0');
       
       dates[day] = `${year}-${month}-${dateVal}`;
    });

    return { mondayDate: monday, weekDates: dates };
  }, [currentWeekOffset]);

  const filteredItems = useMemo(() => {
    return schedule.filter(item => {
      const matchTrainer = trainerFilter === 'all' || item.trainerId === trainerFilter;
      const matchKid = kidFilter === 'all' || item.kidId === kidFilter;
      return matchTrainer && matchKid;
    });
  }, [schedule, trainerFilter, kidFilter]);

  // --- GENERATION HANDLER ---
  const handleGenerate = async (scope: GenerationScope) => {
      setShowGenMenu(false); 
      let confirmMsg = "";
      let targetDate = mondayDate; 
      if (scope === '3-WEEKS') {
          confirmMsg = "⚠️ This will generate schedules for the Next 3 WEEKS from today.\nHistory will be preserved.\n\nContinue?";
          targetDate = new Date(); 
      } else if (scope === 'WEEK') {
          confirmMsg = `⚠️ This will overwrite the WHOLE WEEK of ${mondayDate.toLocaleDateString()}.\n\nContinue?`;
          targetDate = mondayDate;
      } else {
          targetDate = new Date();
          confirmMsg = `⚠️ This will regenerate sessions for TODAY (${targetDate.toLocaleDateString()}) only.\n\nContinue?`;
      }
      if (!window.confirm(confirmMsg)) return;
      setIsGenerating(true);
      try {
          await runAutoScheduler(scope, targetDate);
          onRefresh(); 
      } catch (e) {
          console.error(e);
          alert("Generation failed. Check console.");
      } finally {
          setIsGenerating(false);
      }
  };

  // ✅ EXCEL EXPORT HANDLER
  const handleExport = async () => {
    // Note: We don't pass 'schedule' anymore because the service fetches it directly!
    await generateClinicalExcel(trainers, kids, weekDates);};

  if (isLoading) return <div className="h-full flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-brand-500 rounded-full border-t-transparent"/></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-500">
      
      {/* --- HEADER --- */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 mb-4 px-1 shrink-0">
        
        {/* Navigation */}
        <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <button onClick={() => setCurrentWeekOffset(c => c - 1)} className="p-2 hover:bg-zinc-100 rounded-lg text-xs font-bold">←</button>
          <div className="text-center min-w-[120px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Week Starting</p>
            <p className="text-sm font-bold dark:text-white">{mondayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <button onClick={() => setCurrentWeekOffset(c => c + 1)} className="p-2 hover:bg-zinc-100 rounded-lg text-xs font-bold">→</button>
          
          <button onClick={() => setCurrentWeekOffset(0)} className="ml-2 px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
            {/* Generator Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setShowGenMenu(!showGenMenu)}
                    disabled={isGenerating}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${isGenerating ? 'bg-zinc-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                >
                    <SparklesIcon className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    {isGenerating ? 'Building...' : 'Auto-Schedule'}
                    <span className="text-[8px] ml-1">▼</span>
                </button>
                {showGenMenu && !isGenerating && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-2">
                            <p className="px-2 py-1 text-[9px] font-black uppercase text-zinc-400 tracking-wider">Select Scope</p>
                            <button onClick={() => handleGenerate('DAY')} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg dark:text-zinc-200">Current Day Only</button>
                            <button onClick={() => handleGenerate('WEEK')} className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg dark:text-zinc-200">This Full Week</button>
                            <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1"/>
                            <button onClick={() => handleGenerate('3-WEEKS')} className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg">Reset Next 3 Weeks</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="h-6 w-px bg-zinc-300 mx-2" />

            <select value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)} className="p-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold uppercase"><option value="all">All Staff</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select value={kidFilter} onChange={e => setKidFilter(e.target.value)} className="p-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold uppercase"><option value="all">All Kids</option>{kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select>
            
            {/* ✅ NEW EXPORT BUTTON */}
            <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
              <DocumentUploadIcon className="w-3 h-3"/> Excel Export
            </button>
        </div>
      </div>

      {/* --- GRID --- */}
      <div className="flex-1 min-h-0 overflow-x-auto">
        <div className="grid grid-cols-7 gap-3 h-full min-w-[1200px] pb-2">
          {(Object.keys(DayToOffset) as DayOfWeek[])
            .sort((a, b) => DayToOffset[a] - DayToOffset[b])
            .map(day => {
              const dateForColumn = weekDates[day]; 
              const columnItems = filteredItems.filter(s => s.dateStr === dateForColumn);

              return (
                <DayColumn 
                  key={day} 
                  day={day} 
                  dateStr={dateForColumn}
                  items={columnItems} 
                  isLocked={lockedDays.includes(day)}
                  onToggleLock={() => onToggleLock(day)}
                  onEdit={setEditingItem}
                  onDelete={onDeleteItem}
                />
              );
            })
          }
        </div>
      </div>

      {/* --- EDIT MODAL --- */}
      {editingItem && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-zinc-200 animate-in zoom-in-95">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4">Edit Session</h3>
            <div className="space-y-4">
               <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Assigned Technician</label>
                  <select 
                     className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold outline-none"
                     value={editingItem.trainerId}
                     onChange={(e) => {
                        const t = trainers.find(tr => tr.id === e.target.value);
                        setEditingItem({...editingItem, trainerId: e.target.value, trainerName: t ? t.name : 'Unknown'});
                     }}
                  >
                     {trainers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.clinicalRole})</option>)}
                  </select>
               </div>
               <div>
                 <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Duration (Mins)</label>
                 <input 
                   type="number" 
                   value={editingItem.durationMins} 
                   onChange={(e) => setEditingItem({...editingItem, durationMins: parseInt(e.target.value)})} 
                   className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold"
                 />
               </div>
               <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 block">Status</label>
                  <select className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-bold" value={editingItem.status} onChange={(e) => setEditingItem({...editingItem, status: e.target.value as any})}>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Completed">Completed</option>
                  </select>
               </div>
               <div className="grid grid-cols-2 gap-2 pt-2">
                 <button onClick={() => { onUpdateItem(editingItem.id, editingItem); setEditingItem(null); }} className="py-3 bg-brand-600 text-white rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-brand-700">Save Changes</button>
                 <button onClick={() => setEditingItem(null)} className="py-3 bg-zinc-100 text-zinc-500 rounded-lg font-bold text-[10px] uppercase tracking-widest hover:bg-zinc-200">Cancel</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};