'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

/**
 * Coaching Intake Form Page
 * 
 * Native form to collect coaching intake information and create coaching subscription.
 * Mirrors the Premium upgrade flow architecture.
 */

// Coaching Price IDs (from Stripe)
const COACHING_PRICES = {
  monthly: {
    priceId: 'price_1SY2YIGZhrOwy75wdbPeTjtl',
    displayAmount: 396,
    period: 'month',
    perWeek: '~$99/week',
  },
  quarterly: {
    priceId: 'price_1SY2ZBGZhrOwy75w5sniKZrq',
    displayAmount: 948,
    period: '3 months',
    perWeek: '~$79/week',
  },
};

// Goals options for multi-select (coaching-specific)
const GOALS_OPTIONS = [
  { id: 'performance', label: 'Increase my performance' },
  { id: 'blockages', label: 'Resolve inner blockages' },
  { id: 'time', label: 'Improve my time management' },
  { id: 'goals', label: 'Set better goals' },
  { id: 'limits', label: 'Break my limits' },
];

// Coach preference options
const COACH_OPTIONS = [
  { id: 'no_preference', label: 'No preference 👍' },
  { id: 'mariyah', label: 'Mariyah Fefilova, M.S.' },
  { id: 'kelsey', label: 'Kelsey Walstrom' },
  { id: 'matthew', label: 'Matthew Hood, CMPC' },
];

// Coaching benefits list
const COACHING_BENEFITS = [
  'Weekly 1:1 or small-group coaching with certified coaches',
  'Personalized feedback on your goals and habits',
  'Weekly accountability and progress structure',
  'Support to overcome mental & emotional blockages',
  'A clear system to turn insight into consistent action',
];

type PlanType = 'monthly' | 'quarterly';
type CommitmentType = 'commit' | 'not_ready' | null;

