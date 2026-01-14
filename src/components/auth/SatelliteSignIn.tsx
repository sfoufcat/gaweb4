'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { OAuthButton } from './OAuthButton';
import { useTheme } from '@/contexts/ThemeContext';

interface SatelliteSignInProps {
  subdomain: string;
  customDomain: string;
  logoUrl: string;
  appTitle: string;
  redirectUrl?: string; // Where to redirect after sign-in (e.g., /join/callback?flowSessionId=xxx)
}

/**
 * Satellite Sign-In Component
 * 
 * Used on custom domains (satellite domains) to show sign-in.
 * - OAuth buttons are on this parent page (redirect flow)
 * - Email/password form is in an iframe from the subdomain
 * 
 * After successful auth:
 * - If redirectUrl is provided, redirect there (for funnel flows with flowSessionId)
 * - Otherwise, redirect to /?from_auth=1 to let ClerkProvider sync session
 * 
 * If user is already signed in, shows "Continue as X" screen instead of sign-in form.
 */
export function SatelliteSignIn({ subdomain, customDomain, logoUrl, appTitle, redirectUrl = '/' }: SatelliteSignInProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  
  // Only render iframe on client side to avoid SSR issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Construct URLs
  const currentOrigin = `https://${customDomain}`;
  const subdomainBase = subdomain 
    ? `https://${subdomain}.coachful.co`
    : 'https://coachful.co';
  
  // Determine the final redirect URL after auth
  // If redirectUrl is a relative path, prepend the current origin
  // Add from_auth=1 to trigger session sync
  const getReturnUrl = () => {
    if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
      // Absolute URL - use as is, but add from_auth if not present
      const url = new URL(redirectUrl);
      if (!url.searchParams.has('from_auth')) {
        url.searchParams.set('from_auth', '1');
      }
      return url.toString();
    } else {
      // Relative path - prepend current origin
      const path = redirectUrl.startsWith('/') ? redirectUrl : `/${redirectUrl}`;
      const url = new URL(path, currentOrigin);
      if (!url.searchParams.has('from_auth')) {
        url.searchParams.set('from_auth', '1');
      }
      return url.toString();
    }
  };
  
  const returnUrl = getReturnUrl();

  // Pass redirectUrl and theme to iframe so it can apply the same theme and include redirectUrl in postMessage
  const iframeSrc = `${subdomainBase}/sign-in/embedded?origin=${encodeURIComponent(currentOrigin)}&redirectUrl=${encodeURIComponent(redirectUrl)}&theme=${theme}`;

  // Handle OAuth - redirect to subdomain which handles Clerk OAuth
  const handleOAuth = (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    // Redirect to subdomain with oauth param - subdomain will initiate Clerk OAuth
    // After OAuth, user will be redirected back to this domain with the proper redirectUrl
    window.location.href = `${subdomainBase}/sign-in?oauth=${provider}&redirect_url=${encodeURIComponent(returnUrl)}`;
  };

  // Handle "Continue as X" button click
  const handleContinue = () => {
    // Redirect to the redirectUrl to continue the flow
    window.location.href = returnUrl;
  };

  // Handle sign out to use different account
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // After sign out, the page will re-render and show sign-in form
    } catch (error) {
      console.error('Sign out error:', error);
      setSigningOut(false);
    }
  };

  useEffect(() => {
    // Listen for postMessage from iframe (email/password auth success)
    const handleMessage = (event: MessageEvent) => {
      // Validate origin - must be from subdomain or primary domain
      if (!event.origin.includes('coachful.co') && !event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        // Redirect to the redirectUrl (which may contain flowSessionId for funnel flow)
        // The iframe may also pass a specific redirectUrl in the message
        const targetUrl = event.data.redirectUrl || returnUrl;
        window.location.href = targetUrl;
      } else if (event.data.type === 'auth-error') {
        console.error('Auth error:', event.data.error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [returnUrl]);

  // Show loading while Clerk loads
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
          </div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is already signed in, show "Continue as X" screen
  if (isSignedIn && user) {
    const displayName = user.firstName || user.primaryEmailAddress?.emailAddress || 'there';
    const displayEmail = user.primaryEmailAddress?.emailAddress || '';
    const displayImage = user.imageUrl;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Header with Coach Branding */}
          <div className="text-center mb-10 lg:mb-12">
            <Image
              src={logoUrl}
              alt={appTitle}
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
              unoptimized={logoUrl.startsWith('http')}
            />
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
              Welcome back
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              Continue with your existing account or use a different one.
            </p>
          </div>

          {/* Auth Container */}
          <div className="w-full max-w-lg mx-auto">
            <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-border-subtle/60 rounded-3xl p-8 shadow-lg">
              {/* Current user card */}
              <div className="bg-[#f5f3f0] dark:bg-surface-elevated rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-4">
                  {displayImage ? (
                    <Image
                      src={displayImage}
                      alt={displayName}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center">
                      <span className="text-lg font-medium text-brand-accent">
                        {displayName?.[0] || displayEmail?.[0] || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {user.firstName && (
                      <p className="font-medium text-text-primary truncate">{user.firstName} {user.lastName || ''}</p>
                    )}
                    {displayEmail && (
                      <p className="text-sm text-text-secondary truncate">{displayEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-4">
                <button
                  onClick={handleContinue}
                  className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                >
                  Continue as {displayName}
                </button>

                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full py-3 px-6 rounded-full font-sans font-medium text-text-secondary hover:text-text-primary transition-colors border border-[#e1ddd8] dark:border-border-subtle disabled:opacity-50"
                >
                  {signingOut ? 'Signing out...' : 'Use a different account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default: Show sign-in form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 lg:py-16">
      <div className="w-full max-w-xl mx-auto">
        {/* Header with Coach Branding */}
        <div className="text-center mb-10 lg:mb-12">
          <Image
            src={logoUrl}
            alt={appTitle}
            width={80}
            height={80}
            className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
            unoptimized={logoUrl.startsWith('http')}
          />
          <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
            Welcome back
          </h1>
          <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
            Sign in to continue your growth journey.
          </p>
        </div>

        {/* Auth Container */}
        <div className="w-full max-w-lg mx-auto">
          <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-border-subtle/60 rounded-3xl p-8 shadow-lg">
            {/* OAuth Button - on parent page, uses redirect flow */}
            <div className="space-y-3">
              <OAuthButton
                provider="google"
                onClick={() => handleOAuth('oauth_google')}
                disabled={false}
                loading={oauthLoading}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-border-subtle" />
              <span className="font-sans text-sm text-text-secondary">or</span>
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-border-subtle" />
            </div>

            {/* Email/Password Form in iframe */}
            {mounted && (
              <iframe
                src={iframeSrc}
                className="w-full border-0 outline-none"
                style={{ height: '340px' }}
                scrolling="no"
                allow="clipboard-write"
                title="Sign In"
              />
            )}
          </div>
        </div>

        {/* Sign Up Link */}
        <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-brand-accent hover:text-[#8a6649] font-medium">
            Start your journey
          </Link>
        </p>
      </div>
    </div>
  );
}
