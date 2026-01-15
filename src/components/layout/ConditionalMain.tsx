'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 *
 * Main content wrapper that provides consistent layout.
 * Background extends into iOS safe area for transparent effect behind Safari's bottom bar.
 *
 * The main-content-safe class uses negative margin + padding technique to allow the
 * background to extend into the safe area while keeping content properly inset.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="main-content-safe">
      {children}
    </main>
  );
}
