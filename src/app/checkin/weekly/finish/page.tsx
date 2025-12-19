'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';

// Liquid blob animation component
const LiquidCelebration = ({ onComplete }: { onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const blobs = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 80 + Math.random() * 200,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 1.5,
    color: [
      'rgba(120, 180, 140, 0.7)',
      'rgba(100, 160, 130, 0.6)',
      'rgba(80, 140, 110, 0.5)',
      'rgba(140, 200, 160, 0.6)',
      'rgba(160, 210, 180, 0.5)',
      'rgba(90, 170, 130, 0.7)',
    ][i % 6],
  }));

  const sparkles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    delay: Math.random() * 1,
    size: 4 + Math.random() * 8,
  }));

  return (
    <motion.div
      className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Liquid blobs */}
      {blobs.map((blob) => (
        <motion.div
          key={blob.id}
          className="absolute rounded-full"
          style={{
            left: `${blob.x}%`,
            top: `${blob.y}%`,
            width: blob.size,
            height: blob.size,
            background: blob.color,
            filter: 'blur(40px)',
          }}
          initial={{ 
            scale: 0, 
            opacity: 0,
            x: '-50%',
            y: '-50%',
          }}
          animate={{ 
            scale: [0, 1.5, 1.2, 1.8, 0],
            opacity: [0, 0.8, 0.6, 0.4, 0],
            x: ['-50%', '-30%', '-70%', '-50%'],
            y: ['-50%', '-70%', '-30%', '-50%'],
          }}
          transition={{
            duration: blob.duration,
            delay: blob.delay,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={`sparkle-${sparkle.id}`}
          className="absolute"
          style={{
            left: `${sparkle.x}%`,
            top: `${sparkle.y}%`,
            width: sparkle.size,
            height: sparkle.size,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 1,
            delay: sparkle.delay + 0.5,
            ease: 'easeOut',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path
              d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
              fill="rgba(255, 215, 0, 0.9)"
            />
          </svg>
        </motion.div>
      ))}

      {/* Center burst */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 3, 4],
          opacity: [0, 0.6, 0],
        }}
        transition={{
          duration: 1.5,
          delay: 0.2,
          ease: 'easeOut',
        }}
      >
        <div 
          className="w-[200px] h-[200px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(120, 180, 140, 0.8) 0%, rgba(100, 160, 130, 0.4) 50%, transparent 70%)',
          }}
        />
      </motion.div>
    </motion.div>
  );
};

export default function FinishPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded } = useUser();
  const { checkIn, isLoading, markGoalComplete } = useWeeklyReflection();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  
  // Check if goal was marked complete (100% progress)
  const isGoalCompleted = searchParams.get('completed') === 'true' || checkIn?.goalCompleted;

  // Handle goal completion when arriving with completed=true
  useEffect(() => {
    if (searchParams.get('completed') === 'true' && !checkIn?.goalCompleted) {
      markGoalComplete();
    }
  }, [searchParams, checkIn?.goalCompleted, markGoalComplete]);

  const handleCloseWeek = useCallback(() => {
    setIsClosing(true);
    setShowCelebration(true);
  }, []);

  const handleCelebrationComplete = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleCreateNewGoal = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Navigate to goal onboarding to create new goal
      router.push('/onboarding/goal');
    } catch (error) {
      console.error('Error navigating:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkipForNow = () => {
    router.push('/');
  };

  if (!isLoaded || isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </motion.div>
    );
  }

  // Goal Achieved Screen
  if (isGoalCompleted) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
      >
        {/* Header with back and close buttons */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <button
            onClick={() => router.push('/checkin/weekly/evaluate')}
            className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => router.push('/')}
            className="p-2 -mr-2 text-[#5f5a55] hover:text-[#1a1a1a] transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <div className="w-full max-w-[400px] mx-auto text-center">
            {/* Emoji */}
            <div className="text-[60px] mb-6">
              💫
            </div>

            {/* Title */}
            <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-6">
              Goal achieved — well done!
            </h1>

            {/* Description */}
            <div className="font-albert text-[20px] md:text-[24px] font-medium text-[#1a1a1a] tracking-[-1px] md:tracking-[-1.5px] leading-[1.4] space-y-4">
              <p>
                You reached your goal — that&apos;s a milestone worth celebrating.
              </p>
              <p>
                Your effort and consistency are really paying off.
              </p>
              <p className="mt-6">
                If you&apos;re ready, set a new goal to keep your momentum going.
              </p>
              <p>
                Or skip for now and enjoy the win — you&apos;ve earned it.
              </p>
            </div>
          </div>
        </div>

        {/* Buttons - fixed at bottom */}
        <div className="px-6 pb-8 md:pb-10 space-y-3">
          <button
            onClick={handleCreateNewGoal}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Loading...' : 'Create new goal'}
          </button>
          
          <button
            onClick={handleSkipForNow}
            disabled={isSubmitting}
            className="w-full max-w-[400px] mx-auto block bg-white border border-[rgba(215,210,204,0.5)] text-[#2c2520] py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] hover:bg-[#f3f1ef] transition-all disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    );
  }

  // Normal Finish Screen - "Great work reflecting"
  return (
    <>
      {/* Celebration Animation */}
      <AnimatePresence>
        {showCelebration && (
          <LiquidCelebration onComplete={handleCelebrationComplete} />
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0.3 : 1 }}
        transition={{ duration: 0.5 }}
        className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
      >
        {/* Header with back and close buttons */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <button
            onClick={() => router.push('/checkin/weekly/focus')}
            className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => router.push('/')}
            className="p-2 -mr-2 text-[#5f5a55] hover:text-[#1a1a1a] transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 md:pb-0">
          <div className="w-full max-w-[400px] mx-auto text-center">
            {/* Celebration emoji */}
            <motion.div 
              className="text-[60px] mb-6"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              🎉
            </motion.div>

            {/* Title */}
            <h1 className="font-albert text-[28px] md:text-[36px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-6">
              Great work reflecting on your week!
            </h1>

            {/* Description */}
            <p className="font-albert text-[20px] md:text-[24px] font-medium text-[#1a1a1a] tracking-[-1px] md:tracking-[-1.5px] leading-[1.4] mb-8 md:mb-10">
              Small steps lead to big wins—let&apos;s make next week even better.
            </p>

            {/* Button - inline on desktop, fixed on mobile */}
            <button
              onClick={handleCloseWeek}
              disabled={isClosing}
              className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isClosing ? 'Closing...' : 'Close my week'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}



