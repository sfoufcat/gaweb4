'use client';

import { useState, useEffect } from 'react';
import { useAuth, SignUp, useSignIn, useSignUp } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { FunnelStepConfigSignup } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';
const primaryHoverVar = 'var(--funnel-primary-hover, #8c6245)';

interface SignupStepProps {
  config: FunnelStepConfigSignup;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  branding: {
    logoUrl: string;
    appTitle: string;
  };
  hostname: string;
  flowSessionId: string;
  isFirstStep: boolean;
}

/**
 * SignupStep - Handles user authentication in a funnel
 * 
 * Modes:
 * 1. Already signed in → Auto-advance
 * 2. Regular domain → Inline Clerk SignUp
 * 3. Custom domain → Iframe-based signup
 */
export function SignupStep({
  config,
  onComplete,
  onBack,
  branding,
  hostname,
  flowSessionId,
  isFirstStep,
}: SignupStepProps) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Auto-advance if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn && userId) {
      // Link session to user if not already linked
      linkSessionAndContinue();
    }
  }, [isLoaded, isSignedIn, userId]);

  const linkSessionAndContinue = async () => {
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
    }
  };

  // Handle OAuth for custom domains
  const handleOAuth = (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    
    if (isCustomDomain) {
      // Redirect to subdomain which handles Clerk OAuth via /join/oauth
      const subdomainBase = subdomain 
        ? `https://${subdomain}.growthaddicts.app`
        : 'https://growthaddicts.app';
      
      // Return URL with flowSessionId so we can link after auth
      const returnUrl = `https://${hostname}/join/callback?flowSessionId=${flowSessionId}`;
      window.location.href = `${subdomainBase}/join/oauth?provider=${provider}&flowSessionId=${flowSessionId}&returnUrl=${encodeURIComponent(returnUrl)}`;
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
  // If user is already signed in, return null and let the useEffect handle linking
  // The FunnelClient will show its own loading state when isNavigating is true
  if (!isLoaded) {
    return (
      <div className="min-h-[50vh] w-full flex flex-col items-center justify-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div 
            className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: primaryVar }}
          />
        </div>
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  // If already signed in and no error, return null - the useEffect will handle
  // linking the session and calling onComplete, which triggers FunnelClient's loader
  if (isSignedIn && !error) {
    return null;
  }

  const heading = config.heading || 'Create your account';
  const subheading = config.subheading || 'Sign up to continue your journey';

  // Custom domain: Show iframe-based signup
  if (isCustomDomain && mounted) {
    const subdomainBase = subdomain 
      ? `https://${subdomain}.growthaddicts.app`
      : 'https://growthaddicts.app';
    const currentOrigin = `https://${hostname}`;
    const iframeSrc = `${subdomainBase}/join/embedded?origin=${encodeURIComponent(currentOrigin)}&flowSessionId=${flowSessionId}`;

    return (
      <div className="w-full max-w-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3">
            {heading}
          </h1>
          <p className="text-text-secondary">{subheading}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-2xl p-6 shadow-lg"
        >
          {/* OAuth Buttons */}
          {config.showSocialLogin !== false && (
            <>
              <div className="space-y-3">
                <button
                  onClick={() => handleOAuth('oauth_google')}
                  disabled={oauthLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-[#e1ddd8] rounded-xl text-text-primary font-medium hover:bg-[#faf8f6] transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {oauthLoading ? 'Redirecting...' : 'Continue with Google'}
                </button>
              </div>

              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-[#e1ddd8]" />
                <span className="text-sm text-text-muted">or</span>
                <div className="flex-1 h-px bg-[#e1ddd8]" />
              </div>
            </>
          )}

          {/* Iframe for email/password */}
          <iframe
            src={iframeSrc}
            className="w-full border-0 outline-none"
            style={{ height: '420px' }}
            scrolling="no"
            allow="clipboard-write"
            title="Sign Up"
          />
        </motion.div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
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
            className="mt-6 text-center"
          >
            <button
              onClick={onBack}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Go back
            </button>
          </motion.div>
        )}
      </div>
    );
  }

  // Regular domain: Use Clerk SignUp component
  return (
    <div className="w-full max-w-xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3">
          {heading}
        </h1>
        <p className="text-text-secondary">{subheading}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center"
      >
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full max-w-md',
              card: 'shadow-none border border-[#e1ddd8] rounded-2xl',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
              socialButtonsBlockButton: 'border-[#e1ddd8] hover:bg-[#faf8f6]',
              formFieldInput: 'border-[#e1ddd8] focus:border-[#a07855] focus:ring-[#a07855]',
              formButtonPrimary: 'bg-[#a07855] hover:bg-[#8c6245]',
              footerAction: 'hidden',
            },
          }}
          signInUrl="/sign-in"
          redirectUrl={`/join/callback?flowSessionId=${flowSessionId}`}
        />
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
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
          className="mt-6 text-center"
        >
          <button
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            ← Go back
          </button>
        </motion.div>
      )}
    </div>
  );
}

