'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Background applied directly to main element to ensure Safari treats
 * the entire scrolling area (including padding) as painted content,
 * preventing the browser bar from turning opaque on scroll.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen pb-24 lg:pb-0 bg-app-bg transition-colors duration-300">
      {children}
    </main>
  );
}

