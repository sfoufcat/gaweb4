'use client';

import { useState, useEffect } from 'react';
import { useAuth, useClerk, useSignUp } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { FunnelStepConfigSignup } from '@/types';
import { SignUpForm, OAuthButton } from '@/components/auth';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';

interface SignupStepProps {
  config: FunnelStepConfigSignup;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  branding: {
    logoUrl: string;
    appTitle: string;
    primaryColor?: string;
  };
  hostname: string;
  flowSessionId: string;
  isFirstStep: boolean;
  // New props for cross-org detection
  organizationId?: string;
  organizationName?: string;
}

/**
 * SignupStep - Handles user authentication in a funnel
 * 
 * Modes:
 * 1. Already signed in (same org) → Auto-advance
 * 2. Already signed in (different org) → Show confirmation to join new org
 * 3. Not signed in (regular domain) → Show custom SignUpForm with branding
 * 4. Not signed in (custom domain) → Iframe-based signup
 */
export function SignupStep({
  config,
  onComplete,
  onBack,
  branding,
  hostname,
  flowSessionId,
  isFirstStep,
  organizationId,
  organizationName,
}: SignupStepProps) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { signOut } = useClerk();
  const { signUp } = useSignUp();
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  
  // Cross-organization state
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [showCrossOrgConfirm, setShowCrossOrgConfirm] = useState(false);
  const [checkingOrg, setCheckingOrg] = useState(false);

  // Determine if we're on a custom domain (satellite)
  const isCustomDomain = !hostname.includes('growthaddicts.app') && 
                         !hostname.includes('localhost') &&
                         !hostname.includes('127.0.0.1');

  // Extract subdomain from hostname for iframe
  const getSubdomain = () => {
    const match = hostname.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
    return match ? match[1] : null;
  };

  const subdomain = getSubdomain();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch user's organization when signed in
  useEffect(() => {
    async function checkUserOrg() {
      if (!isLoaded || !isSignedIn || !userId) return;
      
      setCheckingOrg(true);
      try {
        // Fetch user's current organization from API
        const response = await fetch('/api/user/organization');
        if (response.ok) {
          const data = await response.json();
          setUserOrgId(data.organizationId || null);
          
          // Check if user is joining a different organization
          if (organizationId && data.organizationId && data.organizationId !== organizationId) {
            setShowCrossOrgConfirm(true);
          } else {
            // Same org or no org - auto-proceed
            linkSessionAndContinue();
          }
        } else {
          // No org info - proceed
          linkSessionAndContinue();
        }
      } catch (err) {
        console.error('Failed to check user org:', err);
        // On error, just proceed
        linkSessionAndContinue();
      } finally {
        setCheckingOrg(false);
      }
    }

    if (isLoaded && isSignedIn && userId && !isLinking) {
      checkUserOrg();
    }
  }, [isLoaded, isSignedIn, userId, organizationId]);

  const linkSessionAndContinue = async () => {
    if (isLinking) return;
    setIsLinking(true);
    
    try {
      // Link the flow session to this user
      const response = await fetch('/api/funnel/link-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowSessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to link session');
      }

      // Continue to next step only if linking succeeded
      onComplete({ userId });
    } catch (err) {
      console.error('Failed to link session:', err);
      setError(err instanceof Error ? err.message : 'Failed to link your account. Please try again.');
      setIsLinking(false);
    }
  };

  // Handle OAuth for regular domains
  const handleOAuth = async (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    setError(null);
    
    if (isCustomDomain) {
      // Custom domain: Redirect to subdomain which handles Clerk OAuth
      const subdomainBase = subdomain 
        ? `https://${subdomain}.growthaddicts.app`
        : 'https://growthaddicts.app';
      
      // Return URL with flowSessionId so we can link after auth
      const returnUrl = `https://${hostname}/join/callback?flowSessionId=${flowSessionId}`;
      window.location.href = `${subdomainBase}/join/oauth?provider=${provider}&flowSessionId=${flowSessionId}&returnUrl=${encodeURIComponent(returnUrl)}`;
    } else {
      // Regular domain: Use direct OAuth
      try {
        if (!signUp) {
          throw new Error('Sign up not loaded');
        }
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: '/sso-callback',
          redirectUrlComplete: `/join/callback?flowSessionId=${flowSessionId}`,
          unsafeMetadata: { signupDomain: hostname },
        });
      } catch (err) {
        console.error('OAuth error:', err);
        setError('Failed to start authentication. Please try again.');
        setOauthLoading(false);
      }
    }
  };

  // Handle signing out to use different account
  const handleSignOutAndRetry = async () => {
    try {
      await signOut();
      setShowCrossOrgConfirm(false);
      setUserOrgId(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError('Failed to sign out. Please try again.');
    }
  };

  // Listen for postMessage from iframe (custom domain flow)
  useEffect(() => {
    if (!isCustomDomain) return;

    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      if (!event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        linkSessionAndContinue();
      } else if (event.data.type === 'auth-error') {
        setError(event.data.error || 'Authentication failed');
        setOauthLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isCustomDomain, flowSessionId]);

  // Loading state - only show loader if Clerk is not loaded yet
  if (!isLoaded || checkingOrg) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          {branding.logoUrl && (
            <Image
              src={branding.logoUrl}
              alt={branding.appTitle}
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
              unoptimized={branding.logoUrl.startsWith('http')}
            />
          )}
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div 
              className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: primaryVar }}
            />
          </div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If linking in progress, show loader
  if (isLinking) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="text-center">
          {branding.logoUrl && (
            <Image
              src={branding.logoUrl}
              alt={branding.appTitle}
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
              unoptimized={branding.logoUrl.startsWith('http')}
            />
          )}
          <div className="relative mb-4 mx-auto w-fit">
            <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
            <div 
              className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: primaryVar }}
            />
          </div>
          <p className="text-text-secondary">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // Cross-organization confirmation screen
  if (showCrossOrgConfirm && isSignedIn) {
    return (
      <div className="fixed inset-0 bg-app-bg overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto text-center"
          >
            {/* Logo */}
            {branding.logoUrl && (
              <Image
                src={branding.logoUrl}
                alt={branding.appTitle}
                width={96}
                height={96}
                className="w-20 h-20 lg:w-24 lg:h-24 rounded-full mx-auto mb-8 shadow-lg"
                unoptimized={branding.logoUrl.startsWith('http')}
              />
            )}

            {/* Heading */}
            <h1 className="font-albert text-[32px] sm:text-[40px] text-text-primary tracking-[-1.5px] leading-[1.1] mb-4">
              Join {organizationName || branding.appTitle}
            </h1>
            <p className="font-sans text-[16px] text-text-secondary leading-[1.6] mb-8">
              You&apos;re about to join a new community. Your existing accounts will remain active.
            </p>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={linkSessionAndContinue}
                className="w-full py-4 px-6 rounded-full font-sans font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                style={{ backgroundColor: branding.primaryColor || '#a07855' }}
              >
                Continue to join
              </button>
              
              <button
                onClick={handleSignOutAndRetry}
                className="w-full py-3 px-6 rounded-full font-sans font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign in with different account
              </button>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl"
              >
                <p className="text-red-600 text-sm">{error}</p>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  // If already signed in (same org), the useEffect will handle linking
  // Show linking loader while that happens
  if (isSignedIn && !error) {
    return null;
  }

  const heading = config.heading || 'Create your account';
  const subheading = config.subheading || 'Sign up to continue your journey';

  // Construct URLs for iframe
  const subdomainBase = subdomain 
    ? `https://${subdomain}.growthaddicts.app`
    : 'https://growthaddicts.app';
  const currentOrigin = isCustomDomain ? `https://${hostname}` : window?.location?.origin || '';
  const iframeSrc = `${subdomainBase}/join/embedded?origin=${encodeURIComponent(currentOrigin)}&flowSessionId=${flowSessionId}`;

  // Full-page centered layout matching SatelliteSignIn design
  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Header with Coach Branding */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10 lg:mb-12"
          >
            {branding.logoUrl && (
              <Image 
                src={branding.logoUrl} 
                alt={branding.appTitle} 
                width={80}
                height={80}
                className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
                unoptimized={branding.logoUrl.startsWith('http')}
              />
            )}
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
              {heading}
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              {subheading}
            </p>
          </motion.div>

          {/* Auth Container */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full max-w-lg mx-auto"
          >
            <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
              {/* OAuth Button */}
              {config.showSocialLogin !== false && (
                <>
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
                    <div className="flex-1 h-px bg-[#e1ddd8]" />
                    <span className="font-sans text-sm text-text-secondary">or</span>
                    <div className="flex-1 h-px bg-[#e1ddd8]" />
                  </div>
                </>
              )}

              {/* Email/Password Form */}
              {isCustomDomain && mounted ? (
                // Custom domain: Use iframe
                <iframe
                  src={iframeSrc}
                  className="w-full border-0 outline-none"
                  style={{ height: '420px' }}
                  scrolling="no"
                  allow="clipboard-write"
                  title="Sign Up"
                />
              ) : (
                // Regular domain: Use SignUpForm directly
                <SignUpForm
                  embedded={true}
                  origin=""
                  redirectUrl={`/join/callback?flowSessionId=${flowSessionId}`}
                  hideOAuth={true}
                />
              )}
            </div>
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center max-w-lg mx-auto"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Back button */}
          {!isFirstStep && onBack && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 text-center"
            >
              <button
                onClick={onBack}
                className="text-text-secondary hover:text-text-primary transition-colors font-sans"
              >
                ← Go back
              </button>
            </motion.div>
          )}

          {/* Sign in link for existing users */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Already have an account?{' '}
            <a href="/sign-in" className="text-[#a07855] hover:text-[#8a6649] font-medium">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
