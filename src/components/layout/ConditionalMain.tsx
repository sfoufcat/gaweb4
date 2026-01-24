'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface ConditionalMainProps {
  children: ReactNode;
  layoutMode?: string;
}

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * For fullscreen pages (website, onboarding, etc.), renders children directly.
 * For regular app pages, wraps content in main-content-safe class.
 *
 * Uses layoutMode prop from SSR for initial render to prevent flash,
 * then uses pathname for client-side navigation.
 */
export function ConditionalMain({ children, layoutMode }: ConditionalMainProps) {
  const pathname = usePathname();
  const [isMarketingRoot, setIsMarketingRoot] = useState(false);

  // Client-side check for marketing domain root
  useEffect(() => {
    const hostname = window.location.hostname;
    const isMarketing =
      (hostname === 'coachful.co' || hostname === 'www.coachful.co') &&
      pathname === '/';
    setIsMarketingRoot(isMarketing);
  }, [pathname]);

  // SSR: Use layoutMode prop for initial render (prevents flash)
  // layoutMode is set by middleware and passed through layout.tsx
  if (layoutMode === 'fullscreen') {
    return <>{children}</>;
  }

  // Check if this is a fullscreen page that should render edge-to-edge
  const isFullscreenPage =
    pathname?.startsWith('/website') ||
    pathname?.startsWith('/onboarding') ||
    pathname?.startsWith('/start') ||
    pathname?.startsWith('/checkin') ||
    pathname?.startsWith('/join') ||
    pathname?.startsWith('/sign-in') ||
    pathname?.startsWith('/coach/onboarding') ||
    pathname?.startsWith('/coach/welcome') ||
    pathname?.startsWith('/invite') ||
    pathname?.startsWith('/marketplace') ||
    pathname?.startsWith('/q/') ||
    pathname?.startsWith('/lander') ||
    pathname?.startsWith('/book') ||
    pathname?.startsWith('/intake-call') ||
    pathname === '/upgrade-premium/form' ||
    pathname === '/get-coach/form' ||
    isMarketingRoot;

  // For fullscreen pages, render children directly without wrapper
  if (isFullscreenPage) {
    return <>{children}</>;
  }

  // For regular app pages, use the main-content-safe wrapper
  return (
    <main className="main-content-safe">
      {children}
    </main>
  );
}
