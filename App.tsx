import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Trainer,
  Kid,
  ScheduleItem,
  Role,
  StaffStatus,
  DayOfWeek,
  KioskLog
} from './types';

import { generateSchedule } from './services/geminiService';
import { apiService } from './services/apiService';
import { ScheduleView } from './components/ScheduleView';

import {
  SparklesIcon,
  ChartBarIcon,
  SettingsIcon,
  UserIcon,
  LogOutIcon,
  CalendarIcon,
  UserGroupIcon
} from './components/Icons';

import { AdminPanel } from './components/AdminPanel';
import { AIChat } from './components/AIChat';
import { DirectorDashboard } from './components/DirectorDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { LandingPage } from './components/LandingPage';
// FIX: Corrected filename typo from 'kisko' to 'kiosk'
import { KioskPortal } from './components/kiosk'; 

/* ================================
   MAIN APP
================================ */
const App: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [lockedDays, setLockedDays] = useState<DayOfWeek[]>([]); 
  const [kioskLogs, setKioskLogs] = useState<KioskLog[]>([]); 
  
  const [isReady, setIsReady] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [loggedInRole, setLoggedInRole] = useState<Role | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ user: '', pass: '' });
  const [authError, setAuthError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin' | 'schedule'>('dashboard');
  const [showLogin, setShowLogin] = useState(false);
  const [intendedRole, setIntendedRole] = useState('');

  // Track mounted state to avoid memory leaks
  const isMounted = useRef(false);

  /* ================================
     INITIALIZATION
  ================================ */
  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      const isDarkStored = localStorage.theme === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isMounted.current) {
        setIsDark(isDarkStored);
        document.documentElement.classList.toggle('dark', isDarkStored);
      }

      // Removed artificial setTimeout for faster load
      try {
        const [t, k, s, l] = await Promise.all([
          apiService.fetchTrainers(),
          apiService.fetchKids(),
          apiService.fetchSchedule(),
          apiService.fetchKioskLogs()
        ]);

        if (isMounted.current) {
          setTrainers(t || []);
          setKids(k || []);
          setSchedule(s || []);
          setKioskLogs(l || []);
          setIsReady(true);
        }
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };
    init();

    return () => { isMounted.current = false; };
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDark;
    setIsDark(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme);
    localStorage.theme = nextTheme ? 'dark' : 'light';
  };

  /* ================================
     SYNC ENGINE
  ================================ */
  const handleSyncSchedule = async () => {
    setIsGenerating(true);
    try {
      const updatedSchedule = await generateSchedule(trainers, kids, schedule, lockedDays);
      setSchedule(updatedSchedule);
      await apiService.saveSchedule(updatedSchedule);
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleLock = (day: DayOfWeek) => {
    setLockedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleTrainerStatusUpdate = async (trainerId: string, newStatus: StaffStatus) => {
    const updatedTrainers = await apiService.updateTrainer(trainerId, { status: newStatus });
    setTrainers(updatedTrainers);
    if (newStatus !== StaffStatus.ACTIVE) {
      handleSyncSchedule();
    }
  };

  const handleKioskLogAction = async (log: KioskLog) => {
    const result = await apiService.logKioskAction(log);
    if (result.success) {
      setKioskLogs(prev => [log, ...prev]);
      setKids(prevKids => prevKids.map(k => 
        k.id === log.kidId ? { ...k, currentStatus: result.updatedKid.currentStatus } : k
      ));
    }
  };

  const currentUserObj = useMemo(() => {
    if (loggedInRole === Role.STAFF) return trainers.find(t => t.id === currentUserId);
    if (loggedInRole === Role.DIRECTOR) return { id: 'admin', name: 'Director Administrator' };
    return null;
  }, [loggedInRole, currentUserId, trainers]);

  const filteredSchedule = useMemo(() => {
    if (loggedInRole === Role.DIRECTOR) return schedule;
    if (loggedInRole === Role.STAFF) return schedule.filter(s => s.trainerId === currentUserId);
    return [];
  }, [schedule, loggedInRole, currentUserId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authForm.user === 'admin' && authForm.pass === 'admin') { setLoggedInRole(Role.DIRECTOR); setCurrentUserId('admin'); setShowLogin(false); return; }
    if (authForm.user === 'kiosk' && authForm.pass === 'kiosk') { setLoggedInRole(Role.KIOSK); setShowLogin(false); return; }
    const trainer = trainers.find(t => t.username === authForm.user && t.password === authForm.pass);
    if (trainer) { setLoggedInRole(Role.STAFF); setCurrentUserId(trainer.id); setShowLogin(false); return; }
    setAuthError('Unauthorized access attempt.');
  };

  if (!isReady) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // --- KIOSK MODE ---
  if (loggedInRole === Role.KIOSK) {
    return <KioskPortal kids={kids} onLogAction={handleKioskLogAction} onExit={() => setLoggedInRole(null)} />;
  }

  // --- LOGIN ---
  if (!loggedInRole) {
    return (
       <div className="transition-colors duration-500">
         <LandingPage onInitiateLogin={(role) => { setIntendedRole(role); setShowLogin(true); }} />
         {showLogin && (
           <div className="fixed inset-0 z-[1000] backdrop-blur-3xl flex items-center justify-center bg-black/60 p-4">
             <div className="w-full max-w-lg bg-white p-14 rounded-[3.5rem] relative text-center">
                 <button onClick={() => setShowLogin(false)} className="absolute top-8 right-8 text-4xl">×</button>
                 <h1 className="text-4xl font-black mb-10">ClinicConnect</h1>
                 <form onSubmit={handleLogin} className="space-y-6">
                    <input placeholder="UID" className="w-full p-6 bg-zinc-100 rounded-3xl outline-none font-bold" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
                    <input type="password" placeholder="TOKEN" className="w-full p-6 bg-zinc-100 rounded-3xl outline-none font-bold" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
                    <button className="w-full py-6 bg-black text-white rounded-3xl font-black hover:scale-105 transition-all">Establish Link</button>
                    <p className="text-xs text-zinc-400 mt-4">Kiosk: kiosk / kiosk</p>
                 </form>
             </div>
           </div>
         )}
       </div>
    );
  }

  // --- MAIN DASHBOARD ---
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#020205] text-zinc-900 dark:text-zinc-100 transition-colors duration-500">
       <nav className="fixed left-0 top-0 h-full w-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 flex flex-col items-center py-10 z-50">
          <div className="w-12 h-12 bg-black dark:bg-white rounded-2xl flex items-center justify-center shadow-xl mb-12">
            <SparklesIcon className="w-6 h-6 text-white dark:text-black" />
          </div>
          <div className="flex-1 flex flex-col gap-8">
            <button onClick={() => setView('dashboard')} className={`p-4 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-black text-white shadow-xl' : 'hover:bg-zinc-100'}`}><ChartBarIcon className="w-6 h-6"/></button>
            <button onClick={() => setView('schedule')} className={`p-4 rounded-2xl transition-all ${view === 'schedule' ? 'bg-black text-white shadow-xl' : 'hover:bg-zinc-100'}`}><CalendarIcon className="w-6 h-6"/></button>
            {loggedInRole === Role.DIRECTOR && <button onClick={() => setView('admin')} className={`p-4 rounded-2xl transition-all ${view === 'admin' ? 'bg-black text-white shadow-xl' : 'hover:bg-zinc-100'}`}><UserGroupIcon className="w-6 h-6"/></button>}
          </div>
          <div className="flex flex-col gap-4">
            <button onClick={toggleTheme} className="p-4 hover:bg-zinc-100 rounded-2xl"><SettingsIcon className="w-6 h-6" /></button>
            <button onClick={() => setLoggedInRole(null)} className="p-4 text-rose-500 hover:bg-rose-50 rounded-2xl"><LogOutIcon className="w-6 h-6" /></button>
          </div>
       </nav>

       <main className="pl-24">
         <header className="px-12 py-12 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-600 mb-2">Clinic OS v5.0</p>
              <h2 className="text-6xl font-black tracking-tighter">Welcome, {currentUserObj?.name}</h2>
            </div>
            {loggedInRole === Role.DIRECTOR && (
             <button onClick={handleSyncSchedule} disabled={isGenerating} className="bg-black dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3">
               <SparklesIcon className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} /> {isGenerating ? 'Syncing...' : 'Run Sync Engine'}
             </button>
            )}
         </header>

         <section className="px-12 pb-24">
            {view === 'dashboard' && loggedInRole === Role.DIRECTOR && <DirectorDashboard trainers={trainers} kids={kids} schedule={schedule} />}
            {view === 'dashboard' && loggedInRole === Role.STAFF && currentUserObj && <StaffDashboard trainer={currentUserObj as Trainer} schedule={filteredSchedule} onUpdateStatus={(s) => handleTrainerStatusUpdate(currentUserObj.id, s)} />}
            
            {view === 'schedule' && (
              <ScheduleView 
                 schedule={filteredSchedule} 
                 trainers={trainers} 
                 kids={kids} 
                 isLoading={isGenerating} 
                 lockedDays={lockedDays}
                 onToggleLock={handleToggleLock}
                 onUpdateItem={async (id, up) => { const s = await apiService.updateScheduleItem(id, up); setSchedule(s); }} 
                 onDeleteItem={async (id) => { const s = await apiService.deleteScheduleItem(id); setSchedule(s); }}
              />
            )}
            
            {/* ADMIN PANEL WITH KIOSK LOGS */}
            {view === 'admin' && loggedInRole === Role.DIRECTOR && (
               <AdminPanel 
                 trainers={trainers} 
                 setTrainers={setTrainers} 
                 kids={kids} 
                 setKids={setKids} 
                 kioskLogs={kioskLogs} 
                 onImport={() => {}} 
                 onLogout={() => setLoggedInRole(null)} 
               />
            )}
         </section>
       </main>
       <AIChat trainers={trainers} kids={kids} schedule={schedule} />
    </div>
  );
};

export default App;