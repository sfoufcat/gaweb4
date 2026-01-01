'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ArrowRight, 
  ArrowLeft,
  Users, 
  Zap, 
  Target,
  Check,
  Sparkles,
  TrendingUp,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import { CreateProgramModal } from '@/components/marketplace/CreateProgramModal';

interface CoachQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type QuizStep = 'why' | 'clients' | 'frustration' | 'match';

type ClientCount = '0-5' | '5-20' | '20-50' | '50+' | null;

type Frustration = 
  | 'clients_dont_implement'
  | 'cant_prove_roi'
  | 'no_accountability_tracking'
  | 'too_much_followup'
  | 'group_loses_feel';

const FRUSTRATION_OPTIONS: { id: Frustration; label: string }[] = [
  { id: 'clients_dont_implement', label: 'Clients consume but don\'t implement' },
  { id: 'cant_prove_roi', label: 'I can\'t prove my coaching actually works' },
  { id: 'no_accountability_tracking', label: 'Community platforms don\'t track accountability' },
  { id: 'too_much_followup', label: 'I spend too much time on follow-ups' },
  { id: 'group_loses_feel', label: 'Group programs lose the 1:1 feel' },
];

const CLIENT_OPTIONS: { value: ClientCount; label: string; sublabel: string }[] = [
  { value: '0-5', label: 'Just starting', sublabel: '0-5 clients' },
  { value: '5-20', label: 'Building momentum', sublabel: '5-20 clients' },
  { value: '20-50', label: 'Scaling up', sublabel: '20-50 clients' },
  { value: '50+', label: 'At capacity', sublabel: '50+ clients' },
];

