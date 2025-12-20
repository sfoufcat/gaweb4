'use client';

import { useEffect } from 'react';
import { useSignIn } from '@clerk/nextjs';

interface OAuthRedirectInitiatorProps {
  provider: 'oauth_google' | 'oauth_apple';
  redirectUrl: string;
}

/**
 * Initiates OAuth flow via redirect (not popup)
 * Used when a subdomain receives ?oauth=provider from a satellite domain
 * After OAuth completes, user is redirected back to the satellite domain
 */
export function OAuthRedirectInitiator({ provider, redirectUrl }: OAuthRedirectInitiatorProps) {
  const { signIn, isLoaded } = useSignIn();

  useEffect(() => {
    if (!isLoaded || !signIn) return;

    // Start OAuth flow with redirect
    signIn.authenticateWithRedirect({
      strategy: provider,
      redirectUrl: '/sso-callback',
      redirectUrlComplete: redirectUrl,
    }).catch((err) => {
      console.error('OAuth initiation failed:', err);
      // If OAuth fails, redirect back to satellite with error
      window.location.href = redirectUrl;
    });
  }, [isLoaded, signIn, provider, redirectUrl]);

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
