'use client';

import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Trophy, Sparkles, Target, MessageSquare, AlertTriangle, ArrowRight, Loader2, CreditCard, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';
import type { ProgramCompletionConfig, Program } from '@/types';
import Image from 'next/image';

// Types for the check-in flow
export type ProgramRating = 1 | 2 | 3 | 4 | 5;
export type ProgressStatus = 'on_track' | 'not_sure' | 'off_track';
export type ContinueChoice = 'continue' | 'own_tasks';

export interface ProgramCheckInData {
  programRating: ProgramRating | null;
  progressStatus: ProgressStatus | null;
  whatWentWell: string;
  obstacles: string;
  continueChoice: ContinueChoice | null;
}

// Saved payment method type
interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// Upsell program info passed from parent
export interface UpsellProgramInfo {
  id: string;
  name: string;
  description: string;
  coverImageUrl?: string;
  priceInCents: number;
  currency: string;
  lengthDays: number;
}

interface ProgramCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: ProgramCheckInData) => Promise<void>;
  programName: string;
  programDays?: number;
  // Completion config from the program
  completionConfig?: ProgramCompletionConfig;
  // Upsell program details (fetched by parent)
  upsellProgram?: UpsellProgramInfo | null;
  // Callback when upsell purchase succeeds
  onUpsellPurchase?: (programId: string) => Promise<void>;
}

type Step = 'congrats' | 'upsell' | 'rating' | 'progress' | 'went_well' | 'obstacles' | 'continue';

const RATING_OPTIONS: { value: ProgramRating; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Not great' },
  { value: 2, emoji: '😐', label: 'Could be better' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😊', label: 'Great' },
  { value: 5, emoji: '🤩', label: 'Amazing!' },
];

const PROGRESS_OPTIONS: { value: ProgressStatus; label: string; description: string }[] = [
  { value: 'off_track', label: 'Not yet', description: 'Still working on it' },
  { value: 'not_sure', label: 'Getting there', description: 'Making progress' },
  { value: 'on_track', label: 'Yes!', description: 'Feeling confident' },
];

// Format price helper
function formatPrice(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// Fire confetti burst
function fireConfetti() {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // Confetti from left
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#f5d799', '#d4a574', '#c9a86c', '#8b7355', '#ffd700'],
    });
    
    // Confetti from right
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#f5d799', '#d4a574', '#c9a86c', '#8b7355', '#ffd700'],
    });
  }, 250);
}

