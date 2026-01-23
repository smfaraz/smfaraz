import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ScheduleItem, DayOfWeek, Trainer, Kid, SessionType } from '../types';
import { SparklesIcon, DocumentUploadIcon, LockIcon } from './Icons';
import { runAutoScheduler } from '../services/schedulerIntegration';
import { generateClinicalExcel } from '../services/excelExportService';

// --- ICONS ---
const UndoIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clipRule="evenodd" />
  </svg>
);

// --- PROPS ---
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

// --- CONFIGURATION (COMPACT MODE) ---
const START_HOUR = 7; 
const END_HOUR = 19;
const HOUR_WIDTH = 90; 
const SNAP_MINUTES = 15;
const TOTAL_WIDTH = (END_HOUR - START_HOUR) * HOUR_WIDTH;

const DayToOffset: Record<DayOfWeek, number> = {
  [DayOfWeek.MON]: 0, [DayOfWeek.TUE]: 1, [DayOfWeek.WED]: 2,
  [DayOfWeek.THU]: 3, [DayOfWeek.FRI]: 4, [DayOfWeek.SAT]: 5, [DayOfWeek.SUN]: 6
};

// --- GLOBAL HELPERS ---
const formatHourLabel = (h24: number) => {
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12} ${period}`;
};

const isoLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isPastDate = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
};

const parseTime = (timeStr: string): number => {
  if (!timeStr) return -1;
  const clean = timeStr.replace(/In-Home|All Day|HOM/gi, '').trim();
  const [time, period] = clean.split(' ');
  if (!time || !period) return -1;
  let [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return -1;
  if (period.toUpperCase() === 'AM' && h === 12) h = 0;
  if (period.toUpperCase() === 'PM' && h !== 12) h += 12;
  return h * 60 + m;
};

const formatTime = (totalMins: number) => {
  let h24 = Math.floor(totalMins / 60);
  const mm = totalMins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`;
};

const buildTimeSlot = (startMins: number, durationMins: number) => {
  const endMins = startMins + durationMins;
  return `${formatTime(startMins)} - ${formatTime(endMins)}`;
};

const getStartOnly = (timeSlot: string) => {
  if (!timeSlot) return '';
  return timeSlot.split(' - ')[0];
};

const minutesToPx = (mins: number) => (mins / 60) * HOUR_WIDTH;

const timeToPx = (timeStr: string) => {
  const mins = parseTime(timeStr.split(' - ')[0]);
  if (mins === -1) return -1;
  return Math.max(0, minutesToPx(mins - START_HOUR * 60));
};

const clampDuration = (mins: number) => {
  const safe = Number.isFinite(mins) ? mins : 60;
  return Math.max(30, Math.min(240, safe));
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  return aStart < bEnd && bStart < aEnd;
};

