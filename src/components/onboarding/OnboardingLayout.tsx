'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import Image from 'next/image';
import { useBrandingValues } from '@/contexts/BrandingContext';

interface OnboardingLayoutProps {
  children: ReactNode;
  showProgress?: boolean;
  currentStep?: number;
  totalSteps?: number;
  stepLabel?: string;
}

/**
 * Reusable layout component for onboarding pages
 * Provides consistent logo header, animations, and progress indicator
 */
export function OnboardingLayout({ 
  children, 
  showProgress = false,
  currentStep = 1,
  totalSteps = 3,
  stepLabel
}: OnboardingLayoutProps) {
  const { logoUrl, appTitle } = useBrandingValues();
  
  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-6 pb-2 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src={logoUrl} 
            alt={appTitle} 
            width={44} 
            height={44} 
            className="rounded-lg"
            unoptimized
          />
        </motion.div>

        {/* Progress indicator */}
        {showProgress && (
          <motion.div 
            className="px-6 pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
              <div className="flex gap-1.5">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => {
                  const isActive = step === currentStep;
                  const isCompleted = step < currentStep;
                  
                  return (
                    <div 
                      key={step} 
                      className={`h-1.5 flex-1 rounded-full relative overflow-hidden ${
                        isCompleted || isActive ? 'bg-brand-accent' : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                      }`}
                    >
                      {/* Shimmer animation only on the active step */}
                      {isActive && (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          initial={{ x: '-100%' }}
                          animate={{ x: '100%' }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'linear',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {stepLabel && (
                <p className="font-sans text-[12px] text-text-secondary mt-2">{stepLabel}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

/**
 * Quiz option button (no individual animation - parent handles page animation)
 */
export function QuizOption({ 
  children, 
  selected,
  disabled,
  onClick,
  index: _index = 0  // Kept for backwards compat but not used
}: { 
  children: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  index?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full p-5 rounded-[20px] border-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${
        selected 
          ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10 shadow-sm' 
          : 'border-[#e1ddd8] dark:border-[#363d4a] bg-white dark:bg-surface hover:border-[#d4d0cb] dark:hover:border-[#464d5c] hover:shadow-sm'
      } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
    >
      {children}
    </button>
  );
}

/**
 * Bottom CTA button wrapper with animation
 * Uses brand-accent for primary button (coach's accent color)
 */
export function OnboardingCTA({ 
  children,
  onClick,
  disabled,
  variant = 'primary'
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'golden';
}) {
  const variants = {
    primary: 'bg-brand-accent text-brand-accent-foreground shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)]',
    secondary: 'bg-white dark:bg-surface border border-[rgba(215,210,204,0.5)] dark:border-[#363d4a] text-text-primary',
    golden: 'bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)]',
  };

  return (
    <motion.div 
      className="sticky bottom-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full max-w-xl lg:max-w-2xl mx-auto block font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]}`}
      >
        {children}
      </button>
    </motion.div>
  );
}