export function ProgramCheckInModal({
  isOpen,
  onClose,
  onComplete,
  programName,
  programDays = 30,
  completionConfig,
  upsellProgram,
  onUpsellPurchase,
}: ProgramCheckInModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('congrats');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<ProgramCheckInData>({
    programRating: null,
    progressStatus: null,
    whatWentWell: '',
    obstacles: '',
    continueChoice: null,
  });
  
  // Confetti fired flag
  const confettiFiredRef = useRef(false);
  
  // Upsell state
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  
  // Determine if we should show upsell step
  const showUpsell = !!(completionConfig?.upsellProgramId && upsellProgram);
  const showConfetti = completionConfig?.showConfetti !== false; // Default true
  
  // Build steps array dynamically
  const getSteps = useCallback((): Step[] => {
    const baseSteps: Step[] = ['congrats'];
    if (showUpsell) {
      baseSteps.push('upsell');
    }
    baseSteps.push('rating', 'progress', 'went_well', 'obstacles', 'continue');
    return baseSteps;
  }, [showUpsell]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('congrats');
      setData({
        programRating: null,
        progressStatus: null,
        whatWentWell: '',
        obstacles: '',
        continueChoice: null,
      });
      confettiFiredRef.current = false;
      setPurchaseSuccess(false);
      setPurchaseError(null);
      setSelectedMethodId(null);
    }
  }, [isOpen]);
  
  // Fire confetti on congrats step
  useEffect(() => {
    if (isOpen && currentStep === 'congrats' && showConfetti && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      // Small delay to let the modal animate in
      setTimeout(() => {
        fireConfetti();
      }, 300);
    }
  }, [isOpen, currentStep, showConfetti]);
  
  // Fetch saved payment methods when upsell step is shown
  useEffect(() => {
    if (currentStep === 'upsell' && showUpsell && savedMethods.length === 0 && !loadingMethods) {
      setLoadingMethods(true);
      fetch('/api/payment-methods')
        .then(res => res.json())
        .then(data => {
          if (data.paymentMethods) {
            setSavedMethods(data.paymentMethods);
            // Auto-select first method
            if (data.paymentMethods.length > 0) {
              setSelectedMethodId(data.paymentMethods[0].id);
            }
          }
        })
        .catch(err => console.error('Failed to fetch payment methods:', err))
        .finally(() => setLoadingMethods(false));
    }
  }, [currentStep, showUpsell, savedMethods.length, loadingMethods]);

  const handleNext = () => {
    const steps = getSteps();
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps = getSteps();
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };
  
  const handleSkipUpsell = () => {
    handleNext();
  };
  
  const handlePurchaseUpsell = async () => {
    if (!upsellProgram || !selectedMethodId || purchasing) return;
    
    setPurchasing(true);
    setPurchaseError(null);
    
    try {
      const response = await fetch('/api/programs/completion-upsell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: upsellProgram.id,
          paymentMethodId: selectedMethodId,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed');
      }
      
      setPurchaseSuccess(true);
      
      // Notify parent
      if (onUpsellPurchase) {
        await onUpsellPurchase(upsellProgram.id);
      }
      
      // Auto-advance after success
      setTimeout(() => {
        handleNext();
      }, 1500);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onComplete(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'congrats':
        return true;
      case 'upsell':
        return true; // Can always skip
      case 'rating':
        return data.programRating !== null;
      case 'progress':
        return data.progressStatus !== null;
      case 'went_well':
        return true; // Optional
      case 'obstacles':
        return true; // Optional
      case 'continue':
        return data.continueChoice !== null;
      default:
        return false;
    }
  };

  const getStepNumber = () => {
    const steps = getSteps();
    return steps.indexOf(currentStep) + 1;
  };

  const totalSteps = getSteps().length;

  const renderUpsellStep = () => {
    if (!upsellProgram) return null;
    
    const headline = completionConfig?.upsellHeadline || 'Keep the momentum going!';
    const description = completionConfig?.upsellDescription || `Continue your journey with ${upsellProgram.name}`;
    
    return (
      <motion.div
        key="upsell"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="py-4"
      >
        <div className="text-center mb-6">
          <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
            {headline}
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
            {description}
          </p>
        </div>
        
        {/* Upsell program card */}
        <div className="rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden bg-[#faf8f6] dark:bg-[#11141b] mb-6">
          {upsellProgram.coverImageUrl && (
            <div className="relative h-32 w-full">
              <Image
                src={upsellProgram.coverImageUrl}
                alt={upsellProgram.name}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="p-4">
            <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
              {upsellProgram.name}
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-3 line-clamp-2">
              {upsellProgram.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8a857f]">
                {upsellProgram.lengthDays} days
              </span>
              <span className="font-albert font-bold text-xl text-brand-accent">
                {formatPrice(upsellProgram.priceInCents, upsellProgram.currency)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Payment section */}
        {purchaseSuccess ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-6"
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-white" />
            </div>
            <p className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8]">
              You&apos;re enrolled!
            </p>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              Starting your new program...
            </p>
          </motion.div>
        ) : loadingMethods ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
          </div>
        ) : savedMethods.length > 0 ? (
          <div className="space-y-3">
            {/* Saved payment methods */}
            {savedMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethodId(method.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left ${
                  selectedMethodId === method.id
                    ? 'bg-brand-accent/10 ring-2 ring-brand-accent'
                    : 'bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50'
                }`}
              >
                <CreditCard className="w-5 h-5 text-[#5f5a55]" />
                <div className="flex-1">
                  <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] capitalize">
                    {method.brand}
                  </span>
                  <span className="text-[#5f5a55] dark:text-[#b2b6c2]">
                    {' '}•••• {method.last4}
                  </span>
                </div>
                <span className="text-sm text-[#8a857f]">
                  {method.expMonth}/{method.expYear}
                </span>
              </button>
            ))}
            
            {purchaseError && (
              <p className="text-sm text-red-500 text-center">{purchaseError}</p>
            )}
            
            <Button
              onClick={handlePurchaseUpsell}
              disabled={!selectedMethodId || purchasing}
              className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white py-6 text-lg font-semibold"
            >
              {purchasing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  Get Started – {formatPrice(upsellProgram.priceInCents, upsellProgram.currency)}
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-4">
              No saved payment method found
            </p>
            <Button
              onClick={() => {
                // TODO: Open payment method form or redirect
                window.location.href = `/program/${upsellProgram.id}`;
              }}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Payment Method
            </Button>
          </div>
        )}
      </motion.div>
    );
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'congrats':
        return (
          <motion.div
            key="congrats"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center py-8 relative overflow-hidden"
          >
            {/* Animated sparkles background */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0, y: 100 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1, 0],
                    y: [100, -50, -100],
                    x: [0, (i % 2 === 0 ? 20 : -20), (i % 2 === 0 ? 40 : -40)],
                  }}
                  transition={{ 
                    duration: 2,
                    delay: 0.3 + (i * 0.15),
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  className="absolute"
                  style={{ 
                    left: `${10 + (i * 7)}%`,
                    top: '60%',
                  }}
                >
                  <Sparkles className={`w-4 h-4 ${
                    i % 3 === 0 ? 'text-[#f5d799]' : i % 3 === 1 ? 'text-[#d4a574]' : 'text-brand-accent'
                  }`} />
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-[#f5d799] to-brand-accent rounded-full flex items-center justify-center shadow-lg relative z-10"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <Trophy className="w-12 h-12 text-white" />
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative z-10"
            >
              <h2 className="text-3xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                Congratulations! 🎉
              </h2>
              <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-sans mb-2">
                You completed the
              </p>
              <p className="text-xl font-albert font-semibold text-brand-accent mb-4">
                {programName}
              </p>
              <div className="flex items-center justify-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="w-5 h-5 text-[#d4a574]" />
                </motion.div>
                <span className="font-sans">{programDays} days of growth</span>
                <motion.div animate={{ rotate: [0, -360] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles className="w-5 h-5 text-[#d4a574]" />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        );
        
      case 'upsell':
        return renderUpsellStep();

      case 'rating':
        return (
          <motion.div
            key="rating"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="py-4"
          >
            <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2 text-center">
              How did the program go?
            </h2>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-center mb-8">
              Rate your overall experience
            </p>
            
            <div className="flex justify-center gap-3">
              {RATING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData(prev => ({ ...prev, programRating: option.value }))}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all ${
                    data.programRating === option.value
                      ? 'bg-brand-accent/10 ring-2 ring-brand-accent dark:ring-brand-accent scale-105'
                      : 'bg-[#faf8f6] dark:bg-white/5 hover:bg-[#f0ebe6] dark:hover:bg-white/10'
                  }`}
                >
                  <span className="text-3xl">{option.emoji}</span>
                  <span className={`text-xs font-albert ${
                    data.programRating === option.value
                      ? 'text-brand-accent font-medium'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                  }`}>
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'progress':
        return (
          <motion.div
            key="progress"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="py-4"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Target className="w-6 h-6 text-brand-accent" />
              <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Are you on track?
              </h2>
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-center mb-8">
              How do you feel about achieving your goal?
            </p>
            
            <div className="space-y-3">
              {PROGRESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setData(prev => ({ ...prev, progressStatus: option.value }))}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
                    data.progressStatus === option.value
                      ? 'bg-brand-accent/10 ring-2 ring-brand-accent dark:ring-brand-accent'
                      : 'bg-[#faf8f6] dark:bg-white/5 hover:bg-[#f0ebe6] dark:hover:bg-white/10'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    data.progressStatus === option.value
                      ? 'border-brand-accent bg-brand-accent'
                      : 'border-[#ccc] dark:border-[#555]'
                  }`}>
                    {data.progressStatus === option.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className={`font-albert font-medium ${
                      data.progressStatus === option.value
                        ? 'text-brand-accent'
                        : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      {option.label}
                    </p>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
                      {option.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 'went_well':
        return (
          <motion.div
            key="went_well"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="py-4"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <MessageSquare className="w-6 h-6 text-[#3c8c64]" />
              <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                What went well?
              </h2>
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-center mb-6">
              Celebrate your wins! (optional)
            </p>
            
            <textarea
              value={data.whatWentWell}
              onChange={(e) => setData(prev => ({ ...prev, whatWentWell: e.target.value }))}
              placeholder="I made progress on... I learned... I'm proud of..."
              className="w-full h-32 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-sans placeholder:text-[#999] resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent"
            />
          </motion.div>
        );

      case 'obstacles':
        return (
          <motion.div
            key="obstacles"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="py-4"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <AlertTriangle className="w-6 h-6 text-[#d4a574]" />
              <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                What were some obstacles?
              </h2>
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-center mb-6">
              Reflect to grow stronger (optional)
            </p>
            
            <textarea
              value={data.obstacles}
              onChange={(e) => setData(prev => ({ ...prev, obstacles: e.target.value }))}
              placeholder="I struggled with... Next time I would... I learned that..."
              className="w-full h-32 p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-sans placeholder:text-[#999] resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent"
            />
          </motion.div>
        );

      case 'continue':
        return (
          <motion.div
            key="continue"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="py-4"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <ArrowRight className="w-6 h-6 text-brand-accent" />
              <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                Would you like to keep going?
              </h2>
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-center mb-8">
              Choose your next step
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => setData(prev => ({ ...prev, continueChoice: 'continue' }))}
                className={`w-full p-5 rounded-xl transition-all text-left ${
                  data.continueChoice === 'continue'
                    ? 'bg-brand-accent/10 ring-2 ring-brand-accent dark:ring-brand-accent'
                    : 'bg-[#faf8f6] dark:bg-white/5 hover:bg-[#f0ebe6] dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    data.continueChoice === 'continue'
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55]'
                  }`}>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-albert font-semibold ${
                      data.continueChoice === 'continue'
                        ? 'text-brand-accent'
                        : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      Continue with the program
                    </p>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
                      Start the next program in the series
                    </p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => setData(prev => ({ ...prev, continueChoice: 'own_tasks' }))}
                className={`w-full p-5 rounded-xl transition-all text-left ${
                  data.continueChoice === 'own_tasks'
                    ? 'bg-brand-accent/10 ring-2 ring-brand-accent dark:ring-brand-accent'
                    : 'bg-[#faf8f6] dark:bg-white/5 hover:bg-[#f0ebe6] dark:hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    data.continueChoice === 'own_tasks'
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#e1ddd8] dark:bg-[#262b35] text-[#5f5a55]'
                  }`}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`font-albert font-semibold ${
                      data.continueChoice === 'own_tasks'
                        ? 'text-brand-accent'
                        : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}>
                      I&apos;ll create my own tasks
                    </p>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-sans">
                      Continue without a structured program
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };
  
  // Render footer buttons based on current step
  const renderFooter = () => {
    const isFirstStep = currentStep === 'congrats';
    const isLastStep = currentStep === 'continue';
    const isUpsellStep = currentStep === 'upsell';
    
    return (
      <div className="flex items-center justify-between px-6 pb-6">
        {!isFirstStep ? (
          <button
            onClick={handleBack}
            className="text-[#5f5a55] hover:text-[#1a1a1a] dark:hover:text-white font-albert text-sm"
          >
            Back
          </button>
        ) : (
          <div />
        )}
        
        {isUpsellStep ? (
          <button
            onClick={handleSkipUpsell}
            className="text-[#5f5a55] hover:text-[#1a1a1a] dark:hover:text-white font-albert text-sm"
          >
            Skip
          </button>
        ) : isLastStep ? (
          <Button
            onClick={handleComplete}
            disabled={!canProceed() || isSubmitting}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white px-8"
          >
            {isSubmitting ? 'Saving...' : 'Finish'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-brand-accent hover:bg-brand-accent/90 text-white px-8"
          >
            Continue
          </Button>
        )}
      </div>
    );
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          {/* Desktop: centered, Mobile: bottom sheet */}
          <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-full sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="w-full sm:max-w-lg transform overflow-hidden rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#171b22] shadow-xl transition-all max-h-[90vh] sm:max-h-none overflow-y-auto">
                {/* Drag handle for mobile */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full" />
                </div>
                
                {/* Header with progress and close */}
                <div className="flex items-center justify-between px-6 pt-4 sm:pt-5 pb-2">
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                          i < getStepNumber()
                            ? 'w-8 bg-brand-accent'
                            : 'w-4 bg-[#e1ddd8] dark:bg-[#262b35]'
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 -mr-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 pb-4">
                  <AnimatePresence mode="wait">
                    {renderStep()}
                  </AnimatePresence>
                </div>

                {/* Footer with navigation */}
                {renderFooter()}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
