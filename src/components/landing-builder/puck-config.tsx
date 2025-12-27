'use client';

import type { Config } from '@measured/puck';
import type { ReactNode } from 'react';
import {
  HeroConfig,
  VideoConfig,
  TestimonialsConfig,
  FeaturesConfig,
  CountdownConfig,
  PricingConfig,
  FAQConfig,
  CoachBioConfig,
  CTABannerConfig,
  StatsConfig,
  GuaranteeConfig,
  LogoCloudConfig,
  SpacerConfig,
  RichTextConfig,
} from './sections';

// Root props type
interface RootProps {
  children: ReactNode;
  backgroundColor?: string;
}

// Define the component configuration for Puck
export const landingPageConfig: Config = {
  // Root configuration for global page settings
  root: {
    fields: {
      backgroundColor: {
        type: 'text',
        label: 'Background Color (CSS)',
      },
    },
    defaultProps: {
      backgroundColor: '',
    },
    render: (props: RootProps) => {
      const { children, backgroundColor } = props;
      return (
        <div 
          className="min-h-screen"
          style={{ backgroundColor: backgroundColor || undefined }}
        >
          {children}
        </div>
      );
    },
  },
  
  // Component configurations
  components: {
    Hero: HeroConfig,
    Video: VideoConfig,
    Testimonials: TestimonialsConfig,
    Features: FeaturesConfig,
    Countdown: CountdownConfig,
    Pricing: PricingConfig,
    FAQ: FAQConfig,
    CoachBio: CoachBioConfig,
    CTABanner: CTABannerConfig,
    Stats: StatsConfig,
    Guarantee: GuaranteeConfig,
    LogoCloud: LogoCloudConfig,
    Spacer: SpacerConfig,
    RichText: RichTextConfig,
  },
  
  // Categories for organizing components in the sidebar
  categories: {
    layout: {
      title: 'Layout',
      components: ['Spacer'],
    },
    hero: {
      title: 'Hero & Headers',
      components: ['Hero', 'CTABanner'],
    },
    media: {
      title: 'Media',
      components: ['Video'],
    },
    content: {
      title: 'Content',
      components: ['Features', 'RichText', 'Stats'],
    },
    social: {
      title: 'Social Proof',
      components: ['Testimonials', 'LogoCloud'],
    },
    conversion: {
      title: 'Conversion',
      components: ['Pricing', 'Countdown', 'Guarantee'],
    },
    about: {
      title: 'About',
      components: ['CoachBio', 'FAQ'],
    },
  },
};

export type LandingPageConfig = typeof landingPageConfig;

