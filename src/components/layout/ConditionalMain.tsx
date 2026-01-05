'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Fixed background is in layout.tsx at body level for iOS Safari compatibility.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-0 min-h-dvh pb-24 lg:pb-0">
      {children}
    </main>
  );
}

