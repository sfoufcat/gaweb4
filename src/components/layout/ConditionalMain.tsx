'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Includes a fixed background div to ensure Safari's translucent browser bar
 * always has a DOM element to show through (not just CSS background).
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Fixed background for Safari - ensures content is visible behind translucent browser bar */}
      <div className="fixed inset-0 bg-app-bg -z-10" aria-hidden="true" />
      <main className="min-h-screen pb-24 lg:pb-0">
        {children}
      </main>
    </>
  );
}

