'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { FunnelStepConfigPlanReveal } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';
const primaryHoverVar = 'var(--funnel-primary-hover, #8c6245)';

interface PlanRevealStepProps {
  config: FunnelStepConfigPlanReveal;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  program: {
    name: string;
    lengthDays: number;
  };
  isFirstStep: boolean;
}

export function PlanRevealStep({
  config,
  onComplete,
  onBack,
  data,
  program,
  isFirstStep,
}: PlanRevealStepProps) {
  const [animateGraph, setAnimateGraph] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Trigger graph animation
    const timer = setTimeout(() => setAnimateGraph(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = async () => {
    setIsSubmitting(true);
    await onComplete({});
    setIsSubmitting(false);
  };

  // Calculate months
  const goalTargetDate = data.goalTargetDate as string;
  const monthsUntilGoal = goalTargetDate 
    ? Math.max(1, Math.ceil((new Date(goalTargetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
    : Math.ceil(program.lengthDays / 30);

  const goalSummary = data.goalSummary as string || data.goal as string || 'Your Goal';
  const startingPoint = data.businessStage as string || 'Starting Point';

  // Build heading
  const defaultHeading = `Your ${monthsUntilGoal}-month Growth Plan is ready!`;
  const heading = config.heading?.replace('{X}', String(monthsUntilGoal)) || defaultHeading;
  
  // Build body text
  const goal = data.goal as string || 'achieve your goals';
  const formattedGoal = goal.charAt(0).toLowerCase() + goal.slice(1);
  const defaultBody = `With consistent action and the right support, you have everything you need to ${formattedGoal}.`;
  const body = config.body || defaultBody;

  const ctaText = config.ctaText || 'Continue';
  const showGraph = config.showGraph !== false;

  // Generate time labels for graph
  const generateTimeLabels = () => {
    if (monthsUntilGoal <= 1) {
      return ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
    }
    if (monthsUntilGoal <= 6) {
      return Array.from({ length: Math.min(monthsUntilGoal, 6) }, (_, i) => `Month ${i + 1}`);
    }
    const step = Math.floor(monthsUntilGoal / 3);
    return ['Month 1', `Month ${step}`, `Month ${step * 2}`, `Month ${monthsUntilGoal}`];
  };

  const timeLabels = generateTimeLabels();

  return (
    <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3">
          {heading}
        </h1>
        <p className="text-text-secondary text-lg">
          {body}
        </p>
      </motion.div>

      {/* Graph */}
      {showGraph && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 mb-8 border border-[#e1ddd8]"
        >
          {/* Graph Container */}
          <div className="relative h-[200px] mb-4">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-text-muted">
              <span className="truncate max-w-[80px]">{goalSummary}</span>
              <span className="truncate max-w-[80px]">{startingPoint}</span>
            </div>

            {/* Graph area */}
            <div className="ml-20 h-full relative">
              {/* Grid lines */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="border-b border-dashed border-[#e1ddd8]" />
                ))}
              </div>

              {/* Growth curve */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <motion.path
                  d="M 0 90 Q 30 85, 50 60 T 100 10"
                  fill="none"
                  stroke="#a07855"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: animateGraph ? 1 : 0 }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
                {/* Start point */}
                <motion.circle
                  cx="0"
                  cy="90"
                  r="4"
                  fill="#a07855"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: animateGraph ? 1 : 0 }}
                  transition={{ delay: 0.2 }}
                />
                {/* End point */}
                <motion.circle
                  cx="100"
                  cy="10"
                  r="4"
                  fill="#a07855"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: animateGraph ? 1 : 0 }}
                  transition={{ delay: 1.5 }}
                />
              </svg>

              {/* Milestone markers */}
              <motion.div
                className="absolute bottom-0 left-0 right-0 flex justify-between"
                initial={{ opacity: 0 }}
                animate={{ opacity: animateGraph ? 1 : 0 }}
                transition={{ delay: 1 }}
              >
                {timeLabels.map((label, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[#a07855]/30 mb-1" />
                    <span className="text-xs text-text-muted">{label}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#a07855]/30" />
              <span className="text-text-muted">Today</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#a07855]" />
              <span className="text-text-muted">Goal</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* What's included */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-[#faf8f6] rounded-2xl p-6 mb-8"
      >
        <h3 className="font-medium text-text-primary mb-4">What you'll get:</h3>
        <ul className="space-y-3">
          {[
            'Personalized daily tasks to keep you on track',
            'Habit tracking to build consistency',
            'Accountability community to stay motivated',
            'Progress tracking to see your growth',
          ].map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-[#a07855] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-text-secondary">{item}</span>
            </motion.li>
          ))}
        </ul>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex gap-3"
      >
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={handleContinue}
          disabled={isSubmitting}
          className="flex-1 py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: primaryVar }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
        >
          {isSubmitting ? 'Loading...' : ctaText}
        </button>
      </motion.div>
    </div>
  );
}

