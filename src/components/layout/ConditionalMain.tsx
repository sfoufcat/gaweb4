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
    // pb-24 clears the fixed mobile nav bar, lg:pb-0 removes it on desktop
    <main className="min-h-screen pb-24 lg:pb-0">
      {children}
    </main>
  );
}





