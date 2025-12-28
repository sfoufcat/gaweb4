'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Users, 
  Layers, 
  Globe, 
  Mail, 
  CreditCard, 
  BarChart3, 
  Zap,
  ArrowRight,
  Sparkles,
  Shield,
  X,
  Lock
} from 'lucide-react';
import Image from 'next/image';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { CoachTier } from '@/types';
import { 
  TIER_PRICING, 
  getTierDisplayInfo, 
  formatLimitValue,
  getNextTier,
} from '@/lib/coach-permissions';
import { CoachPlanSkeleton } from '@/components/coach/CoachPlanSkeleton';

// Initialize Stripe outside component to avoid recreation on each render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// =============================================================================
// PLAN DEFINITIONS
// =============================================================================

interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

interface Plan {
  id: CoachTier;
  name: string;
  price: string;
  period: string;
  description: string;
  limits: { label: string; value: string }[];
  features: PlanFeature[];
  highlighted?: boolean;
  tag?: string;
}

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/month',
    description: 'Perfect for coaches just starting out',
    limits: [
      { label: 'Clients', value: '15' },
      { label: 'Programs', value: '2' },
      { label: 'Squads', value: '3' },
      { label: 'Funnels per target', value: '1' },
    ],
    features: [
      { text: 'Courses, Events & Articles', included: true },
      { text: 'Basic funnel steps', included: true },
      { text: 'Custom funnel branding', included: true },
      { text: 'Stripe Connect (accept payments)', included: true },
      { text: 'Advanced funnel steps (Identity, Analyzing)', included: false },
      { text: 'Custom domain', included: false },
      { text: 'Email whitelabeling', included: false },
    ],
    tag: 'START HERE',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$129',
    period: '/month',
    description: 'For growing coaching businesses',
    limits: [
      { label: 'Clients', value: '150' },
      { label: 'Programs', value: '10' },
      { label: 'Squads', value: '25' },
      { label: 'Funnels per target', value: '5' },
    ],
    features: [
      { text: 'Everything in Starter', included: true },
      { text: 'Advanced funnel steps', included: true, highlight: true },
      { text: 'Custom domain', included: true, highlight: true },
      { text: 'Email whitelabeling', included: true, highlight: true },
      { text: 'Advanced analytics', included: false },
      { text: 'A/B testing', included: false },
    ],
    highlighted: true,
    tag: 'MOST POPULAR',
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$299',
    period: '/month',
    description: 'For established coaching operations',
    limits: [
      { label: 'Clients', value: '500' },
      { label: 'Programs', value: '50' },
      { label: 'Squads', value: '100' },
      { label: 'Funnels per target', value: 'Unlimited' },
    ],
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Advanced analytics', included: true, highlight: true },
      { text: 'A/B testing', included: true, highlight: true },
      { text: 'API access', included: true, highlight: true },
      { text: 'Priority support', included: true, highlight: true },
      { text: 'Custom integrations', included: true },
      { text: 'Dedicated success manager', included: true },
    ],
  },
];

