'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { Check, Calendar, Users, Sparkles, TrendingUp, Shield, Target, UserPlus, ListChecks, Eye, Crown } from 'lucide-react';
import Image from 'next/image';
import Script from 'next/script';
import { usePendingInvite } from '@/hooks/usePendingInvite';
import { useBrandingValues } from '@/contexts/BrandingContext';

type PlanType = 'trial' | 'standard' | 'premium';

const PLANS: {
  id: PlanType;
  name: string;
  price: string;
  originalPrice?: string;
  period: string;
  perDay: string;
  billedAs: string;
  description: string;
  features: { text: string; bold?: boolean; emoji?: string }[];
  highlighted?: boolean;
  tag?: string;
  trialInfo?: string;
}[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: '$9.99',
    period: '/week',
    perDay: '$1.43',
    billedAs: 'billed weekly',
    description: 'Try everything risk-free for a week',
    trialInfo: 'Then $39.99/month',
    features: [
      { text: 'Full access for 7 days' },
      { text: 'Daily morning & evening check-ins' },
      { text: 'Goal tracking & progress visualization' },
      { text: 'Habit tracking system' },
      { text: 'Daily focus tasks' },
      { text: 'Community access' },
    ],
    tag: 'TRY FIRST',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$39.99',
    period: '/month',
    perDay: '$1.33',
    billedAs: 'billed monthly',
    description: 'Everything you need to build consistency',
    features: [
      { text: 'Daily morning & evening check-ins' },
      { text: 'Founder accountability squad' },
      { text: 'Goal tracking & progress visualization' },
      { text: 'Habit tracking system' },
      { text: 'Weekly reflections' },
      { text: 'Community access' },
    ],
    highlighted: true,
    tag: 'BEST VALUE',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$99',
    period: '/month',
    perDay: '$3.30',
    billedAs: 'billed monthly',
    description: 'For serious growth with accountability',
    features: [
      { text: 'Everything in Standard' },
      { text: 'Premium Squad membership', bold: true, emoji: '👥' },
      { text: 'Dedicated accountability coach', bold: true, emoji: '🎯' },
      { text: 'Priority support' },
      { text: 'Exclusive content & resources' },
      { text: 'Advanced analytics' },
    ],
  },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Daily structure',
    description: 'That keeps you moving forward',
  },
  {
    icon: Users,
    title: 'Accountability squad',
    description: 'So you\'re never doing this alone',
  },
  {
    icon: TrendingUp,
    title: 'Weekly reviews',
    description: 'To lock in your progress',
  },
  {
    icon: Sparkles,
    title: 'Expert strategies',
    description: 'Designed for long-term progress protection',
  },
  {
    icon: Shield,
    title: 'Resource hub',
    description: 'With templates, prompts, and implementation tools',
  },
  {
    icon: Target,
    title: 'Personalized action plan',
    description: 'Based on your specific goals and timeline',
  },
];

const TESTIMONIALS = [
  {
    name: 'James R.',
    text: 'Finally found a system that keeps me accountable. Lost 15kg and built a morning routine that stuck.',
    rating: 5,
  },
  {
    name: 'Priya S.',
    text: 'The daily check-ins changed everything. I\'ve been more productive in 3 months than the entire last year.',
    rating: 5,
  },
  {
    name: 'Michael K.',
    text: 'Grew my side business to $5k/month while working full-time. The structure made it possible.',
    rating: 5,
  },
];

/**
 * Plan Selection Page - Premium Redesign
 * BetterMe-style sales page with testimonials, guarantee, and value stacking
 */
