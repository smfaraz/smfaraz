import React, { useState, useMemo } from 'react';
import { ScheduleItem, DayOfWeek, Trainer, Kid, SessionType } from '../types';
import { SparklesIcon, DocumentUploadIcon, LockIcon } from './Icons';
import { runAutoScheduler } from '../services/schedulerIntegration';
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

// --- CONFIG FOR DAY VIEW (TIMELINE) ---
const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_WIDTH = 120;
const TOTAL_WIDTH = (END_HOUR - START_HOUR) * HOUR_WIDTH;

// --- CONFIG FOR WEEK VIEW (COLUMNS) ---
const DayToOffset: Record<DayOfWeek, number> = {
  [DayOfWeek.MON]: 0,
  [DayOfWeek.TUE]: 1,
  [DayOfWeek.WED]: 2,
  [DayOfWeek.THU]: 3,
  [DayOfWeek.FRI]: 4,
  [DayOfWeek.SAT]: 5,
  [DayOfWeek.SUN]: 6
};

// ---------------- Helpers ----------------
const isoLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseTime = (timeStr: string): number => {
  if (!timeStr) return -1;
  if (timeStr === 'In-Home' || timeStr === 'All Day') return -1;

  const [time, period] = timeStr.split(' ');
  if (!time || !period) return -1;

  let [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;

  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;

  return h * 60 + m;
};

const sortTimeValue = (timeStr: string): number => {
  const mins = parseTime(timeStr);
  return mins === -1 ? 999999 : mins;
};

const minutesToPx = (mins: number) => (mins / 60) * HOUR_WIDTH;

const timeToPx = (timeStr: string) => {
  const mins = parseTime(timeStr);
  if (mins === -1) return -1;
  return Math.max(0, minutesToPx(mins - START_HOUR * 60));
};

const clampDuration = (mins: number) => {
  const safe = Number.isFinite(mins) ? mins : 60;
  return Math.max(30, Math.min(120, safe)); // Allow 30 min breaks
};

const formatHourLabel = (h24: number) => {
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12} ${period}`;
};

const isPastDate = (dateStr: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return d < today;
};

const formatTime = (totalMins: number) => {
  let h24 = Math.floor(totalMins / 60);
  const mm = totalMins % 60;

  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`;
};

const getStartOnly = (timeSlot: string) => {
  if (!timeSlot) return '';
  if (timeSlot.includes(' - ')) return timeSlot.split(' - ')[0];
  return timeSlot;
};

const buildTimeSlot = (startStr: string, durationMins: number) => {
  if (!startStr) return '';
  if (startStr === 'In-Home' || startStr === 'All Day') return startStr;

  const start = parseTime(startStr);
  if (start === -1) return startStr;

  const end = start + durationMins;
  return `${startStr} - ${formatTime(end)}`;
};

const getRangeMinutes = (timeSlot: string, durationMins: number) => {
  const startOnly = getStartOnly(timeSlot);
  const start = parseTime(startOnly);
  if (start === -1) return null;
  const dur = clampDuration(durationMins);
  return { start, end: start + dur };
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  return aStart < bEnd && bStart < aEnd;
};

