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

import { apiService } from './services/apiService';
import { ScheduleView } from './components/ScheduleView';

import {
  SparklesIcon,
  ChartBarIcon,
  SettingsIcon,
  LogOutIcon,
  CalendarIcon,
  UserGroupIcon
} from './components/Icons';

import { AdminPanel } from './components/AdminPanel';
import { AIChat } from './components/AIChat';
import { DirectorDashboard } from './components/DirectorDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { LandingPage } from './components/LandingPage';
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
     DATA HANDLERS
  ================================ */
  
  const handleRefreshSchedule = async () => {
    setIsGenerating(true); 
    try {
      const updated = await apiService.fetchSchedule();
      setSchedule(updated);
    } catch (err) {
      console.error("Failed to refresh schedule:", err);
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

  if (!isReady) return <div className="h-screen flex items-center justify-center text-brand-600 animate-pulse font-semibold">Initializing System...</div>;

  if (loggedInRole === Role.KIOSK) {
    return <KioskPortal kids={kids} onLogAction={handleKioskLogAction} onExit={() => setLoggedInRole(null)} />;
  }

  if (!loggedInRole) {
    return (
       <div className="transition-colors duration-500 font-sans">
         <LandingPage onInitiateLogin={(role) => { setIntendedRole(role); setShowLogin(true); }} />
         {showLogin && (
           <div className="fixed inset-0 z-[1000] backdrop-blur-sm flex items-center justify-center bg-brand-900/40 p-4">
             <div className="w-full max-w-md bg-white dark:bg-brand-900 border border-brand-100 dark:border-brand-800 p-8 rounded-2xl shadow-2xl relative">
                 <button onClick={() => setShowLogin(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl">×</button>
                 <div className="flex items-center justify-center gap-2 mb-6">
                    <SparklesIcon className="w-6 h-6 text-brand-600" />
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Secure Access</h1>
                 </div>
                 
                 <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">User ID</label>
                        <input className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 transition-all" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Passkey</label>
                        <input type="password" className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 transition-all" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
                    </div>
                    {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
                    <button className="w-full py-3 bg-brand-600 text-white rounded-lg font-semibold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition-all">Verify Credentials</button>
                    <p className="text-xs text-center text-slate-400 mt-2">Director: admin / admin</p>
                 </form>
             </div>
           </div>
         )}
       </div>
    );
  }

  // --- PROFESSIONAL SIDEBAR & LAYOUT ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors duration-500 font-sans">
       
       {/* Sidebar */}
       <nav className="fixed left-0 top-0 h-full w-20 bg-brand-900 dark:bg-brand-950 flex flex-col items-center py-6 z-50 shadow-2xl">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/40 mb-10">
            <SparklesIcon className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 flex flex-col gap-6 w-full px-3">
            <button onClick={() => setView('dashboard')} 
                className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Dashboard">
                <ChartBarIcon className="w-6 h-6"/>
            </button>
            <button onClick={() => setView('schedule')} 
                className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'schedule' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Schedule">
                <CalendarIcon className="w-6 h-6"/>
            </button>
            {loggedInRole === Role.DIRECTOR && 
            <button onClick={() => setView('admin')} 
                className={`p-3 rounded-xl transition-all w-full flex justify-center ${view === 'admin' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Admin">
                <UserGroupIcon className="w-6 h-6"/>
            </button>}
          </div>

          <div className="flex flex-col gap-4 px-3 w-full">
            <button onClick={toggleTheme} className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl w-full flex justify-center"><SettingsIcon className="w-6 h-6" /></button>
            <button onClick={() => setLoggedInRole(null)} className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl w-full flex justify-center"><LogOutIcon className="w-6 h-6" /></button>
          </div>
       </nav>

       <main className="pl-20">
         <header className="px-10 py-8 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-brand-950/50 backdrop-blur-sm sticky top-0 z-40">
            <div>
              <div className="flex items-center gap-2 mb-1">
                 <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                 <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">Clinic OS v5.0</p>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Welcome, {currentUserObj?.name}</h2>
            </div>
         </header>

         <section className="p-10">
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
                 onRefresh={handleRefreshSchedule} 
              />
            )}
            
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