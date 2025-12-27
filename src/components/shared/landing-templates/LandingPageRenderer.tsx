'use client';

import type { LandingPageTemplate, ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';
import { ClassicTemplate } from './ClassicTemplate';
import { ModernTemplate } from './ModernTemplate';
import { MinimalTemplate } from './MinimalTemplate';

export interface LandingPageRendererProps {
  template: LandingPageTemplate;
  headline?: string;
  subheadline?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  onCTA?: () => void;
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


