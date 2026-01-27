'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSignIn, useAuth, useClerk, useSession } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AuthInput } from './AuthInput';
import { OAuthButton } from './OAuthButton';
import { VerificationCodeInput } from './VerificationCodeInput';

interface SignInFormProps {
  redirectUrl?: string;
  embedded?: boolean;  // Running in iframe for satellite domain
  origin?: string;     // Parent window origin for postMessage
  hideOAuth?: boolean; // Hide OAuth buttons (used when OAuth is handled by parent)
}

export function SignInForm({ redirectUrl = '/', embedded = false, origin = '', hideOAuth = false }: SignInFormProps) {
  const { signIn, isLoaded, setActive } = useSignIn();
  // Use treatPendingAsSignedOut: false to recognize users with pending session tasks
  // (e.g., choose-organization). This prevents the form from showing when user is
  // authenticated but has incomplete tasks.
  const { isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { session } = useSession();
  const { signOut } = useClerk();
  const router = useRouter();

  // Check if we're on the marketing domain (coachful.co without subdomain)
  const [isMarketingDomain, setIsMarketingDomain] = useState(false);
  // Track if we've already triggered a redirect to prevent loops
  const [hasTriggeredRedirect, setHasTriggeredRedirect] = useState(false);
  // Track when we've successfully authenticated and are redirecting
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname.toLowerCase();
      // Marketing domain: coachful.co or www.coachful.co (not subdomains)
      const isMarketing = hostname === 'coachful.co' || hostname === 'www.coachful.co';
      setIsMarketingDomain(isMarketing);
    }
  }, []);

  // Helper to handle redirects - use client-side navigation when possible
  // to avoid server-side auth timing issues after sign-in
  const handleRedirect = useCallback((url: string) => {
    console.log('[SignInForm] handleRedirect called with:', url);

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
        console.log('[SignInForm] Preserving tenant param, new URL:', finalUrl);
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
          console.log('[SignInForm] Using router.push for same-origin URL:', relativePath);
          router.push(relativePath);
          return;
        }
      } catch {
        // Invalid URL, fall through to window.location
      }
      console.log('[SignInForm] Using window.location.href for cross-origin URL');
      window.location.href = finalUrl;
    } else {
      console.log('[SignInForm] Using router.push for relative URL:', finalUrl);
      router.push(finalUrl);
    }
  }, [router]);

  // Helper to link session and redirect for localhost funnel flows
  // This avoids the cookie propagation issue by making API calls while session is active
  const linkSessionAndRedirectForLocalhost = useCallback(async (): Promise<boolean> => {
    const isLocalhost = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (!isLocalhost || !redirectUrl.includes('/join/callback') || !redirectUrl.includes('flowSessionId=')) {
      return false; // Not a localhost funnel flow
    }

    console.log('[SignInForm] Localhost funnel detected, linking session directly...');

    // Extract flowSessionId from redirectUrl
    const url = new URL(redirectUrl, window.location.origin);
    const flowSessionId = url.searchParams.get('flowSessionId');

    if (!flowSessionId) {
      return false;
    }

    try {
      // Wait for Clerk to initialize session
      await new Promise(resolve => setTimeout(resolve, 500));

      // Call link-session API directly
      const linkResponse = await fetch('/api/funnel/link-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowSessionId }),
      });

      if (!linkResponse.ok) {
        console.error('[SignInForm] Link session failed:', await linkResponse.text());
        return false;
      }

      const linkData = await linkResponse.json();
      console.log('[SignInForm] Session linked successfully:', linkData);

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

          console.log('[SignInForm] Redirecting to funnel:', funnelUrl);
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
      console.error('[SignInForm] Error linking session:', err);
      return false;
    }
  }, [redirectUrl, router]);

  // Helper to handle successful auth
  // In embedded mode: send postMessage to parent with redirectUrl
  // On marketing domain: call API to determine redirect URL (for coaches)
  // Otherwise: redirect normally (with localhost funnel flow handling)
  const handleAuthSuccess = useCallback(async () => {
    console.log('[SignInForm] handleAuthSuccess called, redirectUrl:', redirectUrl);
    // Set redirecting state immediately to show spinner
    setIsRedirecting(true);

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

    // Try localhost funnel flow first (only for standalone SignInForm, not embedded)
    const handled = await linkSessionAndRedirectForLocalhost();
    if (handled) {
      return;
    }

    // On marketing domain, check if user is a coach with an org
    // and redirect them appropriately (to onboarding or their subdomain)
    if (isMarketingDomain) {
      try {
        const response = await fetch('/api/auth/post-signin-redirect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.redirect) {
            handleRedirect(data.redirect);
            return;
          }
        }
      } catch (error) {
        console.error('[SignInForm] Error fetching redirect URL:', error);
        // Fall through to default redirect on error
      }
    }

    // Default: use provided redirectUrl
    handleRedirect(redirectUrl);
  }, [embedded, origin, isMarketingDomain, redirectUrl, handleRedirect, linkSessionAndRedirectForLocalhost]);

  // Handle redirect when user is already signed in (useEffect to avoid render-time side effects)
  // With treatPendingAsSignedOut: false, isSignedIn will be true even for pending sessions
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasTriggeredRedirect) {
      console.log('[SignInForm] User is signed in (sessionStatus:', session?.status, '), redirecting');
      setHasTriggeredRedirect(true);
      handleAuthSuccess();
    }
  }, [isLoaded, isSignedIn, session?.status, hasTriggeredRedirect, handleAuthSuccess]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Verification state (for 2FA / email verification)
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleOAuthSignIn = async (provider: 'oauth_google' | 'oauth_apple') => {
    if (!isLoaded || !signIn) return;
    setOauthLoading(true);
    setError('');

    try {
      if (embedded && origin) {
        // In embedded mode, open OAuth in a popup instead of redirecting the iframe
        // The popup will post a message back when complete
        const currentOrigin = window.location.origin;
        const oauthUrl = `${currentOrigin}/sign-in?oauth=${provider}&popup=1&origin=${encodeURIComponent(origin)}`;
        
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
        // We don't need to do anything else here - parent window listens for postMessage
        setOauthLoading(false);
      } else {
        // Normal OAuth flow with redirect
        // Always use the provided redirectUrl - it may contain flowSessionId for funnel flow
        // The marketing domain redirect logic will be handled after sign-in
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: '/sso-callback',
          redirectUrlComplete: redirectUrl,
        });
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Something went wrong. Please try again.');
      setOauthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setLoading(true);
    setError('');
    setFieldErrors({});

    // Basic validation
    const errors: { email?: string; password?: string } = {};
    if (!email) errors.email = 'Email is required';
    if (!password) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      console.log('[SignInForm] Sign-in result status:', result.status);
      if (result.status === 'complete') {
        console.log('[SignInForm] Sign-in complete, setting session active');
        await setActive({ session: result.createdSessionId });
        console.log('[SignInForm] Session set active, calling handleAuthSuccess');
        await handleAuthSuccess();
      } else if (result.status === 'needs_first_factor' || result.status === 'needs_second_factor') {
        // User needs to verify with a code (email verification or 2FA)
        // Check if email_code strategy is available
        const emailCodeFactor = result.supportedFirstFactors?.find(
          (factor) => factor.strategy === 'email_code'
        );
        
        if (emailCodeFactor && 'emailAddressId' in emailCodeFactor) {
          // Prepare the email code verification
          await signIn.prepareFirstFactor({
            strategy: 'email_code',
            emailAddressId: emailCodeFactor.emailAddressId,
          });
        }
        
        // Switch to verification UI
        setVerifying(true);
        setCode('');
      } else {
        setError('Sign in incomplete. Please try again.');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; code: string }> };
      const errorCode = clerkError.errors?.[0]?.code;
      const errorMessage = clerkError.errors?.[0]?.message || 'Something went wrong. Please try again.';

      // Handle "session already exists" error by signing out and retrying
      if (errorCode === 'session_exists' || errorMessage.toLowerCase().includes('session already exists')) {
        try {
          await signOut();
          // After signing out, retry the sign-in
          const result = await signIn.create({
            identifier: email,
            password,
          });
          if (result.status === 'complete') {
            await setActive({ session: result.createdSessionId });
            await handleAuthSuccess();
            return;
          }
        } catch (retryErr) {
          console.error('[SignInForm] Retry after signOut failed:', retryErr);
          setError('Please refresh the page and try again.');
        }
      } else if (errorCode === 'form_identifier_not_found') {
        setFieldErrors({ email: 'No account found with this email' });
      } else if (errorCode === 'form_password_incorrect') {
        setFieldErrors({ password: 'Incorrect password' });
      } else if (errorCode === 'strategy_for_user_invalid') {
        setError('This account uses a different sign-in method. Try signing in with Google.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setVerifyLoading(true);
    setError('');

    if (!code || code.length < 6) {
      setError('Please enter the 6-digit verification code');
      setVerifyLoading(false);
      return;
    }

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        await handleAuthSuccess();
      } else if (result.status === 'needs_second_factor') {
        // Handle 2FA if needed (for future expansion)
        setError('Additional verification required. Please contact support.');
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; code: string }> };
      const errorCode = clerkError.errors?.[0]?.code;
      const errorMessage = clerkError.errors?.[0]?.message || 'Invalid verification code. Please try again.';

      if (errorCode === 'form_code_incorrect') {
        setError('Invalid verification code. Please check and try again.');
      } else if (errorCode === 'verification_expired') {
        setError('Verification code expired. Please request a new one.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signIn) return;

    setVerifyLoading(true);
    setError('');

    try {
      // Get the current sign-in attempt and prepare a new code
      const emailCodeFactor = signIn.supportedFirstFactors?.find(
        (factor) => factor.strategy === 'email_code'
      );

      if (emailCodeFactor && 'emailAddressId' in emailCodeFactor) {
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailCodeFactor.emailAddressId,
        });
        setCode('');
        setError(''); // Clear any previous error
        // Show success message briefly
        setError('New verification code sent to your email.');
        setTimeout(() => setError(''), 3000);
      } else {
        setError('Unable to resend code. Please try signing in again.');
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string }> };
      setError(clerkError.errors?.[0]?.message || 'Failed to resend code. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    setVerifying(false);
    setCode('');
    setError('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setResetLoading(true);
    setResetError('');

    if (!resetEmail) {
      setResetError('Please enter your email address');
      setResetLoading(false);
      return;
    }

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: resetEmail,
      });
      setResetSent(true);
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; code: string }> };
      const errorCode = clerkError.errors?.[0]?.code;

      if (errorCode === 'form_identifier_not_found') {
        setResetError('No account found with this email');
      } else {
        setResetError(clerkError.errors?.[0]?.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If user is already signed in OR we're redirecting after successful auth, show spinner
  // With treatPendingAsSignedOut: false, isSignedIn includes pending sessions
  if (isSignedIn || isRedirecting) {
    console.log('[SignInForm] Showing spinner (isSignedIn:', isSignedIn, ', sessionStatus:', session?.status, ', isRedirecting:', isRedirecting, ')');
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-2 border-text-secondary/30 border-t-text-primary rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Redirecting...</p>
      </div>
    );
  }

  // Verification code UI
  if (verifying) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-border-subtle/60 rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-accent/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-albert text-2xl text-text-primary tracking-[-1px] mb-2">
              Check your email
            </h2>
            <p className="font-sans text-sm text-text-secondary">
              We sent a verification code to <span className="font-medium text-text-primary">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-6">
            <VerificationCodeInput
              value={code}
              onChange={setCode}
              error={error && error.includes('Invalid') ? error : undefined}
              disabled={verifyLoading}
              autoFocus
            />

            {error && !error.includes('Invalid') && (
              <div className={`p-4 border rounded-2xl ${error.includes('sent') ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-sm font-sans ${error.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={verifyLoading || code.length < 6}
              className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
            >
              {verifyLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Verify and sign in'
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={verifyLoading}
              className="font-sans text-sm text-brand-accent hover:text-[#8a6649] font-medium transition-colors disabled:opacity-50"
            >
              Didn&apos;t receive the code? Resend
            </button>
            <button
              type="button"
              onClick={handleBackToSignIn}
              className="font-sans text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password modal
  if (showForgotPassword) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white/80 dark:bg-surface/80 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-border-subtle/60 rounded-3xl p-8 shadow-lg">
          {resetSent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-albert text-2xl text-text-primary tracking-[-1px] mb-2">
                  Check your email
                </h2>
                <p className="font-sans text-sm text-text-secondary">
                  We sent a password reset link to <span className="font-medium text-text-primary">{resetEmail}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                  setResetEmail('');
                }}
                className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="font-albert text-2xl text-text-primary tracking-[-1px] mb-2">
                  Reset your password
                </h2>
                <p className="font-sans text-sm text-text-secondary">
                  Enter your email and we&apos;ll send you a reset link
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                <AuthInput
                  label="Email address"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetLoading}
                  autoFocus
                />

                {resetError && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="text-sm text-red-600 font-sans">{resetError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
                >
                  {resetLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetError('');
                    setResetEmail('');
                  }}
                  className="font-sans text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main sign in form
  return (
    <div className={embedded ? "w-full" : "w-full max-w-lg mx-auto"}>
      {/* Card wrapper - only when NOT embedded (iframe parent already has card) */}
      <div className={embedded ? "" : "bg-white/80 dark:bg-surface/80 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-border-subtle/60 rounded-3xl p-8 shadow-lg"}>
        {/* OAuth Buttons - hidden when parent handles OAuth */}
        {!hideOAuth && (
          <>
            <div className="space-y-3">
              <OAuthButton
                provider="google"
                onClick={() => handleOAuthSignIn('oauth_google')}
                disabled={loading}
                loading={oauthLoading}
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8">
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-border-subtle" />
              <span className="font-sans text-sm text-text-secondary">or</span>
              <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-border-subtle" />
            </div>
          </>
        )}

        {/* Email Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-5">
          <AuthInput
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={loading}
          />

          <div>
            <AuthInput
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={loading}
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="font-sans text-sm text-brand-accent hover:text-[#8a6649] font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-sm text-red-600 font-sans">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Sign in
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