export default function CoachingIntakeFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  
  // Get plan from URL or default to monthly
  const planParam = searchParams.get('plan') as PlanType | null;
  const plan: PlanType = planParam === 'quarterly' ? 'quarterly' : 'monthly';
  const pricing = COACHING_PRICES[plan];

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasExistingPhone, setHasExistingPhone] = useState(false);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [coachPreference, setCoachPreference] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<CommitmentType>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch user profile to check for existing phone number
  useEffect(() => {
    async function fetchProfile() {
      if (!isLoaded || !user) return;
      
      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user?.phoneNumber) {
            setHasExistingPhone(true);
            setPhoneNumber(data.user.phoneNumber);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    }
    
    fetchProfile();
  }, [isLoaded, user]);

  const handleGoalToggle = (goalId: string) => {
    setSelectedGoals(prev => 
      prev.includes(goalId)
        ? prev.filter(id => id !== goalId)
        : [...prev, goalId]
    );
  };

  const isFormValid = () => {
    // Phone required if not already in profile
    if (!hasExistingPhone && !phoneNumber.trim()) return false;
    
    // At least one goal required
    if (selectedGoals.length === 0) return false;
    
    // Coach preference required
    if (!coachPreference) return false;
    
    // Commitment required and must be 'commit'
    if (commitment !== 'commit') return false;
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      if (commitment === 'not_ready') {
        setError("We understand you're not ready yet. Feel free to come back when you're ready to commit!");
        return;
      }
      setError('Please complete all required fields.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coaching/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: pricing.priceId,
          planLabel: plan,
          phoneNumber: hasExistingPhone ? undefined : phoneNumber.trim(),
          goalsSelected: selectedGoals,
          coachPreference,
          commitment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start coaching subscription');
      }

      setSuccess(true);
      
      // Redirect to mycoach page after a brief delay
      setTimeout(() => {
        router.push('/squad');
      }, 2500);

    } catch (err) {
      console.error('Coaching subscribe error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Success state
  if (success) {
    return (
      <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-[#4CAF50]/20 to-[#2E7D32]/20 flex items-center justify-center">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="font-albert text-[32px] font-semibold text-text-primary tracking-[-1.5px] mb-4">
            Welcome to coaching!
          </h1>
          <p className="font-albert text-[18px] text-text-secondary leading-relaxed mb-8">
            Your coaching journey starts now. We'll reach out shortly to match you with your coach!
          </p>
          <div className="animate-pulse font-albert text-[14px] text-text-secondary">
            Redirecting...
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoadingProfile) {
    return (
      <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary font-albert">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#faf8f6]/95 dark:bg-[#05070b]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link 
            href="/get-coach"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-text-secondary hover:text-text-primary hover:border-[#d1ccc5] dark:hover:border-[#313746] transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary">
              Coaching Application
            </h1>
            <p className="font-albert text-[13px] sm:text-[14px] text-text-secondary">
              {plan === 'monthly' ? `$${pricing.displayAmount}/month` : `$${pricing.displayAmount}/3 months`} • {pricing.perWeek}
            </p>
          </div>
          
          {/* Desktop: Show price in header */}
          <div className="hidden lg:block text-right">
            <p className="font-albert text-[12px] text-text-secondary">Due today</p>
            <p className="font-albert text-[20px] font-bold text-[#4CAF50]">
              {formatCurrency(pricing.displayAmount)}
            </p>
          </div>
        </div>
        {/* Constrained divider */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-b border-[#e1ddd8] dark:border-[#262b35]" />
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-48 lg:pb-32">
        {/* Desktop: Two column layout */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          {/* Main Form Column */}
          <div className="lg:col-span-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="font-albert text-[14px] text-red-600">{error}</p>
                </div>
              )}

              {/* Phone number (only if not already in profile) */}
              {!hasExistingPhone && (
                <div className="space-y-3">
                  <label className="block font-albert text-[16px] font-medium text-text-primary">
                    What's your phone number? <span className="text-red-500">*</span>
                  </label>
                  <p className="font-albert text-[14px] text-text-secondary">
                    We'll use this to coordinate your coaching sessions.
                  </p>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+123456789"
                    className="w-full h-[54px] px-5 py-3 bg-white dark:bg-[#181d26] border border-[#e1ddd8] dark:border-[#313746] rounded-2xl font-albert text-[16px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/30 focus:border-[#4CAF50] transition-all"
                  />
                </div>
              )}

              {/* Goals multi-select */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  What are you looking to get out of coaching? <span className="text-red-500">*</span>
                </label>
                <p className="font-albert text-[14px] text-text-secondary">
                  Select all that apply.
                </p>
                <div className="space-y-2">
                  {GOALS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleGoalToggle(option.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                        selectedGoals.includes(option.id)
                          ? 'bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 dark:from-[#4CAF50]/20 dark:to-[#2E7D32]/20 border-[#4CAF50]/40'
                          : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedGoals.includes(option.id)
                          ? 'bg-[#4CAF50] border-[#4CAF50]'
                          : 'border-[#d1ccc5] dark:border-[#7d8190]'
                      }`}>
                        {selectedGoals.includes(option.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-albert text-[15px] text-text-primary">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coach preference */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  Coach preference <span className="text-red-500">*</span>
                </label>
                <p className="font-albert text-[14px] text-text-secondary">
                  Choose your preferred coach or let us match you.
                </p>
                <div className="space-y-2">
                  {COACH_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setCoachPreference(option.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                        coachPreference === option.id
                          ? 'bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 dark:from-[#4CAF50]/20 dark:to-[#2E7D32]/20 border-[#4CAF50]/40'
                          : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        coachPreference === option.id
                          ? 'border-[#4CAF50]'
                          : 'border-[#d1ccc5] dark:border-[#7d8190]'
                      }`}>
                        {coachPreference === option.id && (
                          <div className="w-3 h-3 rounded-full bg-[#4CAF50]" />
                        )}
                      </div>
                      <span className="font-albert text-[15px] text-text-primary">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Commitment question */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  By signing up for the coaching process, I commit to showing up for myself and my coach. <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCommitment('commit')}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                      commitment === 'commit'
                        ? 'bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 dark:from-[#4CAF50]/20 dark:to-[#2E7D32]/20 border-[#4CAF50]/40'
                        : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      commitment === 'commit'
                        ? 'border-[#4CAF50]'
                        : 'border-[#d1ccc5] dark:border-[#7d8190]'
                    }`}>
                      {commitment === 'commit' && (
                        <div className="w-3 h-3 rounded-full bg-[#4CAF50]" />
                      )}
                    </div>
                    <span className="font-albert text-[15px] text-text-primary">
                      I commit, let's go 🚀
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCommitment('not_ready')}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                      commitment === 'not_ready'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600/50'
                        : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      commitment === 'not_ready'
                        ? 'border-yellow-500'
                        : 'border-[#d1ccc5] dark:border-[#7d8190]'
                    }`}>
                      {commitment === 'not_ready' && (
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      )}
                    </div>
                    <span className="font-albert text-[15px] text-text-primary">
                      I'm not ready 🫤
                    </span>
                  </button>
                </div>
              </div>
            </form>

            {/* Mobile: Bottom Benefits Card (Green theme for coaching) */}
            <div className="lg:hidden mt-10">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-3xl p-6 border border-emerald-200/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="font-albert text-[16px] font-semibold text-emerald-900">
                    What you get
                  </span>
                </div>
                <div className="space-y-3">
                  {COACHING_BENEFITS.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-albert text-[14px] text-emerald-800">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop: Sidebar with pricing info */}
          <div className="hidden lg:block lg:col-span-4">
            <div className="sticky top-32">
              {/* Pricing Card */}
              <div className="bg-white dark:bg-[#171b22] rounded-3xl p-8 border border-[#e1ddd8] dark:border-[#262b35] shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="font-albert text-[16px] font-semibold text-text-primary">
                    Personal Coaching
                  </span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary">
                      ${plan === 'monthly' ? '99' : '79'}
                    </span>
                    <span className="font-albert text-[18px] text-text-secondary">
                      /week
                    </span>
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary mt-1">
                    {plan === 'monthly' ? 'Billed monthly at $396' : 'Billed quarterly at $948'}
                  </p>
                </div>

                {/* Due today card */}
                <div className="bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 rounded-2xl p-5 mb-5">
                  <p className="font-albert text-[13px] text-text-secondary mb-1">
                    Due today
                  </p>
                  <p className="font-albert text-[28px] font-bold text-[#4CAF50]">
                    {formatCurrency(pricing.displayAmount)}
                  </p>
                </div>

                {/* Benefits */}
                <div className="space-y-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  {COACHING_BENEFITS.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#4CAF50] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-albert text-[14px] text-text-primary">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-5 text-text-secondary">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-albert text-[12px]">Secure checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="font-albert text-[12px]">Cancel anytime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#faf8f6]/98 dark:bg-[#05070b]/98 backdrop-blur-md border-t border-[#e1ddd8] dark:border-[#262b35]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="lg:flex lg:items-center lg:gap-6">
            {/* Mobile: Amount due */}
            <div className="lg:hidden text-center mb-3">
              <span className="font-albert text-[13px] text-text-secondary">
                Due today:{' '}
              </span>
              <span className="font-albert text-[16px] font-bold text-[#4CAF50]">
                {formatCurrency(pricing.displayAmount)}
              </span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || isLoading}
              className={`w-full lg:flex-1 py-4 px-6 rounded-2xl font-albert text-[17px] font-semibold transition-all duration-200 ${
                isFormValid() && !isLoading
                  ? 'bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#43A047] hover:to-[#1B5E20] text-white shadow-lg shadow-[#4CAF50]/20'
                  : 'bg-[#e1ddd8] dark:bg-[#262b35] text-text-secondary cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing payment...
                </span>
              ) : (
                <>
                  Secure my spot
                  <span className="hidden lg:inline"> • {formatCurrency(pricing.displayAmount)}</span>
                  <span className="ml-1">→</span>
                </>
              )}
            </button>
          </div>
          
          <p className="font-albert text-[11px] sm:text-[12px] text-text-secondary text-center leading-relaxed mt-3 lg:mt-2">
            By clicking "Secure my spot", you'll start your coaching subscription at{' '}
            <strong>{plan === 'monthly' ? '$396/month' : '$948/3 months'}</strong> ({pricing.perWeek}).
          </p>
        </div>
      </div>
    </div>
  );
}
