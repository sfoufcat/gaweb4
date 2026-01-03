'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Component, ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';

// Error boundary to catch sidebar rendering errors
class SidebarErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SidebarErrorBoundary] Sidebar rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      console.error('[SidebarErrorBoundary] Error caught:', this.state.error?.message);
      return null; // Don't crash the page, just hide sidebar
    }
    return this.props.children;
  }
}

interface ConditionalSidebarProps {
  layoutMode?: string;
}

/**
 * ConditionalSidebar
 * 
 * Wrapper that conditionally renders the Sidebar based on the current route.
 * 
 * Note: The main content padding is now handled via data-layout attribute
 * set during SSR by middleware, which prevents layout shift issues.
 * This component only controls sidebar visibility.
 * 
 * The layoutMode prop is passed from RootLayout (set by proxy middleware)
 * to prevent flash of sidebar on fullscreen pages like marketing domain.
 */
export function ConditionalSidebar({ layoutMode }: ConditionalSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Debug logging for sidebar visibility issues
  useEffect(() => {
    console.log('[ConditionalSidebar] Debug:', {
      layoutMode,
      pathname,
      hostname: typeof window !== 'undefined' ? window.location.hostname : 'ssr',
    });
  }, [layoutMode, pathname]);
  
  // SSR-based check: If middleware determined this is fullscreen mode, don't render sidebar
  // This prevents flash on marketing domain and other fullscreen pages
  // Default to showing sidebar if layoutMode is undefined (defensive)
  if (layoutMode === 'fullscreen') {
    console.log('[ConditionalSidebar] Hiding: layoutMode is fullscreen');
    return null;
  }
  
  // If layoutMode is undefined or unexpected, log it but still show sidebar
  if (!layoutMode || (layoutMode !== 'with-sidebar' && layoutMode !== 'fullscreen')) {
    console.warn('[ConditionalSidebar] Unexpected layoutMode:', layoutMode, '- defaulting to show sidebar');
  }
  
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
  
  // Hide sidebar on marketplace page (fullscreen public experience)
  const isMarketplacePage = pathname?.startsWith('/marketplace');
  
  // Hide sidebar on coach onboarding pages (fullscreen experience)
  const isCoachOnboarding = pathname?.startsWith('/coach/onboarding');
  
  // Hide sidebar on coach welcome page (fullscreen experience)
  const isCoachWelcome = pathname?.startsWith('/coach/welcome');
  
  const shouldHideSidebar = isOnboardingPage || isStartPage || isCheckInPage || isJoinPage || isSignInPage || isProfileEditOnboarding || isPremiumUpgradeForm || isCoachingForm || isInvitePage || isMarketplacePage || isCoachOnboarding || isCoachWelcome;
  
  if (shouldHideSidebar) {
    console.log('[ConditionalSidebar] Hiding due to pathname:', {
      isOnboardingPage,
      isStartPage,
      isCheckInPage,
      isJoinPage,
      isSignInPage,
      isProfileEditOnboarding,
      isPremiumUpgradeForm,
      isCoachingForm,
      isInvitePage,
      isMarketplacePage,
      isCoachOnboarding,
      isCoachWelcome,
    });
    return null;
  }
  
  console.log('[ConditionalSidebar] Rendering Sidebar');
  return (
    <SidebarErrorBoundary>
      <Sidebar />
    </SidebarErrorBoundary>
  );
}