// --- COMPONENT: SESSION CARD (COMPACT & INTERACTIVE) ---
const SessionCard: React.FC<{
  item: ScheduleItem;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}> = ({ item, onClick, onDragStart, onDragEnd, disabled, style, className }) => {
  const isHome = item.sessionType === SessionType.HOME;
  const isBreak = item.sessionType === SessionType.BREAK || item.sessionType === SessionType.ADMIN;
  
  // 🔥 FIX: We ONLY disable interaction if the PARENT (Day/Week) is disabled.
  // We ignore item.isLocked for UI interaction purposes so user can move it again.
  const isInteractable = !disabled; 

  const baseClasses = "absolute top-0.5 bottom-0.5 rounded-[4px] text-[10px] leading-tight font-semibold truncate flex flex-col justify-center px-1.5 shadow-sm transition-all duration-200 select-none z-10 border-l-[3px]";
  
  const colorClasses = isBreak
    ? "bg-slate-50 border-slate-300 border-l-slate-400 text-slate-500 items-center border-dashed border"
    : isHome
    ? "bg-amber-50 border-l-amber-500 text-amber-900 border border-amber-100 hover:border-amber-300 hover:shadow-md"
    : "bg-indigo-50 border-l-indigo-500 text-indigo-900 border border-indigo-100 hover:border-indigo-300 hover:shadow-md";
  
  const cursorClass = isInteractable 
    ? "cursor-grab active:cursor-grabbing hover:z-20 hover:-translate-y-[1px]" 
    : "cursor-not-allowed opacity-70 grayscale-[0.5]";

  return (
    <div
      draggable={isInteractable}
      onDragStart={(e) => {
        if (!isInteractable) {
            e.preventDefault();
            return;
        }
        onDragStart(e);
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => { 
          e.stopPropagation(); 
          if(isInteractable) onClick(); 
      }}
      className={`${baseClasses} ${colorClasses} ${cursorClass} ${className || ''}`}
      style={style}
      title={`${item.kidName} (${item.timeSlot})`}
    >
      {isBreak ? (
        <span className="tracking-widest uppercase text-[8px] font-bold opacity-70">{item.kidName}</span>
      ) : (
        <>
          <div className="flex justify-between items-center w-full">
            <span className="truncate font-bold">{item.kidName}</span>
            {isHome && <span className="w-1 h-1 rounded-full bg-amber-500 ml-0.5"></span>}
          </div>
          {item.durationMins >= 60 && (
             <span className="text-[8px] font-medium opacity-80">{item.timeSlot}</span>
          )}
        </>
      )}
    </div>
  );
};

// --- COMPONENT: COMPACT SESSION CARD (WEEK VIEW) ---
const CompactSessionCard: React.FC<{
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  disabled: boolean;
  onDragStart: (e: React.DragEvent, item: ScheduleItem) => void;
}> = ({ item, onEdit, disabled, onDragStart }) => {
  const isHome = item.sessionType === SessionType.HOME;
  const isBreak = item.sessionType === SessionType.BREAK || item.sessionType === SessionType.ADMIN;
  
  // 🔥 FIX: Allow interaction unless the container is disabled (Day Locked/Past)
  const isInteractable = !disabled;

  return (
    <div
      draggable={isInteractable}
      onDragStart={(e) => {
          if(!isInteractable) { e.preventDefault(); return; }
          onDragStart(e, item);
      }}
      onClick={(e) => {
          e.stopPropagation();
          if(isInteractable) onEdit(item);
      }}
      className={`p-2 rounded border text-[10px] transition-all group bg-white
        ${isInteractable ? 'cursor-grab active:cursor-grabbing hover:shadow hover:z-10' : 'opacity-60 cursor-not-allowed grayscale'}
        ${isBreak 
            ? 'border-dashed border-slate-300 text-slate-400 bg-slate-50' 
            : isHome 
                ? 'border-amber-200 border-l-2 border-l-amber-500' 
                : 'border-slate-200 border-l-2 border-l-indigo-500'
        }
      `}
    >
      <div className="flex justify-between font-bold text-slate-800 mb-0.5">
          <span>{item.kidName}</span>
          {!isBreak && <span className="text-[8px] text-slate-400 font-medium">{item.timeSlot}</span>}
      </div>
      {!isBreak && (
          <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${isHome ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
              {item.trainerName}
          </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
export const ScheduleView: React.FC<Props> = ({
  schedule,
  trainers,
  kids,
  isLoading,
  lockedDays,
  onToggleLock,
  onUpdateItem,
  onDeleteItem,
  onRefresh
}) => {
  const [viewMode, setViewMode] = useState<'DAY' | 'WEEK'>('DAY');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<Array<{ id: string; state: Partial<ScheduleItem> }>>([]);

  const [draggedItem, setDraggedItem] = useState<ScheduleItem | null>(null);
  const [hoverTrainerId, setHoverTrainerId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<DayOfWeek | null>(null);
  const [ghost, setGhost] = useState<{ left: number; width: number; timeLabel: string; isConflict: boolean } | null>(null);

  const [trainerFilter, setTrainerFilter] = useState('all');
  const [kidFilter, setKidFilter] = useState('all');

  const { weekDates, mondayDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff + weekOffset * 7);
    
    const dates: Record<string, string> = {};
    (Object.keys(DayToOffset) as DayOfWeek[]).forEach((d) => {
      const off = DayToOffset[d];
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + off);
      dates[d] = isoLocalDate(cur);
    });
    return { weekDates: dates, mondayDate: monday };
  }, [weekOffset]);

  const selectedDateStr = useMemo(() => isoLocalDate(selectedDate), [selectedDate]);
  
  const dayName = useMemo(() => {
    const d = selectedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const map: any = { MON: DayOfWeek.MON, TUE: DayOfWeek.TUE, WED: DayOfWeek.WED, THU: DayOfWeek.THU, FRI: DayOfWeek.FRI, SAT: DayOfWeek.SAT, SUN: DayOfWeek.SUN };
    return map[d] || DayOfWeek.MON;
  }, [selectedDate]);

  const dayItems = useMemo(() => schedule.filter(s => s.dateStr === selectedDateStr), [schedule, selectedDateStr]);
  const isDayLocked = lockedDays.includes(dayName);

  // --- SCROLL SYNC ---
  const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (headerRef.current) {
        headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // --- UNDO HELPER ---
  const captureHistory = (item: ScheduleItem) => {
    setHistory(prev => [...prev, { 
      id: item.id, 
      state: {
        trainerId: item.trainerId,
        trainerName: item.trainerName,
        timeSlot: item.timeSlot,
        durationMins: item.durationMins,
        day: item.day,
        dateStr: item.dateStr,
        isManuallyEdited: item.isManuallyEdited,
        isLocked: item.isLocked
      } 
    }]);
  };

  const handleUndo = async () => {
    if (history.length === 0) return;
    const lastAction = history[history.length - 1];
    const newHistory = history.slice(0, -1);
    setHistory(newHistory);

    try {
      await onUpdateItem(lastAction.id, lastAction.state);
    } catch (e) {
      console.error("Undo failed", e);
      alert("Could not undo action.");
    }
  };

  // --- DRAG HANDLERS ---

  const handleDragStart = (e: React.DragEvent, item: ScheduleItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoverTrainerId(null);
    setHoverDay(null);
    setGhost(null);
  };

  const handleDragOverTimeline = (e: React.DragEvent, trainerId: string) => {
    e.preventDefault();
    if (!draggedItem || isDayLocked) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    
    const minutesFromLeft = (offsetX / HOUR_WIDTH) * 60;
    const absoluteMinutes = Math.round(minutesFromLeft + (START_HOUR * 60));
    const snappedStartMins = Math.round(absoluteMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    
    const duration = clampDuration(draggedItem.durationMins);
    const minStart = START_HOUR * 60;
    const maxStart = (END_HOUR * 60) - duration;
    const finalStart = Math.max(minStart, Math.min(maxStart, snappedStartMins));

    const finalEnd = finalStart + duration;
    
    const hasConflict = dayItems.some(item => {
      if (item.id === draggedItem.id) return false;
      if (item.trainerId !== trainerId) return false;
      const iStart = parseTime(item.timeSlot.split(' - ')[0]);
      if (iStart === -1) return false;
      const iEnd = iStart + item.durationMins;
      return overlaps(finalStart, finalEnd, iStart, iEnd);
    });

    setHoverTrainerId(trainerId);
    setGhost({
      left: minutesToPx(finalStart - (START_HOUR * 60)),
      width: minutesToPx(duration),
      timeLabel: formatTime(finalStart),
      isConflict: hasConflict
    });
  };

  const handleDropTimeline = async (e: React.DragEvent, targetTrainer: Trainer) => {
    e.preventDefault();
    if (!draggedItem || isDayLocked || !ghost) return;

    if (ghost.isConflict) {
      alert("⚠️ Conflict detected.");
      handleDragEnd();
      return;
    }

    const duration = clampDuration(draggedItem.durationMins);
    const startMins = parseTime(ghost.timeLabel); 
    const newTimeSlot = buildTimeSlot(startMins, duration);

    captureHistory(draggedItem);

    try {
      await onUpdateItem(draggedItem.id, {
        trainerId: targetTrainer.id,
        trainerName: targetTrainer.name,
        timeSlot: newTimeSlot,
        durationMins: duration,
        isManuallyEdited: true,
        isLocked: true 
      });
    } catch (err) {
      console.error(err);
      alert("Failed to move session.");
    } finally {
      handleDragEnd();
    }
  };

  const handleDropWeek = async (e: React.DragEvent, dateStr: string, day: DayOfWeek) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (lockedDays.includes(day)) {
      alert("🔒 This day is locked.");
      handleDragEnd();
      return;
    }
    
    if (isPastDate(dateStr)) {
        alert("Cannot move sessions to past dates.");
        handleDragEnd();
        return;
    }

    captureHistory(draggedItem);

    try {
      await onUpdateItem(draggedItem.id, { dateStr, day, isManuallyEdited: true });
    } catch (err) {
      console.error(err);
      alert("Failed to move session.");
    } finally {
      handleDragEnd();
    }
  };

  const handleGenerate = async () => {
    if (viewMode === 'DAY' && isDayLocked) return alert('Unlock this day first.');
    const scope = viewMode === 'DAY' ? 'DAY' : 'WEEK';
    const target = viewMode === 'DAY' ? selectedDate : mondayDate;
    if (!confirm(`🤖 Auto-fill ${scope.toLowerCase()} for ${target.toLocaleDateString()}?`)) return;
    
    setHistory([]);
    setIsGenerating(true);
    await runAutoScheduler(scope, target);
    setIsGenerating(false);
    onRefresh();
  };

  const [nowMins, setNowMins] = useState(-1);
  useEffect(() => {
    const update = () => {
      const now = new Date();
      if (now.toDateString() !== selectedDate.toDateString()) {
        setNowMins(-1);
        return;
      }
      const mins = now.getHours() * 60 + now.getMinutes();
      setNowMins(mins);
    };
    update();
    const interval = setInterval(update, 60000); 
    return () => clearInterval(interval);
  }, [selectedDate]);

  if (isLoading) return <div className="h-full flex flex-col items-center justify-center font-bold text-slate-300 animate-pulse"><SparklesIcon className="w-8 h-8 mb-2 text-indigo-300" />Loading Schedule...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 animate-in fade-in duration-300 selection:bg-indigo-100">
      
      {/* --- TOOLBAR --- */}
      <div className="flex justify-between items-center px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0 z-30">
        <div className="flex gap-3 items-center">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {(['DAY', 'WEEK'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${
                  viewMode === m ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                 const d = new Date(viewMode === 'DAY' ? selectedDate : mondayDate);
                 d.setDate(d.getDate() - (viewMode === 'DAY' ? 1 : 7));
                 viewMode === 'DAY' ? setSelectedDate(d) : setWeekOffset(o => o - 1);
              }}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              ←
            </button>
            <div className="text-center min-w-[120px]">
              <div className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">
                {viewMode === 'DAY' ? selectedDate.toLocaleDateString('en-US', {weekday:'long'}) : 'Week Of'}
              </div>
              <div className="text-sm font-bold">
                {viewMode === 'DAY' ? selectedDate.toLocaleDateString('en-US', {month:'long', day:'numeric'}) : mondayDate.toLocaleDateString('en-US', {month:'short', day:'numeric'})}
              </div>
            </div>
            <button 
              onClick={() => {
                 const d = new Date(viewMode === 'DAY' ? selectedDate : mondayDate);
                 d.setDate(d.getDate() + (viewMode === 'DAY' ? 1 : 7));
                 viewMode === 'DAY' ? setSelectedDate(d) : setWeekOffset(o => o + 1);
              }}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              →
            </button>
          </div>

          {viewMode === 'DAY' && (
            <button 
              onClick={() => onToggleLock(dayName)} 
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition-colors
              ${isDayLocked 
                ? 'bg-rose-50 border-rose-200 text-rose-600' 
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <LockIcon className="w-3 h-3" />
              {isDayLocked ? 'Locked' : 'Unlocked'}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm
              ${history.length > 0 
                ? 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:shadow-md' 
                : 'bg-slate-50 border border-slate-200 text-slate-300 cursor-not-allowed'}`}
            title="Undo"
          >
            <UndoIcon className="w-3 h-3" />
            Undo
          </button>

          {viewMode === 'WEEK' && (
             <div className="flex gap-2">
                <select className="bg-slate-50 dark:bg-slate-800 border-none rounded text-[10px] font-bold px-2 outline-none cursor-pointer" value={trainerFilter} onChange={e => setTrainerFilter(e.target.value)}>
                   <option value="all">All Staff</option>
                   {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
             </div>
          )}

          <button 
            onClick={handleGenerate} 
            disabled={isGenerating || (viewMode === 'DAY' && isDayLocked)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-md transition-all"
          >
            <SparklesIcon className={isGenerating ? 'animate-spin w-3 h-3' : 'w-3 h-3'} />
            {isGenerating ? 'Working...' : 'Auto-Fill'}
          </button>
          
          <button 
            onClick={() => generateClinicalExcel(schedule, trainers, kids, weekDates)} 
            className="p-1.5 bg-white border border-slate-200 rounded text-slate-500 hover:text-indigo-600 transition-colors shadow-sm" 
            title="Export"
          >
            <DocumentUploadIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --- DAY VIEW (TIMELINE) --- */}
      {viewMode === 'DAY' && (
        <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          
          <div 
            ref={headerRef}
            className="flex border-b border-slate-200 dark:border-slate-800 h-8 shrink-0 bg-slate-50 dark:bg-slate-950 overflow-hidden"
          >
            <div className="w-36 shrink-0 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex items-center px-3 z-20 shadow-sm sticky left-0">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Staff</span>
            </div>
            
            <div className="relative flex" style={{ width: TOTAL_WIDTH }}>
                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                  <div key={i} className="shrink-0 h-full border-l border-slate-200 dark:border-slate-800 pl-1 pt-1.5 flex" style={{ width: HOUR_WIDTH }}>
                    <span className="text-[9px] font-bold text-slate-400">{formatHourLabel(START_HOUR + i)}</span>
                  </div>
                ))}
            </div>
          </div>

          <div 
            ref={bodyRef}
            onScroll={handleBodyScroll}
            className="flex-1 overflow-auto relative custom-scrollbar bg-slate-50/30"
          >
            <div className="min-w-max pb-20 relative">
              
              {/* Current Time Line */}
              {nowMins !== -1 && nowMins >= START_HOUR*60 && nowMins <= END_HOUR*60 && (
                 <div 
                   className="absolute top-0 bottom-0 border-l border-red-500 z-40 pointer-events-none opacity-60"
                   style={{ left: 144 + minutesToPx(nowMins - START_HOUR * 60) }} // 144px = w-36
                 >
                   <div className="absolute -top-1 -left-[3px] w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" />
                 </div>
              )}

              {trainers.map((trainer, index) => {
                const tItems = dayItems.filter(i => i.trainerId === trainer.id);
                const isHovered = hoverTrainerId === trainer.id;
                
                const bgClass = index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50';

                return (
                  <div 
                    key={trainer.id}
                    className={`flex h-12 border-b border-slate-100 dark:border-slate-800/50 group transition-colors ${isHovered ? 'bg-indigo-50/60' : bgClass}`}
                    onDragOver={(e) => handleDragOverTimeline(e, trainer.id)}
                    onDragLeave={(e) => {
                        if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                            setHoverTrainerId(null);
                            setGhost(null);
                        }
                    }}
                    onDrop={(e) => handleDropTimeline(e, trainer)}
                  >
                    <div className={`w-36 shrink-0 border-r border-slate-200 dark:border-slate-800 sticky left-0 z-20 flex flex-col justify-center px-3 transition-colors ${isHovered ? 'bg-indigo-50/80 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}`}>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{trainer.name}</div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-wider truncate">{trainer.clinicalRole}</div>
                    </div>

                    <div className="relative h-full" style={{ width: TOTAL_WIDTH }}>
                      <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                          <div key={i} className="border-l border-slate-100 dark:border-slate-800 h-full" style={{ width: HOUR_WIDTH }} />
                        ))}
                      </div>

                      {/* Ghost */}
                      {isHovered && ghost && (
                        <div 
                          className={`absolute top-0.5 bottom-0.5 rounded-[4px] border-2 border-dashed z-30 flex items-center justify-center pointer-events-none backdrop-blur-sm
                            ${ghost.isConflict 
                                ? 'border-rose-500 bg-rose-100/50 text-rose-700' 
                                : 'border-indigo-500 bg-indigo-100/50 text-indigo-700'}`}
                          style={{ left: ghost.left, width: ghost.width }}
                        >
                          <span className="text-[9px] font-black bg-white/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                            {ghost.timeLabel} {ghost.isConflict && '🚫'}
                          </span>
                        </div>
                      )}

                      {/* Items */}
                      {tItems.map(item => {
                        const left = timeToPx(item.timeSlot);
                        const width = minutesToPx(clampDuration(item.durationMins));
                        if (left === -1) return null;
                        
                        const isBeingDragged = draggedItem?.id === item.id;

                        return (
                          <SessionCard
                            key={item.id}
                            item={item}
                            onClick={() => { if(!isDayLocked) setEditingItem(item); }}
                            onDragStart={(e) => handleDragStart(e, item)}
                            onDragEnd={handleDragEnd}
                            disabled={isDayLocked} // Only disable if Day is locked, not item
                            className={isBeingDragged ? 'opacity-30 scale-95 grayscale' : ''}
                            style={{ left: `${left}px`, width: `${width}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- WEEK VIEW (Compact) --- */}
      {viewMode === 'WEEK' && (
        <div className="flex-1 overflow-auto bg-slate-100 dark:bg-black p-3">
          <div className="flex h-full min-w-[1200px] gap-2">
            {(Object.keys(weekDates) as DayOfWeek[]).map(day => {
              const dateStr = weekDates[day];
              const isLocked = lockedDays.includes(day);
              const past = isPastDate(dateStr);
              
              const filteredItems = schedule.filter(s => s.dateStr === dateStr)
                                    .filter(s => trainerFilter === 'all' || s.trainerId === trainerFilter)
                                    .filter(s => kidFilter === 'all' || s.kidId === kidFilter)
                                    .sort((a,b) => parseTime(getStartOnly(a.timeSlot)) - parseTime(getStartOnly(b.timeSlot)));
              
              const isHovered = hoverDay === day;

              return (
                <div 
                  key={day} 
                  className={`flex-1 flex flex-col h-full rounded-lg border transition-all duration-200 shadow-sm
                    ${isHovered ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-100' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}
                  onDragOver={(e) => { 
                      e.preventDefault(); 
                      if(!isLocked && !past) setHoverDay(day); 
                  }}
                  onDragLeave={() => setHoverDay(null)}
                  onDrop={(e) => handleDropWeek(e, dateStr, day)}
                >
                  <div className={`p-2 border-b border-slate-100 dark:border-slate-800 rounded-t-lg flex justify-between items-center ${isLocked || past ? 'bg-slate-50' : 'bg-white'}`}>
                    <div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{day}</div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    {(isLocked || past) && <LockIcon className="w-3 h-3 text-rose-400" />}
                  </div>
                  
                  <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {filteredItems.map(item => (
                      <CompactSessionCard 
                        key={item.id} 
                        item={item} 
                        onEdit={setEditingItem} 
                        disabled={isLocked || past} 
                        onDragStart={handleDragStart} 
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-80 bg-white dark:bg-slate-900 h-full shadow-2xl p-5 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-300 flex flex-col">
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Session</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto">
               <div>
                 <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Time Slot</label>
                 <input 
                   className="w-full bg-slate-50 border rounded-md p-2 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500" 
                   value={editingItem.timeSlot} 
                   onChange={e => setEditingItem({...editingItem, timeSlot: e.target.value})}
                 />
               </div>
               
               <div>
                 <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Duration</label>
                 <div className="flex gap-1">
                    {[30, 60, 90, 120, 240].map(d => (
                        <button 
                           key={d}
                           onClick={() => setEditingItem({...editingItem, durationMins: d})}
                           className={`flex-1 py-1.5 text-[10px] font-bold rounded border ${editingItem.durationMins === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        >
                           {d}m
                        </button>
                    ))}
                 </div>
               </div>

               <div>
                 <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Kid</label>
                 <select 
                    className="w-full bg-slate-50 border rounded-md p-2 text-xs font-bold outline-none" 
                    value={editingItem.kidId || ''} 
                    onChange={e => {
                      const k = kids.find(x => x.id === e.target.value);
                      setEditingItem({...editingItem, kidId: k?.id, kidName: k?.name || ''});
                    }}
                 >
                    {kids.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                 </select>
               </div>

               <div>
                 <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Trainer</label>
                 <select 
                    className="w-full bg-slate-50 border rounded-md p-2 text-xs font-bold outline-none" 
                    value={editingItem.trainerId || ''} 
                    onChange={e => {
                      const t = trainers.find(x => x.id === e.target.value);
                      setEditingItem({...editingItem, trainerId: t?.id, trainerName: t?.name || ''});
                    }}
                 >
                    {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
               </div>
            </div>

            <div className="pt-4 flex flex-col gap-2 mt-auto border-t border-slate-100">
               <button 
                 onClick={async () => { 
                     const start = parseTime(getStartOnly(editingItem.timeSlot));
                     const isSpecial = editingItem.timeSlot.includes('All Day') || editingItem.timeSlot.includes('In-Home');
                     
                     if(start === -1 && !isSpecial) {
                         alert('Invalid time format.');
                         return;
                     }

                     const safeDur = clampDuration(editingItem.durationMins);
                     const startOnly = getStartOnly(editingItem.timeSlot);
                     const nextSlot = buildTimeSlot(parseTime(startOnly), safeDur);

                     captureHistory(editingItem);

                     try {
                         await onUpdateItem(editingItem.id, {
                             ...editingItem,
                             durationMins: safeDur,
                             timeSlot: nextSlot,
                             isManuallyEdited: true,
                             isLocked: true
                         });
                         setEditingItem(null);
                         onRefresh();
                     } catch(e) {
                         console.error(e);
                         alert('Failed to save.');
                     }
                 }}
                 className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg text-xs shadow-sm transition-all"
               >
                 Save Changes
               </button>
               
               <button 
                 onClick={() => { 
                     if(!confirm("Delete this session?")) return;
                     onDeleteItem(editingItem.id); 
                     setEditingItem(null); 
                 }}
                 className="w-full bg-white border border-rose-200 text-rose-600 font-bold py-2 rounded-lg text-xs hover:bg-rose-50 transition-all"
               >
                 Delete Session
               </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};