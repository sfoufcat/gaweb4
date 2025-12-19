'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

/**
 * Premium Upgrade Form Page
 * 
 * Native form to collect premium squad intake information and upgrade subscription.
 * Replaces the Tally embed with a fully integrated experience.
 */

// Price IDs for premium plans
const PREMIUM_PRICES = {
  monthly: {
    priceId: 'price_1SXkqZGZhrOwy75wAG3mSczA',
    amount: 99,
    period: 'month',
    perDay: '~$3.30/day',
  },
  sixMonth: {
    priceId: 'price_1SXkqZGZhrOwy75wPUyBuKxs',
    amount: 399,
    period: '6 months',
    perDay: '~$2.22/day',
  },
};

// Benefits options for multi-select
const BENEFITS_OPTIONS = [
  { id: 'performance', label: 'Increase my performance' },
  { id: 'blockages', label: 'Resolve inner blockages' },
  { id: 'time', label: 'Improve my time management' },
  { id: 'goals', label: 'Set better goals' },
  { id: 'limits', label: 'Break my limits' },
];

// Premium benefits list
const PREMIUM_BENEFITS = [
  'Coach-led weekly calls',
  'Premium squad placement',
  'Advanced performance tracking',
  'Priority support',
];

type PlanType = 'monthly' | 'sixMonth';
type CommitmentType = 'commit' | 'not_ready' | null;
type UpgradeWithFriendsType = 'no' | 'yes' | null;

interface ProrationPreview {
  dueToday: number;
  currency: string;
  creditAmount: number;
  chargeAmount: number;
  nextBillingDate: string;
}