export function CoachQuizModal({ isOpen, onClose }: CoachQuizModalProps) {
  const [step, setStep] = useState<QuizStep>('why');
  const [clientCount, setClientCount] = useState<ClientCount>(null);
  const [frustrations, setFrustrations] = useState<Set<Frustration>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('why');
      setClientCount(null);
      setFrustrations(new Set());
    }
  }, [isOpen]);

  const toggleFrustration = (id: Frustration) => {
    setFrustrations(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleNext = () => {
    if (step === 'why') setStep('clients');
    else if (step === 'clients' && clientCount) setStep('frustration');
    else if (step === 'frustration' && frustrations.size > 0) setStep('match');
  };

  const handleBack = () => {
    if (step === 'clients') setStep('why');
    else if (step === 'frustration') setStep('clients');
    else if (step === 'match') setStep('frustration');
  };

  const handleCreatePlatform = () => {
    onClose();
    setShowCreateModal(true);
  };

  const stepIndex = ['why', 'clients', 'frustration', 'match'].indexOf(step);

  // Value props for step 1
  const valueProps = [
    {
      icon: BarChart3,
      title: 'See who\'s doing the work',
      description: 'Alignment scores show exactly which clients are engaged—no more guessing',
    },
    {
      icon: Target,
      title: 'Built for transformation',
      description: 'Daily Focus, habits, and streaks keep clients accountable between sessions',
    },
    {
      icon: Users,
      title: 'Scale without losing quality',
      description: 'Squad accountability makes group coaching as effective as 1:1',
    },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal - Desktop: centered, Mobile: bottom sheet */}
            <motion.div
              initial={{ opacity: 0, y: '100%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 pointer-events-none"
            >
              <div className="w-full sm:w-[480px] max-h-[90vh] overflow-y-auto bg-white dark:bg-[#171b22] rounded-t-3xl sm:rounded-3xl shadow-2xl pointer-events-auto">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full bg-[#f3f1ef] dark:bg-[#1e222a] hover:bg-[#e1ddd8] dark:hover:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Progress bar */}
                <div className="px-6 pt-6">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i <= stepIndex 
                            ? 'bg-brand-accent' 
                            : 'bg-[#e1ddd8] dark:bg-[#262b35]'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {/* Step 1: Why Growth Addicts */}
                  {step === 'why' && (
                    <motion.div
                      key="why"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-brand-accent to-[#8c6245] rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Sparkles className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                          Why Growth Addicts?
                        </h2>
                        <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                          Built for coaches who want results, not just engagement
                        </p>
                      </div>
                      
                      <div className="space-y-4 mb-8">
                        {valueProps.map((prop, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex gap-4 items-start p-4 bg-[#faf8f6] dark:bg-[#1e222a] rounded-2xl"
                          >
                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#262b35] flex items-center justify-center flex-shrink-0 shadow-sm">
                              <prop.icon className="w-5 h-5 text-brand-accent" />
                            </div>
                            <div>
                              <h4 className="font-albert text-[15px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                {prop.title}
                              </h4>
                              <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                                {prop.description}
                              </p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      
                      <button
                        onClick={handleNext}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20"
                      >
                        Let's see if we're a match
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}

                  {/* Step 2: Client Count */}
                  {step === 'clients' && (
                    <motion.div
                      key="clients"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >
                      <button
                        onClick={handleBack}
                        className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                      
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <TrendingUp className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                          How many clients do you coach?
                        </h2>
                        <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                          This helps us understand your needs
                        </p>
                      </div>
                      
                      <div className="space-y-3 mb-8">
                        {CLIENT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => setClientCount(option.value)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                              clientCount === option.value
                                ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                                : 'border-[#e1ddd8] dark:border-[#313746] hover:border-[#c5bfb8] dark:hover:border-[#3d4452]'
                            }`}
                          >
                            <div className="text-left">
                              <p className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                {option.label}
                              </p>
                              <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                                {option.sublabel}
                              </p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                              clientCount === option.value
                                ? 'border-brand-accent bg-brand-accent'
                                : 'border-[#c5bfb8] dark:border-[#3d4452]'
                            }`}>
                              {clientCount === option.value && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      <button
                        onClick={handleNext}
                        disabled={!clientCount}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        Continue
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}

                  {/* Step 3: Frustrations */}
                  {step === 'frustration' && (
                    <motion.div
                      key="frustration"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >
                      <button
                        onClick={handleBack}
                        className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                      
                      <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="w-7 h-7 text-white" />
                        </div>
                        <h2 className="font-albert text-[26px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]">
                          What frustrates you most?
                        </h2>
                        <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                          Select all that apply
                        </p>
                      </div>
                      
                      <div className="space-y-3 mb-8">
                        {FRUSTRATION_OPTIONS.map((option) => {
                          const isSelected = frustrations.has(option.id);
                          return (
                            <button
                              key={option.id}
                              onClick={() => toggleFrustration(option.id)}
                              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10'
                                  : 'border-[#e1ddd8] dark:border-[#313746] hover:border-[#c5bfb8] dark:hover:border-[#3d4452]'
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'border-brand-accent bg-brand-accent'
                                  : 'border-[#c5bfb8] dark:border-[#3d4452]'
                              }`}>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-white" />
                                )}
                              </div>
                              <p className="font-sans text-[15px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                                {option.label}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      
                      <button
                        onClick={handleNext}
                        disabled={frustrations.size === 0}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        See my results
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </motion.div>
                  )}

                  {/* Step 4: Match */}
                  {step === 'match' && (
                    <motion.div
                      key="match"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="p-6"
                    >
                      <button
                        onClick={handleBack}
                        className="flex items-center gap-1 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors mb-4"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                      </button>
                      
                      <div className="text-center mb-6">
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
                          className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30"
                        >
                          <Check className="w-10 h-10 text-white" />
                        </motion.div>
                        <motion.h2 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="font-albert text-[28px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px]"
                        >
                          You're a perfect match!
                        </motion.h2>
                        <motion.p 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] mt-2"
                        >
                          Growth Addicts was built for coaches exactly like you
                        </motion.p>
                      </div>
                      
                      {/* Summary of their answers */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-[#faf8f6] dark:bg-[#1e222a] rounded-2xl p-5 mb-6"
                      >
                        <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
                          Based on your answers, here's what you'll get:
                        </p>
                        <ul className="space-y-2.5">
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <strong>Alignment Scores</strong> — see exactly who's doing the work
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <strong>Daily Focus + Habits</strong> — accountability that sticks
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <strong>Squad Groups</strong> — peer pressure that works
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                              <strong>Built-in Payments</strong> — monetize on day one
                            </span>
                          </li>
                        </ul>
                      </motion.div>
                      
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        onClick={handleCreatePlatform}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-sans font-bold text-[16px] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-[#e8b923]/20"
                      >
                        <Sparkles className="w-5 h-5" />
                        Create my platform
                      </motion.button>
                      
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-center font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190] mt-4"
                      >
                        7-day free trial • Credit card required • Cancel anytime
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create Program Modal (from marketplace) */}
      <CreateProgramModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </>
  );
}

