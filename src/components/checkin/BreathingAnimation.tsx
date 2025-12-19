'use client';

import { useState, useEffect } from 'react';

interface BreathingAnimationProps {
  onComplete: () => void;
  isActive: boolean;
}

type BreathPhase = 'idle' | 'inhale' | 'exhale';

export function BreathingAnimation({ onComplete, isActive }: BreathingAnimationProps) {
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [cycleCount, setCycleCount] = useState(0);

  const startBreathing = () => {
    if (phase !== 'idle') return;
    setPhase('inhale');
    setCycleCount(0);
  };

  useEffect(() => {
    if (!isActive || phase === 'idle') return;

    let timeout: NodeJS.Timeout;

    if (phase === 'inhale') {
      // Inhale for 5 seconds, then exhale
      timeout = setTimeout(() => {
        setPhase('exhale');
      }, 5000);
    } else if (phase === 'exhale') {
      // Exhale for 5 seconds, then complete
      timeout = setTimeout(() => {
        const newCount = cycleCount + 1;
        setCycleCount(newCount);
        
        // Complete after 1 full cycle
        if (newCount >= 1) {
          setPhase('idle');
          onComplete();
        } else {
          setPhase('inhale');
        }
      }, 5000);
    }

    return () => clearTimeout(timeout);
  }, [phase, cycleCount, isActive, onComplete]);

  // Animation scale based on phase
  const getScale = () => {
    switch (phase) {
      case 'inhale':
        return 'scale-100';
      case 'exhale':
        return 'scale-75';
      default:
        return 'scale-75';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      {phase === 'idle' ? (
        // Start button
        <button
          onClick={startBreathing}
          className="w-[200px] h-[200px] rounded-full bg-white border border-[rgba(215,210,204,0.5)] flex items-center justify-center shadow-sm hover:shadow-md transition-all"
        >
          <span className="font-sans text-[16px] font-bold text-[#2c2520] tracking-[-0.5px]">
            Take a deep breath
          </span>
        </button>
      ) : (
        // Breathing animation
        <div className="relative w-[280px] h-[280px] flex items-center justify-center">
          {/* Multiple overlapping circles for the breathing effect */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const angle = (i / 8) * Math.PI * 2;
            const offsetX = Math.cos(angle) * 40;
            const offsetY = Math.sin(angle) * 40;
            
            return (
              <div
                key={i}
                className={`absolute w-[200px] h-[200px] rounded-full bg-black/80 transition-all ease-in-out ${getScale()}`}
                style={{
                  transitionDuration: '5000ms',
                  transform: phase === 'inhale' 
                    ? `translate(${offsetX}px, ${offsetY}px) scale(1)` 
                    : `translate(0px, 0px) scale(0.75)`,
                  opacity: 0.8,
                }}
              />
            );
          })}
          
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="font-albert text-[18px] font-semibold text-[#f1ece6] tracking-[-1px]">
              {phase === 'inhale' ? 'Breathe in' : 'Breathe out'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

