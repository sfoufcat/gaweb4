'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * The sidebar padding is now handled via CSS :has() selector in globals.css
 * to avoid hydration mismatch and layout shift issues.
 *
 * Background colors come from html/body elements in layout.tsx,
 * which extend behind iOS Safari toolbar via viewport-fit: cover.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh pb-24 lg:pb-0">
      {children}
    </main>
  );
}

