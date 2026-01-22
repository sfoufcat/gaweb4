'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingLayout, OnboardingCTA } from '@/components/onboarding/OnboardingLayout';
import { Check } from 'lucide-react';
import type { OnboardingSupportNeed } from '@/types';

const SUPPORT_OPTIONS: { value: OnboardingSupportNeed; label: string }[] = [
  { 
    value: 'daily_checkins', 
    label: 'Consistent daily check-ins' 
  },
  { 
    value: 'accountability', 
    label: 'Accountability (people who notice if I slip)' 
  },
  { 
    value: 'clear_system', 
    label: 'A clear system for priorities & daily tasks' 
  },
  { 
    value: 'expert_guidance', 
    label: 'Expert guidance & resources' 
  },
  { 
    value: 'inspiration', 
    label: 'Simply being regularly inspired' 
  },
];

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

/**
 * Support Needs Question (Multi-select)
 * Final quiz question with celebration before going to home
 */
export default function SupportNeedsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [selected, setSelected] = useState<OnboardingSupportNeed[]>([]);
  const [existingData, setExistingData] = useState<Record<string, unknown> | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Fetch existing onboarding data to merge
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        if (data.user?.onboarding) {
          setExistingData(data.user.onboarding);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };
    if (isLoaded && user) {
      fetchData();
    }
  }, [isLoaded, user]);

  const toggleOption = (value: OnboardingSupportNeed) => {
    setSelected(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value) 
        : [...prev, value]
    );
  };

  // Navigate to home after celebration
  const navigateToHome = useCallback(() => {
    router.push('/');
  }, [router]);

  // Auto-redirect after showing celebration
  useEffect(() => {
    if (showCelebration) {
      const timer = setTimeout(() => {
        navigateToHome();
      }, 3000); // 3 seconds delay
      return () => clearTimeout(timer);
    }
  }, [showCelebration, navigateToHome]);

  const handleContinue = async () => {
    if (selected.length === 0) return;
    
    setIsNavigating(true);
    
    try {
      // Save support needs and mark onboarding as complete
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          onboardingStatus: 'complete',
          onboarding: { 
            ...existingData,
            supportNeeds: selected 
          }
        }),
      });
      
      // Save goal setting entry to goal journal/reflections
      try {
        await fetch('/api/goal/reflections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'daily',
            date: new Date().toISOString().split('T')[0],
            emotionalState: 'energized',
            tasksCompleted: 0,
            tasksTotal: 0,
            note: `Goal set! Support needs: ${selected.map(s => {
              const opt = SUPPORT_OPTIONS.find(o => o.value === s);
              return opt?.label || s;
            }).join(', ')}`,
          }),
        });
      } catch (err) {
        // Non-blocking - don't fail if journal entry fails
        console.error('Failed to save to goal journal:', err);
      }
      
      // Show celebration with confetti
      setShowCelebration(true);
      setShowConfetti(true);
    } catch (error) {
      console.error('Failed to save support needs:', error);
      setIsNavigating(false);
    }
  };

  // Show loading spinner until everything is ready
  if (!isLoaded || !user) {
    if (!isLoaded) {
      return (
        <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
          </div>
        </div>
      );
    }
    router.push('/signup');
    return null;
  }

  // Generate confetti pieces
  const confettiPieces = showConfetti ? Array.from({ length: 100 }, (_, i) => i) : [];

  // Show celebration screen
  if (showCelebration) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-app-bg">
        {/* Confetti Layer */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {confettiPieces.map((index) => (
              <ConfettiPiece key={index} index={index} />
            ))}
          </div>
        )}

        <div className="min-h-full flex items-center justify-center px-4 py-12">
          <motion.div 
            className="w-full max-w-xl lg:max-w-2xl mx-auto text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            
            {/* Success Icon */}
            <motion.div 
              className="mb-8 inline-flex items-center justify-center w-24 h-24 bg-brand-accent rounded-3xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Check className="w-12 h-12 text-white stroke-[3]" />
            </motion.div>

            {/* Heading */}
            <motion.h1 
              className="font-albert text-[42px] lg:text-[52px] text-text-primary tracking-[-2px] leading-[1.2] mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Goal saved! 🎉
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              className="font-sans text-[18px] lg:text-[20px] text-text-secondary tracking-[-0.5px] leading-[1.4] mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              You&apos;re all set! Let&apos;s start working toward your goal.
            </motion.p>

            {/* Action Button */}
            <motion.button
              onClick={navigateToHome}
              className="w-full bg-brand-accent text-brand-accent-foreground font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              Let&apos;s go! →
            </motion.button>

          </motion.div>
        </div>

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
      </div>
    );
  }

  return (
    <OnboardingLayout 
      showProgress 
      currentStep={1} 
      totalSteps={1}
      stepLabel="One quick question"
    >
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
          <motion.h1 
            className="font-albert text-[32px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
              What would support you the most in achieving your goal?
          </motion.h1>
          <motion.p 
            className="font-sans text-[16px] text-text-secondary mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
              Select all that apply.
          </motion.p>

            {/* Options */}
            <div className="space-y-3 mb-8">
            {SUPPORT_OPTIONS.map((option, index) => {
                const isSelected = selected.includes(option.value);
                return (
                <motion.button
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`w-full p-5 rounded-[20px] border-2 text-left transition-all ${
                      isSelected 
                      ? 'border-brand-accent bg-[#faf8f6] dark:bg-[#1d222b] shadow-sm' 
                      : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] hover:border-[#d4d0cb] dark:hover:border-[#313746] hover:shadow-sm'
                    }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + index * 0.08 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected 
                          ? 'border-brand-accent bg-brand-accent' 
                          : 'border-[#d4d0cb] dark:border-[#7d8190]'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="font-sans text-[16px] text-text-primary">
                        {option.label}
                      </p>
                    </div>
                </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
      <OnboardingCTA onClick={handleContinue} disabled={selected.length === 0 || isNavigating}>
        {isNavigating ? 'Saving...' : 'Complete setup →'}
      </OnboardingCTA>
    </OnboardingLayout>
  );
}
