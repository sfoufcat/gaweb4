'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { useEveningCheckIn } from '@/hooks/useEveningCheckIn';

/**
 * Confetti Piece Component
 */
function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#ff6b6b', '#ff8c42', '#ffa500', '#9b59b6', '#a07855', '#4ecdc4', '#45b7d1', '#96ceb4'];
  const color = colors[index % colors.length];
  const left = Math.random() * 100;
  const animationDelay = Math.random() * 0.5;
  const animationDuration = 2 + Math.random() * 2;
  const size = 8 + Math.random() * 8;
  const rotation = Math.random() * 360;

  return (
    <div
      className="fixed pointer-events-none animate-confetti-fall"
      style={{
        left: `${left}%`,
        top: '-20px',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${animationDelay}s`,
        animationDuration: `${animationDuration}s`,
        zIndex: 9999,
      }}
    />
  );
}

export default function EveningFinishPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [showConfetti, setShowConfetti] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { completeCheckIn } = useEveningCheckIn();

  const handleFinish = useCallback(async () => {
    // Trigger confetti
    setShowConfetti(true);
    setIsNavigating(true);

    try {
      // Mark evening check-in as completed
      await completeCheckIn();
      
      // Move all focus tasks to backlog so user can use them tomorrow
      await fetch('/api/tasks/move-to-backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Failed to complete evening check-in:', error);
    }
    
    // Wait for confetti to play, then navigate
    setTimeout(() => {
      router.push('/');
    }, 1500);
  }, [router, completeCheckIn]);

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </div>
    );
  }

  // Generate confetti pieces
  const confettiPieces = showConfetti ? Array.from({ length: 100 }, (_, i) => i) : [];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
    >
      {/* Confetti Layer */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiPieces.map((index) => (
            <ConfettiPiece key={index} index={index} />
          ))}
        </div>
      )}

      {/* Main content - centered */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-[480px] lg:max-w-[560px] mx-auto text-center">
          {/* Title */}
          <h1 className="font-albert text-[40px] md:text-[52px] lg:text-[64px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-6 md:mb-8">
            Day closed ✨
          </h1>

          {/* Description */}
          <p className="font-albert text-[22px] md:text-[26px] lg:text-[28px] font-medium text-[#5f5a55] tracking-[-1.5px] leading-[1.4] max-w-[400px] mx-auto mb-10 md:mb-12">
            Rest, reset, and come back tomorrow with fresh energy.
          </p>

          {/* Finish button */}
          <button
            onClick={handleFinish}
            disabled={isNavigating}
            className="w-full bg-[#2c2520] text-white py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[17px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-80 disabled:cursor-not-allowed"
          >
            {isNavigating ? '🎉 See you tomorrow!' : 'Finish day'}
          </button>
        </div>
      </div>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-6 left-6 p-2 text-[#5f5a55] hover:text-[#1a1a1a] transition-colors"
        aria-label="Back"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      {/* Confetti Animation Styles */}
      <style jsx>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        :global(.animate-confetti-fall) {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </motion.div>
  );
}



