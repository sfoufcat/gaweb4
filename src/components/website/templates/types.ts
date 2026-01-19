import type { ProgramTestimonial, ProgramFAQ, WebsiteService, TransformationStep } from '@/types';

export interface WebsiteTemplateProps {
  // Hero
  headline: string;
  subheadline: string;
  heroImageUrl?: string;
  ctaText: string;
  ctaUrl: string;

  // Coach/About
  coachName: string;
  coachImageUrl?: string;
  coachBio: string;
  coachHeadline?: string;
  credentials: string[];

  // Services
  services: WebsiteService[];

  // Transformation/Journey section
  transformationHeadline?: string;
  transformationSteps?: TransformationStep[];
  transformationImageUrl?: string;

  // Social Proof
  testimonials: ProgramTestimonial[];
  faqs: ProgramFAQ[];

  // Footer
  footerCompanyName?: string;
  footerTagline?: string;
  footerEmail?: string;
  footerPhone?: string;
  footerAddress?: string;
  logoUrl?: string;

  // Styling
  accentLight?: string;
  accentDark?: string;

  // Callbacks
  onServiceClick?: (service: WebsiteService) => void;
}
