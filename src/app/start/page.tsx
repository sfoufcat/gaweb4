'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import type { UserTrack } from '@/types';

// Valid track values for validation
const VALID_TRACKS: UserTrack[] = ['content_creator', 'saas', 'coach_consultant', 'ecom', 'agency', 'community_builder', 'general'];

// Track options with emojis and labels
const TRACK_OPTIONS: { value: UserTrack; emoji: string; label: string; description: string; enabled: boolean }[] = [
  { 
    value: 'content_creator', 
    emoji: '🚀', 
    label: 'Content Creator',
    description: 'Grow your audience & build a personal brand',
    enabled: true,
  },
  { 
    value: 'saas', 
    emoji: '🧠', 
    label: 'SaaS Founder',
    description: 'Build and scale your software business',
    enabled: false,
  },
  { 
    value: 'coach_consultant', 
    emoji: '🎙️', 
    label: 'Coach / Consultant',
    description: 'Grow your practice & attract high-value clients',
    enabled: false,
  },
  { 
    value: 'ecom', 
    emoji: '🛒', 
    label: 'E-commerce Founder',
    description: 'Scale your online store & optimize operations',
    enabled: false,
  },
  { 
    value: 'agency', 
    emoji: '🧩', 
    label: 'Agency Owner',
    description: 'Grow your agency & build systems',
    enabled: false,
  },
  { 
    value: 'community_builder', 
    emoji: '🤝', 
    label: 'Community Builder',
    description: 'Grow and monetize your community',
    enabled: false,
  },
];

/**
 * Start Flow Entry - Track Selection Page
 * Users choose their track, then go through track-specific quiz
 */
export default function StartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { saveData, isLoading } = useGuestSession();
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<UserTrack | null>(null);

  // Handle preselection from URL query param
  useEffect(() => {
    if (!isLoading) {
      const trackParam = searchParams.get('track');
      if (trackParam && VALID_TRACKS.includes(trackParam as UserTrack)) {
        // If track is preselected and enabled, auto-navigate
        const trackOption = TRACK_OPTIONS.find(t => t.value === trackParam);
        if (trackOption?.enabled) {
          handleTrackSelect(trackParam as UserTrack);
        } else {
          setSelectedTrack(trackParam as UserTrack);
        }
      }
      
      // Save current step
      saveData({ currentStep: 'start' });
    }
  }, [isLoading, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTrackSelect = async (track: UserTrack) => {
    setSelectedTrack(track);
    setIsNavigating(true);
    
    // Save track selection to guest session
    await saveData({ 
      preselectedTrack: track,
      currentStep: 'content-creator',
    });
    
    // Route to track-specific quiz
    if (track === 'content_creator') {
      router.push('/start/content-creator');
    } else {
      // For other tracks, use the old flow for now
      router.push('/start/workday');
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg overflow-y-auto">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #a07855 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative px-4 py-8 lg:py-12">
        {/* Logo Header */}
        <motion.div 
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={56} 
            height={56} 
            priority
            className="rounded-xl shadow-lg"
          />
        </motion.div>

        <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
          
          {/* Hero Section */}
          <motion.div 
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
              What are you{' '}
              <span className="bg-gradient-to-r from-[#a07855] via-[#c9a07a] to-[#a07855] bg-clip-text text-transparent">
                building?
              </span>
            </h1>
            
            <motion.p
              className="font-sans text-[16px] lg:text-[18px] text-text-secondary tracking-[-0.3px] leading-[1.5] max-w-md mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Select your path to get a personalized 90-day growth plan 📈
            </motion.p>
          </motion.div>

          {/* Track Options */}
          <motion.div 
            className="space-y-3 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {TRACK_OPTIONS.map((track, index) => (
              <motion.button
                key={track.value}
                onClick={() => track.enabled && handleTrackSelect(track.value)}
                disabled={isNavigating || !track.enabled}
                className={`w-full p-5 rounded-[20px] border-2 text-left transition-all ${
                  track.enabled 
                    ? 'hover:scale-[1.01] active:scale-[0.99] cursor-pointer' 
                    : 'opacity-50 cursor-not-allowed'
                } ${
                  selectedTrack === track.value && track.enabled
                    ? 'border-[#a07855] bg-[#faf8f6] shadow-sm' 
                    : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                } disabled:hover:scale-100`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 + index * 0.05 }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-[32px]">{track.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px]">
                        {track.label}
                      </p>
                      {!track.enabled && (
                        <span className="px-2 py-0.5 bg-[#f0ebe5] text-[#8c7a68] text-[11px] font-medium rounded-full">
                          Coming soon
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-[14px] text-text-secondary mt-0.5">
                      {track.description}
                    </p>
                  </div>
                  {track.enabled && (
                    <svg className="w-5 h-5 text-[#a07855] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>

          {/* Trust Signal */}
          <motion.div 
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex -space-x-2">
                {[
                  'https://randomuser.me/api/portraits/women/44.jpg',
                  'https://randomuser.me/api/portraits/men/32.jpg',
                  'https://randomuser.me/api/portraits/women/68.jpg',
                  'https://randomuser.me/api/portraits/men/75.jpg',
                ].map((src, i) => (
                  <Image 
                    key={i}
                    src={src}
                    alt=""
                    width={28}
                    height={28}
                    className="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm"
                  />
                ))}
              </div>
              <span className="font-sans text-[12px] text-text-secondary">
                + thousands of achievers in 40+ countries
              </span>
            </div>
            <p className="font-sans text-[13px] text-text-muted mt-3">
              Already a member?{' '}
              <Link href="/sign-in" className="text-[#a07855] hover:text-[#8c6245] underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </motion.div>

          {/* Loading overlay */}
          {isNavigating && (
            <motion.div 
              className="fixed inset-0 bg-app-bg/80 backdrop-blur-sm flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center">
                <div className="relative mb-4">
                  <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
                </div>
                <p className="font-sans text-[14px] text-text-secondary">Preparing your quiz...</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