// --- WEEK VIEW CARD ---
const CompactSessionCard: React.FC<{
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  disabled: boolean;
}> = ({ item, onEdit, disabled }) => {
  const isHome = item.sessionType === SessionType.HOME;
  const isBreak = item.sessionType === SessionType.BREAK;

  if (isBreak) {
    return (
      <div
        onClick={() => !disabled && onEdit(item)}
        className={`relative p-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-transparent text-center flex flex-col justify-center items-center transition-all ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">BREAK</span>
        <span className="text-[9px] font-bold text-slate-300 mt-1">{item.timeSlot}</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => !disabled && onEdit(item)}
      className={`relative p-2 rounded-lg border text-left transition-all hover:shadow-md
      ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'cursor-pointer'}
      ${
        isHome
          ? 'bg-orange-50 border-orange-200 hover:border-orange-300'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-300 border-l-4 border-l-brand-600'
      }`}
    >
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.kidName}</span>
        <span className="text-[9px] font-bold text-slate-400">{item.timeSlot}</span>
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{item.trainerName}</span>
        {isHome && <span className="text-[8px] font-black bg-orange-100 text-orange-700 px-1 rounded">HOME</span>}
      </div>
    </div>
  );
};

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

  // WEEK FILTERS
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [kidFilter, setKidFilter] = useState('all');

  // --- WEEK DATES (LOCAL SAFE) ---
  const { weekDates, mondayDate } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentDay = today.getDay();
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);

    const dates: Record<string, string> = {};
    (Object.keys(DayToOffset) as DayOfWeek[]).forEach((day) => {
      const offset = DayToOffset[day];
      const d = new Date(monday);
      d.setDate(monday.getDate() + offset);
      d.setHours(0, 0, 0, 0);
      dates[day] = isoLocalDate(d);
    });

    return { weekDates: dates, mondayDate: monday };
  }, [weekOffset]);

  // --- DAY ITEMS ---
  const selectedDateStr = useMemo(() => isoLocalDate(selectedDate), [selectedDate]);

  const dayItems = useMemo(() => {
    return schedule.filter((s) => s.dateStr === selectedDateStr);
  }, [schedule, selectedDateStr]);

  const dayName = useMemo(() => {
    const weekday = selectedDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const map: Record<string, DayOfWeek> = {
      MON: DayOfWeek.MON,
      TUE: DayOfWeek.TUE,
      WED: DayOfWeek.WED,
      THU: DayOfWeek.THU,
      FRI: DayOfWeek.FRI,
      SAT: DayOfWeek.SAT,
      SUN: DayOfWeek.SUN
    };
    return map[weekday] ?? DayOfWeek.MON;
  }, [selectedDate]);

  const isDayLocked = lockedDays.includes(dayName);

  const filteredWeekItems = useMemo(() => {
    return schedule.filter((s) => {
      const trainerOk = trainerFilter === 'all' || s.trainerId === trainerFilter;
      const kidOk = kidFilter === 'all' || s.kidId === kidFilter;
      return trainerOk && kidOk;
    });
  }, [schedule, trainerFilter, kidFilter]);

  // --- NAV HANDLERS ---
  const goPrev = () => {
    if (viewMode === 'DAY') {
      setSelectedDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() - 1);
        return d;
      });
    } else {
      setWeekOffset((c) => c - 1);
    }
  };

  const goNext = () => {
    if (viewMode === 'DAY') {
      setSelectedDate((prev) => {
        const d = new Date(prev);
        d.setDate(d.getDate() + 1);
        return d;
      });
    } else {
      setWeekOffset((c) => c + 1);
    }
  };

  // --- GENERATE ---
  const handleGenerate = async () => {
    if (viewMode === 'DAY' && isDayLocked) {
      alert('This day is locked. Unlock it first.');
      return;
    }

    const ok = window.confirm(
      viewMode === 'DAY'
        ? `Auto-fill sessions for ${selectedDate.toLocaleDateString()}?`
        : `Auto-fill sessions for the week of ${mondayDate.toLocaleDateString()}?`
    );
    if (!ok) return;

    setIsGenerating(true);
    try {
      await runAutoScheduler(viewMode === 'DAY' ? 'DAY' : 'WEEK', viewMode === 'DAY' ? selectedDate : mondayDate);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Generation failed. Check console.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    generateClinicalExcel(schedule, trainers, kids, weekDates);
  };

  if (isLoading) {
    return <div className="h-full flex items-center justify-center font-bold text-slate-400">Loading Schedule...</div>;
  }

  const todayStr = isoLocalDate(new Date());

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in duration-300 font-sans bg-slate-50 dark:bg-slate-950">
      {/* --- TOP CONTROL BAR --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 px-1 shrink-0">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <div className="bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800 flex shadow-sm">
            <button
              onClick={() => setViewMode('DAY')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'DAY' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === 'WEEK' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Week View
            </button>
          </div>

          <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-sm items-center">
            <button
              onClick={goPrev}
              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 font-bold"
            >
              ←
            </button>

            <div className="px-4 text-center min-w-[160px]">
              <span className="block text-xs font-black uppercase text-slate-400 tracking-widest">
                {viewMode === 'DAY' ? selectedDate.toLocaleDateString('en-US', { weekday: 'long' }) : 'Week Of'}
              </span>
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                {viewMode === 'DAY'
                  ? selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
                  : mondayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <button
              onClick={goNext}
              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 font-bold"
            >
              →
            </button>

            {viewMode === 'DAY' && (
              <button
                onClick={() => onToggleLock(dayName)}
                className={`ml-2 px-3 py-1 rounded text-xs font-bold uppercase border transition-colors flex items-center gap-1
                ${isDayLocked ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
              >
                <LockIcon className="w-3.5 h-3.5" />
                {isDayLocked ? 'Locked' : 'Lock'}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex gap-3">
          {viewMode === 'WEEK' && (
            <>
              <select
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 text-xs font-bold rounded-lg px-3 outline-none"
              >
                <option value="all">All Staff</option>
                {trainers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <select
                value={kidFilter}
                onChange={(e) => setKidFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 text-xs font-bold rounded-lg px-3 outline-none"
              >
                <option value="all">All Kids</option>
                {kids.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={handleGenerate}
            disabled={isGenerating || (viewMode === 'DAY' && isDayLocked)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all
            ${isGenerating ? 'opacity-70 cursor-wait' : ''}
            ${
              viewMode === 'DAY' && isDayLocked
                ? 'bg-slate-300 text-white cursor-not-allowed'
                : 'bg-brand-600 hover:bg-brand-700 text-white'
            }`}
          >
            <SparklesIcon className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Working...' : viewMode === 'DAY' ? 'Auto-Fill Day' : 'Auto-Fill Week'}
          </button>

          <button
            onClick={handleExport}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 transition-all"
            title="Export Excel"
          >
            <DocumentUploadIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================= DAY VIEW ========================= */}
      {viewMode === 'DAY' && (
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
          {/* Header */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur z-20 overflow-hidden">
            <div className="w-48 shrink-0 p-3 border-r border-slate-200 dark:border-slate-800 font-bold text-xs text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 sticky left-0 z-30">
              Staff Member
            </div>

            <div className="flex-1 overflow-hidden relative" style={{ minWidth: TOTAL_WIDTH }}>
              <div className="flex absolute inset-0">
                {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                  const h = START_HOUR + i;
                  return (
                    <div
                      key={i}
                      className="shrink-0 border-l border-slate-200 dark:border-slate-800 h-full flex items-center justify-start pl-1"
                      style={{ width: HOUR_WIDTH }}
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{formatHourLabel(h)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-black/20">
            <div className="min-w-max">
              {trainers.map((trainer) => {
                const items = dayItems.filter((s) => s.trainerId === trainer.id);

                return (
                  <div
                    key={trainer.id}
                    className="flex border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors h-14 group"
                  >
                    <div className="w-48 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky left-0 z-10 flex items-center px-4 gap-3 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30">
                      <div className={`w-1.5 h-8 rounded-full ${items.length > 0 ? 'bg-brand-500' : 'bg-slate-200'}`} />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{trainer.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{trainer.clinicalRole}</p>
                      </div>
                    </div>

                    <div className="relative h-full" style={{ width: TOTAL_WIDTH }}>
                      <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                          <div key={i} className="border-l border-slate-100 dark:border-slate-800/50 h-full" style={{ width: HOUR_WIDTH }} />
                        ))}
                      </div>

                      {items.map((item) => {
                        const left = timeToPx(item.timeSlot);
                        if (left === -1) return null;

                        const widthRaw = minutesToPx(clampDuration(item.durationMins));
                        const width = Math.max(20, Math.min(TOTAL_WIDTH - left, widthRaw));

                        const isHome = item.sessionType === SessionType.HOME;
                        const isBreak = item.sessionType === SessionType.BREAK;

                        return (
                          <div
                            key={item.id}
                            onClick={() => !isDayLocked && setEditingItem(item)}
                            className={`absolute top-2 bottom-2 rounded-md shadow-sm border flex items-center px-2 transition-all
                            ${isDayLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:z-20 hover:scale-[1.02]'}
                            ${
                              isBreak
                                ? 'bg-transparent border-dashed border-slate-300 text-slate-400 z-0 justify-center'
                                : isHome
                                ? 'bg-orange-100 border-orange-300 text-orange-900 z-10'
                                : 'bg-brand-100 border-brand-300 text-brand-900 z-10'
                            }`}
                            style={{ left: `${left}px`, width: `${width}px` }}
                          >
                            <span className={`text-[10px] font-bold truncate ${isBreak ? 'tracking-widest uppercase' : ''}`}>
                              {isBreak ? 'BREAK' : item.kidName}
                            </span>
                          </div>
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

      {/* ========================= WEEK VIEW ========================= */}
      {viewMode === 'WEEK' && (
        <div className="flex-1 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 animate-in zoom-in-95 duration-300">
          <div className="flex h-full min-w-[1200px] divide-x divide-slate-200 dark:divide-slate-800">
            {(Object.keys(DayToOffset) as DayOfWeek[])
              .sort((a, b) => DayToOffset[a] - DayToOffset[b])
              .map((day) => {
                const dateStr = weekDates[day];
                const isToday = dateStr === todayStr;
                const isLocked = lockedDays.includes(day);
                const past = isPastDate(dateStr);

                const items = filteredWeekItems
                  .filter((s) => s.dateStr === dateStr)
                  .sort((a, b) => sortTimeValue(a.timeSlot) - sortTimeValue(b.timeSlot));

                const disableEdit = isLocked || past;

                return (
                  <div
                    key={day}
                    className={`flex-1 flex flex-col h-full ${disableEdit ? 'bg-slate-50/60 dark:bg-slate-950/40' : 'bg-white dark:bg-slate-900'}`}
                  >
                    <div
                      className={`p-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10 flex justify-between items-center ${
                        isToday ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''
                      }`}
                    >
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isToday ? 'text-brand-600' : 'text-slate-500'}`}>{day}</p>
                        <p className={`text-xs font-bold ${isToday ? 'text-brand-700 dark:text-brand-400' : 'text-slate-400'}`}>
                          {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {past ? ' (Past)' : ''}
                        </p>


                      </div>

                      {!past && (
                        <button
                          onClick={() => onToggleLock(day)}
                          className={isLocked ? 'text-rose-500' : 'text-slate-300 hover:text-slate-500'}
                          title={isLocked ? 'Unlock day' : 'Lock day'}
                        >
                          <LockIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex-1 p-2 overflow-y-auto space-y-2">
                      {items.map((item) => (
                        <CompactSessionCard key={item.id} item={item} onEdit={setEditingItem} disabled={disableEdit} />
                      ))}

                      {items.length === 0 && <div className="text-center py-10 text-slate-300 text-[10px] uppercase font-bold">No Sessions</div>}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================= EDIT DRAWER ========================= */}
      {editingItem && (
        <div className="fixed inset-0 z-[200] bg-slate-900/30 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-6 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Session</h3>
                <p className="text-xs text-slate-400 font-semibold">Conflict checks + smart actions</p>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 text-2xl">
                &times;
              </button>
            </div>

            {(() => {
              const isBreak = editingItem.sessionType === SessionType.BREAK;
              const isHome = editingItem.sessionType === SessionType.HOME;

              const clampDurationByType = (mins: number) => {
                const safe = Number.isFinite(mins) ? mins : isBreak ? 30 : 60;
                if (isBreak) return Math.max(30, Math.min(120, safe));
                return Math.max(60, Math.min(120, safe));
              };

              const durationSafe = clampDurationByType(editingItem.durationMins);
              const startOnly = getStartOnly(editingItem.timeSlot);
              const previewSlot = buildTimeSlot(startOnly, durationSafe);

              // sessions same day + same trainer (excluding self)
              const sameTrainerSameDay = schedule.filter(
                (s) =>
                  s.id !== editingItem.id &&
                  s.dateStr === editingItem.dateStr &&
                  s.trainerId === editingItem.trainerId
              );

              const thisRange = getRangeMinutes(previewSlot, durationSafe);

              const conflicts = (() => {
                if (!thisRange) return [];
                return sameTrainerSameDay.filter((s) => {
                  const r = getRangeMinutes(s.timeSlot, s.durationMins);
                  if (!r) return false;
                  return overlaps(thisRange.start, thisRange.end, r.start, r.end);
                });
              })();

              const travelWarnings = (() => {
                if (!thisRange) return [];
                if (!isHome) return [];

                const homeSessions = sameTrainerSameDay.filter((s) => s.sessionType === SessionType.HOME);
                const warnings: ScheduleItem[] = [];

                for (const s of homeSessions) {
                  const r = getRangeMinutes(s.timeSlot, s.durationMins);
                  if (!r) continue;

                  // if adjacent within 30 mins gap, warn
                  const gap1 = Math.abs(thisRange.start - r.end);
                  const gap2 = Math.abs(r.start - thisRange.end);
                  const gap = Math.min(gap1, gap2);

                  if (gap > 0 && gap < 30) warnings.push(s);
                }
                return warnings;
              })();

              const timeOptions = Array.from({ length: (END_HOUR - START_HOUR) * 2 + 1 }).map((_, i) => {
                const mins = START_HOUR * 60 + i * 30;
                return formatTime(mins);
              });

              const findNextFreeSlot = () => {
                if (!editingItem.dateStr) return null;

                const duration = durationSafe;
                const daySessions = sameTrainerSameDay
                  .map((s) => {
                    const r = getRangeMinutes(s.timeSlot, s.durationMins);
                    return r ? { ...r, id: s.id } : null;
                  })
                  .filter(Boolean) as { start: number; end: number; id: string }[];

                // search from START_HOUR to END_HOUR in 30-min steps
                const dayStart = START_HOUR * 60;
                const dayEnd = END_HOUR * 60;

                for (let t = dayStart; t + duration <= dayEnd; t += 30) {
                  const slotStart = t;
                  const slotEnd = t + duration;

                  const overlapsAny = daySessions.some((r) => overlaps(slotStart, slotEnd, r.start, r.end));
                  if (!overlapsAny) {
                    return buildTimeSlot(formatTime(slotStart), duration);
                  }
                }

                return null;
              };

              const doSwapTrainerWithConflict = async () => {
                if (conflicts.length === 0) {
                  alert('No conflict found to swap with.');
                  return;
                }

                const target = conflicts[0]; // swap with first conflict
                const currentTrainerId = editingItem.trainerId;
                const currentTrainerName = editingItem.trainerName;

                // swap trainer on BOTH sessions
                await onUpdateItem(editingItem.id, {
                  trainerId: target.trainerId,
                  trainerName: target.trainerName,
                  isManuallyEdited: true,
                  isLocked: true
                });

                await onUpdateItem(target.id, {
                  trainerId: currentTrainerId,
                  trainerName: currentTrainerName,
                  isManuallyEdited: true,
                  isLocked: true
                });

                setEditingItem(null);
                onRefresh();
              };

              return (
                <div className="space-y-5">
                  {/* Conflict Warning */}
                  {conflicts.length > 0 && (
                    <div className="p-3 rounded-xl border border-rose-200 bg-rose-50">
                      <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 mb-1">
                        Conflict Detected
                      </p>
                      <p className="text-xs font-bold text-rose-800">
                        Same trainer has {conflicts.length} overlapping session(s).
                      </p>
                      <div className="mt-2 space-y-1">
                        {conflicts.slice(0, 3).map((c) => (
                          <div key={c.id} className="text-[11px] font-semibold text-rose-700">
                            • {c.kidName} — {c.timeSlot} ({c.durationMins}m)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Travel Warning */}
                  {travelWarnings.length > 0 && (
                    <div className="p-3 rounded-xl border border-orange-200 bg-orange-50">
                      <p className="text-[11px] font-black uppercase tracking-widest text-orange-600 mb-1">
                        Travel Time Warning
                      </p>
                      <p className="text-xs font-bold text-orange-800">
                        HOME sessions too close. Consider adding buffer (30 mins).
                      </p>
                      <div className="mt-2 space-y-1">
                        {travelWarnings.slice(0, 3).map((c) => (
                          <div key={c.id} className="text-[11px] font-semibold text-orange-700">
                            • {c.kidName} — {c.timeSlot}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Student */}
                  {!isBreak && (
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Student
                      </label>
                      <select
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                        value={editingItem.kidId}
                        onChange={(e) => {
                          const kid = kids.find((k) => k.id === e.target.value);
                          setEditingItem({
                            ...editingItem,
                            kidId: e.target.value,
                            kidName: kid?.name ?? 'Unknown'
                          });
                        }}
                      >
                        {kids.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Provider */}
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Provider
                    </label>
                    <select
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                      value={editingItem.trainerId}
                      onChange={(e) => {
                        const t = trainers.find((tr) => tr.id === e.target.value);
                        setEditingItem({
                          ...editingItem,
                          trainerId: e.target.value,
                          trainerName: t?.name ?? 'Unknown'
                        });
                      }}
                    >
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.clinicalRole})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Session Type */}
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Session Type
                    </label>
                    <select
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                      value={editingItem.sessionType}
                      onChange={(e) => {
                        const nextType = e.target.value as SessionType;

                        if (nextType === SessionType.BREAK) {
                          setEditingItem({
                            ...editingItem,
                            sessionType: nextType,
                            kidId: 'BREAK',
                            kidName: 'BREAK',
                            durationMins: 30
                          });
                          return;
                        }

                        setEditingItem({
                          ...editingItem,
                          sessionType: nextType,
                          durationMins: clampDurationByType(editingItem.durationMins)
                        });
                      }}
                    >
                      {Object.values(SessionType).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                      value={editingItem.dateStr || ''}
                      onChange={(e) => {
                        const newDateStr = e.target.value;
                        const d = new Date(newDateStr + 'T00:00:00');
                        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

                        const map: Record<string, DayOfWeek> = {
                          MON: DayOfWeek.MON,
                          TUE: DayOfWeek.TUE,
                          WED: DayOfWeek.WED,
                          THU: DayOfWeek.THU,
                          FRI: DayOfWeek.FRI,
                          SAT: DayOfWeek.SAT,
                          SUN: DayOfWeek.SUN
                        };

                        setEditingItem({
                          ...editingItem,
                          dateStr: newDateStr,
                          day: map[weekday] ?? editingItem.day
                        });
                      }}
                    />
                  </div>

                  {/* Time + Duration */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Start Time
                      </label>
                      <select
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                        value={startOnly ?? ''}
                        onChange={(e) => {
                          const start = e.target.value;
                          const nextSlot = buildTimeSlot(start, durationSafe);

                          setEditingItem({
                            ...editingItem,
                            timeSlot: nextSlot
                          });
                        }}
                      >
                        {timeOptions.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        <option value="In-Home">In-Home</option>
                        <option value="All Day">All Day</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                        Duration
                      </label>
                      <select
                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-bold outline-none"
                        value={durationSafe}
                        onChange={(e) => {
                          const nextDur = clampDurationByType(Number(e.target.value));
                          const nextSlot = buildTimeSlot(startOnly ?? '', nextDur);

                          setEditingItem({
                            ...editingItem,
                            durationMins: nextDur,
                            timeSlot: nextSlot
                          });
                        }}
                      >
                        {isBreak ? (
                          <>
                            <option value={30}>30 mins</option>
                            <option value={60}>60 mins</option>
                            <option value={90}>90 mins</option>
                            <option value={120}>120 mins</option>
                          </>
                        ) : (
                          <>
                            <option value={60}>60 mins</option>
                            <option value={90}>90 mins</option>
                            <option value={120}>120 mins</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Smart Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        const next = findNextFreeSlot();
                        if (!next) {
                          alert('No free slot available for this trainer today.');
                          return;
                        }
                        setEditingItem({ ...editingItem, timeSlot: next });
                      }}
                      className="py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-slate-800 dark:text-white font-black text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Move to Next Free Slot
                    </button>

                    <button
                      onClick={doSwapTrainerWithConflict}
                      className="py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-slate-800 dark:text-white font-black text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Swap Trainer
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Preview</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{previewSlot}</p>
                  </div>

                  {/* Actions */}
                  {/* Actions */}
<div className="pt-2 flex flex-col gap-2">
  {/* SAVE ONLY (NO AUTOSCHEDULER EVER) */}
  <button
    onClick={async () => {
      const safeDuration = clampDurationByType(editingItem.durationMins);
      const start = getStartOnly(editingItem.timeSlot);
      const nextSlot = buildTimeSlot(start, safeDuration);

      const updatedItem = {
        ...editingItem,
        durationMins: safeDuration,
        timeSlot: nextSlot,
        isManuallyEdited: true,
        isLocked: true
      };

      await onUpdateItem(editingItem.id, updatedItem);
      setEditingItem(null);
      onRefresh();
    }}
    className="w-full py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
  >
    Save Only
  </button>

  {/* SAVE & REBALANCE (ONLY FOR TODAY/FUTURE) */}
  <button
    onClick={async () => {
      const safeDuration = clampDurationByType(editingItem.durationMins);
      const start = getStartOnly(editingItem.timeSlot);
      const nextSlot = buildTimeSlot(start, safeDuration);

      const updatedItem = {
        ...editingItem,
        durationMins: safeDuration,
        timeSlot: nextSlot,
        isManuallyEdited: true,
        isLocked: true
      };

      await onUpdateItem(editingItem.id, updatedItem);
      setEditingItem(null);

      if (updatedItem.dateStr) {
        // 🚫 if past day => do NOT rebalance
        if (isPastDate(updatedItem.dateStr)) {
          onRefresh();
          return;
        }

        const targetDate = new Date(updatedItem.dateStr + "T00:00:00");
        await runAutoScheduler("DAY", targetDate);
        onRefresh();
      }
    }}
    disabled={!!editingItem.dateStr && isPastDate(editingItem.dateStr)}
    className={`w-full py-3 font-black rounded-xl shadow-lg transition-all
      ${
        editingItem.dateStr && isPastDate(editingItem.dateStr)
          ? "bg-slate-300 text-white cursor-not-allowed"
          : "bg-brand-600 hover:bg-brand-700 text-white"
      }`}
  >
    Save & Rebalance
  </button>

  <button
    onClick={() => {
      const ok = window.confirm("Delete this session?");
      if (!ok) return;
      onDeleteItem(editingItem.id);
      setEditingItem(null);
    }}
    className="w-full py-3 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 text-rose-600 font-black rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all"
  >
    Delete Session
  </button>

  <button
    onClick={() => setEditingItem(null)}
    className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
  >
    Cancel
  </button>
</div>

                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
