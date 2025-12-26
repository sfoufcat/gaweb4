'use client';

import type { FunnelStepConfigLandingPage } from '@/types';
import { LandingPageRenderer } from '@/components/shared/landing-templates';

export interface LandingPageStepProps {
  config: FunnelStepConfigLandingPage;
  onComplete: (stepData: Record<string, unknown>) => void;
  onBack?: () => void;
  isNavigating?: boolean;
  isSubmitting?: boolean;
}

/**
 * Landing Page Step - Displays a full landing page using templates
 * Used in funnels to show rich, customizable landing pages
 */
export function LandingPageStep({
  config,
  onComplete,
  isNavigating = false,
}: LandingPageStepProps) {
  const handleCTA = () => {
    if (!isNavigating) {
      onComplete({});
    }
  };

  return (
    <LandingPageRenderer
      template={config.template || 'classic'}
      headline={config.headline}
      subheadline={config.subheadline}
      coachBio={config.coachBio}
      keyOutcomes={config.keyOutcomes}
      features={config.features}
      testimonials={config.testimonials}
      faqs={config.faqs}
      ctaText={config.ctaText || 'Continue'}
      ctaSubtext={config.ctaSubtext}
      showTestimonials={config.showTestimonials}
      showFAQ={config.showFAQ}
      onCTA={handleCTA}
    />
  );
}