export default function PremiumUpgradeFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded } = useUser();
  
  // Get plan from URL or default to monthly
  const planParam = searchParams.get('plan') as PlanType | null;
  const plan: PlanType = planParam === 'sixMonth' ? 'sixMonth' : 'monthly';
  const pricing = PREMIUM_PRICES[plan];

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasExistingPhone, setHasExistingPhone] = useState(false);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [upgradeWithFriends, setUpgradeWithFriends] = useState<UpgradeWithFriendsType>(null);
  const [friendsNames, setFriendsNames] = useState('');
  const [commitment, setCommitment] = useState<CommitmentType>(null);
  
  // Proration preview state
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null);
  const [isLoadingProration, setIsLoadingProration] = useState(true);
  const [prorationError, setProrationError] = useState<string | null>(null);
  
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

  // Fetch proration preview
  useEffect(() => {
    async function fetchProrationPreview() {
      if (!isLoaded || !user) return;
      
      try {
        setIsLoadingProration(true);
        setProrationError(null);
        
        const response = await fetch('/api/subscription/preview-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planLabel: plan }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.preview) {
          setProrationPreview(data.preview);
        } else {
          setProrationError(data.error || 'Could not calculate upgrade cost');
        }
      } catch (err) {
        console.error('Error fetching proration:', err);
        setProrationError('Could not calculate upgrade cost');
      } finally {
        setIsLoadingProration(false);
      }
    }
    
    fetchProrationPreview();
  }, [isLoaded, user, plan]);

  const handleBenefitToggle = (benefitId: string) => {
    setSelectedBenefits(prev => 
      prev.includes(benefitId)
        ? prev.filter(id => id !== benefitId)
        : [...prev, benefitId]
    );
  };

  const isFormValid = () => {
    // Phone required if not already in profile
    if (!hasExistingPhone && !phoneNumber.trim()) return false;
    
    // At least one benefit required
    if (selectedBenefits.length === 0) return false;
    
    // Upgrade with friends answer required
    if (upgradeWithFriends === null) return false;
    
    // If yes to friends, names required
    if (upgradeWithFriends === 'yes' && !friendsNames.trim()) return false;
    
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
      const response = await fetch('/api/subscription/upgrade-to-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: pricing.priceId,
          planLabel: plan,
          phoneNumber: hasExistingPhone ? undefined : phoneNumber.trim(),
          benefitsSelected: selectedBenefits,
          upgradeWithFriends: upgradeWithFriends === 'yes',
          friendsNames: upgradeWithFriends === 'yes' ? friendsNames.trim() : null,
          commitment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade subscription');
      }

      setSuccess(true);
      
      // Redirect to squad page after a brief delay
      // Add upgraded=true query param to trigger the squad choice modal
      setTimeout(() => {
        router.push('/squad?upgraded=true');
      }, 2500);

    } catch (err) {
      console.error('Upgrade error:', err);
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
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-[#FF8A65]/20 to-[#FF6B6B]/20 flex items-center justify-center">
            <span className="text-4xl">🎉</span>
          </div>
          <h1 className="font-albert text-[32px] font-semibold text-text-primary tracking-[-1.5px] mb-4">
            You're in!
          </h1>
          <p className="font-albert text-[18px] text-text-secondary leading-relaxed mb-8">
            Your Premium Squad access is now active. Get ready to accelerate your growth!
          </p>
          <div className="animate-pulse font-albert text-[14px] text-text-secondary">
            Redirecting to your squad...
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
          <div className="w-12 h-12 border-4 border-[#FF6B6B] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            href="/upgrade-premium"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-text-secondary hover:text-text-primary hover:border-[#d1ccc5] dark:hover:border-[#313746] transition-all shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary">
              Premium Squad Application
            </h1>
            <p className="font-albert text-[13px] sm:text-[14px] text-text-secondary">
              {plan === 'monthly' ? '$99/month' : '$399/6 months'} • {pricing.perDay}
            </p>
          </div>
          
          {/* Desktop: Show proration preview in header */}
          {prorationPreview && !isLoadingProration && (
            <div className="hidden lg:block text-right">
              <p className="font-albert text-[12px] text-text-secondary">Due today</p>
              <p className="font-albert text-[20px] font-bold text-[#FF6B6B]">
                {formatCurrency(prorationPreview.dueToday)}
              </p>
            </div>
          )}
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
                    We'll use this to coordinate with you about your premium squad.
                  </p>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+123456789"
                    className="w-full h-[54px] px-5 py-3 bg-white dark:bg-[#181d26] border border-[#e1ddd8] dark:border-[#313746] rounded-2xl font-albert text-[16px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/30 focus:border-[#FF6B6B] transition-all"
                  />
                </div>
              )}

              {/* Benefits multi-select */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  What are you looking to get out of a Premium Squad? <span className="text-red-500">*</span>
                </label>
                <p className="font-albert text-[14px] text-text-secondary">
                  Select all that apply.
                </p>
                <div className="space-y-2">
                  {BENEFITS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleBenefitToggle(option.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                        selectedBenefits.includes(option.id)
                          ? 'bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 border-[#FF6B6B]/40'
                          : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        selectedBenefits.includes(option.id)
                          ? 'bg-[#FF6B6B] border-[#FF6B6B]'
                          : 'border-[#d1ccc5] dark:border-[#7d8190]'
                      }`}>
                        {selectedBenefits.includes(option.id) && (
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

              {/* Upgrade with friends */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  Do you want to upgrade with friends? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setUpgradeWithFriends('no')}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                      upgradeWithFriends === 'no'
                        ? 'bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 border-[#FF6B6B]/40'
                        : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      upgradeWithFriends === 'no'
                        ? 'border-[#FF6B6B]'
                        : 'border-[#d1ccc5] dark:border-[#7d8190]'
                    }`}>
                      {upgradeWithFriends === 'no' && (
                        <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
                      )}
                    </div>
                    <span className="font-albert text-[15px] text-text-primary">
                      No, I just want a guided squad
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUpgradeWithFriends('yes')}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                      upgradeWithFriends === 'yes'
                        ? 'bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 border-[#FF6B6B]/40'
                        : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      upgradeWithFriends === 'yes'
                        ? 'border-[#FF6B6B]'
                        : 'border-[#d1ccc5] dark:border-[#7d8190]'
                    }`}>
                      {upgradeWithFriends === 'yes' && (
                        <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
                      )}
                    </div>
                    <span className="font-albert text-[15px] text-text-primary">
                      Yes, I want to upgrade with friends
                    </span>
                  </button>
                </div>

                {/* Friends names input */}
                {upgradeWithFriends === 'yes' && (
                  <div className="mt-4 pl-10">
                    <input
                      type="text"
                      value={friendsNames}
                      onChange={(e) => setFriendsNames(e.target.value)}
                      placeholder="Enter your friends' names"
                      className="w-full h-[54px] px-5 py-3 bg-white dark:bg-[#181d26] border border-[#e1ddd8] dark:border-[#313746] rounded-2xl font-albert text-[16px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-[#FF6B6B]/30 focus:border-[#FF6B6B] transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Commitment question */}
              <div className="space-y-4">
                <label className="block font-albert text-[16px] font-medium text-text-primary">
                  Are you ready to commit to your growth? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setCommitment('commit')}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left ${
                      commitment === 'commit'
                        ? 'bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 dark:from-[#FF8A65]/20 dark:to-[#FF6B6B]/20 border-[#FF6B6B]/40'
                        : 'bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5] dark:hover:border-[#313746]'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      commitment === 'commit'
                        ? 'border-[#FF6B6B]'
                        : 'border-[#d1ccc5] dark:border-[#7d8190]'
                    }`}>
                      {commitment === 'commit' && (
                        <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
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

            {/* Mobile: Bottom Benefits Card (Green theme) */}
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
                  {PREMIUM_BENEFITS.map((benefit, index) => (
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                  </div>
                  <span className="font-albert text-[16px] font-semibold text-text-primary">
                    Premium Squad
                  </span>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary">
                      ${plan === 'monthly' ? '99' : '66'}
                    </span>
                    <span className="font-albert text-[18px] text-text-secondary">
                      /month
                    </span>
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary mt-1">
                    {plan === 'monthly' ? 'Billed monthly' : 'Billed every 6 months at $399'}
                  </p>
                </div>

                {/* Proration info */}
                {prorationPreview && !isLoadingProration && (
                  <div className="bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-2xl p-5 mb-5">
                    <p className="font-albert text-[13px] text-text-secondary mb-1">
                      Due today
                    </p>
                    <p className="font-albert text-[28px] font-bold text-[#FF6B6B]">
                      {formatCurrency(prorationPreview.dueToday)}
                    </p>
                    <p className="font-albert text-[12px] text-text-secondary mt-2">
                      Prorated from your current plan
                    </p>
                  </div>
                )}

                {isLoadingProration && (
                  <div className="bg-[#f3f1ef] dark:bg-[#1d222b] rounded-2xl p-5 mb-5 animate-pulse">
                    <div className="h-3 bg-[#e1ddd8] dark:bg-[#262b35] rounded w-20 mb-2"></div>
                    <div className="h-7 bg-[#e1ddd8] dark:bg-[#262b35] rounded w-24"></div>
                  </div>
                )}

                {prorationError && (
                  <div className="bg-yellow-50 rounded-2xl p-5 mb-5">
                    <p className="font-albert text-[13px] text-yellow-700">
                      {prorationError}
                    </p>
                  </div>
                )}

                {/* Benefits */}
                <div className="space-y-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  {PREMIUM_BENEFITS.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#FF6B6B] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            {/* Mobile: Amount due with (prorated) */}
            {prorationPreview && !isLoadingProration && (
              <div className="lg:hidden text-center mb-3">
                <span className="font-albert text-[13px] text-text-secondary">
                  Due today:{' '}
                </span>
                <span className="font-albert text-[16px] font-bold text-[#FF6B6B]">
                  {formatCurrency(prorationPreview.dueToday)}
                </span>
                <span className="font-albert text-[12px] text-text-muted ml-1">
                  (prorated)
                </span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!isFormValid() || isLoading}
              className={`w-full lg:flex-1 py-4 px-6 rounded-2xl font-albert text-[17px] font-semibold transition-all duration-200 ${
                isFormValid() && !isLoading
                  ? 'bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] hover:from-[#FF7A55] hover:to-[#FF5B5B] text-white shadow-lg shadow-[#FF6B6B]/20'
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
                  {prorationPreview && !isLoadingProration && (
                    <span className="hidden lg:inline"> • {formatCurrency(prorationPreview.dueToday)}</span>
                  )}
                  <span className="ml-1">→</span>
                </>
              )}
            </button>
          </div>
          
          <p className="font-albert text-[11px] sm:text-[12px] text-text-secondary text-center leading-relaxed mt-3 lg:mt-2">
            {prorationPreview && !isLoadingProration ? (
              <>
                You'll be charged <strong>{formatCurrency(prorationPreview.dueToday)}</strong> today{' '}
                <span className="text-text-muted">(prorated)</span>.
                Then <strong>{plan === 'monthly' ? '$99/month' : '$399/6 months'}</strong> starting{' '}
                {new Date(prorationPreview.nextBillingDate).toLocaleDateString()}.
              </>
            ) : (
              <>
                By clicking "Secure my spot", you'll be upgraded to the Premium Squad at{' '}
                <strong>{plan === 'monthly' ? '$99/month' : '$399/6 months'}</strong> ({pricing.perDay}).
                Your current subscription will be automatically prorated.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
