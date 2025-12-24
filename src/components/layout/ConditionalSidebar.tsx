'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

/**
 * ConditionalSidebar
 * 
 * Wrapper that conditionally renders the Sidebar based on the current route.
 * When rendered, it includes a data-sidebar attribute that CSS uses to
 * automatically apply the correct padding to the main content area.
 * 
 * This approach avoids layout shift by using CSS :has() selector
 * instead of client-side JavaScript to determine padding.
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
  
  // Wrapper div with data-sidebar attribute for CSS :has() detection
  return (
    <div data-sidebar>
      <Sidebar />
    </div>
  );
}

