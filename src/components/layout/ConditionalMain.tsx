'use client';

import { ReactNode } from 'react';

/**
 * ConditionalMain
 * 
 * Main content wrapper that provides consistent layout.
 * The sidebar padding is now handled via CSS :has() selector in globals.css
 * to avoid hydration mismatch and layout shift issues.
 * 
 * CSS automatically applies lg:pl-64 when sidebar is present in the DOM.
 */
export function ConditionalMain({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      {children}
    </main>
  );
}





