'use client';

import { useEffect, useState } from 'react';
import { CoachLandingPage } from '@/components/lp/CoachLandingPage';
import { DashboardPage } from '@/components/dashboard/DashboardPage';

/**
 * Homepage - Dynamic based on domain
 * 
 * - Marketing domain (coachful.co): Shows CoachLandingPage
 * - Tenant domains (*.coachful.co): Shows Dashboard
 */
export default function HomePage() {
  const [isMarketingDomain, setIsMarketingDomain] = useState<boolean | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    // Only show landing page on actual marketing domain
    // Localhost and tenant subdomains should show dashboard
    const isMarketing = 
      hostname === 'coachful.co' || 
      hostname === 'www.coachful.co';
    
    setIsMarketingDomain(isMarketing);
    
    // Set layout mode based on domain
    if (isMarketing) {
      document.body.setAttribute('data-layout', 'fullscreen');
    }
  }, []);

  // Show nothing while determining domain
  if (isMarketingDomain === null) {
    return null;
  }

  // Marketing domain: Show landing page
  if (isMarketingDomain) {
    return <CoachLandingPage />;
  }

  // Tenant domain: Show dashboard
  return <DashboardPage />;
}
