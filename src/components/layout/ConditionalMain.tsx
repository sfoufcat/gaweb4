'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * For fullscreen pages (website, onboarding, etc.), renders children directly.
 * For regular app pages, wraps content in main-content-safe class.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
    pathname === '/upgrade-premium/form' ||
    pathname === '/get-coach/form';

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
