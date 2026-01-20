import React, { useState, useEffect } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { 
  SparklesIcon, 
  LockIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  CalendarIcon, 
  CheckIcon 
} from './Icons';

interface Props {
  onInitiateLogin: (rolePreference: string) => void;
}

/**
 * 3D FLOATING ENGINE HUB
 * A centerpiece visual representing the "intelligence" of the system.
 */
const FloatingEngineHub = () => (
  <motion.div 
    initial={{ rotateY: 0 }}
    animate={{ 
      rotateY: [0, 20, -20, 0],
      rotateX: [0, 10, -10, 0],
      y: [0, -30, 0]
    }}
    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    style={{ perspective: 2000 }}
    className="relative w-72 h-72 mx-auto flex items-center justify-center"
  >
    {/* Animated Ring */}
    <div className="absolute inset-0 border-[3px] border-dashed border-brand-500/30 rounded-full animate-spin-slow" />
    <div className="absolute inset-4 border border-brand-400/20 rounded-full animate-reverse-spin" />
    
    {/* Core Glass Card */}
    <div className="relative w-52 h-64 bg-gradient-to-br from-brand-600 to-indigo-700 rounded-[3rem] shadow-[0_0_50px_rgba(79,70,229,0.4)] flex flex-col items-center justify-center border border-white/20 backdrop-blur-xl transition-all duration-500 hover:scale-105">
      <div className="bg-white/10 p-5 rounded-2xl mb-4 shadow-inner">
        <SparklesIcon className="w-12 h-12 text-white animate-pulse" />
      </div>
      <p className="text-white font-black text-[10px] uppercase tracking-[0.4em]">Proprietary Engine</p>
      <div className="absolute -bottom-5 -right-5 bg-emerald-500 p-4 rounded-2xl shadow-2xl border-4 border-white dark:border-slate-900 scale-110">
        <CheckIcon className="w-6 h-6 text-white" />
      </div>
    </div>
  </motion.div>
);

/**
 * LOGIC TERMINAL
 */
const LogicTerminal = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const scenarios = [
    "> Ingesting Monday Staff Roster...",
    "> Analyzing Student-to-Staff ratios...",
    "> Validation: 97155 supervision goal met.",
    "> Resolving Travel Buffer: 30min gap inserted.",
    "> Optimization Complete: 100% Coverage reached."
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setLogs(prev => [...prev.slice(-4), scenarios[i]]);
      i = (i + 1) % scenarios.length;
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#050a14] rounded-3xl p-8 border border-slate-800 shadow-2xl font-mono text-xs w-full group hover:border-brand-500/50 transition-all duration-500">
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-4">
        <div className="w-3 h-3 rounded-full bg-red-500/40" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
        <span className="ml-4 text-slate-500 uppercase tracking-widest text-[10px] font-bold">System_Core_v5.0</span>
      </div>
      <div className="space-y-3 h-40 overflow-hidden text-emerald-500/90 leading-relaxed">
        {logs.map((log, idx) => (
          <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>{log}</motion.div>
        ))}
        <div className="text-brand-400 animate-pulse font-bold text-lg">_</div>
      </div>
    </div>
  );
};

