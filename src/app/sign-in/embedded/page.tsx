'use client';

import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/auth';
import { Suspense, useEffect } from 'react';

/**
 * /sign-in/embedded - Embeddable sign-in form for iframes
 *
 * Used by satellite domains to embed sign-in in an iframe.
 * Accepts ?origin=https://example.com to send postMessage to parent window.
 * Accepts ?redirectUrl=/path to pass back to parent for redirect after auth.
 * Accepts ?theme=light|dark to sync theme with parent page.
 *
 * This page is minimal - no background, no header, just the form.
 * OAuth buttons are hidden since they're handled by the parent page.
 */
function EmbeddedSignInContent() {
  const searchParams = useSearchParams();
  const origin = searchParams.get('origin') || '';
  // Get redirectUrl from query params - this is passed from SatelliteSignIn
  // so we can include it in the postMessage to parent
  const redirectUrl = searchParams.get('redirectUrl') || '/';
  // Get theme from query params to sync with parent page
  const theme = searchParams.get('theme') || '';

  // Make body transparent and sync theme with parent page
  useEffect(() => {
    document.body.style.background = 'transparent';

    // Sync theme with parent page to ensure consistent appearance
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
    // If no theme param, let it use the default (system/org preference)

    return () => {
      document.body.style.background = '';
    };
  }, [theme]);

  return (
    <div className="p-2">
      <SignInForm
        embedded={true}
        origin={origin}
        redirectUrl={redirectUrl}
        hideOAuth={true}
      />
    </div>
  );
}

export default function EmbeddedSignInPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    }>
      <EmbeddedSignInContent />
    </Suspense>
  );
}
