'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, useClerk, useSignUp, useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import type { FunnelStepConfigSignup } from '@/types';
import { SignUpForm, OAuthButton } from '@/components/auth';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';

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
  // Organization context for the funnel
  organizationId?: string;
  organizationName?: string;
  // Subdomain for custom domain auth iframe (resolved from tenant)
  tenantSubdomain?: string | null;
}

// User state types for the 3 cases
type UserState = 'new' | 'same_tenant' | 'different_tenant' | 'checking';

interface MembershipCheckResult {
  isMember: boolean;
  inDifferentOrg: boolean;
  userInfo: {
    firstName: string;
    lastName: string;
    email: string;
    imageUrl: string;
  } | null;
}

// Unified loader component
function Loader({ branding, message }: { branding: { logoUrl: string; appTitle: string }; message: string }) {
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
        <p className="text-text-secondary">{message}</p>
      </div>
    </div>
  );
}

/**
 * SignupStep - Handles user authentication in a funnel
 * 
 * 3 User Cases:
 * 1. New User - Show sign-up form (normal flow)
 * 2. Same Tenant - User exists in this org → "Welcome back!" with auto-continue after 2s
 * 3. Different Tenant - User exists but in different org → "Continue as" or "Use different account"
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
  tenantSubdomain,
}: SignupStepProps) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { signUp } = useSignUp();
  const [mounted, setMounted] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  
  // User state detection
  const [userState, setUserState] = useState<UserState>('checking');
  const [membershipInfo, setMembershipInfo] = useState<MembershipCheckResult | null>(null);
  
  // For signed-in users confirmation
  const [hasConfirmed, setHasConfirmed] = useState(false);
  
  // Auto-continue countdown for same_tenant
  const [autoCountdown, setAutoCountdown] = useState(2);

  // Determine if we're on a custom domain (satellite)
  const isCustomDomain = !hostname.includes('growthaddicts.com') && 
                         !hostname.includes('growthaddicts.app') &&
                         !hostname.includes('localhost') &&
                         !hostname.includes('127.0.0.1');

  // Get subdomain for auth iframe:
  // - Custom domains: use tenantSubdomain passed from server-side tenant resolution
  // - Regular domains: extract from hostname pattern
  const getSubdomainFromHostname = useCallback(() => {
    // Try .com first (current domain), then .app (legacy)
    const comMatch = hostname.match(/^([a-z0-9-]+)\.growthaddicts\.com$/);
    if (comMatch) return comMatch[1];
    const appMatch = hostname.match(/^([a-z0-9-]+)\.growthaddicts\.app$/);
    return appMatch ? appMatch[1] : null;
  }, [hostname]);

  // For custom domains, use the passed tenantSubdomain; otherwise extract from hostname
  const subdomain = isCustomDomain ? (tenantSubdomain || null) : getSubdomainFromHostname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check user membership status when signed in
  useEffect(() => {
    async function checkMembership() {
      if (!isLoaded) return;
      
      if (!isSignedIn) {
        setUserState('new');
        return;
      }
      
      if (!organizationId) {
        // No org context, treat as different tenant case
        setUserState('different_tenant');
        return;
      }
      
      try {
        const response = await fetch(`/api/funnel/check-membership?orgId=${organizationId}`);
        if (!response.ok) {
          throw new Error('Failed to check membership');
        }
        
        const result: MembershipCheckResult = await response.json();
        setMembershipInfo(result);
        
        if (result.isMember) {
          setUserState('same_tenant');
        } else if (result.inDifferentOrg) {
          setUserState('different_tenant');
        } else {
          // User is signed in but not in any org yet - treat as different_tenant for confirmation
          setUserState('different_tenant');
        }
      } catch (err) {
        console.error('Membership check failed:', err);
        // On error, default to different_tenant for manual confirmation
        setUserState('different_tenant');
      }
    }
    
    checkMembership();
  }, [isLoaded, isSignedIn, organizationId]);

  // Auto-continue for same_tenant users after countdown
  useEffect(() => {
    if (userState !== 'same_tenant' || hasConfirmed) return;
    
    const timer = setInterval(() => {
      setAutoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-confirm and continue
          setHasConfirmed(true);
          linkSessionAndContinue();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [userState, hasConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Link session and continue to next step
  const linkSessionAndContinue = useCallback(async () => {
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
  }, [isLinking, flowSessionId, onComplete, userId]);

  // Handle confirmation click - user confirms they want to join
  const handleConfirmJoin = useCallback(() => {
    setHasConfirmed(true);
    linkSessionAndContinue();
  }, [linkSessionAndContinue]);

  // Handle OAuth for regular domains
  const handleOAuth = async (provider: 'oauth_google' | 'oauth_apple') => {
    setOauthLoading(true);
    setError(null);
    
    if (isCustomDomain) {
      // Custom domain: Redirect to subdomain which handles Clerk OAuth
      const subdomainBase = subdomain 
        ? `https://${subdomain}.growthaddicts.com`
        : 'https://growthaddicts.com';
      
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
      setHasConfirmed(false);
      setUserState('new');
      setMembershipInfo(null);
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
      if (!event.origin.includes('growthaddicts.com') && !event.origin.includes('growthaddicts.app')) {
        return;
      }
      
      if (event.data.type === 'auth-success') {
        // After iframe auth, user will be signed in - we'll show confirmation
        // The isSignedIn state will update and trigger confirmation screen
      } else if (event.data.type === 'auth-error') {
        setError(event.data.error || 'Authentication failed');
        setOauthLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isCustomDomain]);

  // ============================================
  // RENDER LOGIC - Handle 3 user cases
  // ============================================

  // State 1: Clerk not loaded yet or checking membership
  if (!isLoaded || userState === 'checking') {
    return <Loader branding={branding} message="Loading..." />;
  }

  // State 2: User is signed in and linking in progress
  if (isLinking) {
    return <Loader branding={branding} message="Setting up your account..." />;
  }

  // ============================================
  // CASE 2: Same Tenant - "Welcome back!" with auto-continue
  // ============================================
  if (userState === 'same_tenant' && isSignedIn && !hasConfirmed) {
    const displayName = user?.firstName || membershipInfo?.userInfo?.firstName || 'there';
    
    return (
      <div className="fixed inset-0 bg-app-bg overflow-y-auto">
        <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto text-center"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-brand-accent/10 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="w-10 h-10 text-brand-accent" />
            </motion.div>

            {/* Heading */}
            <h1 className="font-albert text-[32px] sm:text-[40px] text-text-primary tracking-[-1.5px] leading-[1.1] mb-4">
              Welcome back, {displayName}!
            </h1>
            <p className="font-sans text-[16px] text-text-secondary leading-[1.6] mb-8">
              You&apos;re already a member. Continuing automatically...
            </p>

            {/* Auto-continue indicator */}
            <div className="flex items-center justify-center gap-2 text-text-muted">
              <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
              <span className="text-sm">Continuing in {autoCountdown}s</span>
            </div>

            {/* Manual continue button */}
            <button
              onClick={handleConfirmJoin}
              className="mt-6 w-full py-4 px-6 rounded-full font-sans font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{ backgroundColor: branding.primaryColor || 'var(--brand-accent-light)' }}
            >
              Continue now
            </button>

            {/* Use different account */}
            <button
              onClick={handleSignOutAndRetry}
              className="mt-4 w-full py-3 px-6 rounded-full font-sans font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Use a different account
            </button>

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

  // ============================================
  // CASE 3: Different Tenant - "Continue as" or "Use different account"
  // ============================================
  if (userState === 'different_tenant' && isSignedIn && !hasConfirmed) {
    const displayName = user?.firstName || membershipInfo?.userInfo?.firstName || '';
    const displayEmail = user?.primaryEmailAddress?.emailAddress || membershipInfo?.userInfo?.email || '';
    const displayImage = user?.imageUrl || membershipInfo?.userInfo?.imageUrl || '';
    
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
              Continue with your existing account or use a different one.
            </p>

            {/* Current user card */}
            <div className="bg-white border border-[#e1ddd8] rounded-2xl p-4 mb-6">
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
                  <div className="w-12 h-12 rounded-full bg-[#f5f3f0] flex items-center justify-center">
                    <span className="text-lg font-medium text-text-primary">
                      {displayName?.[0] || displayEmail?.[0] || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 text-left">
                  {displayName && (
                    <p className="font-medium text-text-primary">{displayName}</p>
                  )}
                  {displayEmail && (
                    <p className="text-sm text-text-secondary">{displayEmail}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={handleConfirmJoin}
                disabled={isLinking}
                className="w-full py-4 px-6 rounded-full font-sans font-bold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: branding.primaryColor || 'var(--brand-accent-light)' }}
              >
                {isLinking ? 'Setting up...' : `Continue as ${displayName || displayEmail}`}
              </button>
              
              <button
                onClick={handleSignOutAndRetry}
                disabled={isLinking}
                className="w-full py-3 px-6 rounded-full font-sans font-medium text-text-secondary hover:text-text-primary transition-colors border border-[#e1ddd8] disabled:opacity-50"
              >
                Sign up with a different account
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

  // State: User confirmed but linking (shouldn't happen often, but handle it)
  if (isSignedIn && hasConfirmed) {
    return <Loader branding={branding} message="Setting up your account..." />;
  }

  // ============================================
  // CASE 1: New User - Show sign-up form
  // ============================================
  const heading = config.heading || 'Create your account';
  const subheading = config.subheading || 'Sign up to continue your journey';

  // Construct URLs for iframe
  const subdomainBase = subdomain 
    ? `https://${subdomain}.growthaddicts.com`
    : 'https://growthaddicts.com';
  const currentOrigin = isCustomDomain ? `https://${hostname}` : (typeof window !== 'undefined' ? window.location.origin : '');
  const iframeSrc = `${subdomainBase}/join/embedded?origin=${encodeURIComponent(currentOrigin)}&flowSessionId=${flowSessionId}`;

  // Full-page centered layout matching SatelliteSignIn design
  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      {/* Back button at top-left */}
      {!isFirstStep && onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors z-10"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
      )}

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

          {/* Sign in link for existing users */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-brand-accent hover:text-[#8a6649] font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
