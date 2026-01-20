'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { WebsiteNav, NavLink } from './WebsiteNav';
import {
  WebsiteClassicTemplate,
  WebsiteModernTemplate,
  WebsiteMinimalTemplate,
} from './templates';
import type { OrgWebsite, Funnel, WebsiteService } from '@/types';

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

export interface WebsitePageRendererProps {
  website: OrgWebsite;
  branding: WebsiteBranding | null;
  coachName: string;
  coachImageUrl?: string;
  funnels: Array<Pick<Funnel, 'id' | 'slug'> & { programSlug?: string; url?: string }>;
  subdomain: string;
  isPreviewMode?: boolean;
}

export function WebsitePageRenderer({
  website,
  branding,
  coachName,
  coachImageUrl,
  funnels,
  subdomain,
  isPreviewMode = false,
}: WebsitePageRendererProps) {
  const router = useRouter();

  // Get accent color from branding - supports both OrgBranding and ServerBranding
  const accentLight = branding?.colors?.accentLight || branding?.primaryColor || '#a07855';
  const accentDark = branding?.colors?.accentDark || branding?.primaryColor || '#8b6544';

  // Build funnel URLs map from pre-computed URLs
  const funnelUrls: Record<string, string> = {};
  funnels.forEach((funnel) => {
    if (funnel.url) {
      funnelUrls[funnel.id] = funnel.url;
    }
  });

  // Get hero CTA URL
  // Priority: 1) Funnel URL if heroCtaFunnelId is set and found
  //           2) /sign-in as fallback
  let heroCtaUrl = '/sign-in';
  if (website.heroCtaFunnelId) {
    // Check if it's a special value or an actual funnel ID
    if (website.heroCtaFunnelId === 'signup' || website.heroCtaFunnelId === 'sign-in') {
      heroCtaUrl = '/sign-in';
    } else if (funnelUrls[website.heroCtaFunnelId]) {
      heroCtaUrl = funnelUrls[website.heroCtaFunnelId];
    } else {
      // Funnel ID set but not found - log warning and fallback
      console.warn(`[WebsitePageRenderer] heroCtaFunnelId ${website.heroCtaFunnelId} not found in funnels, falling back to /sign-in`);
      heroCtaUrl = '/sign-in';
    }
  }

  // Handle service click - navigate to funnel
  const handleServiceClick = (service: WebsiteService) => {
    if (service.funnelId && funnelUrls[service.funnelId]) {
      router.push(funnelUrls[service.funnelId]);
    }
  };

  // Build navigation links based on available sections
  const navLinks: NavLink[] = React.useMemo(() => {
    const links: NavLink[] = [];
    if (website.coachBio || (website.coachBullets && website.coachBullets.length > 0)) {
      links.push({ label: 'About', href: '#about' });
    }
    if (website.services && website.services.length > 0) {
      links.push({ label: 'Services', href: '#services' });
    }
    if (website.testimonials && website.testimonials.length > 0) {
      links.push({ label: 'Testimonials', href: '#testimonials' });
    }
    if (website.faqs && website.faqs.length > 0) {
      links.push({ label: 'FAQ', href: '#faq' });
    }
    return links;
  }, [website.coachBio, website.coachBullets, website.services, website.testimonials, website.faqs]);

  // Determine if nav should be dark (for modern template)
  const isDarkNav = website.template === 'modern';

  // Select template based on website settings
  const renderTemplate = () => {
    const commonProps = {
      headline: website.heroHeadline,
      subheadline: website.heroSubheadline,
      heroImageUrl: website.heroImageUrl,
      ctaText: website.heroCtaText || 'Get Started',
      ctaUrl: heroCtaUrl,
      coachName: coachName,
      coachImageUrl: coachImageUrl,
      coachBio: website.coachBio,
      coachHeadline: website.coachHeadline,
      credentials: website.coachBullets || [],
      services: website.services || [],
      testimonials: website.testimonials || [],
      faqs: website.faqs || [],
      accentLight,
      accentDark,
      onServiceClick: handleServiceClick,
      // Transformation section props
      transformationHeadline: website.transformationHeadline,
      transformationSteps: website.transformationSteps,
      transformationImageUrl: website.transformationImageUrl,
      // Footer props
      footerCompanyName: website.footerCompanyName || branding?.appTitle,
      footerTagline: website.footerTagline,
      footerEmail: website.footerEmail,
      footerPhone: website.footerPhone,
      footerAddress: website.footerAddress,
      logoUrl: branding?.horizontalLogoUrl || branding?.logoUrl,
    };

    switch (website.template) {
      case 'modern':
        return <WebsiteModernTemplate {...commonProps} />;
      case 'minimal':
        return <WebsiteMinimalTemplate {...commonProps} />;
      case 'classic':
      default:
        return <WebsiteClassicTemplate {...commonProps} />;
    }
  };

  return (
    <>
      {/* Preview Mode Banner */}
      {isPreviewMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
          <span>Preview Mode</span>
          <span className="mx-2">•</span>
          <span className="opacity-90">This is how visitors will see your website</span>
          <a
            href="/coach?tab=website"
            className="ml-3 underline hover:no-underline"
          >
            Back to Editor
          </a>
        </div>
      )}

      {/* Navigation */}
      <WebsiteNav
        branding={branding}
        showSignIn={website.showSignIn}
        signInButtonText={website.signInButtonText || 'Sign In'}
        joinButtonText={website.heroCtaText || 'Get Started'}
        joinUrl={heroCtaUrl}
        accentColor={accentLight}
        isPreviewMode={isPreviewMode}
        navLinks={navLinks}
        isDark={isDarkNav}
      />

      {/* Website Template Content (includes rich footer) */}
      {renderTemplate()}
    </>
  );
}
