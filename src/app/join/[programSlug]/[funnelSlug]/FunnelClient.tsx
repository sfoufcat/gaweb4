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

// Step components (to be created)
import { QuestionStep } from '@/components/funnel/steps/QuestionStep';

/**
 * Darken or lighten a hex color
 * @param hex - Hex color string (e.g., "#a07855")
 * @param percent - Positive to lighten, negative to darken
 */
function adjustColor(hex: string, percent: number): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Adjust each component
  const adjust = (value: number) => {
    const adjusted = Math.round(value + (percent / 100) * 255);
    return Math.max(0, Math.min(255, adjusted));
  };
  
  // Convert back to hex
  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`;
}
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

interface FunnelClientProps {
  funnel: Funnel;
  steps: FunnelStep[];
  program: {
    id: string;
    name: string;
    slug: string;
    description: string;
    coverImageUrl?: string;
    type: string;
    lengthDays: number;
    priceInCents: number;
    currency: string;
    stripePriceId?: string;
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
  tenantSubdomain?: string | null;
  referrerId?: string;
}

interface FlowSessionData {
  [key: string]: unknown;
}

export default function FunnelClient({
  funnel,
  steps,
  program,
  branding,
  organization,
  inviteCode,
  validatedInvite,
  hostname,
  tenantSubdomain,
  referrerId,
}: FunnelClientProps) {
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
        // Check for existing session in localStorage
        const storedSessionId = localStorage.getItem(`funnel_session_${funnel.id}`);
        
        if (storedSessionId) {
          // Try to restore session
          const response = await fetch(`/api/funnel/session?sessionId=${storedSessionId}`);
          const result = await response.json();
          
          if (result.session && !result.expired) {
            setSessionId(storedSessionId);
            setCurrentStepIndex(result.session.currentStepIndex || 0);
            setData(result.session.data || {});
            setIsLoading(false);
            return;
          } else {
            // Session expired or not found, clear it
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
    // Merge step data
    const newData = { ...data, ...stepData };
    setData(newData);

    // Mark current step as completed
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
      
      // Check conditional display
      if (nextStep.showIf) {
        const fieldValue = newData[nextStep.showIf.field];
        let shouldShow = false;
        
        switch (nextStep.showIf.operator) {
          case 'eq':
            shouldShow = fieldValue === nextStep.showIf.value;
            break;
          case 'neq':
            shouldShow = fieldValue !== nextStep.showIf.value;
            break;
          case 'in':
            shouldShow = Array.isArray(nextStep.showIf.value) && nextStep.showIf.value.includes(fieldValue);
            break;
          case 'nin':
            shouldShow = Array.isArray(nextStep.showIf.value) && !nextStep.showIf.value.includes(fieldValue);
            break;
        }
        
        if (!shouldShow) {
          nextIndex++;
          continue;
        }
      }
      
      break;
    }

    // Check if funnel is complete
    if (nextIndex >= steps.length) {
      const successConfig = getSuccessStepConfig();
      await completeFunnel(newData, successConfig?.skipSuccessRedirect);
      return;
    }

    // Move to next step
    setCurrentStepIndex(nextIndex);
    await updateSession({ currentStepIndex: nextIndex });
  }, [currentStepIndex, data, steps, skipPayment, updateSession, getSuccessStepConfig]);

  // Handle going back
  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      updateSession({ currentStepIndex: newIndex });
    }
  }, [currentStepIndex, updateSession]);

  // Complete funnel and enroll
  const completeFunnel = async (finalData: FlowSessionData, customRedirect?: string) => {
    setIsNavigating(true);
    
    try {
      const response = await fetch('/api/funnel/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowSessionId: sessionId,
          stripePaymentIntentId: finalData.stripePaymentIntentId,
          stripeCheckoutSessionId: finalData.stripeCheckoutSessionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete enrollment');
      }

      // Clear session from localStorage
      localStorage.removeItem(`funnel_session_${funnel.id}`);

      // Redirect to custom URL or dashboard
      const redirectUrl = customRedirect || '/';
      router.push(redirectUrl);
    } catch (err) {
      console.error('Failed to complete funnel:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete enrollment');
      setIsNavigating(false);
    }
  };

  // Render current step
  const renderStep = () => {
    if (steps.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-text-secondary">This funnel has no steps configured.</p>
        </div>
      );
    }

    const currentStep = steps[currentStepIndex];
    if (!currentStep) return null;

    const stepConfig = currentStep.config as FunnelStepConfig;
    const commonProps = {
      onComplete: handleStepComplete,
      onBack: currentStepIndex > 0 ? handleBack : undefined,
      data,
      program,
      branding,
      isFirstStep: currentStepIndex === 0,
      isLastStep: currentStepIndex === steps.length - 1,
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
            tenantSubdomain={tenantSubdomain}
          />
        );
      
      case 'payment':
        return (
          <PaymentStep
            {...commonProps}
            config={stepConfig.config as FunnelStepConfigPayment}
            skipPayment={skipPayment}
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
        return <PlanRevealStep {...commonProps} config={stepConfig.config as FunnelStepConfigPlanReveal} />;
      
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
        return <SuccessStep {...commonProps} config={stepConfig.config as FunnelStepConfigSuccess} />;
      
      default:
        return (
          <div className="text-center p-8">
            <p className="text-text-secondary">Unknown step type: {currentStep.type}</p>
            <button
              onClick={() => handleStepComplete({})}
              className="mt-4 px-6 py-2 text-white rounded-lg"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Continue
            </button>
          </div>
        );
    }
  };

  // Loading state (initial session load) - show skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-app-bg">
        <div className="max-w-2xl mx-auto px-4 py-8 animate-pulse">
          {/* Logo skeleton */}
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-text-primary/10 mx-auto mb-6" />
          {/* Title skeleton */}
          <div className="h-8 w-3/4 bg-text-primary/10 rounded mx-auto mb-4" />
          {/* Description skeleton */}
          <div className="space-y-2 mb-8">
            <div className="h-4 w-full bg-text-primary/5 rounded mx-auto" />
            <div className="h-4 w-2/3 bg-text-primary/5 rounded mx-auto" />
          </div>
          {/* Form fields skeleton */}
          <div className="space-y-4 mb-8">
            <div className="h-12 w-full bg-text-primary/5 rounded-xl" />
            <div className="h-12 w-full bg-text-primary/5 rounded-xl" />
            <div className="h-12 w-full bg-text-primary/5 rounded-xl" />
          </div>
          {/* Button skeleton */}
          <div className="h-14 w-full bg-text-primary/10 rounded-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Something went wrong</h2>
          <p className="text-text-secondary mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 text-white rounded-lg transition-colors"
            style={{ 
              backgroundColor: branding.primaryColor,
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = adjustColor(branding.primaryColor, -15)}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = branding.primaryColor}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Navigating state (completing funnel)
  if (isNavigating) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center">
          {branding.logoUrl && (
            <Image
              src={branding.logoUrl}
              alt={branding.appTitle}
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
            />
          )}
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div 
              className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: branding.primaryColor }}
            />
          </div>
          <p className="text-text-secondary">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Render step content
  // Note: SignupStep now always returns content (confirmation or form), never null
  const stepContent = renderStep();

  // Progress calculation
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // CSS variable style for dynamic theming
  const themeStyle = {
    '--funnel-primary': branding.primaryColor,
    '--funnel-primary-hover': adjustColor(branding.primaryColor, -15),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-app-bg" style={themeStyle}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#e1ddd8] z-50">
        <motion.div
          className="h-full"
          style={{ backgroundColor: 'var(--funnel-primary)' }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Logo */}
      <div className="pt-6 pb-4 px-6 flex justify-center">
        {branding.logoUrl && (
          <Image
            src={branding.logoUrl}
            alt={branding.appTitle}
            width={48}
            height={48}
            className="rounded-lg"
          />
        )}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="px-4 pb-8"
        >
          {stepContent}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

