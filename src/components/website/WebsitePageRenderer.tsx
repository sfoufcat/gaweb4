'use client';

import React from 'react';
import { LandingPageRenderer } from '@/components/shared/landing-templates/LandingPageRenderer';
import { WebsiteNav } from './WebsiteNav';
import { WebsiteServicesSection } from './WebsiteServicesSection';
import { WebsiteFooterCTA } from './WebsiteFooterCTA';
import type { OrgWebsite, Funnel } from '@/types';

// Simple branding interface for website rendering
// Can accept either full OrgBranding or simplified ServerBranding
interface WebsiteBranding {
  logoUrl?: string;
  horizontalLogoUrl?: string | null;
  appTitle?: string;
  primaryColor?: string;
  colors?: {
    accentLight?: string;
    accentDark?: string;
  };
}

interface WebsitePageRendererProps {
  website: OrgWebsite;
  branding: WebsiteBranding | null;
  coachName: string;
  coachImageUrl?: string;
  funnels: Array<Pick<Funnel, 'id' | 'slug'> & { programSlug?: string }>;
  subdomain: string;
}

export function WebsitePageRenderer({
  website,
  branding,
  coachName,
  coachImageUrl,
  funnels,
  subdomain,
}: WebsitePageRendererProps) {
  // Get accent color from branding - supports both OrgBranding and ServerBranding
  const accentLight = branding?.colors?.accentLight || branding?.primaryColor || '#a07855';
  const accentDark = branding?.colors?.accentDark || branding?.primaryColor || '#b8896a';

  // Build funnel URLs map
  const funnelUrls: Record<string, string> = {};
  funnels.forEach((funnel) => {
    // Build the join URL for this funnel
    // Format: /join/[programSlug]/[funnelSlug] or just /join/default/[funnelSlug]
    const programSlug = funnel.programSlug || 'default';
    funnelUrls[funnel.id] = `/join/${programSlug}/${funnel.slug}`;
  });

  // Get hero CTA URL
  const heroCtaUrl = website.heroCtaFunnelId
    ? funnelUrls[website.heroCtaFunnelId] || '/join'
    : '/join';

  // Get footer CTA URL (defaults to hero CTA)
  const footerCtaUrl = website.ctaFunnelId
    ? funnelUrls[website.ctaFunnelId] || heroCtaUrl
    : heroCtaUrl;

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <WebsiteNav
        branding={branding}
        showSignIn={website.showSignIn}
        signInButtonText={website.signInButtonText || 'Sign In'}
        joinButtonText={website.heroCtaText || 'Get Started'}
        joinUrl={heroCtaUrl}
        accentColor={accentLight}
      />

      {/* Spacer for fixed nav */}
      <div className="h-16" />

      {/* Main Landing Page Content - reuses existing templates */}
      <LandingPageRenderer
        template={website.template}
        headline={website.heroHeadline}
        subheadline={website.heroSubheadline}
        programImageUrl={website.heroImageUrl}
        coachName={coachName}
        coachImageUrl={coachImageUrl}
        coachBio={website.coachBio}
        keyOutcomes={website.coachBullets} // Credentials as outcomes
        features={[]} // Services shown separately below
        testimonials={website.testimonials}
        faqs={website.faqs}
        ctaText={website.heroCtaText || 'Get Started'}
        showTestimonials={website.testimonials.length > 0}
        showFAQ={website.faqs.length > 0}
        showPrice={false} // Website doesn't show price
        onCTA={() => {
          // Navigate to funnel
          window.location.href = heroCtaUrl;
        }}
        accentLight={accentLight}
        accentDark={accentDark}
      />

      {/* Services Section - shown after main content */}
      <WebsiteServicesSection
        headline={website.servicesHeadline || 'What I Offer'}
        services={website.services}
        funnelUrls={funnelUrls}
        accentColor={accentLight}
      />

      {/* Footer CTA */}
      <WebsiteFooterCTA
        headline={website.ctaHeadline}
        subheadline={website.ctaSubheadline}
        buttonText={website.ctaButtonText || website.heroCtaText || 'Get Started'}
        url={footerCtaUrl}
        accentColor={accentLight}
      />

      {/* Simple Footer */}
      <footer className="py-8 bg-[#faf8f6] dark:bg-[#05070b] border-t border-[#e1ddd8] dark:border-[#262b35]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-[#5f5a55] dark:text-[#7d8190] font-albert">
            © {new Date().getFullYear()} {branding?.appTitle || coachName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