export const LandingPage: React.FC<Props> = ({ onInitiateLogin }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);

  return (
    <div className="min-h-screen selection:bg-brand-500/30 font-sans bg-white dark:bg-[#0b1120] overflow-x-hidden">
      <motion.div className="fixed top-0 left-0 right-0 h-1.5 bg-brand-600 origin-left z-[1000] shadow-[0_0_10px_rgba(79,70,229,0.8)]" style={{ scaleX }} />

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        <motion.div style={{ y: backgroundY }} className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-600/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[140px]" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, type: "spring" }}
          className="text-center z-10 max-w-5xl mx-auto space-y-10"
        >
          <div className="inline-flex items-center gap-3 bg-brand-50/50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-700 px-6 py-2 rounded-full shadow-xl backdrop-blur-md">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Enterprise Standard v5.0</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white leading-[0.9] drop-shadow-2xl">
            Intelligent Scheduling for <br />
            <span className="text-brand-600 italic">Modern Clinics</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-400 text-xl md:text-2xl leading-relaxed font-medium">
            Eliminate scheduling conflicts with a high-performance operating system designed for enterprise-level therapy centers.
          </p>

          <div className="pt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => onInitiateLogin('Director')}
              className="group relative px-10 py-5 bg-brand-600 text-white rounded-2xl font-black text-lg shadow-[0_20px_50px_rgba(79,70,229,0.3)] hover:shadow-[0_20px_50px_rgba(79,70,229,0.5)] transition-all hover:-translate-y-2"
            >
              Access Portal
              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button 
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="px-10 py-5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl font-black text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xl"
            >
              View Workflow
            </button>
          </div>
        </motion.div>
      </section>

      {/* --- FEATURE GRID (POPS UP ON SCROLL) --- */}
      <section className="py-32 px-6 lg:px-24 bg-slate-50 dark:bg-transparent">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { title: 'AI Optimization', desc: 'Proprietary logic resolves millions of permutations to find the perfect pairing.', icon: SparklesIcon },
            { title: 'Clinical Ledger', desc: 'Live tracking of insurance authorizations and supervision mandates.', icon: ChartBarIcon },
            { title: 'Role Security', desc: 'Enterprise-grade encryption and granular access control for all users.', icon: LockIcon },
          ].map((feat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 100, rotateX: 20 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ delay: i * 0.2, duration: 0.8 }}
              className="p-10 rounded-[2.5rem] bg-white dark:bg-brand-900/20 border border-slate-100 dark:border-slate-800 shadow-2xl hover:border-brand-500 transition-all group overflow-hidden"
            >
              <div className="w-16 h-16 bg-brand-50 dark:bg-brand-800 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-12 transition-transform">
                <feat.icon className="w-8 h-8 text-brand-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4">{feat.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{feat.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --- 3D COMPLIANCE CENTER --- */}
      <section className="py-40 px-6 lg:px-24 bg-white dark:bg-[#0b1120] relative">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-32 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -100 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h2 className="text-5xl font-black text-slate-900 dark:text-white leading-[1.1]">
              Built-in <span className="text-brand-600 italic">Clinical Intelligence</span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 leading-relaxed">
              Every roster is verified against clinical mandates, supervision targets, and travel buffers automatically.
            </p>
            <div className="grid gap-4">
              {['Insurance Limit Protection', 'Credential Tracking', 'Automated Buffers'].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="w-6 h-6 bg-brand-100 dark:bg-brand-900 flex items-center justify-center rounded-full">
                    <CheckIcon className="w-3 h-3 text-brand-600" />
                  </div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
          <FloatingEngineHub />
        </div>
      </section>

      {/* --- PERSPECTIVE TILT LIFECYCLE --- */}
      <section className="py-32 px-6 lg:px-24 bg-slate-50 dark:bg-brand-950/20 border-y border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl font-black uppercase tracking-tighter">Optimization <span className="text-brand-600">Lifecycle</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {[
              { step: '01', title: 'Data Ingestion', desc: 'Syncing rosters and clinical mandates.' },
              { step: '02', title: 'Analysis', desc: 'Processing millions of staff-student permutations.' },
              { step: '03', title: 'Deployment', desc: 'Live rosters deployed to all portals instantly.' },
            ].map((item, i) => (
              <motion.div 
                key={i}
                whileHover={{ rotateX: 15, rotateY: 15, scale: 1.05 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="p-12 bg-slate-900 rounded-[3rem] border border-slate-800 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute -top-4 -right-4 text-9xl font-black text-white/5 group-hover:text-brand-600/20 transition-all duration-700">
                  {item.step}
                </div>
                <h3 className="text-3xl font-black text-white mb-6 relative z-10">{item.title}</h3>
                <p className="text-slate-400 relative z-10 text-lg leading-relaxed">{item.desc}</p>
                <div className="mt-10 h-2 w-0 bg-brand-600 group-hover:w-full transition-all duration-1000 rounded-full" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- SCROLL-LINKED LOGIC VISUALIZER --- */}
      <section className="py-40 px-6 lg:px-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 50 }}
          >
            <LogicTerminal />
          </motion.div>
          <div className="space-y-10">
            <h2 className="text-5xl font-black italic leading-tight">
              Intelligent <br />
              <span className="text-brand-600">Self-Healing</span>
            </h2>
            <p className="text-2xl text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              If a staff member calls out, the engine identifies affected students and rebalances the day instantly.
            </p>
            <div className="bg-emerald-500/10 border-2 border-emerald-500/20 p-6 rounded-[2rem] inline-flex items-center gap-4">
               <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]" />
               <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.3em]">Active Resolution Logic</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 border-t border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-[#050a14]">
        <div className="flex justify-center gap-12 mb-10 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">
           <span className="hover:text-brand-500 transition-colors cursor-pointer">HIPAA Secure</span>
           <span className="hover:text-brand-500 transition-colors cursor-pointer">Privacy Policy</span>
           <span className="hover:text-brand-500 transition-colors cursor-pointer">Support</span>
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">© 2026 Clinic OS • Enterprise Clinical Standard.</p>
      </footer>
    </div>
  );
};