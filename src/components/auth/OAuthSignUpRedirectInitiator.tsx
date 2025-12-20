'use client';

import { useEffect } from 'react';
import { useSignUp } from '@clerk/nextjs';

interface OAuthSignUpRedirectInitiatorProps {
  provider: 'oauth_google' | 'oauth_apple';
  redirectUrl: string;
}

/**
 * Initiates OAuth sign-up flow via redirect (not popup)
 * Used when a subdomain receives ?oauth=provider from a satellite domain
 * After OAuth completes, user is redirected back to the satellite domain
 */
export function OAuthSignUpRedirectInitiator({ provider, redirectUrl }: OAuthSignUpRedirectInitiatorProps) {
  const { signUp, isLoaded } = useSignUp();

  useEffect(() => {
    if (!isLoaded || !signUp) return;

    // Capture the current domain for org enrollment
    const signupDomain = window.location.hostname;

    // Start OAuth flow with redirect, passing the signup domain for org enrollment
    signUp.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: '/sso-callback',
      redirectUrlComplete: redirectUrl,
      unsafeMetadata: { signupDomain },
    }).catch((err) => {
      console.error('OAuth initiation failed:', err);
      // If OAuth fails, redirect back to satellite with error
      window.location.href = redirectUrl;
    });
  }, [isLoaded, signUp, provider, redirectUrl]);

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-text-secondary/30 border-t-text-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="font-sans text-text-secondary">
          Connecting to {provider === 'oauth_google' ? 'Google' : 'Apple'}...
        </p>
      </div>
    </div>
  );
}

