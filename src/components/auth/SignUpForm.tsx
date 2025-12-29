'use client';

import { useState, useEffect } from 'react';
import { useSignUp } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { AuthInput } from './AuthInput';
import { OAuthButton } from './OAuthButton';
import { VerificationCodeInput } from './VerificationCodeInput';

interface SignUpFormProps {
  redirectUrl?: string;
  embedded?: boolean;  // Running in iframe for satellite domain
  origin?: string;     // Parent window origin for postMessage
  hideOAuth?: boolean; // Hide OAuth buttons (used when OAuth is handled by parent)
}

export function SignUpForm({ redirectUrl = '/onboarding/welcome', embedded = false, origin = '', hideOAuth = false }: SignUpFormProps) {
  const { signUp, isLoaded, setActive } = useSignUp();
  const router = useRouter();
  
  // Capture the current hostname for auto-enrollment
  const [signupDomain, setSignupDomain] = useState<string>('');
  
  useEffect(() => {
    // Capture the domain on mount (client-side only)
    if (typeof window !== 'undefined') {
      setSignupDomain(window.location.hostname);
    }
  }, []);

  // Helper to handle successful auth
  // In embedded mode: send postMessage to parent
  // Otherwise: redirect normally
  const handleAuthSuccess = () => {
    if (embedded && origin) {
      // Notify parent window of successful auth
      window.parent.postMessage({ type: 'auth-success' }, origin);
    } else {
      handleRedirect(redirectUrl);
    }
  };

  // Helper to handle redirects - external URLs (http/https) use window.location
  // Internal paths use Next.js router
  const handleRedirect = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
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
    if (!isLoaded || !signUp) return;

    setLoading(true);
    setError('');
    setFieldErrors({});

    // Basic validation
    const errors: { firstName?: string; lastName?: string; email?: string; password?: string } = {};
    if (!firstName.trim()) errors.firstName = 'First name is required';
    if (!lastName.trim()) errors.lastName = 'Last name is required';
    if (!email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      await signUp.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        emailAddress: email,
        password,
        // Pass signup domain for auto-enrollment to organization
        unsafeMetadata: {
          signupDomain: signupDomain,
        },
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message: string; code: string }> };
      const errorMessage = clerkError.errors?.[0]?.message || 'Something went wrong. Please try again.';
      const errorCode = clerkError.errors?.[0]?.code;

      if (errorCode === 'form_identifier_exists') {
        setFieldErrors({ email: 'An account with this email already exists' });
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
        handleAuthSuccess();
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

  // Verification step
  if (pendingVerification) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#f3f1ef] flex items-center justify-center">
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

          <form onSubmit={handleVerification} className="space-y-6">
            <VerificationCodeInput
              value={verificationCode}
              onChange={setVerificationCode}
              error={fieldErrors.code}
              disabled={loading}
              autoFocus
            />

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-sm text-red-600 font-sans">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Verify email'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleResendCode}
              className="font-sans text-sm text-brand-accent hover:text-[#8a6649] font-medium transition-colors"
            >
              Didn&apos;t receive the code? Resend
            </button>
          </div>

          <div className="mt-4 text-center">
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
          </div>
        </div>
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
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            disabled={loading}
          />

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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2c2520] hover:bg-[#1a1512] text-white font-sans font-bold text-base rounded-full py-4 px-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

