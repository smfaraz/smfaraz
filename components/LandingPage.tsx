import React from 'react';
import { SparklesIcon, LockIcon, UserGroupIcon, UserIcon, ChartBarIcon } from './Icons';

interface Props {
  onInitiateLogin: (rolePreference: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onInitiateLogin }) => {
  return (
    <div className="min-h-screen selection:bg-brand-500/30 font-sans">
      {/* PROFESSIONAL HERO SECTION */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
        
        {/* Background Gradients */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="text-center z-10 max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-700 px-4 py-1.5 rounded-full shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">Enterprise Edition v5.0</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            Intelligent Scheduling for 
            <span className="text-brand-600 block mt-2">Modern Clinics</span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-600 dark:text-slate-400 text-lg md:text-xl leading-relaxed">
            Eliminate scheduling conflicts and optimize staff allocation with our AI-driven operating system. Designed for high-volume therapy centers.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => onInitiateLogin('Director')}
              className="px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-semibold shadow-lg shadow-brand-500/30 transition-all transform hover:-translate-y-1"
            >
              Access Portal
            </button>
            <button 
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="px-8 py-4 bg-white dark:bg-transparent border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-brand-900/50 transition-all"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="py-24 px-6 lg:px-24 bg-white dark:bg-transparent border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Core Capabilities</h2>
            <p className="text-slate-500">Everything you need to manage your clinical ecosystem.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'AI Optimization', desc: 'Gemini 3.0 algorithms automatically resolve conflicts and optimize gap times.', icon: SparklesIcon },
              { title: 'Smart Ledger', desc: 'Real-time tracking of insurance authorizations and session limits.', icon: ChartBarIcon },
              { title: 'Role Security', desc: 'Granular access control for Directors, Staff, and Guardians.', icon: LockIcon },
            ].map((feat, i) => (
              <div key={i} className="p-8 rounded-2xl bg-slate-50 dark:bg-brand-900/40 border border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-700 transition-all group">
                <div className="w-12 h-12 bg-white dark:bg-brand-800 rounded-lg flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
                  <feat.icon className="w-6 h-6 text-brand-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feat.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-sm">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center bg-slate-50 dark:bg-[#050a14]">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">© 2024 Clinic OS. Enterprise Standard.</p>
      </footer>
    </div>
  );
};