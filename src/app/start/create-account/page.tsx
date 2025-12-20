'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSignUp, useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useGuestSession } from '@/hooks/useGuestSession';
import { VerificationCodeInput } from '@/components/onboarding/VerificationCodeInput';

type Step = 'create' | 'verify' | 'linking';

/**
 * Guest Create Account Page (NEW)
 * Creates a Clerk account after payment
 * Email is pre-filled from the guest session
 */
export default function GuestCreateAccountPage() {
  const router = useRouter();
  const { data, sessionId, clearSession, refreshData, saveData, isLoading: sessionLoading } = useGuestSession();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  
  const [step, setStep] = useState<Step>('create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  
  // Capture the current hostname for auto-enrollment
  const [signupDomain, setSignupDomain] = useState<string>('');
  
  useEffect(() => {
    // Capture the domain on mount (client-side only)
    if (typeof window !== 'undefined') {
      setSignupDomain(window.location.hostname);
    }
  }, []);

  // Pre-fill email from guest session
  useEffect(() => {
    if (data.email) {
      setEmail(data.email);
    }
  }, [data.email]);

  const linkAccountAndRedirect = useCallback(async () => {
    if (!sessionId) return;
    
    setStep('linking');
    setIsLoading(true);
    setError(null);

    try {
      // Link guest session to the new user account
      const response = await fetch('/api/guest/link-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestSessionId: sessionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to link account');
      }

      // Set flag to prevent billing redirect race condition
      sessionStorage.setItem('ga_just_completed_payment', 'true');

      // Clear the guest session
      clearSession();

      // Redirect to identity setup (moved to after payment)
      router.push('/start/identity');
    } catch (err) {
      console.error('Link account error:', err);
      const message = err instanceof Error ? err.message : 'Failed to complete account setup. Please try again.';
      setError(message);
      setStep('create');
      setIsLoading(false);
    }
  }, [sessionId, clearSession, router]);

  // If already signed in, try to link account
  useEffect(() => {
    if (isSignedIn && sessionId) {
      linkAccountAndRedirect();
    }
  }, [isSignedIn, sessionId, linkAccountAndRedirect]);

  // Redirect if no payment completed
  useEffect(() => {
    if (!sessionLoading && (!data.paymentStatus || data.paymentStatus !== 'completed') && !data.selectedPlan) {
      // If user hasn't paid, refresh to check for updated payment status
      refreshData();
    }
  }, [sessionLoading, data.paymentStatus, data.selectedPlan, refreshData]);

  // Self-correct: Ensure currentStep is set to create-account if payment was completed
  // This fixes the issue where users who paid are redirected to /start/plan
  useEffect(() => {
    if (!sessionLoading && data.paymentStatus === 'completed') {
      saveData({ currentStep: 'create-account' });
    }
  }, [sessionLoading, data.paymentStatus, saveData]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoaded || !signUp) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Create Clerk account with email and password
      await signUp.create({
        emailAddress: email,
        password: password,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        // Pass signup domain for auto-enrollment to organization
        unsafeMetadata: {
          signupDomain: signupDomain,
        },
      });

      // Send email verification code
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      
      setStep('verify');
    } catch (err) {
      console.error('Sign up error:', err);
      
      // Handle specific Clerk errors
      const clerkError = err as { errors?: Array<{ code?: string; message?: string }> };
      const errorCode = clerkError.errors?.[0]?.code;
      const errorMessage = clerkError.errors?.[0]?.message;
      
      // Handle "email already exists" error
      if (errorCode === 'form_identifier_exists' || errorMessage?.toLowerCase().includes('email address is taken')) {
        setError(
          <>
            An account with this email already exists.{' '}
            <Link href="/sign-in" className="underline font-medium hover:text-red-800">Sign in instead</Link>
          </>
        );
      } else if (errorMessage) {
        setError(errorMessage);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoaded || !signUp) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Verify the email code
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (completeSignUp.status === 'complete') {
        // Set the active session
        await setActive({ session: completeSignUp.createdSessionId });
        
        // Now link the guest session to the new user
        // The useEffect for isSignedIn will handle this
      } else {
        console.error('Sign up not complete:', completeSignUp);
        setError('Verification incomplete. Please try again.');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Verification error:', err);
      
      const clerkError = err as { errors?: Array<{ message?: string }> };
      if (clerkError.errors?.[0]?.message) {
        setError(clerkError.errors[0].message);
      } else {
        setError('Invalid verification code. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!isLoaded || !signUp) return;
    
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError(null);
    } catch (err) {
      console.error('Resend error:', err);
      setError('Failed to resend code. Please try again.');
    }
  };

  if (!isLoaded || sessionLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-8 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={56} 
            height={56} 
            className="rounded-lg"
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md mx-auto">
            {step === 'linking' && (
              <motion.div
                className="text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative mb-6 mx-auto w-16 h-16">
                  <div className="w-16 h-16 rounded-full border-2 border-[#e1ddd8]" />
                  <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
                </div>
                <h1 className="font-albert text-[28px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
                  Setting up your account...
                </h1>
                <p className="font-sans text-[16px] text-text-secondary">
                  Please wait while we complete your setup.
                </p>
              </motion.div>
            )}

            {step === 'create' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-center mb-8">
                  <h1 className="font-albert text-[32px] lg:text-[40px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                    Create your account
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary">
                    Set a password to secure your account
                  </p>
                </div>

                <form onSubmit={handleCreateAccount} className="space-y-5">
                  {/* Email - pre-filled and read-only */}
                  <div>
                    <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      readOnly
                      className="w-full px-4 py-3.5 bg-[#f5f3f0] border-2 border-[#e1ddd8] rounded-2xl font-sans text-[16px] text-text-secondary cursor-not-allowed"
                    />
                    <p className="mt-1.5 text-[12px] text-text-muted">
                      This is the email you used for payment.{' '}
                      <button
                        type="button"
                        onClick={() => router.push('/start/create-account/change-email')}
                        className="text-[#a07855] hover:underline"
                      >
                        Wrong email? Change it
                      </button>
                    </p>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      placeholder="Create a password"
                      minLength={8}
                      required
                      className="w-full px-4 py-3.5 bg-white border-2 border-[#e1ddd8] rounded-2xl font-sans text-[16px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-[#a07855] disabled:opacity-50"
                    />
                    <p className="mt-1.5 text-[12px] text-text-muted">
                      At least 8 characters
                    </p>
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div 
                      className="p-4 bg-red-50 border border-red-200 rounded-xl"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-sm text-red-700">{error}</p>
                    </motion.div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading || !password || password.length < 8}
                    className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {step === 'verify' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="text-center mb-8">
                  <h1 className="font-albert text-[32px] lg:text-[40px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                    Verify your email
                  </h1>
                  <p className="font-sans text-[16px] text-text-secondary">
                    We sent a code to <span className="font-semibold">{email}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyEmail} className="space-y-6">
                  {/* Verification code - 6 separate boxes */}
                  <div>
                    <label className="block font-sans text-[14px] font-medium text-text-primary mb-4 text-center">
                      Enter the 6-digit code
                    </label>
                    <VerificationCodeInput
                      length={6}
                      value={verificationCode}
                      onChange={setVerificationCode}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div 
                      className="p-4 bg-red-50 border border-red-200 rounded-xl"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <p className="text-sm text-red-700">{error}</p>
                    </motion.div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      'Verify email'
                    )}
                  </button>

                  {/* Resend code */}
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="w-full text-center font-sans text-[14px] text-text-secondary hover:text-[#a07855] transition-colors disabled:opacity-50"
                  >
                    Didn&apos;t receive the code? <span className="underline">Resend</span>
                  </button>

                  {/* Back to change email/password */}
                  <button
                    type="button"
                    onClick={() => {
                      setStep('create');
                      setVerificationCode('');
                      setError(null);
                    }}
                    disabled={isLoading}
                    className="w-full text-center font-sans text-[14px] text-text-muted hover:text-text-secondary transition-colors disabled:opacity-50"
                  >
                    Change email or password
                  </button>
                </form>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

