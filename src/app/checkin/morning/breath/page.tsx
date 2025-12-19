'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type BreathPhase = 'ready' | 'inhale' | 'hold' | 'exhale' | 'complete';

export default function BreathPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<BreathPhase>('ready');
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [scale, setScale] = useState(0.6);
  const totalCycles = 1;

  useEffect(() => {
    if (phase === 'ready') return;

    let timeout: NodeJS.Timeout;

    switch (phase) {
      case 'inhale':
        // Expand over 5 seconds
        setScale(1);
        timeout = setTimeout(() => {
          setPhase('hold');
        }, 5000);
        break;
        
      case 'hold':
        // Brief hold
        timeout = setTimeout(() => {
          setPhase('exhale');
        }, 1000);
        break;
        
      case 'exhale':
        // Contract over 5 seconds
        setScale(0.6);
        timeout = setTimeout(() => {
          const newCycles = cyclesCompleted + 1;
          setCyclesCompleted(newCycles);
          
          if (newCycles >= totalCycles) {
            setPhase('complete');
          } else {
            setPhase('inhale');
          }
        }, 5000);
        break;
        
      case 'complete':
        // Auto-continue after brief pause
        timeout = setTimeout(() => {
          router.push('/checkin/morning/reframe');
        }, 1500);
        break;
    }

    return () => clearTimeout(timeout);
  }, [phase, cyclesCompleted, router]);

  const startBreathing = () => {
    setPhase('inhale');
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'ready':
        return 'Start breathing';
      case 'inhale':
        return 'Breathe in...';
      case 'hold':
        return 'Hold...';
      case 'exhale':
        return 'Breathe out...';
      case 'complete':
        return 'Well done';
    }
  };

  return (
    // Fixed container - viewport positioning
    <div 
      className="fixed inset-0 z-[9999] bg-[#faf8f6] overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      {/* Centered content container - uses absolute positioning for bulletproof centering */}
      <div 
        className="absolute left-1/2 top-1/2 w-full max-w-[500px] px-6 animate-page-fade-in flex flex-col items-center"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {/* Breathing visualization */}
        <div className="relative w-[300px] h-[300px] md:w-[350px] md:h-[350px] flex items-center justify-center">
          {/* Multiple overlapping circles */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            const baseOffset = 30;
            const offsetX = Math.cos(angle) * baseOffset * scale;
            const offsetY = Math.sin(angle) * baseOffset * scale;
            
            return (
              <div
                key={i}
                className="absolute w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-gradient-to-br from-[#2c2520] to-[#1a1a1a] transition-all ease-in-out"
                style={{
                  transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
                  transitionDuration: phase === 'inhale' || phase === 'exhale' ? '5000ms' : '300ms',
                  opacity: 0.85,
                }}
              />
            );
          })}
          
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="font-albert text-[20px] md:text-[24px] font-semibold text-white tracking-[-1px] text-center px-4">
              {getPhaseText()}
            </span>
          </div>
        </div>

        {/* Instructions */}
        {phase === 'ready' && (
          <p className="mt-8 text-center font-sans text-[16px] md:text-[18px] text-[#5f5a55] max-w-[320px]">
            Take a moment to center yourself with a deep breath
          </p>
        )}

        {/* Action button */}
        <div className="w-full mt-8 md:mt-10">
          {phase === 'ready' ? (
            <button
              onClick={startBreathing}
              className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Begin
            </button>
          ) : phase === 'complete' ? (
            <button
              onClick={() => router.push('/checkin/morning/reframe')}
              className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Continue
            </button>
          ) : (
            <div className="w-full max-w-[400px] mx-auto block bg-[#e1ddd8] text-[#a7a39e] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] text-center">
              Breathing...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
