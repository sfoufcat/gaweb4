'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGuestSession } from '@/hooks/useGuestSession';
import { AnalyzingLoader } from '@/components/onboarding/AnalyzingLoader';

/**
 * Guest Analyzing Screen
 * Shows progress while "creating personalized growth plan"
 * Goal summary is already generated during validation, no prefetch needed
 */
export default function GuestAnalyzingPage() {
  const router = useRouter();
  const { saveData, isLoading } = useGuestSession();

  const handleComplete = useCallback(async () => {
    // Save current step and navigate to transformation
    await saveData({ currentStep: 'transformation' });
    router.push('/start/transformation');
  }, [saveData, router]);

  // Set current step on mount
  useEffect(() => {
    if (!isLoading) {
      saveData({ currentStep: 'analyzing' });
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the AnalyzingLoader with 4 second duration
  return <AnalyzingLoader onComplete={handleComplete} duration={4000} />;
}
