'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSignUp, useSignIn } from '@clerk/nextjs';

/**
 * /join/oauth - OAuth initiator for funnel flows
 * 
 * This page runs on the subdomain (where Clerk is registered) and initiates
 * OAuth authentication for users coming from custom domains via the funnel.
 * 
 * Query params:
 * - provider: 'oauth_google' | 'oauth_apple'
 * - flowSessionId: The flow session to link after auth
 * - returnUrl: Where to redirect after auth (custom domain's /join/callback)
 * 
 * Flow:
 * 1. Custom domain redirects here with params
 * 2. This page initiates Clerk OAuth
 * 3. After OAuth, Clerk redirects to /sso-callback
 * 4. /sso-callback redirects to returnUrl (back to custom domain)
 */
function OAuthContent() {
  const searchParams = useSearchParams();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const [error, setError] = useState<string | null>(null);

  const provider = searchParams.get('provider') as 'oauth_google' | 'oauth_apple' | null;
  const flowSessionId = searchParams.get('flowSessionId');
  const returnUrl = searchParams.get('returnUrl');

  useEffect(() => {
    if (!signUpLoaded || !signInLoaded) return;
    if (!provider || !flowSessionId || !returnUrl) {
      setError('Missing required parameters');
      return;
    }

    // Capture the current domain for org enrollment
    const signupDomain = window.location.hostname;

    // Build the complete redirect URL that includes flowSessionId
    // This ensures the callback knows which flow session to link
    const redirectUrlComplete = returnUrl.includes('?') 
      ? returnUrl 
      : `${returnUrl}${returnUrl.includes('flowSessionId') ? '' : `?flowSessionId=${flowSessionId}`}`;

    // Try sign up first, if user exists it will fail and we try sign in
    const initiateOAuth = async () => {
      try {
        // Try to sign up with OAuth
        await signUp?.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: '/sso-callback',
          redirectUrlComplete,
          unsafeMetadata: { 
            signupDomain,
            flowSessionId, // Store in metadata for potential use
          },
        });
      } catch (err: unknown) {
        const clerkError = err as { errors?: Array<{ code: string; message: string }> };
        
        // If user already exists, try sign in instead
        if (clerkError.errors?.[0]?.code === 'form_identifier_exists' || 
            clerkError.errors?.[0]?.code === 'external_account_exists') {
          try {
            await signIn?.authenticateWithRedirect({
              strategy: provider,
              redirectUrl: '/sso-callback',
              redirectUrlComplete,
            });
          } catch (signInErr) {
            console.error('OAuth sign-in failed:', signInErr);
            setError('Authentication failed. Please try again.');
          }
        } else {
          console.error('OAuth initiation failed:', err);
          setError(clerkError.errors?.[0]?.message || 'Authentication failed. Please try again.');
        }
      }
    };

    initiateOAuth();
  }, [signUpLoaded, signInLoaded, signUp, signIn, provider, flowSessionId, returnUrl]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="font-albert text-xl text-text-primary mb-2">Authentication Error</h2>
          <p className="font-sans text-text-secondary mb-6">{error}</p>
          {returnUrl && (
            <button
              onClick={() => window.location.href = returnUrl}
              className="px-6 py-2 bg-[#a07855] dark:bg-[#b8896a] text-white rounded-lg hover:bg-[#8c6245] dark:hover:bg-[#a07855] transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const providerName = provider === 'oauth_google' ? 'Google' : provider === 'oauth_apple' ? 'Apple' : 'provider';

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
      <div className="text-center">
        <div className="relative mb-4 mx-auto w-fit">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
        <p className="font-sans text-text-secondary">
          Connecting to {providerName}...
        </p>
      </div>
    </div>
  );
}

export default function JoinOAuthPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="font-sans text-text-secondary">Loading...</p>
        </div>
      </div>
    }>
      <OAuthContent />
    </Suspense>
  );
}






