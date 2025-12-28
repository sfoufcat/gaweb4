'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { AnalyzingLoader } from '@/components/onboarding/AnalyzingLoader';
import { useBrandingValues } from '@/contexts/BrandingContext';

/**
 * Generate time labels for the x-axis based on duration
 * @param startDate - Today's date
 * @param targetDate - User's goal target date
 * @returns Array of label strings (max 4 labels)
 */
function generateTimeLabels(startDate: Date, targetDate: Date): string[] {
  const diffMs = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.ceil(diffDays / 30);

  // If duration <= 1 month: Show weeks
  if (diffMonths <= 1) {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }

  // If duration > 1 month and <= 6 months: Show months
  if (diffMonths <= 6) {
    return Array.from({ length: Math.min(diffMonths, 6) }, (_, i) => `Month ${i + 1}`);
  }

  // If duration > 6 months: Show 4 evenly spaced labels
  const step = Math.floor(diffMonths / 3);
  return [
    'Month 1',
    `Month ${step}`,
    `Month ${step * 2}`,
    `Month ${diffMonths}`,
  ];
}

/**
 * Transformation Summary Page
 * Shows user's journey visualization before plan selection
 * Redesigned with BetterMe-style premium aesthetics
 */
export default function TransformationPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  const [isNavigating, setIsNavigating] = useState(false);
  const [userData, setUserData] = useState<{ user?: { goal?: string; goalTargetDate?: string; onboarding?: { businessStage?: string[] } }; goal?: { goal?: string; targetDate?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnalyzing, setShowAnalyzing] = useState(true);
  const [transformationText, setTransformationText] = useState<string | null>(null);
  const [animateGraph, setAnimateGraph] = useState(false);
  const [goalSummary, setGoalSummary] = useState<string | null>(null);
  const [accountabilitySummary, setAccountabilitySummary] = useState<string | null>(null);

  // Fetch user data for goal info
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data and transformation text in parallel
        const [userResponse, transformResponse] = await Promise.all([
          fetch('/api/user/me'),
          fetch('/api/onboarding/transformation'),
        ]);
        
        const userData = await userResponse.json();
        const transformData = await transformResponse.json();
        
        setUserData(userData);
        setTransformationText(transformData.text);

        // Fetch both summaries if goal or businessStage exists
        const goal = userData?.user?.goal || userData?.goal?.goal;
        const businessStage = userData?.user?.onboarding?.businessStage;
        
        // Only fetch if we have actual data to summarize
        const hasGoal = goal && goal.trim().length > 0;
        const hasStage = businessStage && businessStage.length > 0;
        
        if (hasGoal || hasStage) {
          console.log('[Transformation Auth] Fetching summaries with:', { goal, businessStage });
          
          fetch('/api/goal/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal, businessStage }),
          })
            .then(res => res.json())
            .then(result => {
              console.log('[Transformation Auth] API response:', result);
              if (result.goalSummary && result.goalSummary !== 'Your Goal') {
                setGoalSummary(result.goalSummary);
              }
              if (result.stageSummary && result.stageSummary !== 'Starting Point') {
                setAccountabilitySummary(result.stageSummary);
              }
            })
            .catch(err => {
              console.error('Failed to fetch summaries:', err);
            });
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    if (isLoaded && user) {
      fetchData();
    }
  }, [isLoaded, user]);

  const handleAnalyzingComplete = useCallback(() => {
    setShowAnalyzing(false);
    // Trigger graph animation after a short delay
    setTimeout(() => setAnimateGraph(true), 300);
  }, []);

  const handleContinue = async () => {
    setIsNavigating(true);
    
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: 'plan' }),
      });
      
      router.push('/onboarding/plan');
    } catch (error) {
      console.error('Failed to update status:', error);
      setIsNavigating(false);
    }
  };

  // Show analyzing loader while data is loading
  if (!isLoaded || loading || !user || showAnalyzing) {
    if (!isLoaded || !user) {
      return (
        <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
        </div>
      );
    }
    
    return <AnalyzingLoader onComplete={handleAnalyzingComplete} duration={4000} />;
  }

  // Extract goal data
  const goalText = userData?.user?.goal || userData?.goal?.goal || 'achieve your goal';
  const goalTargetDate = userData?.user?.goalTargetDate || userData?.goal?.targetDate;
  
  // Calculate months until goal
  const monthsUntilGoal = goalTargetDate 
    ? Math.max(1, Math.ceil((new Date(goalTargetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
    : null;

  // Format target date
  const formattedDate = goalTargetDate 
    ? new Date(goalTargetDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // Generate time labels for x-axis
  const timeLabels = goalTargetDate 
    ? generateTimeLabels(new Date(), new Date(goalTargetDate))
    : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  // Show full transformation text without truncation
  const displayText = transformationText 
    || 'Your personalized plan will guide you step by step toward this goal.';

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header */}
        <motion.div 
          className="pt-6 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src={logoUrl} 
            alt={appTitle} 
            width={48} 
            height={48} 
            className="rounded-lg"
            unoptimized
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 pb-8 lg:pb-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center mb-8"
            >
              <h1 className="font-albert text-[32px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.15] mb-3">
                Your {monthsUntilGoal || '—'}-month Growth Plan is ready!
              </h1>
              <p className="font-sans text-[15px] lg:text-[16px] text-text-secondary">
                We predict you&apos;ll reach your goal by{' '}
                <span className="font-semibold text-[#a07855] dark:text-[#b8896a]">{formattedDate || 'your target date'}</span>
              </p>
            </motion.div>

            {/* Premium Graph Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-[28px] p-5 lg:p-6 mb-6 border border-[#e1ddd8] shadow-sm overflow-hidden"
            >
              {/* Graph Container - more compact */}
              <div className="relative">
                {/* SVG Graph with labels positioned directly above data points */}
                <svg 
                  className="w-full h-[180px] lg:h-[200px]" 
                  viewBox="0 0 400 180" 
                  fill="none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Gradient definitions */}
                  <defs>
                    {/* Main path gradient - warm to cool like BetterMe */}
                    <linearGradient id="transformGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="25%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="75%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    
                    {/* Area gradient for fill */}
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                      <stop offset="50%" stopColor="#eab308" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
                    </linearGradient>
                    
                    {/* Glow filter */}
                    <filter id="transformGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Subtle grid lines - adjusted for new viewBox */}
                  <g opacity="0.1">
                    <line x1="30" y1="120" x2="370" y2="120" stroke="#a07855" strokeWidth="1" />
                    <line x1="30" y1="85" x2="370" y2="85" stroke="#a07855" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="30" y1="50" x2="370" y2="50" stroke="#a07855" strokeWidth="1" strokeDasharray="4 4" />
                  </g>
                  
                  {/* Area fill under curve - adjusted y positions */}
                  <motion.path 
                    d="M 30 120 C 80 120, 100 108, 130 94 C 160 80, 200 60, 260 46 C 310 35, 340 30, 370 30 L 370 120 L 30 120 Z" 
                    fill="url(#areaGradient)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: animateGraph ? 1 : 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                  
                  {/* Main progress curve - adjusted y positions */}
                  <motion.path 
                    d="M 30 120 C 80 120, 100 108, 130 94 C 160 80, 200 60, 260 46 C 310 35, 340 30, 370 30" 
                    stroke="url(#transformGradient)" 
                    strokeWidth="5" 
                    strokeLinecap="round"
                    fill="none"
                    filter="url(#transformGlow)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: animateGraph ? 1 : 0 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                  
                  {/* Start point - at y=120 */}
                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: animateGraph ? 1 : 0, opacity: animateGraph ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <circle cx="30" cy="120" r="8" fill="#ef4444" opacity="0.2" />
                    <circle cx="30" cy="120" r="5" fill="#ef4444" />
                    <circle cx="30" cy="120" r="2" fill="white" opacity="0.6" />
                  </motion.g>
                  
                  {/* End point with pulse - at y=30 */}
                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: animateGraph ? 1 : 0, opacity: animateGraph ? 1 : 0 }}
                    transition={{ duration: 0.4, delay: 1.5 }}
                  >
                    <circle cx="370" cy="30" r="12" fill="#06b6d4" opacity="0.15">
                      <animate
                        attributeName="r"
                        values="12;18;12"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.15;0.05;0.15"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle cx="370" cy="30" r="8" fill="#06b6d4" />
                    <circle cx="370" cy="30" r="3" fill="white" opacity="0.7" />
                  </motion.g>

                  {/* X-axis time labels - positioned at y=155 */}
                  {timeLabels.map((label, index) => {
                    const x = 30 + (340 / (timeLabels.length - 1)) * index;
                    return (
                      <motion.text
                        key={index}
                        x={x}
                        y="150"
                        textAnchor="middle"
                        className="font-sans text-[10px] fill-text-secondary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: animateGraph ? 1 : 0 }}
                        transition={{ duration: 0.3, delay: 1.8 + index * 0.1 }}
                      >
                        {label}
                      </motion.text>
                    );
                  })}
                </svg>

                {/* "Today" label - positioned directly above the red dot */}
                <motion.div 
                  className="absolute left-0 lg:left-2"
                  style={{ top: 'calc(67% - 52px)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: animateGraph ? 1 : 0, y: animateGraph ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="bg-gradient-to-br from-[#ef4444] to-[#dc2626] rounded-xl px-3 py-1.5 shadow-lg">
                    <p className="font-sans text-[9px] text-white/80 uppercase tracking-wider font-medium">Today</p>
                    <p className="font-albert text-[11px] lg:text-[12px] text-white font-semibold">
                      {accountabilitySummary || 'Starting Point'}
                    </p>
                  </div>
                </motion.div>
                
                {/* Goal label - positioned directly above the green dot */}
                <motion.div 
                  className="absolute -right-1 lg:right-0"
                  style={{ top: 'calc(17% + 12px)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: animateGraph ? 1 : 0, y: animateGraph ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 1.6 }}
                >
                  <div className="bg-gradient-to-br from-[#06b6d4] to-[#0891b2] rounded-xl px-3 py-1.5 shadow-lg">
                    <p className="font-sans text-[9px] text-white/80 uppercase tracking-wider font-medium">
                      {formattedDate || 'Target Date'}
                    </p>
                    <p className="font-albert text-[11px] lg:text-[12px] text-white font-semibold">
                      {goalSummary || 'Your Goal'}
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Disclaimer - reduced top margin */}
              <motion.p 
                className="text-center text-[11px] text-text-tertiary mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: animateGraph ? 1 : 0 }}
                transition={{ duration: 0.5, delay: 2.2 }}
              >
                *This chart is for illustrative purposes only
              </motion.p>
            </motion.div>

            {/* Goal Summary Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-gradient-to-br from-[#2c2520] to-[#1a1512] rounded-[24px] p-6 mb-6 shadow-xl"
            >
              <div className="space-y-4">
                {/* Goal */}
                <div>
                  <p className="font-sans text-[11px] text-white/50 uppercase tracking-wider mb-1">
                    Your Goal
                  </p>
                  <p className="font-albert text-[18px] lg:text-[20px] text-white leading-[1.3] tracking-[-0.5px]">
                    {goalText}
                  </p>
                </div>

                {/* Target */}
                {formattedDate && (
                  <div>
                    <p className="font-sans text-[11px] text-white/50 uppercase tracking-wider mb-1">
                      Target Milestone
                    </p>
                    <p className="font-sans text-[15px] text-white/80">
                      {formattedDate}
                    </p>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-white/10 pt-4">
                  <p className="font-sans text-[11px] text-white/50 uppercase tracking-wider mb-2">
                    Why This Plan Works
                  </p>
                  <p className="font-sans text-[14px] text-white/70 leading-relaxed">
                    {displayText}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Trust indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center justify-center gap-2 text-text-secondary mb-4"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
              </svg>
              <span className="font-sans text-[12px]">Personalized for your unique journey</span>
            </motion.div>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div 
          className="sticky bottom-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <button
            onClick={handleContinue}
            disabled={isNavigating}
            className="w-full max-w-xl lg:max-w-2xl mx-auto block bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              'Continue →'
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
