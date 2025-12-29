'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, 
  Globe, 
  Mail, 
  CreditCard, 
  BarChart3, 
  ArrowRight,
  X,
  Lock,
  Users,
  Sparkles,
  Headphones,
  Shield
} from 'lucide-react';
import Image from 'next/image';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
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
      { text: 'Accountability + check-ins', included: true },
      { text: 'Programs + Masterminds + Squads', included: true },
      { text: 'Tasks + habits', included: true },
      { text: 'Social feed + chat + calls', included: true },
      { text: 'Courses + events + articles', included: true },
      { text: 'Custom funnels (basic steps)', included: true },
      { text: 'Basic analytics', included: true },
      { text: 'Stripe Connect payments', included: true },
      { text: 'Custom domain', included: false },
      { text: 'Email white labeling', included: false },
    ],
    tag: '7-DAY FREE TRIAL',
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
      { text: 'Everything in Starter, plus:', included: true },
      { text: 'Custom domain', included: true, highlight: true },
      { text: 'Email white labeling', included: true, highlight: true },
      { text: 'Advanced funnel steps', included: true, highlight: true },
      { text: 'Upsells + downsells', included: true, highlight: true },
      { text: 'Team roles + permissions', included: false },
      { text: 'AI Builder / AI Helper', included: false },
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
      { text: 'Everything in Pro, plus:', included: true },
      { text: 'Team roles + permissions', included: true, highlight: true },
      { text: 'Multi-coach support', included: true, highlight: true },
      { text: 'Higher limits (all categories)', included: true, highlight: true },
      { text: 'AI Builder / AI Helper', included: true, highlight: true },
      { text: 'Priority support', included: true, highlight: true },
    ],
  },
];

const WHY_UPGRADE_PRO = [
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

const WHY_UPGRADE_SCALE = [
  {
    icon: Users,
    title: 'Team Roles & Permissions',
    description: 'Invite team members with role-based access control',
  },
  {
    icon: Shield,
    title: 'Multi-Coach Support',
    description: 'Run multiple coaches under one organization',
  },
  {
    icon: Sparkles,
    title: 'AI Builder & Helper',
    description: 'Use AI to create funnels, content, and more',
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description: 'Get faster responses and dedicated assistance',
  },
];

// Stripe appearance configuration for PaymentElement
const stripeAppearance: import('@stripe/stripe-js').Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: 'var(--brand-accent-light)',
    colorBackground: '#ffffff',
    colorText: '#1a1a1a',
    colorTextSecondary: '#5f5a55',
    colorDanger: '#ef4444',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSizeBase: '15px',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      borderColor: '#e1ddd8',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:focus': {
      borderColor: 'var(--brand-accent-light)',
      boxShadow: '0 0 0 1px var(--brand-accent-light)',
    },
    '.Label': {
      fontWeight: '500',
      marginBottom: '6px',
      color: '#1a1a1a',
    },
    '.Tab': {
      borderColor: '#e1ddd8',
    },
    '.Tab--selected': {
      borderColor: 'var(--brand-accent-light)',
      backgroundColor: '#faf8f6',
    },
  },
};

// =============================================================================
// CHECKOUT FORM COMPONENT (with PaymentElement)
// =============================================================================

