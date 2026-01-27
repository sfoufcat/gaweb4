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
  FunnelStepConfigAnalyzing,
  FunnelStepConfigInfo,
  FunnelStepConfigExplainer,
  FunnelStepConfigLandingPage,
  FunnelStepConfigSuccess,
  FunnelContentType,
} from '@/types';

// Step components
import { QuestionStep } from '@/components/funnel/steps/QuestionStep';
import { SignupStep } from '@/components/funnel/steps/SignupStep';
import { PaymentStep } from '@/components/funnel/steps/PaymentStep';
import { AnalyzingStep } from '@/components/funnel/steps/AnalyzingStep';
import { ExplainerStep } from '@/components/funnel/steps/ExplainerStep';
import { LandingPageStep } from '@/components/funnel/steps/LandingPageStep';
import { InfoStep } from '@/components/funnel/steps/InfoStep';
import { SuccessStep } from '@/components/funnel/steps/SuccessStep';
import { InfluencePromptCard } from '@/components/funnel/InfluencePromptCard';
import { FunnelPixelTracker } from '@/components/funnel/FunnelPixelTracker';
import { AlreadyEnrolledModal, ProductType } from '@/components/AlreadyEnrolledModal';

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

interface ContentFunnelClientProps {
  funnel: Funnel;
  steps: FunnelStep[];
  content: {
    id: string;
    type: FunnelContentType;
    title: string;
    description: string;
    coverImageUrl?: string;
    priceInCents: number;
    currency: string;
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
  } | null;
  hostname: string;
  tenantSubdomain?: string | null;
  referrerId?: string;
  /** Existing purchase if user already owns this content */
  existingPurchase?: {
    id: string;
    redirectUrl: string;
  } | null;
}

interface FlowSessionData {
  [key: string]: unknown;
}

