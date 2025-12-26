'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import type { 
  Funnel, 
  FunnelStep, 
  FunnelStepConfig,
  FunnelStepConfigQuestion,
  FunnelStepConfigSignup,
  FunnelStepConfigPayment,
  FunnelStepConfigGoal,
  FunnelStepConfigIdentity,
  FunnelStepConfigAnalyzing,
  FunnelStepConfigPlanReveal,
  FunnelStepConfigInfo,
  FunnelStepConfigExplainer,
  FunnelStepConfigLandingPage,
  FunnelStepConfigSuccess,
} from '@/types';

// Step components
import { QuestionStep } from '@/components/funnel/steps/QuestionStep';
import { SignupStep } from '@/components/funnel/steps/SignupStep';
import { PaymentStep } from '@/components/funnel/steps/PaymentStep';
import { GoalStep } from '@/components/funnel/steps/GoalStep';
import { IdentityStep } from '@/components/funnel/steps/IdentityStep';
import { AnalyzingStep } from '@/components/funnel/steps/AnalyzingStep';
import { PlanRevealStep } from '@/components/funnel/steps/PlanRevealStep';
import { ExplainerStep } from '@/components/funnel/steps/ExplainerStep';
import { LandingPageStep } from '@/components/funnel/steps/LandingPageStep';
import { InfoStep } from '@/components/funnel/steps/InfoStep';
import { SuccessStep } from '@/components/funnel/steps/SuccessStep';

/**
 * Darken or lighten a hex color
 */
function adjustColor(hex: string, percent: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  const adjust = (value: number) => {
    const adjusted = Math.round(value + (percent / 100) * 255);
    return Math.max(0, Math.min(255, adjusted));
  };
  
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}

interface SquadFunnelClientProps {
  funnel: Funnel;
  steps: FunnelStep[];
  squad: {
    id: string;
    name: string;
    slug: string;
    description: string;
    imageUrl?: string;
  };
  branding: {
    logoUrl: string;
    appTitle: string;
    primaryColor: string;
  };
  organization: {
    id: string;
    name: string;
  };
  inviteCode?: string;
  validatedInvite?: {
    paymentStatus: string;
    targetSquadId?: string;
  } | null;
  hostname: string;
  referrerId?: string;
}

interface FlowSessionData {
  [key: string]: unknown;
}

