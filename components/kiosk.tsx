import React, { useState, useRef, useEffect } from 'react';
import { Kid, KioskLog } from '../types';
import { CheckIcon, UserIcon } from './Icons';

interface Props {
  kids: Kid[];
  onLogAction: (log: KioskLog) => void;
  onExit: () => void;
}

export const KioskPortal: React.FC<Props> = ({ kids, onLogAction, onExit }) => {
  const [search, setSearch] = useState('');
  const [selectedKid, setSelectedKid] = useState<Kid | null>(null);
  const [message, setMessage] = useState('');
  
  // Biometric / Verification State
  const [isVerifying, setIsVerifying] = useState<'DROP_OFF' | 'PICK_UP' | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanInterval = useRef<any>(null);

  const filteredKids = kids.filter(k => k.name.toLowerCase().includes(search.toLowerCase()));

  // Determine Buttons State
  const isCheckedIn = selectedKid?.currentStatus === 'CHECKED_IN';

  // --- CAMERA LOGIC ---
  useEffect(() => {
    let stream: MediaStream | null = null;

    if (isVerifying && !message) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(s => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Camera access denied:", err);
          setCameraError(true);
        });
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isVerifying, message]);

  // --- CLEANUP TIMER ON UNMOUNT/CLOSE ---
  useEffect(() => {
    return () => {
      if (scanInterval.current) clearInterval(scanInterval.current);
    };
  }, [isVerifying]);

  // --- FINGERPRINT SCAN LOGIC ---
  const startScan = (e?: React.TouchEvent | React.MouseEvent) => {
    // Prevent double-firing on touch devices
    // if (e && e.type === 'touchstart') e.preventDefault(); 

    // Safety: Clear any running interval first (Fixes "One Time Only" bug)
    if (scanInterval.current) clearInterval(scanInterval.current);

    if (scanProgress >= 100) return;
    
    setScanProgress(0);
    
    scanInterval.current = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          if (scanInterval.current) clearInterval(scanInterval.current);
          return 100;
        }
        return prev + 4; // Scan speed
      });
    }, 50);
  };

  const stopScan = () => {
    if (scanInterval.current) clearInterval(scanInterval.current);
    if (scanProgress < 100) {
      setScanProgress(0);
    }
  };

  // Trigger completion when scan hits 100%
  useEffect(() => {
    if (scanProgress === 100 && isVerifying) {
      handleCompleteAction();
    }
  }, [scanProgress]);

  const handleCompleteAction = () => {
    if (scanInterval.current) clearInterval(scanInterval.current); // Double safety
    
    if (!selectedKid || !isVerifying) return;

    // 1. Capture Photo
    let photoData = '';
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, 320, 240);
        photoData = canvasRef.current.toDataURL('image/jpeg');
      }
    }

    // 2. Create Log
    const log: KioskLog = {
      id: crypto.randomUUID(),
      kidId: selectedKid.id,
      kidName: selectedKid.name,
      action: isVerifying,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleString(),
      photo: photoData,
      method: 'BIOMETRIC'
    };

    onLogAction(log);
    
    // 3. Show Success
    setMessage(`Verified: ${isVerifying === 'DROP_OFF' ? 'Dropped Off' : 'Picked Up'} ${selectedKid.name}`);
    setIsVerifying(null);
    setScanProgress(0);

    setTimeout(() => {
      setSelectedKid(null);
      setMessage('');
      setSearch('');
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col font-sans text-zinc-900 select-none">
      
      {/* HEADER */}
      <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white z-10">
        <div>
           <h1 className="text-4xl font-black tracking-tighter text-brand-600 mb-2">ClinicConnect Kiosk</h1>
           <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Parent Check-In Portal</p>
        </div>
        <button onClick={onExit} className="px-6 py-3 bg-zinc-100 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-200">
           Exit Kiosk
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: KID SELECTION */}
        <div className="w-1/3 bg-zinc-50 border-r border-zinc-200 flex flex-col p-6">
           <input 
             autoFocus
             placeholder="Search Child's Name..." 
             className="w-full p-6 text-xl font-bold rounded-2xl border-2 border-zinc-200 focus:border-brand-500 outline-none mb-6 shadow-sm uppercase placeholder:normal-case"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
           <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {filteredKids.map(k => (
                <button 
                  key={k.id} 
                  onClick={() => { setSelectedKid(k); setIsVerifying(null); }}
                  className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center gap-4
                    ${selectedKid?.id === k.id 
                      ? 'border-brand-600 bg-brand-600 text-white shadow-xl scale-[1.02]' 
                      : 'border-white bg-white text-zinc-600 hover:border-zinc-300'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shrink-0 ${selectedKid?.id === k.id ? 'bg-white text-brand-600' : 'bg-zinc-100 text-zinc-400'}`}>
                    {k.name.substring(0,1)}
                  </div>
                  <div>
                    <span className="text-xl font-bold truncate block">{k.name}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${k.currentStatus === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                       {k.currentStatus === 'CHECKED_IN' ? 'IN CLINIC' : 'AWAY'}
                    </span>
                  </div>
                </button>
              ))}
           </div>
        </div>

        {/* RIGHT: ACTIONS & VERIFICATION */}
        <div className="w-2/3 flex items-center justify-center p-12 bg-white relative">
           
           {message && (
             <div className="absolute inset-0 bg-emerald-500 z-50 flex flex-col items-center justify-center text-white animate-in zoom-in-95 duration-300">
                <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-md">
                  <CheckIcon className="w-24 h-24" />
                </div>
                <h2 className="text-5xl font-black uppercase tracking-widest text-center px-10 leading-tight">{message}</h2>
                <p className="mt-6 opacity-80 font-mono text-lg bg-black/10 px-6 py-2 rounded-full">
                  Time: {new Date().toLocaleTimeString()} • Photo Logged
                </p>
             </div>
           )}

           {!selectedKid && !message && (
             <div className="text-center opacity-20">
               <UserIcon className="w-40 h-40 mx-auto mb-6" />
               <h2 className="text-4xl font-black uppercase tracking-tight">Select Child to Begin</h2>
             </div>
           )}

           {selectedKid && !isVerifying && !message && (
             <div className="w-full max-w-3xl grid grid-cols-2 gap-8 animate-in slide-in-from-bottom-10 fade-in duration-500">
               
               {/* DROP OFF BUTTON */}
               <button 
                 onClick={() => setIsVerifying('DROP_OFF')}
                 disabled={isCheckedIn} 
                 className={`aspect-square rounded-[3rem] flex flex-col items-center justify-center gap-6 transition-all shadow-2xl group
                   ${isCheckedIn 
                     ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed grayscale opacity-50 shadow-none' 
                     : 'bg-indigo-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/30'
                   }`}
               >
                 <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl">↓</div>
                 <span className="text-4xl font-black uppercase tracking-widest">Drop Off</span>
                 {isCheckedIn && <span className="text-xs font-bold uppercase tracking-widest bg-zinc-200 text-zinc-500 px-4 py-1 rounded-full">Already In</span>}
               </button>

               {/* PICK UP BUTTON */}
               <button 
                 onClick={() => setIsVerifying('PICK_UP')}
                 disabled={!isCheckedIn} 
                 className={`aspect-square rounded-[3rem] flex flex-col items-center justify-center gap-6 transition-all shadow-2xl group
                   ${!isCheckedIn 
                     ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed grayscale opacity-50 shadow-none' 
                     : 'bg-emerald-500 text-white hover:scale-105 active:scale-95 shadow-emerald-500/30'
                   }`}
               >
                 <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-5xl">↑</div>
                 <span className="text-4xl font-black uppercase tracking-widest">Pick Up</span>
                 {!isCheckedIn && <span className="text-xs font-bold uppercase tracking-widest bg-zinc-200 text-zinc-500 px-4 py-1 rounded-full">Not Checked In</span>}
               </button>
             </div>
           )}

           {/* BIOMETRIC VERIFICATION */}
           {isVerifying && !message && (
             <div className="w-full max-w-xl flex flex-col items-center animate-in zoom-in-95 duration-300">
                <h3 className="text-3xl font-black uppercase tracking-widest mb-8 text-zinc-400">
                  Confirm {isVerifying === 'DROP_OFF' ? 'Drop Off' : 'Pick Up'}
                </h3>

                {/* CAMERA PREVIEW */}
                <div className="relative w-64 h-64 bg-zinc-100 rounded-[2.5rem] overflow-hidden border-4 border-zinc-200 mb-8 shadow-inner">
                   {!cameraError ? (
                     <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-zinc-200 text-zinc-400 font-bold">No Camera</div>
                   )}
                   <canvas ref={canvasRef} width="320" height="240" className="hidden" />
                   <div className="absolute inset-0 border-[3px] border-white/30 rounded-[2.5rem] m-4 pointer-events-none" />
                </div>

                {/* FINGERPRINT BUTTON */}
                <div className="relative">
                  <button
                    onMouseDown={(e) => startScan(e)}
                    onMouseUp={stopScan}
                    onMouseLeave={stopScan}
                    onTouchStart={(e) => startScan(e)}
                    onTouchEnd={(e) => { e.preventDefault(); stopScan(); }}
                    className="w-32 h-32 rounded-full bg-white border-4 border-brand-100 flex items-center justify-center relative z-10 active:scale-95 transition-all shadow-xl"
                  >
                    <div className={`w-24 h-24 rounded-full transition-colors duration-200 flex items-center justify-center
                      ${scanProgress > 0 ? 'bg-brand-600 text-white' : 'bg-zinc-100 text-zinc-300'}`}
                    >
                       <span className="text-4xl">☝️</span>
                    </div>
                  </button>

                  {/* Circular Progress Ring */}
                  <svg className="absolute top-[-10px] left-[-10px] w-[148px] h-[148px] rotate-[-90deg] pointer-events-none">
                    <circle
                      cx="74" cy="74" r="70"
                      stroke="currentColor" strokeWidth="8" fill="transparent"
                      className="text-zinc-100"
                    />
                    <circle
                      cx="74" cy="74" r="70"
                      stroke="currentColor" strokeWidth="8" fill="transparent"
                      strokeDasharray="440"
                      strokeDashoffset={440 - (440 * scanProgress) / 100}
                      className="text-brand-500 transition-all duration-75 ease-linear"
                    />
                  </svg>
                </div>

                <p className="mt-8 text-sm font-bold text-zinc-400 uppercase tracking-[0.2em] animate-pulse">
                  {scanProgress > 0 ? 'Scanning...' : 'Hold to Verify'}
                </p>

                <button onClick={() => { setIsVerifying(null); setScanProgress(0); }} className="mt-12 text-zinc-400 font-bold hover:text-zinc-600">
                  Cancel
                </button>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};