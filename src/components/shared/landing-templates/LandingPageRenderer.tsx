'use client';

import type { LandingPageTemplateName, ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';
import { ClassicTemplate } from './ClassicTemplate';
import { ModernTemplate } from './ModernTemplate';
import { MinimalTemplate } from './MinimalTemplate';

export interface LandingPageRendererProps {
  template: LandingPageTemplateName;
  headline?: string;
  subheadline?: string;
  programName?: string;
  programDescription?: string;
  programImageUrl?: string;
  coachName?: string;
  coachImageUrl?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  showPrice?: boolean; // Default true - only used in funnel LPs to optionally hide price
  onCTA?: () => void;
  // Program display props
  priceInCents?: number;
  durationDays?: number;
  enrolledCount?: number;
  programType?: 'individual' | 'group';
  // Brand accent colors
  accentLight?: string;
  accentDark?: string;
}

export function LandingPageRenderer({
  template,
  ...props
}: LandingPageRendererProps) {
  switch (template) {
    case 'modern':
      return <ModernTemplate {...props} />;
    case 'minimal':
      return <MinimalTemplate {...props} />;
    case 'classic':
    default:
      return <ClassicTemplate {...props} />;
  }
}
