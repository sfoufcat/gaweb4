'use client';

import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { OrgOnboardingFlowRenderer } from '@/components/onboarding/OrgOnboardingFlowRenderer';

/**
 * Org Onboarding Flow Page (User-facing)
 *
 * Shows the coach's custom onboarding flow to new users.
 * This is the actual onboarding experience, not the preview.
 *
 * After completion, redirects to dashboard.
 */
export default function OrgOnboardingFlowPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const flowId = params.flowId as string;
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-in');
      return;
    }
    if (isLoaded && user) {
      setIsCheckingAuth(false);
    }
  }, [isLoaded, user, router]);

  const handleComplete = async () => {
    // Mark onboarding as completed and redirect to dashboard
    try {
      await fetch('/api/user/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasCompletedOnboarding: true,
          onboardingStatus: 'completed'
        }),
      });
    } catch (error) {
      console.error('Failed to mark onboarding as completed:', error);
    }

    router.push('/');
  };

  const handleClose = () => {
    // User wants to skip - go to dashboard anyway
    router.push('/');
  };

  if (!isLoaded || isCheckingAuth) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
        </div>
      </div>
    );
  }

  if (!flowId) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <p className="text-text-secondary">No onboarding flow configured</p>
      </div>
    );
  }

  return (
    <OrgOnboardingFlowRenderer
      flowId={flowId}
      isPreview={false}
      onComplete={handleComplete}
      onClose={handleClose}
    />
  );
}
