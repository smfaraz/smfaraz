
import React, { useState } from 'react';
import { SparklesIcon, LockIcon, UserGroupIcon, UserIcon, ChartBarIcon } from './Icons';

interface Props {
  onInitiateLogin: (rolePreference: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onInitiateLogin }) => {
  return (
    <div className="min-h-screen selection:bg-brand-500/30">
      {/* HERO SECTION */}
      <section className="relative h-screen flex flex-col items-center justify-center px-6 overflow-hidden perspective-container">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-brand-600/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-pink-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        </div>

        <div className="text-center z-10 space-y-8 tilt-card">
          <div className="inline-flex items-center gap-3 bg-white/5 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <SparklesIcon className="w-4 h-4 text-brand-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Next-Gen Clinical ERP</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-black tracking-tighter leading-[0.8] uppercase dark:text-white transition-all duration-700 hover:tracking-[-0.05em]">
            Clinic<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-pink-400 to-brand-600">Connect AI</span>
          </h1>

          <p className="max-w-2xl mx-auto text-zinc-500 dark:text-zinc-400 text-lg md:text-xl font-medium leading-relaxed px-4">
            A hyper-intelligent scheduling ecosystem that synchronizes multi-specialty clinical domains with zero-latency conflict resolution.
          </p>

          <div className="pt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              className="px-10 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              Explore OS
            </button>
            <button 
              onClick={() => onInitiateLogin('Director')}
              className="px-10 py-5 bg-brand-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl shadow-brand-500/40 hover:scale-105 active:scale-95 transition-all"
            >
              Initialize Access
            </button>
          </div>
        </div>

        {/* 3D DECORATIVE ELEMENTS */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-12 h-12 glass-panel rounded-xl rotate-12 animate-bounce duration-[3s]" />
          <div className="absolute bottom-1/4 right-1/4 w-20 h-20 glass-panel rounded-3xl -rotate-12 animate-bounce duration-[4s] delay-700" />
          <div className="absolute top-1/2 right-1/3 w-8 h-8 bg-brand-500/20 rounded-full blur-xl animate-pulse" />
        </div>
      </section>

      {/* SYSTEM ARCHITECTURE */}
      <section className="py-32 px-6 lg:px-24 bg-white/50 dark:bg-black/20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 space-y-4">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase dark:text-white">The Neural Core</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Triple-Layered Clinical Optimization</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { title: 'AI Matching', desc: 'Gemini 3.0 Pro logic ensures therapists are matched to students based on certification, availability, and clinical quotas.', icon: SparklesIcon, color: 'brand' },
              { title: 'Auth Ledger', desc: 'Real-time insurance tracking prevents over-scheduling and ensures every session is pre-authorized by regional nodes.', icon: ChartBarIcon, color: 'pink' },
              { title: 'Zero Conflict', desc: 'A sophisticated temporal buffer system ensures no physical overlap between providers or students across the entire facility.', icon: LockIcon, color: 'emerald' },
            ].map((feat, i) => (
              <div key={i} className="glass-panel p-12 rounded-[3.5rem] border-zinc-200 dark:border-zinc-800 group hover:-translate-y-4 transition-all duration-500">
                <div className={`w-16 h-16 bg-${feat.color}-500/10 rounded-2xl flex items-center justify-center mb-8 border border-${feat.color}-500/20 text-${feat.color}-500`}>
                  <feat.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black tracking-tight uppercase mb-4 dark:text-white">{feat.title}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACCESS PORTAL */}
      <section className="py-32 px-6 lg:px-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase dark:text-white mb-6">Network Nodes</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">Select your authorization channel</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { role: 'Director', label: 'Clinical Authority', desc: 'Master override, resource management, and AI engine synchronization.', icon: UserGroupIcon, color: 'brand' },
              { role: 'Staff', label: 'Clinical Provider', desc: 'View temporal timelines, patient rosters, and weekly clinical loads.', icon: UserIcon, color: 'brand' },
              { role: 'Parent', label: 'Guardian Node', desc: 'Real-time session visibility and clinical authorization status.', icon: UserIcon, color: 'brand' },
            ].map((node, i) => (
              <div 
                key={i} 
                onClick={() => onInitiateLogin(node.role)}
                className="glass-panel p-10 rounded-[4rem] text-center border-zinc-200 dark:border-zinc-800 cursor-pointer group hover:scale-[1.02] active:scale-95 transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-20 h-20 bg-brand-600/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8 group-hover:bg-brand-600 group-hover:text-white transition-all">
                  <node.icon className="w-10 h-10" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-2">{node.label}</p>
                <h4 className="text-3xl font-black tracking-tight uppercase mb-6 dark:text-white">{node.role}</h4>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium leading-relaxed mb-8">{node.desc}</p>
                <div className="text-[10px] font-black uppercase tracking-widest text-brand-600 group-hover:translate-x-2 transition-transform inline-flex items-center gap-2">
                  Establish Link 
                  <span className="text-lg">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-zinc-100 dark:border-zinc-900 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-400">ClinicConnect AI v5.0 © 2024 Neural Core Systems</p>
      </footer>
    </div>
  );
};