interface CheckoutFormProps {
  planName: string;
  price: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ planName, price, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/coach?upgraded=true`,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      // Payment succeeded
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('An unexpected error occurred. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Plan Summary */}
      <div className="bg-[#faf8f6] dark:bg-[#262b35] rounded-xl p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-sans text-[14px] font-medium text-text-primary">{planName} Plan</p>
            <p className="font-sans text-[12px] text-text-secondary">Monthly subscription</p>
          </div>
          <p className="font-albert text-[20px] font-bold text-text-primary">{price}/mo</p>
        </div>
      </div>

      {/* Payment Element */}
      <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#313746] p-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-text-secondary" />
          <span className="font-sans text-[14px] font-medium text-text-primary">
            Payment details
          </span>
        </div>
        <PaymentElement
          options={{
            layout: 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
        />
      </div>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl"
          >
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-text-secondary">
        <Lock className="w-4 h-4" />
        <span className="font-sans text-[12px]">
          Secured by Stripe. Your payment info is encrypted.
        </span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-brand-accent hover:bg-[#8b6847] text-white font-sans font-bold text-[15px] py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing payment...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Subscribe to {planName}
          </>
        )}
      </button>

      {/* Cancel Link */}
      <button
        type="button"
        onClick={onCancel}
        disabled={isProcessing}
        className="w-full text-center font-sans text-[14px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </form>
  );
}

// =============================================================================
// MAIN COMPONENT
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
  
  // Subscription details for display
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  
  // Admin-granted subscription tracking
  const [isManualBilling, setIsManualBilling] = useState(false);
  const [manualExpiresAt, setManualExpiresAt] = useState<string | null>(null);
  const [showAdminGrantedPopup, setShowAdminGrantedPopup] = useState(false);
  
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
            setSubscriptionStatus(data.subscription.status);
            setRenewalDate(data.subscription.currentPeriodEnd);
            setTrialEnd(data.subscription.trialEnd);
            setCancelAtPeriodEnd(data.subscription.cancelAtPeriodEnd || false);
            // Track admin-granted subscriptions
            setIsManualBilling(data.subscription.manualBilling || false);
            setManualExpiresAt(data.subscription.manualExpiresAt || null);
            // Pre-select next tier up if they have a subscription
            const nextTier = getNextTier(data.subscription.tier);
            if (nextTier) {
              setSelectedPlan(nextTier);
            }
          } else if (data.tier) {
            // Legacy: tier from org_settings but no subscription doc
            setCurrentTier(data.tier);
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
        body: JSON.stringify({ tier: selectedPlan, upgrade: true }),
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
    // For admin-granted plans, show the info popup instead of Stripe portal
    if (isManualBilling) {
      setShowAdminGrantedPopup(true);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/coach/subscription/portal', {
        method: 'POST',
      });
      const data = await response.json();
      if (data.url) {
        // Open Stripe portal in new tab for better UX
        window.open(data.url, '_blank');
        setIsLoading(false);
      } else if (data.error) {
        setError(data.error);
        setIsLoading(false);
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

        {/* Current Plan Status */}
        {currentTier && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className="bg-white rounded-2xl border border-[#e1ddd8] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    subscriptionStatus === 'active' || subscriptionStatus === 'trialing' 
                      ? 'bg-[#22c55e]' 
                      : subscriptionStatus === 'past_due' 
                      ? 'bg-[#f59e0b]' 
                      : 'bg-[#ef4444]'
                  }`} />
                  <div>
                    <h3 className="font-albert text-[18px] font-semibold text-text-primary">
                      {TIER_PRICING[currentTier].name} Plan
                    </h3>
                    <p className="font-sans text-[13px] text-text-secondary capitalize">
                      {subscriptionStatus === 'trialing' ? 'Trial' : subscriptionStatus || 'Active'}
                      {cancelAtPeriodEnd && ' • Cancels at period end'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManageSubscription}
                    className="px-4 py-2 text-brand-accent font-sans text-[14px] font-medium hover:bg-[#faf8f6] rounded-lg transition-colors"
                  >
                    Manage membership
                  </button>
                </div>
              </div>
              
              {/* Status Details */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#e1ddd8]">
                {trialEnd && subscriptionStatus === 'trialing' && (
                  <div>
                    <p className="font-sans text-[12px] text-text-tertiary uppercase tracking-wide mb-1">Trial ends</p>
                    <p className="font-sans text-[14px] text-text-primary font-medium">
                      {new Date(trialEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {renewalDate && (
                  <div>
                    <p className="font-sans text-[12px] text-text-tertiary uppercase tracking-wide mb-1">
                      {cancelAtPeriodEnd ? 'Access until' : 'Renews on'}
                    </p>
                    <p className="font-sans text-[14px] text-text-primary font-medium">
                      {new Date(renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="font-sans text-[12px] text-text-tertiary uppercase tracking-wide mb-1">Monthly price</p>
                  <p className="font-sans text-[14px] text-text-primary font-medium">
                    ${(TIER_PRICING[currentTier].monthly / 100).toFixed(0)}/month
                  </p>
                </div>
              </div>
              
              {/* Cancel Link */}
              {subscriptionStatus && !cancelAtPeriodEnd && (
                <div className="mt-4 pt-4 border-t border-[#e1ddd8]">
                  <button
                    onClick={handleManageSubscription}
                    className="font-sans text-[13px] text-text-tertiary hover:text-red-600 transition-colors"
                  >
                    Cancel subscription
                  </button>
                </div>
              )}
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
                    ? 'border-[#22c55e] cursor-default'
                    : isDowngrade
                    ? 'border-[#e1ddd8] opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-brand-accent shadow-lg'
                    : 'border-[#e1ddd8] hover:border-[#d4d0cb] hover:shadow-md'
                }`}
              >
                {/* Tag */}
                {plan.tag && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`text-white font-sans text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md whitespace-nowrap ${
                      plan.highlighted 
                        ? 'bg-brand-accent'
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
                      ? 'border-brand-accent bg-brand-accent'
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
                <div className="grid grid-cols-2 gap-2 mb-5 p-3 rounded-xl">
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
                          feature.highlight ? 'text-brand-accent' : 'text-[#22c55e]'
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
              className="w-full bg-brand-accent hover:bg-[#8b6847] text-white font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
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

        {/* Why Upgrade Section - dynamic based on selected plan */}
        {(() => {
          // Determine which features to show based on selected plan and current tier
          const showProFeatures = selectedPlan === 'pro' && currentTier !== 'pro' && currentTier !== 'scale';
          const showScaleFeatures = selectedPlan === 'scale' && currentTier !== 'scale';
          
          if (!showProFeatures && !showScaleFeatures) return null;
          
          const features = showScaleFeatures ? WHY_UPGRADE_SCALE : WHY_UPGRADE_PRO;
          const title = showScaleFeatures ? 'Why upgrade to Scale?' : 'Why upgrade to Pro?';
          
          return (
            <motion.div
              key={selectedPlan} // Re-animate when plan changes
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-12"
            >
              <h2 className="font-albert text-[24px] lg:text-[28px] text-text-primary tracking-[-1px] text-center mb-8">
                {title}
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {features.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 + index * 0.05 }}
                    className="rounded-2xl p-5 border border-[#e1ddd8] text-center"
                  >
                    <div className="w-12 h-12 bg-[#faf8f6] rounded-xl flex items-center justify-center mx-auto mb-3">
                      <item.icon className="w-6 h-6 text-brand-accent" />
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
          );
        })()}

        {/* FAQ or Contact */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="font-sans text-[14px] text-text-secondary">
            Questions? Contact us at{' '}
            <a href="mailto:hello@growthaddicts.com" className="text-brand-accent underline underline-offset-2">
              hello@growthaddicts.com
            </a>
          </p>
        </motion.div>
      </div>

      {/* Payment Checkout Modal */}
      <AnimatePresence>
        {showCheckout && clientSecret && checkoutPlan && (
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
              className="relative w-full max-w-md bg-white dark:bg-[#1a1e26] rounded-[24px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#313746]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-accent to-[#c9a07a] rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px]">
                      Upgrade to {TIER_PRICING[checkoutPlan].name}
                    </h2>
                    <p className="font-sans text-[13px] text-text-secondary">
                      Complete your payment
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

              {/* Checkout Content with PaymentElement */}
              <div className="flex-1 overflow-y-auto p-6">
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: stripeAppearance,
                  }}
                >
                  <CheckoutForm
                    planName={TIER_PRICING[checkoutPlan].name}
                    price={`$${(TIER_PRICING[checkoutPlan].monthly / 100).toFixed(0)}`}
                    onSuccess={() => {
                      handleCloseCheckout();
                      // Refresh page to show updated subscription
                      window.location.href = '/coach?upgraded=true';
                    }}
                    onCancel={handleCloseCheckout}
                  />
                </Elements>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin-Granted Plan Info Popup */}
      <AnimatePresence>
        {showAdminGrantedPopup && currentTier && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAdminGrantedPopup(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white dark:bg-[#1a1e26] rounded-[24px] shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#313746]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#22c55e] to-[#16a34a] rounded-xl flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-albert text-[18px] font-semibold text-text-primary tracking-[-0.5px]">
                      Your Plan
                    </h2>
                    <p className="font-sans text-[13px] text-text-secondary">
                      Granted by administrator
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAdminGrantedPopup(false)}
                  className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Plan Info Content */}
              <div className="p-6 space-y-4">
                {/* Current Plan */}
                <div className="bg-[#f0fdf4] dark:bg-[#22c55e]/10 rounded-xl p-4 border border-[#22c55e]/20">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-[#22c55e]" />
                    <div>
                      <p className="font-sans text-[14px] font-semibold text-text-primary">
                        {TIER_PRICING[currentTier].name} Plan
                      </p>
                      <p className="font-sans text-[12px] text-text-secondary">
                        Active
                      </p>
                    </div>
                  </div>
                </div>

                {/* Access Duration */}
                <div className="bg-[#f9f8f7] dark:bg-[#262b35] rounded-xl p-4">
                  <p className="font-sans text-[12px] text-text-tertiary uppercase tracking-wide mb-1">
                    Access Duration
                  </p>
                  <p className="font-sans text-[16px] font-semibold text-text-primary">
                    {manualExpiresAt 
                      ? `Until ${new Date(manualExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : 'Unlimited access'
                    }
                  </p>
                  {manualExpiresAt && (
                    <p className="font-sans text-[13px] text-text-secondary mt-1">
                      {(() => {
                        const daysLeft = Math.ceil((new Date(manualExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        if (daysLeft < 0) return 'Expired';
                        if (daysLeft === 0) return 'Expires today';
                        if (daysLeft === 1) return '1 day remaining';
                        return `${daysLeft} days remaining`;
                      })()}
                    </p>
                  )}
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800/50">
                  <p className="font-sans text-[13px] text-blue-700 dark:text-blue-300">
                    Your plan was granted by an administrator. To make changes or extend your access, please contact support.
                  </p>
                </div>

                {/* Contact Support Button */}
                <a
                  href="mailto:hello@growthaddicts.com"
                  className="block w-full bg-brand-accent hover:bg-[#8b6847] text-white font-sans font-semibold text-[14px] py-3 px-6 rounded-xl text-center transition-colors"
                >
                  Contact Support
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

