'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';

/**
 * Guest Your Info Page (NEW)
 * Collects first name, last name, and email before payment
 */
export default function GuestYourInfoPage() {
  const router = useRouter();
  const { saveData, data, isLoading } = useGuestSession();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({});
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExistingMember, setIsExistingMember] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Pre-fill from existing guest data if available
  useEffect(() => {
    if (data.firstName) setFirstName(data.firstName);
    if (data.lastName) setLastName(data.lastName);
    if (data.email) setEmail(data.email);
  }, [data]);

  // Check if email belongs to an existing paying member
  const checkExistingMember = useCallback(async (emailToCheck: string) => {
    const trimmedEmail = emailToCheck.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setIsExistingMember(false);
      return;
    }

    setIsCheckingEmail(true);
    try {
      const response = await fetch('/api/checkout/check-existing-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      
      const result = await response.json().catch(() => null);
      
      if (result?.isExistingMember) {
        setIsExistingMember(true);
      } else {
        setIsExistingMember(false);
      }
    } catch (error) {
      console.error('Error checking existing member:', error);
      setIsExistingMember(false);
    } finally {
      setIsCheckingEmail(false);
    }
  }, []);

  const validateForm = () => {
    const newErrors: { firstName?: string; lastName?: string; email?: string } = {};
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;
    
    setIsNavigating(true);
    
    await saveData({ 
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      currentStep: 'plan',
    });
    
    router.push('/start/plan');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
      </div>
    );
  }

  const isFormValid = firstName.trim() && lastName.trim() && email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !isExistingMember;

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-6 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={48} 
            height={48} 
            className="rounded-lg"
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 lg:py-12">
          <div className="w-full max-w-xl lg:max-w-2xl mx-auto">
            {/* Header */}
            <motion.div 
              className="mb-10 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h1 className="font-albert text-[36px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                Almost there!
              </h1>
              <p className="font-sans text-[17px] lg:text-[19px] text-text-secondary tracking-[-0.3px] leading-[1.4]">
                Enter your details so we can personalize your experience.
              </p>
            </motion.div>

            {/* Form */}
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {/* Name Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errors.firstName) setErrors({ ...errors, firstName: undefined });
                    }}
                    disabled={isNavigating}
                    placeholder="John"
                    className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl font-sans text-[16px] text-text-primary placeholder:text-text-muted outline-none transition-all ${
                      errors.firstName 
                        ? 'border-red-400 focus:border-red-500' 
                        : 'border-[#e1ddd8] focus:border-[#a07855]'
                    } disabled:opacity-50`}
                  />
                  {errors.firstName && (
                    <p className="mt-1.5 text-[13px] text-red-500 font-sans">{errors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errors.lastName) setErrors({ ...errors, lastName: undefined });
                    }}
                    disabled={isNavigating}
                    placeholder="Doe"
                    className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl font-sans text-[16px] text-text-primary placeholder:text-text-muted outline-none transition-all ${
                      errors.lastName 
                        ? 'border-red-400 focus:border-red-500' 
                        : 'border-[#e1ddd8] focus:border-[#a07855]'
                    } disabled:opacity-50`}
                  />
                  {errors.lastName && (
                    <p className="mt-1.5 text-[13px] text-red-500 font-sans">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                    if (isExistingMember) setIsExistingMember(false);
                  }}
                  onBlur={(e) => checkExistingMember(e.target.value)}
                  disabled={isNavigating || isCheckingEmail}
                  placeholder="john@example.com"
                  className={`w-full px-4 py-3.5 bg-white border-2 rounded-2xl font-sans text-[16px] text-text-primary placeholder:text-text-muted outline-none transition-all ${
                    errors.email || isExistingMember
                      ? 'border-red-400 focus:border-red-500' 
                      : 'border-[#e1ddd8] focus:border-[#a07855]'
                  } disabled:opacity-50`}
                />
                {errors.email && (
                  <p className="mt-1.5 text-[13px] text-red-500 font-sans">{errors.email}</p>
                )}
                
                {/* Existing member error */}
                <AnimatePresence>
                  {isExistingMember && (
                    <motion.div 
                      className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="font-sans text-[14px] text-amber-800 leading-relaxed">
                        You are already a GrowthAddicts paying member.{' '}
                        <Link href="/sign-in" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245] font-semibold">
                          Sign in here
                        </Link>
                        , or visit{' '}
                        <Link href="/upgrade-premium" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245] font-semibold">
                          Premium
                        </Link>
                        {' '}to upgrade.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Trust badge */}
              <motion.div 
                className="flex items-center justify-center gap-2 text-text-secondary pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-sans text-[13px]">Your information is secure and will never be shared</span>
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div 
          className="sticky bottom-0 px-6 pb-8 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <button
            onClick={handleContinue}
            disabled={!isFormValid || isNavigating}
            className="w-full max-w-xl lg:max-w-2xl mx-auto block bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isNavigating ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              'Continue to plan →'
            )}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