const WHY_UPGRADE = [
  {
    icon: Globe,
    title: 'Custom Domain',
    description: 'Run your coaching business on your own domain',
  },
  {
    icon: Mail,
    title: 'Email Whitelabeling',
    description: 'Send emails from your brand, not ours',
  },
  {
    icon: CreditCard,
    title: 'Stripe Connect',
    description: 'Accept payments directly to your account',
  },
  {
    icon: BarChart3,
    title: 'Advanced Funnels',
    description: 'Build sophisticated quiz funnels that convert',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function CoachPlanPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { logoUrl, appTitle } = useBrandingValues();
  const [selectedPlan, setSelectedPlan] = useState<CoachTier>('pro');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<CoachTier | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true);
  
  // Embedded checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<CoachTier | null>(null);

  // Fetch current subscription status
  useEffect(() => {
    if (!isLoaded || !user) return;

    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.subscription) {
            setCurrentTier(data.subscription.tier);
            // Pre-select next tier up if they have a subscription
            const nextTier = getNextTier(data.subscription.tier);
            if (nextTier) {
              setSelectedPlan(nextTier);
            }
          }
        }
      } catch (err) {
        console.error('Failed to check subscription:', err);
      } finally {
        setIsCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [isLoaded, user]);

  const handleSelectPlan = async () => {
    if (!selectedPlan) return;

    // Can't select current or lower tier
    if (currentTier) {
      const tierOrder: CoachTier[] = ['starter', 'pro', 'scale'];
      const currentIndex = tierOrder.indexOf(currentTier);
      const selectedIndex = tierOrder.indexOf(selectedPlan);
      if (selectedIndex <= currentIndex) {
        setError('Please select a higher tier to upgrade');
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.clientSecret) {
        // Open embedded checkout modal
        setClientSecret(data.clientSecret);
        setCheckoutPlan(selectedPlan);
        setShowCheckout(true);
        setIsLoading(false);
      } else {
        throw new Error('No checkout session received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  const handleCloseCheckout = useCallback(() => {
    setShowCheckout(false);
    setClientSecret(null);
    setCheckoutPlan(null);
  }, []);

  const handleManageSubscription = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/coach/subscription/portal', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError('Failed to open billing portal');
      setIsLoading(false);
    }
  };

  if (!isLoaded || !user || isCheckingSubscription) {
    return <CoachPlanSkeleton />;
  }

  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header */}
      <motion.div
        className="sticky top-0 z-50 bg-app-bg/95 backdrop-blur-sm border-b border-[#e1ddd8]/50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between px-6 py-3 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <Image
              src={logoUrl}
              alt={appTitle}
              width={40}
              height={40}
              className="rounded-lg"
              unoptimized
            />
            <span className="font-albert text-lg font-semibold text-text-primary">
              Coach Plans
            </span>
          </div>
          <button
            onClick={() => router.back()}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </motion.div>

      <div className="px-4 py-8 lg:py-12 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <h1 className="font-albert text-[32px] lg:text-[44px] text-text-primary tracking-[-2px] leading-[1.15] mb-3">
            {currentTier ? 'Upgrade Your Plan' : 'Choose Your Plan'}
          </h1>
          <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary max-w-xl mx-auto">
            {currentTier
              ? `You're currently on the ${TIER_PRICING[currentTier].name} plan. Upgrade to unlock more features.`
              : 'Start building your coaching business with the right tools.'}
          </p>
        </motion.div>

        {/* Current Plan Badge */}
        {currentTier && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f0fdf4] border border-[#bbf7d0] rounded-full">
              <Check className="w-4 h-4 text-[#22c55e]" />
              <span className="font-sans text-[14px] text-[#166534] font-medium">
                Current plan: {TIER_PRICING[currentTier].name}
              </span>
              <button
                onClick={handleManageSubscription}
                className="text-[#15803d] underline underline-offset-2 hover:text-[#166534]"
              >
                Manage
              </button>
            </div>
          </motion.div>
        )}

        {/* Plan Cards */}
        <motion.div
          className="grid md:grid-cols-3 gap-5 lg:gap-6 mb-12"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {PLANS.map((plan) => {
            const isCurrentPlan = currentTier === plan.id;
            const isDowngrade = !!(currentTier && 
              ['starter', 'pro', 'scale'].indexOf(plan.id) <= ['starter', 'pro', 'scale'].indexOf(currentTier));
            const isSelected = selectedPlan === plan.id;

            return (
              <button
                key={plan.id}
                onClick={() => !isDowngrade && setSelectedPlan(plan.id)}
                disabled={isDowngrade && !isCurrentPlan}
                className={`relative p-6 rounded-[24px] border-2 text-left transition-all duration-300 ${
                  isCurrentPlan
                    ? 'border-[#22c55e] bg-[#f0fdf4]/50 cursor-default'
                    : isDowngrade
                    ? 'border-[#e1ddd8] bg-[#f9f8f7] opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-[#a07855] bg-[#faf8f6] shadow-lg'
                    : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-md'
                }`}
              >
                {/* Tag */}
                {plan.tag && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-white font-sans text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md whitespace-nowrap ${
                      plan.highlighted 
                        ? 'bg-gradient-to-r from-[#a07855] to-[#c9a07a]'
                        : 'bg-[#6b7280]'
                    }`}>
                      {plan.tag}
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#22c55e] text-white font-sans text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                      CURRENT PLAN
                    </span>
                  </div>
                )}

                {/* Radio indicator */}
                {!isCurrentPlan && !isDowngrade && (
                  <div className={`absolute top-5 right-5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-[#a07855] bg-[#a07855]'
                      : 'border-[#d4d0cb]'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                )}

                {/* Plan Header */}
                <div className="mb-4 pr-8">
                  <h3 className="font-albert text-[22px] font-semibold text-text-primary tracking-[-0.5px] mb-1">
                    {plan.name}
                  </h3>
                  <p className="font-sans text-[13px] text-text-secondary">
                    {plan.description}
                  </p>
                </div>

                {/* Pricing */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-albert text-[40px] font-bold text-text-primary tracking-[-2px]">
                      {plan.price}
                    </span>
                    <span className="font-sans text-[14px] text-text-secondary">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-2 mb-5 p-3 bg-[#f9f8f7] rounded-xl">
                  {plan.limits.map((limit) => (
                    <div key={limit.label} className="text-center">
                      <div className="font-albert text-[18px] font-bold text-text-primary">
                        {limit.value}
                      </div>
                      <div className="font-sans text-[11px] text-text-secondary">
                        {limit.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      {feature.included ? (
                        <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          feature.highlight ? 'text-[#a07855]' : 'text-[#22c55e]'
                        }`} strokeWidth={2.5} />
                      ) : (
                        <X className="w-4 h-4 text-[#d4d0cb] flex-shrink-0 mt-0.5" strokeWidth={2} />
                      )}
                      <span className={`font-sans text-[13px] leading-tight ${
                        feature.included
                          ? feature.highlight
                            ? 'font-semibold text-text-primary'
                            : 'text-text-secondary'
                          : 'text-text-tertiary'
                      }`}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </motion.div>

        {/* CTA Button */}
        {(!currentTier || currentTier !== 'scale') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md mx-auto mb-12"
          >
            <button
              onClick={handleSelectPlan}
              disabled={isLoading || (currentTier === selectedPlan)}
              className="w-full bg-gradient-to-r from-[#a07855] to-[#c9a07a] text-white font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : currentTier ? (
                <>
                  Upgrade to {TIER_PRICING[selectedPlan].name}
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  Get Started with {TIER_PRICING[selectedPlan].name}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {error && (
              <p className="mt-3 text-center text-sm text-red-600">{error}</p>
            )}

            <p className="mt-4 text-center font-sans text-[12px] text-text-tertiary">
              Cancel anytime. No questions asked.
            </p>
          </motion.div>
        )}

        {/* Why Upgrade Section */}
        {(!currentTier || currentTier === 'starter') && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-12"
          >
            <h2 className="font-albert text-[24px] lg:text-[28px] text-text-primary tracking-[-1px] text-center mb-8">
              Why upgrade to Pro?
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {WHY_UPGRADE.map((item, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + index * 0.05 }}
                  className="bg-white rounded-2xl p-5 border border-[#e1ddd8] text-center"
                >
                  <div className="w-12 h-12 bg-[#faf8f6] rounded-xl flex items-center justify-center mx-auto mb-3">
                    <item.icon className="w-6 h-6 text-[#a07855]" />
                  </div>
                  <h4 className="font-sans text-[14px] font-semibold text-text-primary mb-1">
                    {item.title}
                  </h4>
                  <p className="font-sans text-[12px] text-text-secondary">
                    {item.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Money Back Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl mx-auto mb-12"
        >
          <div className="bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] rounded-[24px] p-6 lg:p-8 border border-[#bbf7d0]">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Shield className="w-6 h-6 text-[#22c55e]" />
              </div>
              <div>
                <h3 className="font-albert text-[20px] font-bold text-[#166534] tracking-[-0.5px] mb-2">
                  14-day money-back guarantee
                </h3>
                <p className="font-sans text-[14px] text-[#15803d] leading-relaxed">
                  Not satisfied? Get a full refund within 14 days, no questions asked.
                  We're confident you'll love the platform.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FAQ or Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="font-sans text-[14px] text-text-secondary">
            Questions? Contact us at{' '}
            <a href="mailto:hello@growthaddicts.com" className="text-[#a07855] underline underline-offset-2">
              hello@growthaddicts.com
            </a>
          </p>
        </motion.div>
      </div>

      {/* Embedded Checkout Modal */}
      <AnimatePresence>
        {showCheckout && clientSecret && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseCheckout();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#1a1e26] rounded-[24px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#313746]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#a07855] to-[#c9a07a] rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px]">
                      Subscribe to {checkoutPlan ? TIER_PRICING[checkoutPlan].name : 'Plan'}
                    </h2>
                    <p className="font-sans text-[13px] text-text-secondary">
                      {checkoutPlan && `$${(TIER_PRICING[checkoutPlan].monthly / 100).toFixed(0)}/month`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseCheckout}
                  className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Checkout Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>

              {/* Security Badge */}
              <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#313746] bg-[#f9f8f7] dark:bg-[#171b22]">
                <div className="flex items-center justify-center gap-2 text-text-secondary">
                  <Lock className="w-4 h-4" />
                  <span className="font-sans text-[12px]">
                    Secured by Stripe. Your payment info is encrypted.
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