export default function ContentFunnelClient({
  funnel,
  steps,
  content,
  branding,
  organization,
  inviteCode,
  validatedInvite,
  hostname,
  tenantSubdomain,
  referrerId,
  existingPurchase,
}: ContentFunnelClientProps) {
  const router = useRouter();
  const { isSignedIn, userId, isLoaded } = useAuth();
  
  // Flow session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<FlowSessionData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Already purchased modal state
  const [showAlreadyPurchasedModal, setShowAlreadyPurchasedModal] = useState(!!existingPurchase);

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

  // Complete funnel and grant content access
  const completeFunnel = useCallback(async (finalData: FlowSessionData, redirectUrl?: string) => {
    try {
      // Grant content access (if payment was successful or free)
      const response = await fetch('/api/content/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: content.type,
          contentId: content.id,
          sessionId,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        console.error('Failed to grant content access:', result.error);
      }

      // Mark funnel as completed
      await updateSession({ completedStepIndex: steps.length - 1 });

      // Clear session from localStorage
      localStorage.removeItem(`funnel_session_${funnel.id}`);

      // Redirect
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        // Default: redirect to the content page
        router.push(`/discover/${content.type}s/${content.id}?purchased=true`);
      }
    } catch (err) {
      console.error('Error completing funnel:', err);
    }
  }, [content.id, content.type, funnel.id, router, sessionId, steps.length, updateSession]);

  // Handle step completion
  const handleStepComplete = useCallback(async (stepData: Record<string, unknown>) => {
    const newData = { ...data, ...stepData };
    setData(newData);

    await updateSession({
      completedStepIndex: currentStepIndex,
      data: stepData,
    });

    // Find next step
    let nextIndex = currentStepIndex + 1;
    
    while (nextIndex < steps.length) {
      const nextStep = steps[nextIndex];
      
      // Skip payment step if pre-paid
      if (nextStep.type === 'payment' && skipPayment) {
        nextIndex++;
        continue;
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
            shouldShow = Array.isArray(nextStep.showIf.value) && 
              nextStep.showIf.value.includes(fieldValue as string);
            break;
          case 'nin':
            shouldShow = Array.isArray(nextStep.showIf.value) && 
              !nextStep.showIf.value.includes(fieldValue as string);
            break;
          default:
            shouldShow = true;
        }
        
        if (!shouldShow) {
          nextIndex++;
          continue;
        }
      }
      
      break;
    }

    if (nextIndex >= steps.length) {
      // All steps completed
      await completeFunnel(newData);
      return;
    }

    // Move to next step
    setIsNavigating(true);
    setCurrentStepIndex(nextIndex);
    await updateSession({ currentStepIndex: nextIndex });
    
    setTimeout(() => setIsNavigating(false), 300);
  }, [data, currentStepIndex, steps, skipPayment, updateSession, completeFunnel]);

  // Handle back navigation
  const handleBack = useCallback(async () => {
    if (currentStepIndex > 0) {
      setIsNavigating(true);
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      await updateSession({ currentStepIndex: newIndex });
      setTimeout(() => setIsNavigating(false), 300);
    }
  }, [currentStepIndex, updateSession]);

  // Render current step
  const renderStep = () => {
    if (steps.length === 0) {
      return (
        <div className="text-center p-8">
          <p className="text-text-secondary">This funnel has no steps configured.</p>
        </div>
      );
    }

    const step = steps[currentStepIndex];
    if (!step) return null;

    const stepConfig = step.config as FunnelStepConfig;
    const config = stepConfig.config;

    // Build program-like object for payment step
    const contentAsProgram = {
      id: content.id,
      name: content.title,
      slug: content.id,
      description: content.description,
      coverImageUrl: content.coverImageUrl,
      type: 'content' as const,
      lengthDays: 0,
      priceInCents: content.priceInCents,
      currency: content.currency,
      coachName: content.coachName,
      coachImageUrl: content.coachImageUrl,
    };

    switch (step.type) {
      case 'question':
        return (
          <QuestionStep
            config={config as FunnelStepConfigQuestion}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
            data={data}
            isFirstStep={currentStepIndex === 0}
          />
        );

      case 'signup':
        return (
          <SignupStep
            config={config as FunnelStepConfigSignup}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
            data={data}
            branding={branding}
            hostname={hostname}
            flowSessionId={sessionId || ''}
            isFirstStep={currentStepIndex === 0}
            organizationId={organization.id}
            organizationName={organization.name}
            tenantSubdomain={tenantSubdomain}
          />
        );

      case 'payment':
        return (
          <PaymentStep
            config={config as FunnelStepConfigPayment}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
            data={data}
            program={contentAsProgram}
            skipPayment={skipPayment}
            isFirstStep={currentStepIndex === 0}
            organizationId={organization.id}
          />
        );

      case 'analyzing':
        return (
          <AnalyzingStep
            config={config as FunnelStepConfigAnalyzing}
            onComplete={handleStepComplete}
            data={data}
          />
        );

      case 'info':
        return (
          <InfoStep
            config={config as FunnelStepConfigInfo}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
            isFirstStep={currentStepIndex === 0}
          />
        );

      case 'explainer':
        return (
          <ExplainerStep
            config={config as FunnelStepConfigExplainer}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
            isFirstStep={currentStepIndex === 0}
          />
        );

      case 'landing_page':
        return (
          <LandingPageStep
            config={config as FunnelStepConfigLandingPage}
            onComplete={handleStepComplete}
            onBack={currentStepIndex > 0 ? handleBack : undefined}
          />
        );

      case 'success':
        return (
          <SuccessStep
            config={config as FunnelStepConfigSuccess}
            onComplete={() => completeFunnel(data)}
            program={contentAsProgram}
            branding={branding}
          />
        );

      default:
        return (
          <div className="text-center p-8">
            <p className="text-text-secondary">Unknown step type: {step.type}</p>
            <button
              onClick={() => handleStepComplete({})}
              className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-lg"
            >
              Continue
            </button>
          </div>
        );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary dark:text-[#b2b6c2] font-albert text-[14px]">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-text-primary dark:text-[#f5f5f8] mb-4">Something went wrong</h1>
          <p className="text-text-secondary dark:text-[#b2b6c2] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Get current step for influence prompt
  const currentStep = steps[currentStepIndex];
  const influencePrompt = currentStep?.influencePrompt;

  // Progress calculation
  const progress = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div
      className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex flex-col"
      style={{
        '--primary-color': branding.primaryColor,
        '--primary-color-light': adjustColor(branding.primaryColor, 10),
        '--primary-color-dark': adjustColor(branding.primaryColor, -10),
        // Set brand accent variables for components that use bg-brand-accent (SignUpForm, etc.)
        '--brand-accent-light': branding.primaryColor,
        '--brand-accent-dark': adjustColor(branding.primaryColor, -15),
      } as React.CSSProperties}
    >
      {/* Pixel Tracker */}
      <FunnelPixelTracker
        tracking={funnel.tracking}
        stepTracking={currentStep?.tracking}
        stepIndex={currentStepIndex}
        funnelId={funnel.id}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {branding.logoUrl && (
              <Image
                src={branding.logoUrl}
                alt={branding.appTitle}
                width={32}
                height={32}
                className="rounded-lg"
              />
            )}
            <span className="font-albert font-semibold text-text-primary dark:text-[#f5f5f8] text-[15px]">
              {branding.appTitle}
            </span>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted dark:text-[#7f8694]">
              {currentStepIndex + 1} of {steps.length}
            </span>
            <div className="w-20 h-1.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: branding.primaryColor }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        {/* Influence Prompt */}
        {influencePrompt?.enabled && (
          <div className="max-w-3xl mx-auto w-full px-4 pt-4">
            <InfluencePromptCard
              config={influencePrompt}
              stepIndex={currentStepIndex}
              totalSteps={steps.length}
            />
          </div>
        )}

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepIndex}
            initial={{ opacity: 0, x: isNavigating ? 50 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isNavigating ? -50 : 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <p className="text-xs text-text-muted dark:text-[#7f8694]">
          Powered by {branding.appTitle}
        </p>
      </footer>

      {/* Already Purchased Modal - shown when user already owns this content */}
      {existingPurchase && (
        <AlreadyEnrolledModal
          isOpen={showAlreadyPurchasedModal}
          onClose={() => setShowAlreadyPurchasedModal(false)}
          productType={content.type as ProductType}
          productName={content.title}
          redirectUrl={existingPurchase.redirectUrl}
          message={`You already own ${content.title}. No need to purchase again!`}
        />
      )}
    </div>
  );
}

