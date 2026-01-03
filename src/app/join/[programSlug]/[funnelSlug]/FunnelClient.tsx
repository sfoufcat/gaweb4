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
  FunnelStepConfigUpsell,
  FunnelStepConfigDownsell,
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
import { UpsellStep } from '@/components/funnel/steps/UpsellStep';
import { DownsellStep } from '@/components/funnel/steps/DownsellStep';
import { InfoStep } from '@/components/funnel/steps/InfoStep';
import { SuccessStep } from '@/components/funnel/steps/SuccessStep';
import { InfluencePromptCard } from '@/components/funnel/InfluencePromptCard';
import { FunnelPixelTracker } from '@/components/funnel/FunnelPixelTracker';
import { AlreadyEnrolledModal } from '@/components/AlreadyEnrolledModal';
import type { NewProgramEnrollmentStatus } from '@/types';

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
    subscriptionEnabled?: boolean;
    billingInterval?: 'monthly' | 'quarterly' | 'yearly';
    coachName?: string;
    coachImageUrl?: string;
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
  /** Existing enrollment if user already enrolled in this program */
  existingEnrollment?: {
    id: string;
    status: NewProgramEnrollmentStatus;
    redirectUrl: string;
  } | null;
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
  existingEnrollment,
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
  
  // Already enrolled modal state
  const [showAlreadyEnrolledModal, setShowAlreadyEnrolledModal] = useState(!!existingEnrollment);
  
  // Upsell/Downsell tracking - which upsells were declined (to show their linked downsells)
  const [declinedUpsellStepIds, setDeclinedUpsellStepIds] = useState<string[]>([]);
  
  // Cache for fetched upsell/downsell product prices (productId -> priceInCents)
  const [productPrices, setProductPrices] = useState<Record<string, number>>({});
  
  // Track which upsell/downsell steps have invalid cohorts (should be skipped)
  const [invalidCohortStepIds, setInvalidCohortStepIds] = useState<string[]>([]);

  // Skip payment if invite is pre-paid
  const skipPayment = validatedInvite?.paymentStatus === 'pre_paid' || validatedInvite?.paymentStatus === 'free';

  // Initialize or restore flow session
  useEffect(() => {
    async function initSession() {
      try {
        // Check for existing session in localStorage
        const storedSessionId = localStorage.getItem(`funnel_session_${funnel.id}`);
        
        // Validate stored session ID format before attempting to restore
        // Must be a non-empty string starting with 'flow_'
        if (storedSessionId && typeof storedSessionId === 'string' && storedSessionId.startsWith('flow_')) {
          try {
            // Try to restore session
            const response = await fetch(`/api/funnel/session?sessionId=${storedSessionId}`);
            
            // Check if response is OK before parsing
            if (response.ok) {
              const result = await response.json();
              
              if (result.session && !result.expired) {
                setSessionId(storedSessionId);
                setCurrentStepIndex(result.session.currentStepIndex || 0);
                setData(result.session.data || {});
                setIsLoading(false);
                return;
              }
            }
            
            // Session restore failed (expired, not found, or API error) - clear it
            localStorage.removeItem(`funnel_session_${funnel.id}`);
          } catch (restoreErr) {
            // Network error during restore - clear corrupted/stale session and continue
            console.warn('Failed to restore session, creating new one:', restoreErr);
            localStorage.removeItem(`funnel_session_${funnel.id}`);
          }
        } else if (storedSessionId) {
          // Invalid session ID format stored (corrupted) - clear it
          console.warn('Invalid session ID format in localStorage, clearing:', storedSessionId);
          localStorage.removeItem(`funnel_session_${funnel.id}`);
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
  }, [funnel.id, inviteCode, referrerId]);

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

  // Fetch product price when we reach an upsell/downsell step
  useEffect(() => {
    const currentStep = steps[currentStepIndex];
    if (!currentStep || (currentStep.type !== 'upsell' && currentStep.type !== 'downsell')) {
      return;
    }

    const stepConfig = currentStep.config as FunnelStepConfig;
    const config = stepConfig.config as FunnelStepConfigUpsell | FunnelStepConfigDownsell;
    const productId = config.productId;
    const productType = config.productType;

    // Skip if already fetched or if not a program type
    if (productPrices[productId] !== undefined || productType !== 'program') {
      return;
    }

    // Fetch the real program price from the database
    async function fetchProductPrice() {
      try {
        const response = await fetch(`/api/programs/${productId}/price`);
        if (response.ok) {
          const data = await response.json();
          if (data.priceInCents !== undefined) {
            setProductPrices(prev => ({ ...prev, [productId]: data.priceInCents }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch product price:', err);
        // Fall back to config price (already displayed)
      }
    }

    fetchProductPrice();
  }, [currentStepIndex, steps, productPrices]);

  // Validate cohort for upsell/downsell steps with program products
  useEffect(() => {
    async function validateCohorts() {
      const stepsToValidate = steps.filter(step => 
        (step.type === 'upsell' || step.type === 'downsell') &&
        !invalidCohortStepIds.includes(step.id)
      );

      for (const step of stepsToValidate) {
        const stepConfig = step.config as FunnelStepConfig;
        const config = stepConfig.config as FunnelStepConfigUpsell | FunnelStepConfigDownsell;
        
        // Only validate program products (group programs have cohorts)
        if (config.productType !== 'program') continue;
        
        // Check if cohort selection mode is 'specific' with a cohort ID
        const cohortSelectionMode = (config as FunnelStepConfigUpsell).cohortSelectionMode || 'next_available';
        const cohortId = (config as FunnelStepConfigUpsell).cohortId;
        
        if (cohortSelectionMode === 'specific' && cohortId) {
          // Validate that the specific cohort exists and hasn't passed
          try {
            const response = await fetch(`/api/funnel/validate-cohort?cohortId=${cohortId}`);
            if (response.ok) {
              const data = await response.json();
              if (!data.valid) {
                // Cohort is invalid (expired or not found) - mark step to skip
                setInvalidCohortStepIds(prev => [...prev, step.id]);
                console.log(`[FunnelClient] Skipping step ${step.id} - cohort ${cohortId} is invalid: ${data.reason}`);
              }
            }
          } catch (err) {
            console.error(`[FunnelClient] Failed to validate cohort for step ${step.id}:`, err);
          }
        } else if (cohortSelectionMode === 'next_available') {
          // Check if there's any valid upcoming cohort for this program
          try {
            const response = await fetch(`/api/funnel/validate-cohort?programId=${config.productId}&mode=next_available`);
            if (response.ok) {
              const data = await response.json();
              if (!data.valid) {
                // No valid cohorts available - mark step to skip
                setInvalidCohortStepIds(prev => [...prev, step.id]);
                console.log(`[FunnelClient] Skipping step ${step.id} - no valid cohorts for program ${config.productId}`);
              }
            }
          } catch (err) {
            console.error(`[FunnelClient] Failed to validate cohorts for step ${step.id}:`, err);
          }
        }
      }
    }

    validateCohorts();
  }, [steps, invalidCohortStepIds]);

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
      
      // Skip upsell/downsell steps with invalid cohorts
      if ((nextStep.type === 'upsell' || nextStep.type === 'downsell') && invalidCohortStepIds.includes(nextStep.id)) {
        console.log(`[FunnelClient] Skipping step ${nextStep.id} due to invalid cohort`);
        nextIndex++;
        continue;
      }
      
      // Skip downsell steps that aren't linked to a declined upsell
      // (downsells are only shown via direct navigation from upsell decline)
      if (nextStep.type === 'downsell') {
        // Check if any upsell points to this downsell and was declined
        const linkedUpsell = steps.find(s => {
          if (s.type !== 'upsell') return false;
          const upsellConfig = (s.config as FunnelStepConfig & { type: 'upsell' }).config as FunnelStepConfigUpsell;
          return upsellConfig.linkedDownsellStepId === nextStep.id;
        });
        
        // Skip if no upsell links to this or the upsell wasn't declined
        if (!linkedUpsell || !declinedUpsellStepIds.includes(linkedUpsell.id)) {
          nextIndex++;
          continue;
        }
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
          stripeSubscriptionId: finalData.stripeSubscriptionId,
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
    // Include flowSessionId and programId in data for API calls
    const dataWithSession = {
      ...data,
      flowSessionId: sessionId,
      programId: program.id,
    };
    const commonProps = {
      onComplete: handleStepComplete,
      onBack: currentStepIndex > 0 ? handleBack : undefined,
      data: dataWithSession,
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
      
      case 'landing_page': {
        const lpConfig = stepConfig.config as FunnelStepConfigLandingPage;
        return (
          <LandingPageStep 
            {...commonProps} 
            config={{
              ...lpConfig,
              // Auto-populate from program if not set in step config
              programName: lpConfig.programName || program.name,
              programDescription: lpConfig.programDescription || program.description,
              programImageUrl: lpConfig.programImageUrl || program.coverImageUrl,
              priceInCents: lpConfig.priceInCents ?? program.priceInCents,
              durationDays: lpConfig.durationDays ?? program.lengthDays,
              programType: lpConfig.programType || (program.type as 'individual' | 'group'),
              coachName: lpConfig.coachName || program.coachName,
              coachImageUrl: lpConfig.coachImageUrl || program.coachImageUrl,
            }}
          />
        );
      }
      
      case 'upsell': {
        const upsellConfig = stepConfig.config as FunnelStepConfigUpsell;
        const upsellProductPrice = productPrices[upsellConfig.productId];
        return (
          <UpsellStep
            config={upsellConfig}
            flowSessionId={sessionId || ''}
            stepId={currentStep.id}
            productPrice={upsellProductPrice !== undefined ? { priceInCents: upsellProductPrice } : undefined}
            onAccept={(result) => {
              // User accepted the upsell - continue to next step
              handleStepComplete({
                [`upsell_${currentStep.id}_accepted`]: true,
                [`upsell_${currentStep.id}_enrollmentId`]: result.enrollmentId,
              });
            }}
            onDecline={() => {
              // User declined - track it and potentially show linked downsell
              setDeclinedUpsellStepIds(prev => [...prev, currentStep.id]);
              
              // Check if there's a linked downsell
              if (upsellConfig.linkedDownsellStepId) {
                // Find the downsell step and navigate to it
                const downsellStepIndex = steps.findIndex(s => s.id === upsellConfig.linkedDownsellStepId);
                if (downsellStepIndex !== -1) {
                  setCurrentStepIndex(downsellStepIndex);
                  return;
                }
              }
              
              // No linked downsell, continue to next step
              handleStepComplete({
                [`upsell_${currentStep.id}_accepted`]: false,
              });
            }}
          />
        );
      }
      
      case 'downsell': {
        // Only show downsell if its linked upsell was declined
        // (this is handled by the flow logic, but we double-check here)
        const downsellConfig = stepConfig.config as FunnelStepConfigDownsell;
        const downsellProductPrice = productPrices[downsellConfig.productId];
        return (
          <DownsellStep
            config={downsellConfig}
            flowSessionId={sessionId || ''}
            stepId={currentStep.id}
            productPrice={downsellProductPrice !== undefined ? { priceInCents: downsellProductPrice } : undefined}
            onAccept={(result) => {
              handleStepComplete({
                [`downsell_${currentStep.id}_accepted`]: true,
                [`downsell_${currentStep.id}_enrollmentId`]: result.enrollmentId,
              });
            }}
            onDecline={() => {
              handleStepComplete({
                [`downsell_${currentStep.id}_accepted`]: false,
              });
            }}
          />
        );
      }
      
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

  // Check if current step is a landing page (needs full-page rendering)
  const currentStep = steps[currentStepIndex];
  const isLandingPage = currentStep?.type === 'landing_page';
  
  // Get influence prompt for current step (if configured)
  const influencePrompt = currentStep?.influencePrompt;
  const showInfluencePrompt = influencePrompt?.enabled && 
    currentStep?.type !== 'success' && 
    currentStep?.type !== 'landing_page';

  // CSS variable style for dynamic theming
  const themeStyle = {
    '--funnel-primary': branding.primaryColor,
    '--funnel-primary-hover': adjustColor(branding.primaryColor, -15),
  } as React.CSSProperties;

  return (
    <div className="min-h-screen bg-app-bg" style={themeStyle}>
      {/* Pixel Tracker - loads funnel pixels and fires step events */}
      <FunnelPixelTracker
        tracking={funnel.tracking}
        stepTracking={currentStep?.tracking}
        stepIndex={currentStepIndex}
        funnelId={funnel.id}
      />

      {/* Progress bar - hide for landing pages */}
      {!isLandingPage && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-[#e1ddd8] z-50">
          <motion.div
            className="h-full"
            style={{ backgroundColor: 'var(--funnel-primary)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Logo - hide for landing pages */}
      {!isLandingPage && (
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
      )}

      {/* Step content - no padding for landing pages */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={isLandingPage ? '' : 'px-4 pb-8'}
        >
          {stepContent}
          
          {/* Influence Prompt Card - shown at bottom of applicable steps */}
          {showInfluencePrompt && influencePrompt && (
            <div className="max-w-xl mx-auto">
              <InfluencePromptCard 
                config={influencePrompt} 
                stepIndex={currentStepIndex}
                totalSteps={steps.length}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Already Enrolled Modal - shown when user already owns this program */}
      {existingEnrollment && (
        <AlreadyEnrolledModal
          isOpen={showAlreadyEnrolledModal}
          onClose={() => setShowAlreadyEnrolledModal(false)}
          productType="program"
          productName={program.name}
          redirectUrl={existingEnrollment.redirectUrl}
          message={`You are already enrolled in ${program.name}. No need to purchase again!`}
        />
      )}
    </div>
  );
}

