'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode } from 'react';

export function ConditionalMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Check if we're on onboarding pages
  const isOnboardingPage = pathname?.startsWith('/onboarding');
  
  // Check if we're on guest checkout flow (fullscreen experience)
  const isStartPage = pathname?.startsWith('/start');
  
  // Check if we're on /begin (signup entry point)
  const isBeginPage = pathname?.startsWith('/begin');
  
  // Check if we're on /sign-in
  const isSignInPage = pathname?.startsWith('/sign-in');
  
  // Check if editing profile in onboarding mode
  const isProfileEditOnboarding = pathname === '/profile' && 
    searchParams?.get('edit') === 'true' && 
    searchParams?.get('fromOnboarding') === 'true';
  
  // Check if on premium upgrade form (fullscreen experience)
  const isPremiumUpgradeForm = pathname === '/upgrade-premium/form';
  
  // Check if on coaching intake form (fullscreen experience)
  const isCoachingForm = pathname === '/get-coach/form';
  
  // Check if we're on check-in pages (fullscreen experience)
  const isCheckInPage = pathname?.startsWith('/checkin');
  
  // Check if on invite pages (fullscreen experience)
  const isInvitePage = pathname?.startsWith('/invite');
  
  const shouldRemovePadding = isOnboardingPage || isStartPage || isCheckInPage || isBeginPage || isSignInPage || isProfileEditOnboarding || isPremiumUpgradeForm || isCoachingForm || isInvitePage;
  
  return (
    <main className={shouldRemovePadding ? 'min-h-screen' : 'lg:pl-64 min-h-screen'}>
      {children}
    </main>
  );
}





