'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Uses same iOS Safari pattern as CoachLandingPage:
 * - Fixed background div extends behind Safari toolbar
 * - Content has `relative` to create stacking context above the -z-10 bg
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-0 min-h-dvh pb-24 lg:pb-0">
      <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] -z-10" />
      {children}
    </main>
  );
}

