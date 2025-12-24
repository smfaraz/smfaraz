import React, { useState, useMemo, useEffect } from 'react';
import { Trainer, Kid, ScheduleItem, Specialty, DayOfWeek, Role, StaffStatus, SessionStatus } from './types';
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
  LockIcon,
  UserGroupIcon,
  PlusIcon
} from './components/Icons';
import { AdminPanel } from './components/AdminPanel';
import { AIChat } from './components/AIChat';
import { DirectorDashboard } from './components/DirectorDashboard';
import { StaffDashboard } from './components/StaffDashboard';
import { LandingPage } from './components/LandingPage';

// Main App component
const App: React.FC = () => {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [loggedInRole, setLoggedInRole] = useState<Role | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ user: '', pass: '' });
  const [authError, setAuthError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin' | 'schedule'>('dashboard');
  
  // App Navigation States
  const [showLogin, setShowLogin] = useState(false);
  const [intendedRole, setIntendedRole] = useState<string>('');

  // Initial data fetch
  useEffect(() => {
    const init = async () => {
      setTimeout(async () => {
        const t = await apiService.fetchTrainers();
        const k = await apiService.fetchKids();
        const s = await apiService.fetchSchedule();
        setTrainers(t || []);
        setKids(k || []);
        setSchedule(s || []);
        setIsReady(true);
      }, 1000);
    };
    init();
  }, []);

  // Theme toggle
  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.theme = newDark ? 'dark' : 'light';
  };

  /**
   * New functionality: Handles updating trainer status and triggers rescheduling
   * if the trainer is no longer active (e.g., Sick or PTO).
   */
  const handleTrainerStatusUpdate = async (trainerId: string, newStatus: StaffStatus) => {
    // Update trainer in local state and API
    const updatedTrainers = await apiService.updateTrainer(trainerId, { status: newStatus });
    setTrainers(updatedTrainers);

    // Auto-reschedule if the trainer is Sick or PTO
    if (newStatus !== StaffStatus.ACTIVE) {
      setIsGenerating(true);
      try {
        // Run the AI scheduling engine with updated availability
        const updatedSchedule = await generateSchedule(updatedTrainers, kids);
        setSchedule(updatedSchedule);
        await apiService.saveSchedule(updatedSchedule);
      } catch (e) {
        console.error("Rescheduling failed:", e);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const currentUserObj = useMemo(() => {
    if (loggedInRole === Role.STAFF) return trainers.find(t => t.id === currentUserId);
    if (loggedInRole === Role.PARENT) return kids.find(k => k.id === currentUserId);
    if (loggedInRole === Role.DIRECTOR) return { id: 'admin', name: 'Director Administrator' };
    return null;
  }, [loggedInRole, currentUserId, trainers, kids]);

  const filteredSchedule = useMemo(() => {
    if (loggedInRole === Role.DIRECTOR) return schedule;
    if (loggedInRole === Role.STAFF) return schedule.filter(s => s.trainerId === currentUserId);
    if (loggedInRole === Role.PARENT) return schedule.filter(s => s.kidId === currentUserId);
    return [];
  }, [schedule, loggedInRole, currentUserId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (authForm.user === 'admin' && authForm.pass === 'admin') {
      setLoggedInRole(Role.DIRECTOR);
      setCurrentUserId('admin');
      setShowLogin(false);
      return;
    }
    const trainer = trainers.find(t => t.username === authForm.user && t.password === authForm.pass);
    if (trainer) {
      setLoggedInRole(Role.STAFF);
      setCurrentUserId(trainer.id);
      setShowLogin(false);
      return;
    }
    const kid = kids.find(k => k.parentUsername === authForm.user && k.parentPassword === authForm.pass);
    if (kid) {
      setLoggedInRole(Role.PARENT);
      setCurrentUserId(kid.id);
      setShowLogin(false);
      return;
    }
    setAuthError('Unauthorized access attempt.');
  };

  if (!isReady) return (
    <div className="h-screen w-full flex flex-col items-center justify-center space-y-6">
      <div className="neural-ring"></div>
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">Loading Clinical OS</p>
    </div>
  );

  // Landing & Login Flow
  if (!loggedInRole) {
    return (
      <>
        <LandingPage onInitiateLogin={(role) => { setIntendedRole(role); setShowLogin(true); }} />
        
        {showLogin && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 lg:p-12 backdrop-blur-3xl animate-in fade-in duration-300">
            <div className="w-full max-w-lg glass-panel p-8 lg:p-14 rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-500 text-center relative">
              <button 
                onClick={() => setShowLogin(false)}
                className="absolute top-8 right-8 text-zinc-400 hover:text-rose-500 text-4xl font-light leading-none"
              >
                &times;
              </button>
              
              <div className="inline-block bg-brand-600 p-5 rounded-3xl mb-8 shadow-xl shadow-brand-500/20">
                <LockIcon className="w-8 h-8 text-white" />
              </div>
              
              <h1 className="text-3xl lg:text-4xl font-black tracking-tighter mb-2 dark:text-white">ClinicConnect</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-10">{intendedRole} Access Node</p>
              
              <form onSubmit={handleLogin} className="space-y-6 text-left">
                {authError && <div className="p-4 bg-rose-500/10 text-rose-500 text-[10px] font-black uppercase rounded-2xl border border-rose-500/20 text-center">{authError}</div>}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-4">Identification UID</label>
                    <input type="text" placeholder="UID" required className="w-full p-5 lg:p-6 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none focus:ring-4 ring-brand-500/10 font-bold dark:text-white" value={authForm.user} onChange={e => setAuthForm({...authForm, user: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-4">Authorization Token</label>
                    <input type="password" placeholder="TOKEN" required className="w-full p-5 lg:p-6 bg-zinc-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl outline-none focus:ring-4 ring-brand-500/10 font-bold dark:text-white" value={authForm.pass} onChange={e => setAuthForm({...authForm, pass: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="w-full py-6 bg-brand-600 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-[12px] shadow-2xl shadow-brand-500/40 hover:bg-brand-700 active:scale-95 transition-all mt-4">Establish Link</button>
              </form>
              <p className="mt-8 text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-relaxed">Default Dev Bypass: admin / admin</p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Operating System Interface (Authenticated)
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#020205] text-zinc-900 dark:text-zinc-100 selection:bg-brand-600/30">
      <nav className="fixed left-0 top-0 h-full w-20 lg:w-24 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-900 flex flex-col items-center py-10 z-[400] transition-all">
        <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 mb-12">
          <SparklesIcon className="w-6 h-6 text-white" />
        </div>
        
        <div className="flex-1 flex flex-col gap-8">
          <button onClick={() => setView('dashboard')} className={`p-4 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-brand-600 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}>
            <ChartBarIcon className="w-6 h-6" />
          </button>
          <button onClick={() => setView('schedule')} className={`p-4 rounded-2xl transition-all ${view === 'schedule' ? 'bg-brand-600 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}>
            <CalendarIcon className="w-6 h-6" />
          </button>
          {loggedInRole === Role.DIRECTOR && (
            <button onClick={() => setView('admin')} className={`p-4 rounded-2xl transition-all ${view === 'admin' ? 'bg-brand-600 text-white shadow-xl' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}>
              <UserGroupIcon className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <button onClick={toggleTheme} className="p-4 text-zinc-400 hover:text-brand-600 transition-colors">
            <SettingsIcon className="w-6 h-6" />
          </button>
          <button onClick={() => setLoggedInRole(null)} className="p-4 text-zinc-400 hover:text-rose-500 transition-colors">
            <LogOutIcon className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <main className="pl-20 lg:pl-24 min-h-screen">
        <header className="px-6 lg:px-12 py-8 lg:py-12 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-600">Clinic OS v5.0</span>
              <div className="w-1 h-1 bg-zinc-300 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">{view} view</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black tracking-tighter uppercase dark:text-white">
              {view === 'dashboard' ? `Welcome, ${currentUserObj?.name}` : view === 'schedule' ? 'Temporal Node' : 'Root Access'}
            </h2>
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto">
            {loggedInRole === Role.DIRECTOR && view === 'schedule' && (
              <button 
                onClick={async () => {
                  setIsGenerating(true);
                  try {
                    const newSchedule = await generateSchedule(trainers, kids);
                    setSchedule(newSchedule);
                    await apiService.saveSchedule(newSchedule);
                  } catch (e) { console.error(e); } finally { setIsGenerating(false); }
                }}
                disabled={isGenerating}
                className="flex-1 lg:flex-none bg-brand-600 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-brand-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <SparklesIcon className="w-4 h-4" />
                {isGenerating ? 'Compiling...' : 'Sync Engine'}
              </button>
            )}
            <div className="hidden sm:flex items-center gap-4 bg-white dark:bg-zinc-900 px-6 py-3 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-1">{loggedInRole}</p>
                <p className="text-xs font-black uppercase tracking-widest dark:text-zinc-200">{currentUserObj?.name}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="px-6 lg:px-12 pb-24">
          {view === 'dashboard' && (
            <>
              {loggedInRole === Role.DIRECTOR && <DirectorDashboard trainers={trainers} kids={kids} schedule={schedule} />}
              {loggedInRole === Role.STAFF && currentUserObj && (
                <StaffDashboard 
                  trainer={currentUserObj as Trainer} 
                  schedule={filteredSchedule} 
                  onUpdateStatus={(status) => handleTrainerStatusUpdate(currentUserObj.id, status)}
                />
              )}
              {loggedInRole === Role.PARENT && (
                <div className="glass-panel p-12 lg:p-24 rounded-[4rem] text-center max-w-4xl mx-auto border border-brand-500/20 shadow-2xl animate-in slide-in-from-bottom-10 duration-700">
                   <div className="w-24 h-24 bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-10 border border-brand-500/20">
                     <UserIcon className="w-12 h-12 text-brand-600" />
                   </div>
                   <h3 className="text-4xl lg:text-6xl font-black tracking-tighter dark:text-white mb-6">Hello, {currentUserObj?.name}</h3>
                   <p className="text-zinc-500 dark:text-zinc-400 text-lg font-medium leading-relaxed mb-12">Your personalized clinical timeline is optimized and ready for review.</p>
                   <button onClick={() => setView('schedule')} className="bg-brand-600 text-white px-14 py-6 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-brand-500/40 hover:-translate-y-1 transition-all active:scale-95">View Timeline</button>
                </div>
              )}
            </>
          )}
          {view === 'schedule' && (
            <ScheduleView 
              schedule={filteredSchedule} 
              trainers={trainers} 
              kids={kids}
              isLoading={isGenerating} 
              onUpdateItem={async (id, updates) => {
                const updated = await apiService.updateScheduleItem(id, updates);
                setSchedule(updated);
              }}
              onDeleteItem={async (id) => {
                const updated = await apiService.deleteScheduleItem(id);
                setSchedule(updated);
              }}
            />
          )}
          {view === 'admin' && loggedInRole === Role.DIRECTOR && (
            <AdminPanel trainers={trainers} setTrainers={setTrainers} kids={kids} setKids={setKids} onImport={() => {}} onLogout={() => setLoggedInRole(null)} />
          )}
        </section>
      </main>

      <AIChat trainers={trainers} kids={kids} schedule={schedule} />
    </div>
  );
};

export default App;