'use client';

import { useEffect } from 'react';
import { useSignUp } from '@clerk/nextjs';

interface OAuthSignUpPopupInitiatorProps {
  provider: 'oauth_google' | 'oauth_apple';
  origin: string;
}

/**
 * Initiates OAuth sign-up flow in a popup window
 * After auth completes, the SSO callback will send postMessage to parent
 */
export function OAuthSignUpPopupInitiator({ provider, origin }: OAuthSignUpPopupInitiatorProps) {
  const { signUp, isLoaded } = useSignUp();

  useEffect(() => {
    if (!isLoaded || !signUp) return;

    // Capture the current domain for org enrollment
    const signupDomain = window.location.hostname;

    // Start OAuth flow - will redirect to provider, then back to /sso-callback
    // The origin is passed so SSO callback knows where to postMessage
    signUp.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: `/sso-callback?popup=1&origin=${encodeURIComponent(origin)}`,
      redirectUrlComplete: `/sso-callback?popup=1&origin=${encodeURIComponent(origin)}`,
      unsafeMetadata: { signupDomain },
    }).catch((err) => {
      console.error('OAuth initiation failed:', err);
      // Notify parent of error
      if (window.opener) {
        window.opener.postMessage({ type: 'auth-error', error: 'OAuth initiation failed' }, origin);
        window.close();
      }
    });
  }, [isLoaded, signUp, provider, origin]);

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="font-sans text-text-secondary">Connecting to {provider === 'oauth_google' ? 'Google' : 'Apple'}...</p>
      </div>
    </div>
  );
}










