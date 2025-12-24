
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { SparklesIcon, UserIcon, CalendarIcon } from './Icons';
import { Trainer, Kid, ScheduleItem } from '../types';

interface Props {
  trainers: Trainer[];
  kids: Kid[];
  schedule: ScheduleItem[];
}

export const AIChat: React.FC<Props> = ({ trainers, kids, schedule }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const now = new Date();
      const currentDateTime = {
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now)
      };

      // Strict Context Injection
      const contextData = {
        system_clock: currentDateTime,
        clinic_stats: {
          total_providers: trainers.length,
          total_students: kids.length,
          active_sessions: schedule.length
        },
        staff_roster: trainers.map(t => ({ name: t.name, specialties: t.specialties, status: t.status })),
        student_roster: kids.map(k => ({ 
          name: k.name, 
          auth_hours: k.insuranceCapHours, 
          used_hours: k.insuranceUsedHours,
          needs: k.requiredSpecialties 
        })),
        // Fix: Corrected property access and removed typo in mapping. Property 'time' does not exist on type 'ScheduleItem', should use 'timeSlot'.
        current_schedule: schedule.map(s => ({ day: s.day, time: s.timeSlot, trainer: s.trainerName, kid: s.kidName, type: s.specialty }))
      };

      const systemInstruction = `
        You are the ClinicConnect AI Assistant. 
        IDENTITY: High-precision ERP clinical analyzer.
        
        TEMPORAL CONTEXT:
        The current date is ${currentDateTime.date}. 
        The current time is ${currentDateTime.time}. 
        Today is ${currentDateTime.day}.
        
        RULES:
        1. Use ONLY the provided data. Do not hallucinate external insurance providers.
        2. "Insurance" in this app refers to AUTHORIZED THERAPY HOURS. 
        3. Report accurately on "auth_hours" vs "used_hours".
        4. If a user asks "what's next?" or "who is scheduled now?", use the system_clock to determine the most relevant sessions.
        5. Be concise, professional, and data-driven. Use Markdown for tables.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${JSON.stringify(contextData)}\n\nUser Question: ${userMsg}`,
        config: {
          systemInstruction,
          temperature: 0.1 // Keep it factual
        }
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || "Neural link timed out. Retry." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: "Critical system error: Logic core disconnected." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 lg:bottom-10 right-6 lg:right-10 z-[300]">
      {isOpen ? (
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-2xl w-[calc(100vw-3rem)] sm:w-[400px] h-[650px] shadow-[0_32px_128px_rgba(0,0,0,0.4)] rounded-[3.5rem] flex flex-col animate-in slide-in-from-bottom-12 duration-500 overflow-hidden border border-zinc-200 dark:border-zinc-800">
          {/* HEADER */}
          <div className="p-8 bg-brand-600 text-white flex justify-between items-center shadow-lg relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl border border-white/20">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-xs uppercase tracking-[0.3em] block leading-none mb-1">Clinic Core AI</span>
                <span className="text-[9px] text-brand-100 font-bold uppercase tracking-widest opacity-80 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Neural Link Active
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/60 hover:text-white transition-all text-4xl font-light hover:rotate-90">&times;</button>
          </div>
          
          {/* MESSAGES */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-zinc-50/50 dark:bg-black/40">
            {messages.length === 0 && (
              <div className="text-center mt-12 space-y-8">
                <div className="w-24 h-24 bg-brand-500/10 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border border-brand-500/20">
                  <SparklesIcon className="w-10 h-10 text-brand-600" />
                </div>
                <div className="space-y-2">
                  <p className="text-zinc-900 dark:text-white font-black uppercase tracking-[0.4em] text-xs">Neural Interface</p>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Awaiting Clinical Query...</p>
                </div>
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[90%] p-6 rounded-[2.5rem] text-sm leading-relaxed shadow-sm ${
                  m.role === 'user' 
                  ? 'bg-brand-600 text-white rounded-tr-none font-medium' 
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-none border border-zinc-200 dark:border-zinc-700 shadow-xl'
                }`}>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {m.text.split('\n').map((line, idx) => (
                      <p key={idx} className={line.startsWith('|') ? 'font-mono text-[11px] whitespace-pre overflow-x-auto' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-2 items-center px-4">
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-brand-600 rounded-full animate-bounce"></div>
              </div>
            )}
          </div>

          {/* INPUT */}
          <div className="p-8 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-4 p-2 bg-zinc-100 dark:bg-black/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 focus-within:ring-4 ring-brand-500/10 transition-all">
              <input 
                className="flex-1 bg-transparent px-6 py-4 text-sm outline-none font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400"
                placeholder="Ask clinical core..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} className="bg-brand-600 text-white p-4 rounded-2xl hover:bg-brand-700 transition-all shadow-lg active:scale-95">
                <SparklesIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-brand-600 text-white p-6 rounded-[2.5rem] shadow-[0_24px_64px_rgba(99,102,241,0.5)] hover:bg-brand-700 transition-all hover:scale-110 active:scale-95 flex items-center gap-4 border border-white/20 group"
        >
          <SparklesIcon className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <span className="font-black uppercase tracking-[0.3em] text-[10px] hidden sm:inline">Ask Assistant</span>
        </button>
      )}
    </div>
  );
};
