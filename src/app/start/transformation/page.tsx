'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useGuestSession } from '@/hooks/useGuestSession';

/**
 * Generate time labels for the x-axis based on duration
 */
function generateTimeLabels(startDate: Date, targetDate: Date): string[] {
  const diffMs = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.ceil(diffDays / 30);

  if (diffMonths <= 1) {
    return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  }

  if (diffMonths <= 6) {
    return Array.from({ length: Math.min(diffMonths, 6) }, (_, i) => `Month ${i + 1}`);
  }

  const step = Math.floor(diffMonths / 3);
  return [
    'Month 1',
    `Month ${step}`,
    `Month ${step * 2}`,
    `Month ${diffMonths}`,
  ];
}

// Static mapping for growth stage labels (fallback if AI summary not available)
const GROWTH_STAGE_LABELS: Record<string, string> = {
  'just_starting': 'Just Starting',
  'building_momentum': 'Building Momentum',
  'growing_steadily': 'Growing Steadily',
  'leveling_up': 'Leveling Up',
  'reinventing': 'Reinventing',
};

/**
 * Guest Transformation Page
 * Shows the growth plan visualization with goal timeline
 * Reuses styling from the authenticated transformation page
 */
export default function GuestTransformationPage() {
  const router = useRouter();
  const { data, saveData, isLoading } = useGuestSession();
  const [isNavigating, setIsNavigating] = useState(false);
  const [animateGraph, setAnimateGraph] = useState(false);

  // Set current step and trigger graph animation on mount
  useEffect(() => {
    if (!isLoading) {
      saveData({ currentStep: 'transformation' });
      // Trigger graph animation after a short delay
      setTimeout(() => setAnimateGraph(true), 300);
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get summaries from session - prefer AI-generated summaries, fall back to static mappings
  const goalSummary = data.goalSummary || 'Your Goal';
  
  // Use AI-generated starting point summary if available, otherwise fall back to static mapping
  const stageSummary = data.startingPointSummary 
    || (data.businessStage ? GROWTH_STAGE_LABELS[data.businessStage] : null)
    || 'Starting Point';

  const handleContinue = async () => {
    setIsNavigating(true);
    await saveData({ currentStep: 'your-info' });
    router.push('/start/your-info');
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

  // Extract goal data from guest session
  const goalText = data.goal || 'achieve your goal';
  const goalTargetDate = data.goalTargetDate;
  
  // Format goal with lowercase first letter for use in sentences
  const formattedGoal = data.goal 
    ? data.goal.charAt(0).toLowerCase() + data.goal.slice(1) 
    : 'achieve your goal';
  
  // Calculate months until goal with logical rounding
  // 0-1.3 months = 1, 1.4-2.3 = 2, 2.4-3.3 = 3, etc.
  const monthsUntilGoal = goalTargetDate 
    ? Math.max(1, Math.floor((new Date(goalTargetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30) + 0.7))
    : null;

  // Format target date
  const formattedDate = goalTargetDate 
    ? new Date(goalTargetDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // Generate time labels for x-axis
  const timeLabels = goalTargetDate 
    ? generateTimeLabels(new Date(), new Date(goalTargetDate))
    : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

  // Goal-based transformation text - focuses on self-efficacy
  // Note: Identity is now collected after payment, so it won't be available here
  const displayText = data.goal
    ? `With consistent action and the right support, you have everything you need to ${formattedGoal}.`
    : 'With consistent action and the right support, you have everything you need to achieve your goals.';

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
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={48} 
            height={48} 
            className="rounded-lg"
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
                <span className="font-semibold text-[#a07855]">{formattedDate || 'your target date'}</span>
              </p>
            </motion.div>

            {/* Premium Graph Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-white rounded-[28px] p-5 lg:p-6 mb-6 border border-[#e1ddd8] shadow-sm overflow-hidden"
            >
              {/* Graph Container */}
              <div className="relative">
                <svg 
                  className="w-full h-[180px] lg:h-[200px]" 
                  viewBox="0 0 400 180" 
                  fill="none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Gradient definitions */}
                  <defs>
                    <linearGradient id="transformGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="25%" stopColor="#f97316" />
                      <stop offset="50%" stopColor="#eab308" />
                      <stop offset="75%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                    
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                      <stop offset="50%" stopColor="#eab308" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.15" />
                    </linearGradient>
                    
                    <filter id="transformGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Subtle grid lines */}
                  <g opacity="0.1">
                    <line x1="30" y1="120" x2="370" y2="120" stroke="#a07855" strokeWidth="1" />
                    <line x1="30" y1="85" x2="370" y2="85" stroke="#a07855" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="30" y1="50" x2="370" y2="50" stroke="#a07855" strokeWidth="1" strokeDasharray="4 4" />
                  </g>
                  
                  {/* Area fill under curve */}
                  <motion.path 
                    d="M 30 120 C 80 120, 100 108, 130 94 C 160 80, 200 60, 260 46 C 310 35, 340 30, 370 30 L 370 120 L 30 120 Z" 
                    fill="url(#areaGradient)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: animateGraph ? 1 : 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                  
                  {/* Main progress curve */}
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
                  
                  {/* Start point */}
                  <motion.g
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: animateGraph ? 1 : 0, opacity: animateGraph ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <circle cx="30" cy="120" r="8" fill="#ef4444" opacity="0.2" />
                    <circle cx="30" cy="120" r="5" fill="#ef4444" />
                    <circle cx="30" cy="120" r="2" fill="white" opacity="0.6" />
                  </motion.g>
                  
                  {/* End point with pulse */}
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

                  {/* X-axis time labels */}
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

                {/* "Today" label - higher on mobile */}
                <motion.div 
                  className="absolute left-0 lg:left-2 top-[calc(67%-70px)] lg:top-[calc(67%-52px)]"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: animateGraph ? 1 : 0, y: animateGraph ? 0 : 10 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <div className="bg-gradient-to-br from-[#ef4444] to-[#dc2626] rounded-xl px-3 py-1.5 shadow-lg">
                    <p className="font-sans text-[9px] text-white/80 uppercase tracking-wider font-medium">Today</p>
                    <p className="font-albert text-[11px] lg:text-[12px] text-white font-semibold">
                      {stageSummary || 'Starting Point'}
                    </p>
                  </div>
                </motion.div>
                
                {/* Goal label - lower on mobile */}
                <motion.div 
                  className="absolute -right-1 lg:right-0 top-[calc(17%+28px)] lg:top-[calc(17%+12px)]"
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

              {/* Disclaimer */}
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

