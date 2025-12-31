'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Users,
  Target,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from 'lucide-react';
import { GrowthAddictsLogo } from '@/components/shared/GrowthAddictsLogo';

// Welcome tour cards - showcasing platform features
// First card is yellow (brand), others have varied colors
const WELCOME_CARDS = [
  {
    id: 'welcome',
    icon: GrowthAddictsLogo,
    iconBg: 'from-[#FFD036] to-[#f5a623]', // Yellow/brand for first card
    title: 'Welcome to Your Coaching Platform! 🎉',
    subtitle: 'Everything you need to build a thriving coaching business',
    description: 'You now have a complete platform to create programs, build community, and grow your coaching practice. Let\'s take a quick tour of what you can do.',
    features: [
      'Create transformation programs',
      'Build accountability squads',
      'Capture leads with funnels',
      'Track progress & revenue',
    ],
  },
  {
    id: 'programs',
    icon: Rocket,
    iconBg: 'from-violet-500 to-purple-600',
    title: 'Programs & Masterminds',
    subtitle: 'Create structured transformation journeys',
    description: 'Design programs with daily tasks, habits, and check-ins. Whether it\'s a 21-day challenge or a 90-day transformation, you control the content and pace.',
    features: [
      'Day-by-day task sequences',
      'Habit tracking for clients',
      'Morning & evening check-ins',
      'Cohort-based or evergreen',
    ],
  },
  {
    id: 'squads',
    icon: Users,
    iconBg: 'from-emerald-500 to-teal-600',
    title: 'Squads & Community',
    subtitle: 'Build accountability groups',
    description: 'Group your clients into small squads where they support each other. Community drives engagement and keeps clients coming back.',
    features: [
      'Small group accountability',
      'Squad chat & discussions',
      'Shared progress visibility',
      'Community feed & wins',
    ],
  },
  {
    id: 'funnels',
    icon: Target,
    iconBg: 'from-rose-500 to-pink-600',
    title: 'Funnels & Landing Pages',
    subtitle: 'Capture leads and automate enrollment',
    description: 'Build beautiful landing pages to attract new clients. Collect emails, process payments with Stripe, and automate the entire enrollment process.',
    features: [
      'Drag-and-drop funnel builder',
      'Stripe payment integration',
      'Lead capture forms',
      'Automated email sequences',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    iconBg: 'from-blue-500 to-cyan-600',
    title: 'Analytics & Growth',
    subtitle: 'Track what matters',
    description: 'Monitor engagement, completion rates, and revenue. See which programs perform best and where clients need more support.',
    features: [
      'Revenue & MRR tracking',
      'Client engagement metrics',
      'Program completion rates',
      'Funnel conversion analytics',
    ],
  },
];

interface WelcomeTourProps {
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeTour({ isOpen, onComplete, onSkip }: WelcomeTourProps) {
  const router = useRouter();
  const [currentCard, setCurrentCard] = useState(0);
  const [direction, setDirection] = useState(0);

  const card = WELCOME_CARDS[currentCard];
  const isLastCard = currentCard === WELCOME_CARDS.length - 1;
  const isFirstCard = currentCard === 0;

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setCurrentCard(0);
      setDirection(0);
    }
  }, [isOpen]);

  const handleNext = () => {
    if (isLastCard) {
      handleContinueToDashboard();
    } else {
      setDirection(1);
      setCurrentCard((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstCard) {
      setDirection(-1);
      setCurrentCard((prev) => prev - 1);
    }
  };

  const handleContinueToDashboard = async () => {
    // Save that welcome tour was completed
    try {
      await fetch('/api/coach/onboarding-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeTourCompleted: true }),
      });
    } catch (err) {
      console.error('Failed to save welcome tour completion:', err);
    }

    onComplete();
    // Navigate to coach dashboard with tour param
    router.push('/coach?tour=true');
  };

  const handleSkip = async () => {
    // Save that tour was skipped
    try {
      await fetch('/api/coach/onboarding-state', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ welcomeTourCompleted: true, welcomeTourSkipped: true }),
      });
    } catch (err) {
      console.error('Failed to save tour skip:', err);
    }

    onSkip();
  };

  if (!isOpen) return null;

  const CardIcon = card.icon;

  // Animation variants - lighter/smoother than before
  const cardVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 60 : -60,
      opacity: 0,
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      {/* Close button */}
      <button
        onClick={handleSkip}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Card counter */}
      <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm">
        <span className="font-sans text-sm text-white">
          {currentCard + 1} of {WELCOME_CARDS.length}
        </span>
      </div>

      {/* Main card container */}
      <div className="relative w-full max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={card.id}
            custom={direction}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white dark:bg-[#1a1e26] rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Card header with gradient - dynamic color per card */}
            <div className={`relative px-8 pt-10 pb-8 bg-gradient-to-br ${card.iconBg} overflow-hidden`}>
              {/* Decorative circle - subtle in both light and dark mode */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6"
                >
                  <CardIcon className="w-8 h-8 text-white" />
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05, duration: 0.2 }}
                  className="font-albert text-3xl font-bold text-white tracking-[-1px] mb-2"
                >
                  {card.title}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="font-sans text-lg text-white/80"
                >
                  {card.subtitle}
                </motion.p>
              </div>
            </div>

            {/* Card body */}
            <div className="px-8 py-8">
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.2 }}
                className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-6"
              >
                {card.description}
              </motion.p>

              {/* Features list */}
              <motion.ul
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.2 }}
                className="space-y-3"
              >
                {card.features.map((feature, index) => (
                  <motion.li
                    key={feature}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.03, duration: 0.15 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {feature}
                    </span>
                  </motion.li>
                ))}
              </motion.ul>
            </div>

            {/* Card footer */}
            <div className="px-8 pb-8">
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {WELCOME_CARDS.map((c, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setDirection(index > currentCard ? 1 : -1);
                      setCurrentCard(index);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentCard
                        ? `w-8 bg-gradient-to-r ${c.iconBg}`
                        : index < currentCard
                        ? 'w-2 bg-[#a7a39e] dark:bg-[#7d8190]'
                        : 'w-2 bg-[#e1ddd8] dark:bg-[#313746]'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-3">
                {!isFirstCard && (
                  <button
                    onClick={handlePrevious}
                    className="flex items-center justify-center gap-2 py-3 px-6 border border-[#e1ddd8] dark:border-[#313746] rounded-xl font-sans text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f9f8f7] dark:hover:bg-[#1e222a] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Previous
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-6 bg-gradient-to-r ${card.iconBg} text-white rounded-xl font-sans text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all`}
                >
                  {isLastCard ? (
                    <>
                      <Rocket className="w-4 h-4" />
                      Let's Set Up Your Dashboard
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {/* Skip link */}
              <button
                onClick={handleSkip}
                className="w-full mt-4 py-2 font-sans text-xs text-[#a7a39e] dark:text-[#7d8190] hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors"
              >
                Skip tour
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
