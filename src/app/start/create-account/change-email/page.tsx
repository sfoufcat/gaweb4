'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useGuestSession } from '@/hooks/useGuestSession';
import { ArrowLeft } from 'lucide-react';

/**
 * Change Email Page
 * Allows users to update their email before creating an account
 */
export default function ChangeEmailPage() {
  const router = useRouter();
  const { data, saveData, isLoading: sessionLoading } = useGuestSession();
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill with current email
  useEffect(() => {
    if (data.email) {
      setNewEmail(data.email);
    }
  }, [data.email]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = newEmail.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (trimmedEmail === data.email) {
      // Email hasn't changed, just go back
      router.push('/start/create-account');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Check if the new email is already a paying member
      const checkResponse = await fetch('/api/checkout/check-existing-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();
        if (checkResult.isPayingMember) {
          setError('This email is already associated with an active GrowthAddicts membership. Please use a different email or sign in.');
          setIsLoading(false);
          return;
        }
      }

      // Save the new email to guest session
      await saveData({ email: trimmedEmail });

      // Also need to update Stripe customer if it exists
      // For now, we'll handle this in the create-account flow
      
      // Redirect back to create-account
      router.push('/start/create-account');
    } catch (err: any) {
      console.error('Error updating email:', err);
      setError('Failed to update email. Please try again.');
      setIsLoading(false);
    }
  };

  if (sessionLoading) {
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Back button */}
              <button
                onClick={() => router.push('/start/create-account')}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="font-sans text-[14px]">Back</span>
              </button>

              <div className="text-center mb-8">
                <h1 className="font-albert text-[32px] lg:text-[40px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
                  Change your email
                </h1>
                <p className="font-sans text-[16px] text-text-secondary">
                  Enter your new email address below
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Current email (if different from new) */}
                {data.email && data.email !== newEmail && (
                  <div className="p-4 bg-[#faf8f6] rounded-xl border border-[#e1ddd8]">
                    <p className="font-sans text-[12px] text-text-muted mb-1">Current email</p>
                    <p className="font-sans text-[14px] text-text-secondary">{data.email}</p>
                  </div>
                )}

                {/* New email input */}
                <div>
                  <label className="block font-sans text-[14px] font-medium text-text-primary mb-2">
                    New email address
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    disabled={isLoading}
                    placeholder="you@example.com"
                    autoFocus
                    className="w-full px-4 py-3.5 bg-white border-2 border-[#e1ddd8] rounded-2xl font-sans text-[16px] text-text-primary placeholder:text-text-muted outline-none transition-all focus:border-[#a07855] disabled:opacity-50"
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
                  disabled={isLoading || !newEmail.trim()}
                  className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </span>
                  ) : (
                    'Update email'
                  )}
                </button>

                {/* Cancel */}
                <button
                  type="button"
                  onClick={() => router.push('/start/create-account')}
                  disabled={isLoading}
                  className="w-full text-center font-sans text-[14px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
