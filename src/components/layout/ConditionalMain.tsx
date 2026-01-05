'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Background comes from body element.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen pb-24 lg:pb-0">
      {children}
    </main>
  );
}

