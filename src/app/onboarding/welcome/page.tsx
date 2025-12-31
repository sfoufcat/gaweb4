'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useBrandingValues } from '@/contexts/BrandingContext';

const CHECKLIST_ITEMS = [
  { 
    text: 'Answer a few quick questions',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  { 
    text: 'Define your mission',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  { 
    text: 'Set your 30-day goal',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
      </svg>
    ),
  },
  { 
    text: 'Get your personalized growth plan',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
  },
];

const VALUE_PROPS = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    text: 'Get a tailored clarity roadmap for your next 30 days',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    text: "Understand what's holding you back and how to fix it",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    text: 'Join a community of ambitious, growth-minded people',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
      </svg>
    ),
    text: 'Discover the #1 habit you should start today',
  },
];

/**
 * Welcome to GrowthAddicts Screen
 * First step in the onboarding flow after signup
 * Premium redesign matching /start page
 */
export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  const [isNavigating, setIsNavigating] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/');
    }
  }, [isLoaded, user, router]);

  const handleContinue = async () => {
    setIsNavigating(true);
    
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: 'workday' }),
      });
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
    }
    
    router.push('/onboarding/workday');
  };

  if (!isLoaded || !user) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg overflow-y-auto">
      {/* Subtle background pattern - uses brand accent color */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--brand-accent) 1px, transparent 0)`,
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
            src={logoUrl} 
            alt={appTitle} 
            width={56} 
            height={56} 
            priority
            className="rounded-xl shadow-lg"
            unoptimized
          />
        </motion.div>

        <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
          
          {/* Hero Section */}
          <motion.div 
            className="mb-8 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[44px] text-text-primary tracking-[-1.5px] leading-[1.1] mb-4">
              Build the life you want,{' '}
              <span className="bg-gradient-to-r from-brand-accent via-brand-accent/80 to-brand-accent bg-clip-text text-transparent">
                one powerful step at a time.
              </span>
            </h1>
            
            <motion.p
              className="font-sans text-[15px] lg:text-[17px] text-text-secondary tracking-[-0.3px] leading-[1.5] max-w-md mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Join thousands of achievers designing a sustainable path to growth. 
              In under 3 minutes, we&apos;ll create a personalized plan based on your goals, habits, and where you&apos;re at right now.
            </motion.p>
          </motion.div>

          {/* Value Props */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <div className="space-y-2.5">
              {VALUE_PROPS.map((prop, index) => (
                <motion.div 
                  key={index}
                  className="flex gap-3 items-start"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.08 }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#faf5ef] border border-[#e8dfd4] flex items-center justify-center flex-shrink-0 text-brand-accent">
                    {prop.icon}
                  </div>
                  <p className="font-sans text-[14px] lg:text-[15px] text-text-primary tracking-[-0.2px] leading-[1.5] pt-1.5">
                    {prop.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Primary CTA */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <button
              onClick={handleContinue}
              disabled={isNavigating}
              className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNavigating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Start My Personalized Plan
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              )}
            </button>
          </motion.div>

          {/* Trust signal - compact */}
          <motion.p 
            className="text-center font-sans text-[13px] text-text-muted mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            Trusted by entrepreneurs, creators, and students in 40+ countries
          </motion.p>

          {/* What to Expect - Preview Steps */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.85 }}
          >
            <div className="bg-white rounded-2xl border border-[#e8dfd4] p-5 shadow-sm">
              <p className="font-sans text-[12px] font-medium text-brand-accent uppercase tracking-[0.5px] mb-4">
                What to expect
              </p>
              <div className="space-y-2.5">
                {CHECKLIST_ITEMS.map((item, index) => (
                  <div 
                    key={index}
                    className="flex gap-3 items-center"
                  >
                    <div className="w-6 h-6 rounded-md bg-[#faf5ef] flex items-center justify-center flex-shrink-0 text-brand-accent">
                      <span className="font-sans text-[12px] font-semibold">{index + 1}</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-[#c9a07a]">{item.icon}</span>
                      <p className="font-sans text-[13px] lg:text-[14px] text-text-primary tracking-[-0.2px]">
                        {item.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[#f0ebe5]">
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-sans text-[12px] text-text-secondary">
                  Takes less than 3 minutes. No fluff, only what actually matters.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Social Proof Row */}
          <motion.div 
            className="text-center pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.95 }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex -space-x-1.5">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-[#e8dfd4] to-[#d4c4b0] border-2 border-white flex items-center justify-center"
                  >
                    <span className="text-[9px]">
                      {['🚀', '💪', '🎯', '✨'][i]}
                    </span>
                  </div>
                ))}
              </div>
              <span className="font-sans text-[12px] text-text-secondary">
                + thousands of achievers
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