export default function SquadFunnelClient({
  funnel,
  steps,
  squad,
  branding,
  organization,
  inviteCode,
  validatedInvite,
  hostname,
  referrerId,
}: SquadFunnelClientProps) {
  const router = useRouter();
  const { isSignedIn, userId, isLoaded } = useAuth();
  
  // Flow session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<FlowSessionData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Skip payment if invite is pre-paid
  const skipPayment = validatedInvite?.paymentStatus === 'pre_paid' || validatedInvite?.paymentStatus === 'free';

  // Initialize or restore flow session
  useEffect(() => {
    async function initSession() {
      try {
        const storedSessionId = localStorage.getItem(`funnel_session_${funnel.id}`);
        
        if (storedSessionId) {
          const response = await fetch(`/api/funnel/session?sessionId=${storedSessionId}`);
          const result = await response.json();
          
          if (result.session && !result.expired) {
            setSessionId(storedSessionId);
            setCurrentStepIndex(result.session.currentStepIndex || 0);
            setData(result.session.data || {});
            setIsLoading(false);
            return;
          } else {
            localStorage.removeItem(`funnel_session_${funnel.id}`);
          }
        }

        // Create new session
        const response = await fetch('/api/funnel/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funnelId: funnel.id,
            inviteCode,
            referrerId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create session');
        }

        setSessionId(result.sessionId);
        localStorage.setItem(`funnel_session_${funnel.id}`, result.sessionId);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize session:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setIsLoading(false);
      }
    }

    initSession();
  }, [funnel.id, inviteCode]);

  // Link session to user when they sign in
  useEffect(() => {
    async function linkSession() {
      if (isLoaded && isSignedIn && userId && sessionId) {
        try {
          const response = await fetch('/api/funnel/link-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flowSessionId: sessionId }),
          });

          if (!response.ok) {
            console.error('Failed to link session');
          }
        } catch (err) {
          console.error('Error linking session:', err);
        }
      }
    }

    linkSession();
  }, [isLoaded, isSignedIn, userId, sessionId]);

  // Update session on server
  const updateSession = useCallback(async (updates: {
    currentStepIndex?: number;
    completedStepIndex?: number;
    data?: Record<string, unknown>;
  }) => {
    if (!sessionId) return;

    try {
      await fetch(`/api/funnel/session/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to update session:', err);
    }
  }, [sessionId]);

  // Check if success step should be skipped
  const getSuccessStepConfig = useCallback(() => {
    const successStep = steps.find(s => s.type === 'success');
    if (!successStep) return null;
    const stepConfig = successStep.config as FunnelStepConfig;
    return stepConfig.config as FunnelStepConfigSuccess;
  }, [steps]);

  // Handle step completion
  const handleStepComplete = useCallback(async (stepData: Record<string, unknown>) => {
    const newData = { ...data, ...stepData };
    setData(newData);

    await updateSession({
      completedStepIndex: currentStepIndex,
      data: stepData,
    });

    // Find next step (skip payment if pre-paid, skip success if configured)
    let nextIndex = currentStepIndex + 1;
    
    while (nextIndex < steps.length) {
      const nextStep = steps[nextIndex];
      
      // Skip payment step if pre-paid
      if (nextStep.type === 'payment' && skipPayment) {
        nextIndex++;
        continue;
      }
      
      // Skip success step if skipSuccessPage is enabled
      if (nextStep.type === 'success') {
        const successConfig = getSuccessStepConfig();
        if (successConfig?.skipSuccessPage) {
          // Complete funnel and redirect immediately
          await completeFunnel(newData, successConfig.skipSuccessRedirect);
          return;
        }
      }
      
      break;
    }

    if (nextIndex >= steps.length) {
      // Complete the funnel - add to squad
      const successConfig = getSuccessStepConfig();
      await completeFunnel(newData, successConfig?.skipSuccessRedirect);
    } else {
      setCurrentStepIndex(nextIndex);
      await updateSession({ currentStepIndex: nextIndex });
    }
  }, [data, currentStepIndex, steps, skipPayment, updateSession, getSuccessStepConfig]);

  // Complete funnel and add user to squad
  const completeFunnel = async (finalData: FlowSessionData, customRedirect?: string) => {
    try {
      const response = await fetch('/api/funnel/complete-squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          funnelId: funnel.id,
          squadId: squad.id,
          organizationId: organization.id,
          inviteCode,
          data: finalData,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to complete funnel');
      }

      // Clear session
      localStorage.removeItem(`funnel_session_${funnel.id}`);

      // Redirect to custom URL or dashboard
      const redirectUrl = customRedirect || '/?joined=squad';
      router.push(redirectUrl);
    } catch (err) {
      console.error('Failed to complete funnel:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  };

  // Handle navigation
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      updateSession({ currentStepIndex: newIndex });
    }
  }, [currentStepIndex, updateSession]);

  // Current step
  const currentStep = steps[currentStepIndex];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#5f5a55]">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] mb-2">Something went wrong</h2>
          <p className="text-[#5f5a55] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#a07855] text-white rounded-full hover:bg-[#8c6245] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No steps
  if (!currentStep) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-[#5f5a55]">No steps configured for this funnel.</p>
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    const stepConfig = currentStep.config as FunnelStepConfig;
    const isFirstStep = currentStepIndex === 0;
    const commonProps = {
      step: currentStep,
      data,
      onComplete: handleStepComplete,
      onBack: currentStepIndex > 0 ? handleBack : undefined,
      branding,
      isNavigating,
      isFirstStep,
    };

    switch (currentStep.type) {
      case 'question':
        return <QuestionStep {...commonProps} config={stepConfig.config as FunnelStepConfigQuestion} />;
      case 'signup':
        return (
          <SignupStep 
            {...commonProps} 
            config={stepConfig.config as FunnelStepConfigSignup}
            hostname={hostname}
            flowSessionId={sessionId || ''}
            organizationId={organization.id}
            organizationName={organization.name}
          />
        );
      case 'payment':
        return (
          <PaymentStep 
            {...commonProps} 
            config={stepConfig.config as FunnelStepConfigPayment}
            // For squad funnels, pass squad info instead of program
            program={{
              name: squad.name,
              priceInCents: 0, // Will be configured per funnel/squad
              currency: 'usd',
            }}
            skipPayment={false}
          />
        );
      case 'goal_setting':
        return <GoalStep {...commonProps} config={stepConfig.config as FunnelStepConfigGoal} />;
      case 'identity':
        return <IdentityStep {...commonProps} config={stepConfig.config as FunnelStepConfigIdentity} />;
      case 'analyzing':
        return <AnalyzingStep {...commonProps} config={stepConfig.config as FunnelStepConfigAnalyzing} />;
      case 'plan_reveal':
      case 'transformation':
        return (
          <PlanRevealStep 
            {...commonProps} 
            config={stepConfig.config as FunnelStepConfigPlanReveal} 
            data={data}
            program={{ name: squad.name, lengthDays: 90 }}
          />
        );
      case 'explainer':
        return <ExplainerStep {...commonProps} config={stepConfig.config as FunnelStepConfigExplainer} />;
      case 'landing_page':
        return <LandingPageStep {...commonProps} config={stepConfig.config as FunnelStepConfigLandingPage} />;
      case 'info':
        // Legacy support: treat 'info' as 'explainer' with defaults
        return <ExplainerStep {...commonProps} config={{
          ...stepConfig.config as FunnelStepConfigInfo,
          mediaType: 'image',
          layout: 'media_top',
        } as FunnelStepConfigExplainer} />;
      case 'success':
        return <SuccessStep {...commonProps} config={stepConfig.config as FunnelStepConfigSuccess} program={{ name: squad.name }} />;
      default:
        return <div className="p-8 text-center">Unknown step type: {currentStep.type}</div>;
    }
  };

  // Progress percentage
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div 
      className="min-h-screen bg-white"
      style={{
        '--funnel-primary': branding.primaryColor,
        '--funnel-primary-light': adjustColor(branding.primaryColor, 20),
        '--funnel-primary-dark': adjustColor(branding.primaryColor, -15),
      } as React.CSSProperties}
    >
      {/* Header with logo and progress */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e1ddd8]/50">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Image
              src={branding.logoUrl}
              alt={branding.appTitle}
              width={36}
              height={36}
              className="rounded-lg"
              unoptimized
            />
            <span className="text-sm text-[#5f5a55]">
              {currentStepIndex + 1} / {steps.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-[#e1ddd8] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: branding.primaryColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-20 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

