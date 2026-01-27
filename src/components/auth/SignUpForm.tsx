'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSignUp, useAuth, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AuthInput } from './AuthInput';
import { OAuthButton } from './OAuthButton';
import { VerificationCodeInput } from './VerificationCodeInput';

interface SignUpFormProps {
  redirectUrl?: string;
  embedded?: boolean;  // Running in iframe for satellite domain
  origin?: string;     // Parent window origin for postMessage
  hideOAuth?: boolean; // Hide OAuth buttons (used when OAuth is handled by parent)
  signInUrl?: string;  // Custom sign-in URL (e.g., with flowSessionId preserved for funnel flow)
  lockedEmail?: string; // If set, email is pre-filled and readonly (for invite-only funnels)
  lockedEmails?: string[]; // Multiple allowed emails (batch invites) - validated after signup
}

export function SignUpForm({ redirectUrl = '/', embedded = false, origin = '', hideOAuth = false, signInUrl, lockedEmail, lockedEmails }: SignUpFormProps) {
  const { signUp, isLoaded, setActive } = useSignUp();
  // Use treatPendingAsSignedOut: false to recognize users with pending session tasks
  // (e.g., choose-organization). This prevents the form from showing when user is
  // authenticated but has incomplete tasks.
  const { isSignedIn, sessionId } = useAuth({ treatPendingAsSignedOut: false });
  const { signOut } = useClerk();
  const router = useRouter();
  
  // Capture the current hostname for auto-enrollment
  const [signupDomain, setSignupDomain] = useState<string>('');
  // Track if we've already triggered a redirect to prevent loops
  const [hasTriggeredRedirect, setHasTriggeredRedirect] = useState(false);

  useEffect(() => {
    // Capture the domain on mount (client-side only)
    if (typeof window !== 'undefined') {
      setSignupDomain(window.location.hostname);
    }
  }, []);

  // Helper to handle redirects - use client-side navigation when possible
  // to avoid server-side auth timing issues after sign-up
  const handleRedirect = useCallback((url: string) => {
    // In development, preserve the ?tenant= param from current URL
    // This ensures the dev-tenant cookie is set on the redirected page
    let finalUrl = url;
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const currentParams = new URLSearchParams(window.location.search);
      const tenantParam = currentParams.get('tenant');
      if (tenantParam && !url.includes('tenant=')) {
        // Add tenant param to redirect URL
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = `${url}${separator}tenant=${tenantParam}`;
      }
    }

    // For full URLs, check if it's the same origin and extract pathname
    if (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) {
      try {
        const parsedUrl = new URL(finalUrl);
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

        // If same origin, use client-side navigation to avoid server-side auth race
        if (parsedUrl.origin === currentOrigin) {
          const relativePath = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
          router.push(relativePath);
          return;
        }
      } catch {
        // Invalid URL, fall through to window.location
      }
      window.location.href = finalUrl;
    } else {
      router.push(finalUrl);
    }
  }, [router]);

  // Helper to link session and redirect for localhost funnel flows
  // This avoids the cookie propagation issue by making API calls while session is still active
  const linkSessionAndRedirectForLocalhost = useCallback(async (clerkSessionId?: string | null): Promise<boolean> => {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ||
       window.location.hostname.endsWith('.localhost')); // Also support subdomain.localhost

    if (!isLocalhost || !redirectUrl.includes('/join/callback') || !redirectUrl.includes('flowSessionId=')) {
      return false; // Not a localhost funnel flow
    }

    console.log('[SignUpForm] Localhost funnel detected, linking session directly...');

    // Extract flowSessionId from redirectUrl
    const url = new URL(redirectUrl, window.location.origin);
    const flowSessionId = url.searchParams.get('flowSessionId');

    if (!flowSessionId) {
      return false;
    }

    try {
      // Wait for Clerk to initialize and propagate the session
      // 1000ms gives more time for session to be queryable via Clerk API
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('[SignUpForm] Calling link-session API with clerkSessionId:', clerkSessionId);
      
      // Call link-session API directly, passing clerkSessionId as backup auth
      const linkResponse = await fetch('/api/funnel/link-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowSessionId, clerkSessionId }),
      });

      if (!linkResponse.ok) {
        console.error('[SignUpForm] Link session failed:', await linkResponse.text());
        return false;
      }

      const linkData = await linkResponse.json();
      console.log('[SignUpForm] Session linked successfully:', linkData);

      // Get funnel details to redirect
      const sessionResponse = await fetch(`/api/funnel/session?sessionId=${flowSessionId}`);
      const sessionData = await sessionResponse.json();

      if (sessionData.session) {
        const funnelResponse = await fetch(`/api/funnel/${sessionData.session.funnelId}`);
        const funnelData = await funnelResponse.json();

        if (funnelData.funnel && funnelData.program) {
          if (linkData.enrolledInOrg) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Preserve ?tenant= param for localhost development
          let funnelUrl = `/join/${funnelData.program.slug}/${funnelData.funnel.slug}`;
          const currentParams = new URLSearchParams(window.location.search);
          const tenantParam = currentParams.get('tenant');
          if (tenantParam) {
            funnelUrl += `?tenant=${tenantParam}`;
          }

          console.log('[SignUpForm] Redirecting to funnel:', funnelUrl);
          router.push(funnelUrl);
          return true;
        }
      }

      // Fallback to dashboard (preserve tenant param)
      const currentParams = new URLSearchParams(window.location.search);
      const tenantParam = currentParams.get('tenant');
      const dashboardUrl = tenantParam ? `/?tenant=${tenantParam}` : '/';
      router.push(dashboardUrl);
      return true;
    } catch (err) {
      console.error('[SignUpForm] Error linking session:', err);
      return false;
    }
  }, [redirectUrl, router]);

  // Helper to handle successful auth
  // In embedded mode: send postMessage to parent with redirectUrl
  // Otherwise: redirect normally (with localhost funnel flow handling)
  // Optional sessionIdOverride for cases where session was just created and hook hasn't updated
  const handleAuthSuccess = useCallback(async (sessionIdOverride?: string | null) => {
    if (embedded && origin) {
      // Notify parent window of successful auth with redirectUrl
      // Parent can use this to redirect to the correct page (e.g., funnel callback with flowSessionId)
      window.parent.postMessage({ type: 'auth-success', redirectUrl }, origin);
      return;
    }

    // When embedded (in funnel) but no origin (same-origin embed), don't use localhost redirect.
    // Let the parent (SignupStep) detect isSignedIn via useEffect and call linkSessionAndContinue.
    // This ensures currentStepIndex gets incremented properly so user sees success step + confetti.
    if (embedded) {
      handleRedirect(redirectUrl);
      return;
    }

    // Try localhost funnel flow first (only for standalone SignUpForm, not embedded)
    const effectiveSessionId = sessionIdOverride || sessionId;
    const handled = await linkSessionAndRedirectForLocalhost(effectiveSessionId);
    if (!handled) {
      // Fallback: redirect to callback with session ID so it can activate the session
      // This is critical for localhost where cookies don't propagate properly
      let fallbackUrl = redirectUrl;
      if (effectiveSessionId && redirectUrl.includes('/join/callback')) {
        try {
          const url = new URL(redirectUrl, window.location.origin);
          url.searchParams.set('_sessionId', effectiveSessionId);
          // Also preserve tenant param
          const currentParams = new URLSearchParams(window.location.search);
          const tenantParam = currentParams.get('tenant');
          if (tenantParam && !url.searchParams.has('tenant')) {
            url.searchParams.set('tenant', tenantParam);
          }
          fallbackUrl = url.pathname + url.search;
        } catch {
          // URL parsing failed, use original
        }
      }
      handleRedirect(fallbackUrl);
    }
  }, [embedded, origin, redirectUrl, handleRedirect, linkSessionAndRedirectForLocalhost, sessionId]);;

  // Handle redirect when user is already signed in (useEffect to avoid render-time side effects)
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasTriggeredRedirect) {
      setHasTriggeredRedirect(true);
      handleAuthSuccess();
    }
  }, [isLoaded, isSignedIn, hasTriggeredRedirect, handleAuthSuccess]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(lockedEmail || '');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; email?: string; password?: string; code?: string }>({});

  const handleOAuthSignUp = async (provider: 'oauth_google' | 'oauth_apple') => {
    if (!isLoaded || !signUp) return;
    setOauthLoading(true);
    setError('');

    try {
      if (embedded && origin) {
        // In embedded mode, open OAuth in a popup instead of redirecting the iframe
        const currentOrigin = window.location.origin;
        // Use /join/oauth route for popup OAuth flow
        const oauthUrl = `${currentOrigin}/join/oauth?provider=${provider}&returnUrl=${encodeURIComponent(origin + '?from_auth=1')}`;
        
        const popup = window.open(
          oauthUrl,
          'oauth-popup',
          'width=500,height=600,menubar=no,toolbar=no,location=no,status=no'
        );
        
        if (!popup) {
          setError('Popup was blocked. Please allow popups and try again.');
          setOauthLoading(false);
          return;
        }
        
        // The popup will handle the OAuth flow and postMessage back
        setOauthLoading(false);
      } else {
        // Normal OAuth flow with redirect - pass signupDomain for org enrollment
        const signupDomain = window.location.hostname;
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: '/sso-callback',
          redirectUrlComplete: redirectUrl,
          unsafeMetadata: { signupDomain },
        });
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Something went wrong. Please try again.');
      setOauthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[SignUpForm] handleEmailSignUp called, isLoaded:', isLoaded, 'signUp:', !!signUp);
    if (!isLoaded || !signUp) {
      console.error('[SignUpForm] Clerk not ready - isLoaded:', isLoaded, 'signUp:', signUp);
      setError('Authentication system not ready. Please refresh the page.');
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({});

    // Basic validation
    const errors: { firstName?: string; lastName?: string; email?: string; password?: string } = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email';
    // Validate email against locked emails list (batch invites)
    else if (lockedEmails && lockedEmails.length > 0) {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedLocked = lockedEmails.map(e => e.toLowerCase());
      if (!normalizedLocked.includes(normalizedEmail)) {
        errors.email = 'This email is not on the invite list. Please use the email your invite was sent to.';
      }
    }
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      // Store signup intent for tenant-branded verification emails
      // This allows the email webhook to know which org to brand for
      if (signupDomain) {
        try {
          await fetch('/api/auth/signup-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, domain: signupDomain }),
          });
        } catch (intentError) {
          // Non-blocking - continue with signup even if intent storage fails
          console.warn('Failed to store signup intent:', intentError);
        }
      }

      console.log('[SignUpForm] Calling signUp.create...');
      console.log('[SignUpForm] Current signUp state:', { id: signUp.id, status: signUp.status });

      // If there's a stale signup attempt, we need to handle it
      // Check if signup already exists with same email - if so, it might be stale
      if (signUp.id && signUp.status !== 'complete') {
        console.log('[SignUpForm] Found existing incomplete signup, attempting to continue or restart...');
      }

      const result = await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email,
        password,
        // Pass signup domain for auto-enrollment to organization
        unsafeMetadata: {
          signupDomain: signupDomain,
        },
      });
      console.log('[SignUpForm] signUp.create succeeded, status:', result.status);

      // Check if signup completed immediately (no verification needed)
      // This can happen in some Clerk configurations
      if (result.status === 'complete') {
        console.log('[SignUpForm] Signup complete, activating session...');
        await setActive({ session: result.createdSessionId });

        // Try localhost funnel flow (makes API calls directly while session is active)
        // Pass the session ID so the API can verify auth even if cookies don't propagate
        const handled = await linkSessionAndRedirectForLocalhost(result.createdSessionId);
        if (handled) {
          return;
        }

        // Non-localhost or non-funnel flow: use normal redirect
        // Wait for session to propagate before redirecting
        console.log('[SignUpForm] Waiting for session propagation...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Pass the session ID to the callback URL so it can activate it if cookies don't work
        let finalRedirectUrl = redirectUrl;
        if (result.createdSessionId) {
          const url = new URL(redirectUrl, window.location.origin);
          url.searchParams.set('_sessionId', result.createdSessionId);
          // Preserve ?tenant= param for localhost development
          const currentParams = new URLSearchParams(window.location.search);
          const tenantParam = currentParams.get('tenant');
          if (tenantParam) {
            url.searchParams.set('tenant', tenantParam);
          }
          finalRedirectUrl = url.pathname + url.search;
        }

        // Use hard redirect to ensure Clerk re-initializes with the new session
        // Client-side navigation (router.push) doesn't always pick up the new session
        console.log('[SignUpForm] Redirecting to:', finalRedirectUrl);
        window.location.href = finalRedirectUrl;
        return;
      }

      // Send email verification code
      console.log('[SignUpForm] Calling prepareEmailAddressVerification...');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      console.log('[SignUpForm] Verification prepared, setting pendingVerification=true');
      setPendingVerification(true);
      console.log('[SignUpForm] setPendingVerification called');
    } catch (err: unknown) {
      console.error('[SignUpForm] Clerk error:', JSON.stringify(err, null, 2));
      const clerkError = err as { errors?: Array<{ message: string; code: string; longMessage?: string }> };
      console.error('[SignUpForm] Error details:', clerkError.errors);
      const errorMessage = clerkError.errors?.[0]?.longMessage || clerkError.errors?.[0]?.message || 'Something went wrong. Please try again.';
      const errorCode = clerkError.errors?.[0]?.code;

      // Handle "session already exists" error by signing out and retrying
      if (errorCode === 'session_exists' || errorMessage.toLowerCase().includes('session already exists')) {
        try {
          await signOut();
          // After signing out, retry the sign-up
          await signUp.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            emailAddress: email,
            password,
            unsafeMetadata: { signupDomain },
          });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
          return;
        } catch (retryErr) {
          console.error('[SignUpForm] Retry after signOut failed:', retryErr);
          setError('Please refresh the page and try again.');
        }
      } else if (errorCode === 'form_identifier_exists') {
        // Email already exists - show helpful error with sign-in link
        // If signInUrl is provided (e.g., from funnel flow), use it to preserve flowSessionId
        const signInLink = signInUrl || '/sign-in';
        setFieldErrors({
          email: `An account with this email already exists. <a href="${signInLink}" class="text-brand-accent hover:underline font-medium">Sign in instead</a>`
        });
      } else if (errorCode === 'form_identifier_not_found' || errorMessage.toLowerCase().includes('no sign up attempt was found')) {
        // Sign-up state was lost (page refresh, navigation, etc.)
        // This can happen due to stale Clerk SDK state - try to create fresh
        console.log('[SignUpForm] Stale signup state detected, retrying with fresh create...');
        try {
          await signUp.create({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            emailAddress: email,
            password,
            unsafeMetadata: { signupDomain },
          });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setPendingVerification(true);
          return; // Success on retry
        } catch (retryErr) {
          console.error('[SignUpForm] Retry after stale state failed:', retryErr);
          setError('Unable to create account. Please refresh the page and try again.');
        }
      } else if (errorCode === 'form_password_pwned') {
        setFieldErrors({ password: 'This password was found in a data breach. Please create a unique password with a mix of letters, numbers, and symbols.' });
      } else if (errorCode === 'form_password_length_too_short') {
        setFieldErrors({ password: 'Password must be at least 8 characters' });
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setLoading(true);
    setError('');
    setFieldErrors({});

    if (!verificationCode || verificationCode.length < 6) {
      setFieldErrors({ code: 'Please enter the 6-digit code' });
      setLoading(false);
      return;
    }

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // Pass the session ID directly since useAuth hook may not have updated yet
        await handleAuthSuccess(result.createdSessionId);
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; code: string }> };
      const errorCode = clerkError.errors?.[0]?.code;

      if (errorCode === 'form_code_incorrect') {
        setFieldErrors({ code: 'Incorrect code. Please check and try again.' });
      } else {
        setError(clerkError.errors?.[0]?.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signUp) return;
    setError('');

    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError(''); // Clear any previous errors
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Failed to resend code. Please try again.');
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If user is already signed in, show spinner while useEffect handles redirect
  if (isSignedIn) {
    return (
      <div className="w-full flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Verification step
  if (pendingVerification) {
    // Cubic bezier easing for smooth animations
    const smoothEase = [0.16, 1, 0.3, 1] as const;

    // Animation variants for staggered entrance
    const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: 0.05,
          delayChildren: 0.1,
        },
      },
    };

    const itemVariants = {
      hidden: { opacity: 0, y: 16 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.4,
          ease: smoothEase,
        },
      },
    };

    // When embedded, skip the outer container (parent already provides it)
    const content = (
      <>
        <motion.div
          className="text-center mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
            <motion.div 
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center"
              variants={itemVariants}
            >
              <svg className="w-8 h-8 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </motion.div>
            <motion.h2 
              className="font-albert text-2xl text-text-primary tracking-[-1px] mb-2"
              variants={itemVariants}
            >
              Check your email
            </motion.h2>
            <motion.p 
              className="font-sans text-sm text-text-secondary"
              variants={itemVariants}
            >
              We sent a verification code to <span className="font-medium text-text-primary">{email}</span>
            </motion.p>
          </motion.div>

          <motion.form 
            onSubmit={handleVerification} 
            className="space-y-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <VerificationCodeInput
                value={verificationCode}
                onChange={setVerificationCode}
                error={fieldErrors.code}
                disabled={loading}
                autoFocus
              />
            </motion.div>

            {error && (
              <motion.div 
                className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-sm text-red-600 dark:text-red-400 font-sans">{error}</p>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent hover:brightness-110 text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-brand-accent/20 flex items-center justify-center gap-2"
              variants={itemVariants}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                <>
                  Verify & continue
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </motion.button>
          </motion.form>

          <motion.div 
            className="mt-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            <button
              type="button"
              onClick={handleResendCode}
              className="font-sans text-sm text-brand-accent hover:text-[#8a6649] font-medium transition-colors"
            >
              Didn&apos;t receive the code? Resend
            </button>
          </motion.div>

          <motion.div
            className="mt-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.3 }}
          >
            <button
              type="button"
              onClick={() => {
                setPendingVerification(false);
                setVerificationCode('');
                setError('');
              }}
              className="font-sans text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back to sign up
            </button>
          </motion.div>
      </>
    );

    // When embedded, return content without container (parent provides it)
    if (embedded) {
      return content;
    }

    // Standalone: wrap in container
    return (
      <div className="w-full max-w-lg mx-auto">
        <motion.div
          className="bg-white/80 dark:bg-[#171b22]/90 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 rounded-3xl p-8 shadow-lg"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: smoothEase }}
        >
          {content}
        </motion.div>
      </div>
    );
  }

  // Main sign up form
  return (
    <div className={embedded ? "w-full" : "w-full max-w-lg mx-auto"}>
      {/* Card wrapper - only when NOT embedded (iframe parent already has card) */}
      <div className={embedded ? "" : "bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg"}>
        {/* OAuth Buttons - hidden when parent handles OAuth */}
        {!hideOAuth && (
          <>
            <div className="space-y-3">
              <OAuthButton
                provider="google"
                onClick={() => handleOAuthSignUp('oauth_google')}
                disabled={loading}
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

        {/* Email Form */}
        <form onSubmit={handleEmailSignUp} className="space-y-5">
          {/* Name Fields Row */}
          <div className="grid grid-cols-2 gap-4">
            <AuthInput
              label="First name"
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={fieldErrors.firstName}
              disabled={loading}
            />
            <AuthInput
              label="Last name"
              type="text"
              autoComplete="family-name"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={fieldErrors.lastName}
              disabled={loading}
            />
          </div>

          <AuthInput
            label={lockedEmail ? "Email address (invite-only)" : (lockedEmails?.length ? "Email address (private invite)" : "Email address")}
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => !lockedEmail && setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={loading || !!lockedEmail}
            readOnly={!!lockedEmail}
          />
          {lockedEmail && (
            <p className="text-xs text-[#8a857f] dark:text-[#7d8190] -mt-2 mb-2">
              This invite is for {lockedEmail}. You must sign up with this email.
            </p>
          )}
          {!lockedEmail && lockedEmails && lockedEmails.length > 0 && (
            <p className="text-xs text-[#8a857f] dark:text-[#7d8190] -mt-2 mb-2">
              Please sign up with the email your invite was sent to.
            </p>
          )}

          <AuthInput
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            disabled={loading}
          />

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-sm text-red-600 font-sans">{error}</p>
            </div>
          )}

          {/* Clerk CAPTCHA container - required for bot protection */}
          <div id="clerk-captcha" />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent hover:brightness-110 text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-brand-accent/20 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-[#2c2520]/30 dark:border-white/30 border-t-[#2c2520] dark:border-t-white rounded-full animate-spin" />
                Creating account...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

