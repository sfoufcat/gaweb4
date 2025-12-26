'use client';

import type { FunnelStepConfigLandingPage } from '@/types';
import { LandingPageViewer } from '@/components/landing-builder';
import { Button } from '@/components/ui/button';
import { type Data } from '@measured/puck';

export interface LandingPageStepProps {
  config: FunnelStepConfigLandingPage;
  onComplete: (stepData: Record<string, unknown>) => void;
  onBack?: () => void;
  isNavigating?: boolean;
  isSubmitting?: boolean;
}

/**
 * Landing Page Step - Displays a full landing page built with Puck
 * Used in funnels to show rich, customizable landing pages
 */
export function LandingPageStep({
  config,
  onComplete,
  isNavigating = false,
}: LandingPageStepProps) {
  const { puckData, settings } = config;

  // Background style based on settings
  const backgroundStyle = settings?.backgroundColor
    ? { backgroundColor: settings.backgroundColor }
    : undefined;

  // Max width container class
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    full: 'max-w-full',
  };
  const maxWidthClass = settings?.maxWidth
    ? maxWidthClasses[settings.maxWidth]
    : '';

  // Check if there's a CTA in the landing page or if we need to show a continue button
  const hasCTASection = puckData?.content?.some(
    (item) => item.type === 'CTABanner' || item.type === 'Hero'
  );

  const handleContinue = () => {
    onComplete({});
  };

  return (
    <div className="min-h-screen" style={backgroundStyle}>
      <div className={`mx-auto ${maxWidthClass}`}>
        {/* Render the landing page */}
        <LandingPageViewer data={puckData as Data} />

        {/* Fallback continue button if no CTA sections */}
        {!hasCTASection && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border">
            <div className="max-w-md mx-auto">
              <Button
                onClick={handleContinue}
                disabled={isNavigating}
                className="w-full py-6 text-lg font-semibold bg-[#a07855] hover:bg-[#8c6245]"
              >
                {isNavigating ? 'Loading...' : 'Continue'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
