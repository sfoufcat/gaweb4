'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useUser } from '@clerk/nextjs';
import type { UserTrack } from '@/types';

// Track definitions
const TRACKS: { 
  id: UserTrack; 
  label: string; 
  description: string; 
  icon: string;
  gradient: string;
}[] = [
  {
    id: 'content_creator',
    label: 'Content Creator',
    description: 'Build an audience, publish content consistently, and grow across platforms.',
    icon: '🎬',
    gradient: 'from-pink-500/20 to-purple-500/20',
  },
  {
    id: 'saas',
    label: 'SaaS Founder',
    description: 'Focus on product iterations, user acquisition, and retention.',
    icon: '💻',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'coach_consultant',
    label: 'Coach / Consultant',
    description: 'Create scalable offers, attract high-quality clients, and grow your practice.',
    icon: '🎯',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    id: 'ecom',
    label: 'E-Commerce',
    description: 'Grow your brand through acquisition, conversion optimization, and retention.',
    icon: '🛒',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    id: 'agency',
    label: 'Agency Owner',
    description: 'Deliver results for clients while building systems and delegation.',
    icon: '🏢',
    gradient: 'from-indigo-500/20 to-violet-500/20',
  },
  {
    id: 'general',
    label: 'General Entrepreneur',
    description: 'For founders building hybrid or unclear business models.',
    icon: '🚀',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
];

/**
 * Track Selection Page
 * User selects their business type during onboarding
 */
export default function ChooseTrackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  const { saveData, data, isLoading: guestLoading } = useGuestSession();
  
  const [selected, setSelected] = useState<UserTrack | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [hoveredTrack, setHoveredTrack] = useState<UserTrack | null>(null);

  // Check for preselected track from URL
  useEffect(() => {
    const trackParam = searchParams.get('track');
    if (trackParam && TRACKS.some(t => t.id === trackParam)) {
      setSelected(trackParam as UserTrack);
    }
  }, [searchParams]);

  // Check if track was preselected in guest session (from funnel)
  useEffect(() => {
    if (!guestLoading && data.preselectedTrack) {
      // Track was preselected, auto-select and continue
      setSelected(data.preselectedTrack);
    }
  }, [guestLoading, data.preselectedTrack]);

  const handleSelectTrack = (trackId: UserTrack) => {
    setSelected(trackId);
  };

  const handleContinue = async () => {
    if (!selected) return;
    
    setIsNavigating(true);

    // If user is logged in, save track to server
    if (user) {
      try {
        const response = await fetch('/api/user/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track: selected }),
        });

        if (!response.ok) {
          console.error('Failed to save track');
        }
      } catch (error) {
        console.error('Error saving track:', error);
      }

      // Redirect to home after track selection for logged-in users
      router.push('/');
      return;
    }

    // For guests, save to guest session and continue onboarding
    await saveData({ 
      preselectedTrack: selected,
      currentStep: 'workday',
    });
    
    router.push('/start/workday');
  };

  // Show loading state
  if (guestLoading || !isLoaded) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <OnboardingLayout>
      <motion.div 
        className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-2xl lg:max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] mb-3">
              What type of business are you building?
            </h1>
            <p className="font-sans text-[15px] sm:text-[16px] text-text-secondary dark:text-[#b2b6c2]">
              This helps us personalize your experience with relevant programs, templates, and guidance.
            </p>
          </div>

          {/* Track Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8">
            {TRACKS.map((track, index) => {
              const isSelected = selected === track.id;
              const isHovered = hoveredTrack === track.id;
              
              return (
                <motion.button
                  key={track.id}
                  onClick={() => handleSelectTrack(track.id)}
                  onMouseEnter={() => setHoveredTrack(track.id)}
                  onMouseLeave={() => setHoveredTrack(null)}
                  disabled={isNavigating}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`
                    relative p-5 sm:p-6 rounded-2xl border-2 text-left
                    transition-all duration-200 ease-out
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isSelected 
                      ? 'border-[#a07855] bg-[#faf8f6] dark:bg-[#1d222b] shadow-lg scale-[1.02]' 
                      : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] hover:border-[#c9a07a] dark:hover:border-[#4a4a4a] hover:shadow-md'
                    }
                    ${isHovered && !isSelected ? 'scale-[1.01]' : ''}
                  `}
                >
                  {/* Background gradient on hover/select */}
                  <div className={`
                    absolute inset-0 rounded-2xl bg-gradient-to-br ${track.gradient}
                    transition-opacity duration-300
                    ${isSelected || isHovered ? 'opacity-100' : 'opacity-0'}
                  `} />
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="flex items-start gap-4">
                      <span className="text-[32px] sm:text-[36px] flex-shrink-0">{track.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-albert text-[17px] sm:text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                            {track.label}
                          </h3>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            >
                              <svg className="w-5 h-5 text-[#a07855]" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </motion.div>
                          )}
                        </div>
                        <p className="font-sans text-[13px] sm:text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5]">
                          {track.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Continue Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <button
              onClick={handleContinue}
              disabled={!selected || isNavigating}
              className={`
                w-full py-4 px-6 rounded-[32px] font-sans font-bold text-[16px] tracking-[-0.5px]
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${selected 
                  ? 'bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
                }
              `}
            >
              {isNavigating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              )}
            </button>
          </motion.div>

          {/* Help text */}
          <p className="text-center font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-4">
            You can change your track later in settings
          </p>
        </div>
      </motion.div>
    </OnboardingLayout>
  );
}



