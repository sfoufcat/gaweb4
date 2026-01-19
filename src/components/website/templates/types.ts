import type { ProgramTestimonial, ProgramFAQ, WebsiteService } from '@/types';

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

  // Social Proof
  testimonials: ProgramTestimonial[];
  faqs: ProgramFAQ[];

  // Styling
  accentLight?: string;
  accentDark?: string;

  // Callbacks
  onServiceClick?: (service: WebsiteService) => void;
}
