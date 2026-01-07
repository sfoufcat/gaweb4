'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BreathStepProps } from './types';

type BreathPhase = 'ready' | 'inhale' | 'hold' | 'exhale' | 'complete';

/**
 * BreathStep - 8-circle radial breathing animation
 *
 * Extracted from /src/app/checkin/morning/breath/page.tsx
 * Features:
 * - 8 overlapping circles arranged radially at 45° intervals
 * - Each circle positioned with cos(angle) * baseOffset * scale offsets
 * - 5-second inhale (scale 0.6 → 1.0 with outward offset)
 * - 5-second exhale (scale 1.0 → 0.6 with center collapse)
 * - Phase transitions: ready → inhale → hold → exhale → complete
 * - Precise transitionDuration: 5000ms on transforms
 */
export function BreathStep({ config, onComplete }: BreathStepProps) {
  const [phase, setPhase] = useState<BreathPhase>('ready');
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [scale, setScale] = useState(0.6);
  const totalCycles = config.cycles || 1;

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
          onComplete();
        }, 1500);
        break;
    }

    return () => clearTimeout(timeout);
  }, [phase, cyclesCompleted, totalCycles, onComplete]);

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
    // Full-screen container
    <div className="h-full w-full bg-[#faf8f6] dark:bg-[#05070b] overflow-hidden">
      {/* Centered content container */}
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
                className="absolute w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-full bg-gradient-to-br from-[#2c2520] to-[#1a1a1a] dark:from-white dark:to-[#e1ddd8] transition-all ease-in-out"
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
            <span className="font-albert text-[20px] md:text-[24px] font-semibold text-white dark:text-[#1a1a1a] tracking-[-1px] text-center px-4">
              {getPhaseText()}
            </span>
          </div>
        </div>

        {/* Instructions */}
        {phase === 'ready' && (
          <p className="mt-8 text-center font-sans text-[16px] md:text-[18px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-[320px]">
            {config.heading || 'Take a moment to center yourself with a deep breath'}
          </p>
        )}

        {/* Cycle indicator */}
        {phase !== 'ready' && phase !== 'complete' && totalCycles > 1 && (
          <p className="mt-8 text-center font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
            Cycle {cyclesCompleted + 1} of {totalCycles}
          </p>
        )}

        {/* Action button */}
        <div className="w-full mt-8 md:mt-10">
          <AnimatePresence mode="wait">
            {phase === 'ready' ? (
              <motion.button
                key="begin-button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={startBreathing}
                className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-colors"
              >
                Begin
              </motion.button>
            ) : phase === 'complete' ? (
              <motion.button
                key="continue-button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                onClick={() => onComplete()}
                className="w-full max-w-[400px] mx-auto block bg-[#2c2520] dark:bg-white text-white dark:text-[#1a1a1a] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] shadow-[0px_8px_30px_0px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-colors"
              >
                Continue
              </motion.button>
            ) : (
              <motion.div
                key="breathing-indicator"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="w-full max-w-[400px] mx-auto block bg-[#e1ddd8] dark:bg-[#262b35] text-[#a7a39e] dark:text-[#7d8190] py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] text-center"
              >
                Breathing...
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
