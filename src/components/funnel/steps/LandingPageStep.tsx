'use client';

import type { FunnelStepConfigLandingPage } from '@/types';
import { LandingPageRenderer } from '@/components/shared/landing-templates';
import { useBranding } from '@/contexts/BrandingContext';

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
  const { branding } = useBranding();
  
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
      programName={config.programName}
      programDescription={config.programDescription}
      programImageUrl={config.programImageUrl}
      coachName={config.coachName}
      coachImageUrl={config.coachImageUrl}
      coachBio={config.coachBio}
      keyOutcomes={config.keyOutcomes}
      features={config.features}
      testimonials={config.testimonials}
      faqs={config.faqs}
      ctaText={config.ctaText || 'Continue'}
      ctaSubtext={config.ctaSubtext}
      showTestimonials={config.showTestimonials}
      showFAQ={config.showFAQ}
      showPrice={config.showPrice !== false} // Default true if not explicitly set to false
      onCTA={handleCTA}
      // Program display props
      priceInCents={config.priceInCents}
      durationDays={config.durationDays}
      enrolledCount={config.enrolledCount}
      programType={config.programType}
      // Brand accent colors from coach's organization
      accentLight={branding.colors.accentLight}
      accentDark={branding.colors.accentDark}
    />
  );
}
