'use client';

import { useParams, useRouter } from 'next/navigation';
import { OrgOnboardingFlowRenderer } from '@/components/onboarding/OrgOnboardingFlowRenderer';

/**
 * Onboarding Flow Preview Page
 *
 * Allows coaches to preview their onboarding flow before enabling it.
 * Opens in a new tab from the coach settings page.
 */
export default function OnboardingPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.flowId as string;

  const handleComplete = () => {
    // In preview mode, just close the tab or go back
    window.close();
    // Fallback if window.close doesn't work (e.g., not opened via JS)
    router.back();
  };

  const handleClose = () => {
    window.close();
    // Fallback
    router.back();
  };

  if (!flowId) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <p className="text-text-secondary">No flow ID provided</p>
      </div>
    );
  }

  return (
    <OrgOnboardingFlowRenderer
      flowId={flowId}
      isPreview={true}
      onComplete={handleComplete}
      onClose={handleClose}
    />
  );
}
