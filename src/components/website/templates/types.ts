import type { ProgramTestimonial, ProgramFAQ, WebsiteService, TransformationStep } from '@/types';

// Simplified program type for website display
export interface WebsiteProgram {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  priceInCents?: number;
}

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
  servicesHeadline?: string;
  servicesSubheadline?: string;

  // Programs/Insights section
  programs?: WebsiteProgram[];
  programsHeadline?: string;
  programsSubheadline?: string;

  // Transformation/Journey section
  transformationHeadline?: string;
  transformationSteps?: TransformationStep[];
  transformationImageUrl?: string;

  // Social Proof
  testimonials: ProgramTestimonial[];
  testimonialsHeadline?: string;
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
  onProgramClick?: (program: WebsiteProgram) => void;
}
