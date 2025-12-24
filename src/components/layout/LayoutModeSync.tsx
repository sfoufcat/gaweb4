'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * LayoutModeSync
 * 
 * Syncs the data-layout attribute on <body> based on current pathname.
 * This ensures the correct layout mode is set during:
 * - Initial hydration (safety net for SSR timing issues)
 * - Client-side navigation (RootLayout doesn't re-render on navigation)
 * 
 * This component acts as a "safety net" that ensures the body attribute
 * is always correct, preventing layout shift issues.
 */
export function LayoutModeSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Determine if this is a fullscreen page (same logic as middleware)
    const isProfileEditOnboarding = pathname === '/profile' && 
      searchParams.get('edit') === 'true' && 
      searchParams.get('fromOnboarding') === 'true';
    
    const isFullscreenPage = 
      pathname?.startsWith('/onboarding') ||
      pathname?.startsWith('/start') ||
      pathname?.startsWith('/checkin') ||
      pathname?.startsWith('/join') ||
      pathname?.startsWith('/sign-in') ||
      pathname === '/upgrade-premium/form' ||
      pathname === '/get-coach/form' ||
      pathname?.startsWith('/invite') ||
      isProfileEditOnboarding;
    
    const layoutMode = isFullscreenPage ? 'fullscreen' : 'with-sidebar';
    
    // Update body attribute immediately
    document.body.setAttribute('data-layout', layoutMode);
  }, [pathname, searchParams]);
  
  return null; // This component renders nothing
}