export default function PlanPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { logoUrl, appTitle } = useBrandingValues();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Check for pending premium squad invite
  const { pendingInvite, hasPremiumInvitePending, getToken } = usePendingInvite();

  // Check if user already has an active subscription - redirect to home if so
  // Uses Clerk metadata (SINGLE SOURCE OF TRUTH - no DB call needed)
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const publicMetadata = user.publicMetadata as {
      billingStatus?: string;
      billingPeriodEnd?: string;
      tier?: string;
    };
    
    const billingStatus = publicMetadata?.billingStatus;
    const billingPeriodEnd = publicMetadata?.billingPeriodEnd;
    const now = new Date();
    const periodEndDate = billingPeriodEnd ? new Date(billingPeriodEnd) : null;
    const hasTimeRemaining = periodEndDate && periodEndDate > now;
    
    const hasActiveSubscription = billingStatus === 'active' || 
      billingStatus === 'trialing' ||
      (billingStatus === 'canceled' && hasTimeRemaining);
    
    if (hasActiveSubscription) {
      router.push('/');
      return;
    }
    
    setCheckingSubscription(false);
  }, [isLoaded, user, router]);

  const handleContinue = async () => {
    if (!selectedPlan) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Include invite token if premium plan is selected and there's a pending invite
      const inviteToken = selectedPlan === 'premium' ? getToken() : undefined;
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: selectedPlan,
          inviteToken,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setIsLoading(false);
    }
  };

  if (!isLoaded || !user || checkingSubscription) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-brand-accent animate-spin" />
        </div>
      </div>
    );
  }

  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header */}
        <motion.div 
          className="sticky top-0 z-50 bg-app-bg/95 backdrop-blur-sm border-b border-[#e1ddd8]/50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center md:justify-between px-6 py-3 max-w-5xl mx-auto">
            <Image 
              src={logoUrl} 
              alt={appTitle} 
              width={44} 
              height={44} 
              className="rounded-lg"
              unoptimized
            />
            <button
              onClick={handleContinue}
              disabled={isLoading || !agreedToTerms}
              className="hidden md:block bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[14px] py-2.5 px-6 rounded-full hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start your transformation
            </button>
          </div>
        </motion.div>

        {/* Content */}
        <div className="flex-1 px-4 py-8 lg:py-12">
          <div className="w-full max-w-5xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <h1 className="font-albert text-[32px] lg:text-[44px] text-text-primary tracking-[-2px] leading-[1.15] mb-3">
                Choose Your Plan
              </h1>
              <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary max-w-md mx-auto">
                Start building momentum today. Cancel anytime.
              </p>
            </motion.div>

            {/* Premium Squad Invite Card - Show only if there's a pending premium invite */}
            {hasPremiumInvitePending && pendingInvite && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="max-w-3xl mx-auto mb-6"
              >
                <div className="bg-gradient-to-br from-[#fffbeb] to-[#fef3c7] rounded-[20px] p-5 border border-[#fcd34d]/30 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#f7c948] to-[#f5b820] rounded-full flex items-center justify-center shadow-md">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-albert text-[18px] font-bold text-[#92400e] tracking-[-0.5px] mb-1">
                        Join {pendingInvite.inviterName}&apos;s Premium Squad
                      </h3>
                      <p className="font-sans text-[14px] text-[#a16207] leading-relaxed mb-3">
                        <span className="font-semibold">{pendingInvite.payload?.squadName}</span> is a Premium-only squad.
                        To join your friend&apos;s squad, select the Premium plan below.
                      </p>
                      <p className="font-sans text-[12px] text-[#b45309]">
                        💡 If you select Standard, you&apos;ll skip the squad join and continue with the normal experience.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Plan Cards */}
            <motion.div 
              className="grid md:grid-cols-3 gap-4 lg:gap-5 mb-8 max-w-5xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {PLANS.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative p-5 lg:p-6 rounded-[20px] border-2 text-left transition-all duration-300 ${
                    selectedPlan === plan.id 
                      ? 'border-brand-accent bg-[#faf8f6] shadow-lg' 
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-md'
                  }`}
                >
                  {/* Tag badge */}
                  {plan.tag && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-brand-accent to-[#c9a07a] text-white font-sans text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md whitespace-nowrap">
                        {plan.tag}
                      </span>
                    </div>
                  )}

                  {/* Radio indicator */}
                  <div className={`absolute top-5 right-5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    selectedPlan === plan.id 
                      ? 'border-brand-accent bg-brand-accent' 
                      : 'border-[#d4d0cb]'
                  }`}>
                    {selectedPlan === plan.id && (
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                  </div>

                  {/* Plan Header */}
                  <div className="mb-4">
                    <h3 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px] mb-1">
                      {plan.name}
                    </h3>
                    <p className="font-sans text-[12px] text-text-secondary leading-snug pr-6">
                      {plan.description}
                    </p>
                  </div>

                  {/* Pricing - Daily rate prominent */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-0.5">
                      <span className="font-albert text-[36px] lg:text-[42px] font-bold text-text-primary tracking-[-2px]">
                        {plan.perDay}
                      </span>
                      <span className="font-sans text-[14px] text-text-secondary">
                        /day
                      </span>
                    </div>
                    <p className="font-sans text-[12px] text-text-muted">
                      {plan.price}{plan.period} · {plan.billedAs}
                    </p>
                    {plan.trialInfo && (
                      <p className="font-sans text-[11px] text-text-tertiary mt-0.5">
                        {plan.trialInfo}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#22c55e] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className={`font-sans text-[12px] leading-tight ${feature.bold ? 'font-bold text-text-primary' : 'text-text-secondary'}`}>
                          {feature.emoji && <span className="mr-1">{feature.emoji}</span>}
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </button>
              ))}
            </motion.div>

            {/* Terms Agreement */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="max-w-3xl mx-auto mb-8"
            >
              <label className="flex items-start gap-3 cursor-pointer group">
                <div 
                  onClick={() => setAgreedToTerms(!agreedToTerms)}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
                    agreedToTerms 
                      ? 'border-brand-accent bg-brand-accent' 
                      : 'border-[#d4d0cb] group-hover:border-brand-accent/50'
                  }`}
                >
                  {agreedToTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <span className="font-sans text-[13px] text-text-secondary leading-relaxed">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-brand-accent underline underline-offset-2 hover:text-brand-accent/90">Terms and Conditions</a>,{' '}
                  <a href="/privacy" target="_blank" className="text-brand-accent underline underline-offset-2 hover:text-brand-accent/90">Privacy policy</a>,{' '}
                  <a href="/subscription-policy" target="_blank" className="text-brand-accent underline underline-offset-2 hover:text-brand-accent/90">Subscription policy</a> and the{' '}
                  <a href="/refund-policy" target="_blank" className="text-brand-accent underline underline-offset-2 hover:text-brand-accent/90">Refund and Cancellation policy</a>
                </span>
              </label>
            </motion.div>

            {/* Main CTA Button - Yellow gradient */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-xl mx-auto mb-8"
            >
              <button
                onClick={handleContinue}
                disabled={isLoading || !agreedToTerms}
                className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Start your transformation'
                )}
              </button>
            </motion.div>

            {/* Billing Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-3xl mx-auto mb-12"
            >
              <p className="font-sans text-[12px] text-text-tertiary text-center leading-relaxed">
                {selectedPlan === 'trial' ? (
                  <>
                    By clicking &quot;Start your transformation&quot;, you will be charged <span className="font-semibold text-text-secondary">$9.99</span> for your first week. 
                    After 7 days, your subscription will automatically convert to <span className="font-semibold text-text-secondary">$39.99/month</span> until you cancel.
                  </>
                ) : (
                  <>
                    By clicking &quot;Start your transformation&quot;, I agree that the plan I have selected will automatically renew until I cancel. 
                    GrowthAddicts will automatically charge my payment method <span className="font-semibold text-text-secondary">{selectedPlanData?.price}</span> every{' '}
                    <span className="font-semibold text-text-secondary">{selectedPlan === 'premium' ? 'month' : 'month'}</span>.
                  </>
                )}{' '}
                I can cancel online by visiting my account on the website or in the app.
              </p>
            </motion.div>

            {/* 30-Day Guarantee */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="max-w-2xl mx-auto mb-16"
            >
              <div className="bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] rounded-[24px] p-6 lg:p-8 border border-[#bbf7d0]">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Shield className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <h3 className="font-albert text-[22px] font-bold text-[#166534] tracking-[-0.5px] mb-2">
                      30-day satisfaction guarantee
                    </h3>
                    <p className="font-sans text-[14px] text-[#15803d] leading-relaxed">
                      If you don't see noticeable progress in the GrowthAddicts system despite completing your daily required tasks, you can request a full refund within 30 days.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* What You Get Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-16"
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                What you get
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {FEATURES.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.45 + index * 0.05 }}
                    className="bg-white rounded-2xl p-5 border border-[#e1ddd8]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-[#faf8f6] rounded-xl flex items-center justify-center">
                        <feature.icon className="w-5 h-5 text-brand-accent" />
                      </div>
                      <div>
                        <h4 className="font-sans text-[14px] font-semibold text-text-primary mb-0.5">
                          {feature.title}
                        </h4>
                        <p className="font-sans text-[12px] text-text-secondary">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* What Happens Next Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="mb-16"
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                What happens next
              </h2>
              <div className="grid md:grid-cols-3 gap-4 lg:gap-6 max-w-4xl mx-auto">
                {/* Step 1 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.5 }}
                  className="bg-white rounded-2xl p-6 border border-[#e1ddd8] text-center"
                >
                  <div className="w-14 h-14 bg-[#faf8f6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-7 h-7 text-brand-accent" />
                  </div>
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-accent text-white font-sans text-[12px] font-bold rounded-full mb-3">
                    1
                  </div>
                  <h4 className="font-sans text-[15px] font-semibold text-text-primary mb-2">
                    Join your Accountability Squad
                  </h4>
                  <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                    Meet the people who will help you stay on track every day.
                  </p>
                </motion.div>

                {/* Step 2 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 }}
                  className="bg-white rounded-2xl p-6 border border-[#e1ddd8] text-center"
                >
                  <div className="w-14 h-14 bg-[#faf8f6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <ListChecks className="w-7 h-7 text-brand-accent" />
                  </div>
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-accent text-white font-sans text-[12px] font-bold rounded-full mb-3">
                    2
                  </div>
                  <h4 className="font-sans text-[15px] font-semibold text-text-primary mb-2">
                    Set your Big 3 Daily Tasks
                  </h4>
                  <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                    You'll choose the three actions that move you forward each day.
                  </p>
                </motion.div>

                {/* Step 3 */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  className="bg-white rounded-2xl p-6 border border-[#e1ddd8] text-center"
                >
                  <div className="w-14 h-14 bg-[#faf8f6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Eye className="w-7 h-7 text-brand-accent" />
                  </div>
                  <div className="inline-flex items-center justify-center w-6 h-6 bg-brand-accent text-white font-sans text-[12px] font-bold rounded-full mb-3">
                    3
                  </div>
                  <h4 className="font-sans text-[15px] font-semibold text-text-primary mb-2">
                    Stay accountable
                  </h4>
                  <p className="font-sans text-[13px] text-text-secondary leading-relaxed">
                    Your squad will see your progress and help you stay consistent every day.
                  </p>
                </motion.div>
              </div>
            </motion.div>

            {/* Testimonials Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mb-16"
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                People love GrowthAddicts
              </h2>
              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {TESTIMONIALS.map((testimonial, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.55 + index * 0.1 }}
                    className="bg-white rounded-2xl p-5 border border-[#e1ddd8]"
                  >
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <span key={i} className="text-[#f7c948] text-sm">★</span>
                      ))}
                    </div>
                    <p className="font-sans text-[13px] text-text-primary leading-relaxed mb-3">
                      "{testimonial.text}"
                    </p>
                    <p className="font-sans text-[12px] text-text-secondary font-medium">
                      {testimonial.name}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Vincent's Experience Video Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="mb-16"
            >
              <div className="text-center mb-8">
                <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] mb-3">
                  Vincent's experience
                </h2>
                <p className="font-sans text-[15px] text-text-secondary max-w-lg mx-auto">
                  Hear how Growth Addicts helped Vincent stay consistent and transform his daily habits.
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <div className="relative bg-white rounded-2xl border border-[#e1ddd8] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.08)] overflow-hidden">
                  {/* 16:9 Aspect Ratio Container */}
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <video
                      className="absolute inset-0 w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster=""
                    >
                      <source 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/video%2FIMG_6354.mov?alt=media&token=c516ed9c-8406-4f46-acad-f147985276d4" 
                        type="video/quicktime"
                      />
                      <source 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/video%2FIMG_6354.mov?alt=media&token=c516ed9c-8406-4f46-acad-f147985276d4" 
                        type="video/mp4"
                      />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
              >
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}

            {/* Trust badges */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-6 text-text-secondary mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="font-sans text-[12px]">Secure payment</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                <span className="font-sans text-[12px]">Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span className="font-sans text-[12px]">Powered by Stripe</span>
              </div>
            </motion.div>

            {/* Sign Out Button */}
            <motion.div
              className="flex justify-center mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              <button
                onClick={() => signOut({ redirectUrl: '/sign-in' })}
                className="font-sans text-[11px] text-text-tertiary hover:text-text-secondary transition-colors underline underline-offset-2"
              >
                Sign out
              </button>
            </motion.div>
          </div>
        </div>

        {/* Bottom CTA - Fixed on mobile */}
        <motion.div 
          className="sticky bottom-0 md:hidden px-6 pb-6 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <button
            onClick={handleContinue}
            disabled={isLoading || !agreedToTerms}
            className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating checkout...
              </span>
            ) : (
              'Start your transformation'
            )}
          </button>
        </motion.div>

        {/* Meta Pixel Code */}
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1347713597075016');
            fbq('track', 'PageView');
            fbq('track', 'AddToCart');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: 'none' }} alt=""
            src="https://www.facebook.com/tr?id=1347713597075016&ev=PageView&noscript=1"
          />
        </noscript>

        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-16653181105"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-16653181105');
          `}
        </Script>
      </div>
    </div>
  );
}
