'use client';

import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
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
  const router = useRouter();

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

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        handleAuthSuccess();
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

      if (errorCode === 'form_identifier_not_found') {
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
        handleAuthSuccess();
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

  // Verification code UI
  if (verifying) {
    return (
      <div className="w-full max-w-lg mx-auto">
        <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#a07855]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              className="font-sans text-sm text-[#a07855] dark:text-[#b8896a] hover:text-[#8a6649] font-medium transition-colors disabled:opacity-50"
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
        <div className="bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg">
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
      <div className={embedded ? "" : "bg-white/80 backdrop-blur-sm border border-[#e1ddd8]/60 rounded-3xl p-8 shadow-lg"}>
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
              <div className="flex-1 h-px bg-[#e1ddd8]" />
              <span className="font-sans text-sm text-text-secondary">or</span>
              <div className="flex-1 h-px bg-[#e1ddd8]" />
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
                className="font-sans text-sm text-[#a07855] dark:text-[#b8896a] hover:text-[#8a6649] font-medium transition-colors"
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

