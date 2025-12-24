'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

/**
 * ConditionalSidebar
 * 
 * Wrapper that conditionally renders the Sidebar based on the current route.
 * 
 * Note: The main content padding is now handled via data-layout attribute
 * set during SSR by middleware, which prevents layout shift issues.
 * This component only controls sidebar visibility.
 */
export function ConditionalSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Hide sidebar on onboarding pages
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  
  // Hide sidebar on guest checkout flow (fullscreen experience)
  const isStartPage = pathname?.startsWith('/start');
  
  // Hide sidebar on check-in pages (fullscreen experience)
  const isCheckInPage = pathname?.startsWith('/checkin');
  
  // Hide sidebar on /join pages (unified funnel entry point)
  const isJoinPage = pathname?.startsWith('/join');
  
  // Hide sidebar on /sign-in
  const isSignInPage = pathname?.startsWith('/sign-in');
  
  // Hide sidebar when editing profile in onboarding mode
  const isProfileEditOnboarding = pathname === '/profile' && 
    searchParams?.get('edit') === 'true' && 
    searchParams?.get('fromOnboarding') === 'true';
  
  // Hide sidebar on premium upgrade form (fullscreen experience)
  const isPremiumUpgradeForm = pathname === '/upgrade-premium/form';
  
  // Hide sidebar on coaching intake form (fullscreen experience)
  const isCoachingForm = pathname === '/get-coach/form';
  
  // Hide sidebar on invite pages (fullscreen experience)
  const isInvitePage = pathname?.startsWith('/invite');
  
  const shouldHideSidebar = isOnboardingPage || isStartPage || isCheckInPage || isJoinPage || isSignInPage || isProfileEditOnboarding || isPremiumUpgradeForm || isCoachingForm || isInvitePage;
  
  if (shouldHideSidebar) {
    return null;
  }
  
  return <Sidebar />;
}

