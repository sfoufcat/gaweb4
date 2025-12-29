'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useOrganization } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js';
import { 
  Check, 
  X,
  ArrowRight,
  Lock,
  CreditCard,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { CoachTier, CoachSubscriptionStatus } from '@/types';
import { useBrandingValues } from '@/contexts/BrandingContext';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Plan definitions
const PLANS = [
  {
    id: 'starter' as CoachTier,
    name: 'Starter',
    price: 49,
    description: 'Perfect for coaches just starting out',
    limits: [
      { label: 'Clients', value: '15' },
      { label: 'Programs', value: '2' },
      { label: 'Squads', value: '3' },
    ],
    features: [
      'Check-ins + accountability',
      'Programs + Masterminds',
      'Tasks + habits',
      'Chat + video calls',
      'Courses + events',
      'Custom funnels (basic)',
      'Basic analytics',
      'Stripe payments',
    ],
  },
  {
    id: 'pro' as CoachTier,
    name: 'Pro',
    price: 129,
    description: 'For growing coaching businesses',
    limits: [
      { label: 'Clients', value: '150' },
      { label: 'Programs', value: '10' },
      { label: 'Squads', value: '25' },
    ],
    features: [
      'Everything in Starter, plus:',
      'Custom domain',
      'Email white labeling',
      'Advanced funnel steps',
      'Upsells + downsells',
    ],
    popular: true,
  },
  {
    id: 'scale' as CoachTier,
    name: 'Scale',
    price: 299,
    description: 'For established coaching operations',
    limits: [
      { label: 'Clients', value: '500' },
      { label: 'Programs', value: '50' },
      { label: 'Squads', value: '100' },
    ],
    features: [
      'Everything in Pro, plus:',
      'Team roles + permissions',
      'Multi-coach support',
      'AI Builder / AI Helper',
      'Priority support',
    ],
  },
];

interface SubscriptionInfo {
  tier: CoachTier;
  status: CoachSubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Coach Reactivation Page
 * 
 * Shown when a coach's subscription is invalid (none, canceled, past_due).
 * Two-column layout:
 * - Left: Plan selection with previous plan preselected
 * - Right: Payment method update / checkout
 */
export default function ReactivatePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { organization } = useOrganization();
  const { logoUrl, appTitle } = useBrandingValues();
  
  const [selectedPlan, setSelectedPlan] = useState<CoachTier>('starter');
  const [previousPlan, setPreviousPlan] = useState<CoachTier | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(true);
  
  // Checkout state
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current subscription status
  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchSubscription = async () => {
      try {
        setIsLoadingSubscription(true);
        const response = await fetch('/api/coach/subscription');
        if (response.ok) {
          const data = await response.json();
          if (data.subscription) {
            setSubscriptionInfo({
              tier: data.subscription.tier,
              status: data.subscription.status,
              currentPeriodEnd: data.subscription.currentPeriodEnd,
              cancelAtPeriodEnd: data.subscription.cancelAtPeriodEnd,
            });
            setPreviousPlan(data.subscription.tier);
            setSelectedPlan(data.subscription.tier);
          } else {
            // No subscription - check Clerk org metadata for previous plan
            const orgMetadata = organization?.publicMetadata as { plan?: CoachTier } | undefined;
            if (orgMetadata?.plan) {
              setPreviousPlan(orgMetadata.plan);
              setSelectedPlan(orgMetadata.plan);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setIsLoadingSubscription(false);
      }
    };

    fetchSubscription();
  }, [isLoaded, user, organization]);

  const handleReactivate = async () => {
    if (!selectedPlan) return;

    setIsStartingCheckout(true);
    setError(null);

    try {
      const response = await fetch('/api/coach/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tier: selectedPlan,
          reactivate: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        setShowCheckout(true);
      } else {
        throw new Error('No checkout session received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const handleCloseCheckout = useCallback(() => {
    setShowCheckout(false);
    setClientSecret(null);
  }, []);

  const handleCheckoutComplete = useCallback(() => {
    // Redirect to dashboard after successful reactivation
    router.push('/coach');
  }, [router]);

  const getStatusMessage = () => {
    if (!subscriptionInfo) {
      return {
        title: 'No Active Subscription',
        description: 'You need an active subscription to access your coaching dashboard.',
        color: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-900/50',
      };
    }

    switch (subscriptionInfo.status) {
      case 'canceled':
        return {
          title: 'Subscription Canceled',
          description: subscriptionInfo.currentPeriodEnd 
            ? `Your subscription ended on ${new Date(subscriptionInfo.currentPeriodEnd).toLocaleDateString()}.`
            : 'Your subscription has been canceled.',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-950/30',
          borderColor: 'border-red-200 dark:border-red-900/50',
        };
      case 'past_due':
        return {
          title: 'Payment Failed',
          description: 'We couldn\'t process your last payment. Please update your payment method to continue.',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-50 dark:bg-orange-950/30',
          borderColor: 'border-orange-200 dark:border-orange-900/50',
        };
      case 'none':
      default:
        return {
          title: 'Subscription Required',
          description: 'Select a plan to activate your coaching dashboard.',
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-50 dark:bg-amber-950/30',
          borderColor: 'border-amber-200 dark:border-amber-900/50',
        };
    }
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#a07855]/20 border-t-[#a07855] rounded-full animate-spin" />
      </div>
    );
  }

  const statusInfo = getStatusMessage();

  return (
    <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#11141b]">
      <div className="bg-gradient-to-b from-[#faf8f6] to-transparent dark:from-[#0a0c10] dark:to-transparent min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#faf8f6]/95 dark:bg-[#0a0c10]/95 backdrop-blur-sm border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden relative">
                <Image
                  src={logoUrl}
                  alt={appTitle}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <span className="font-albert text-[18px] font-bold tracking-[-0.5px] text-[#1a1a1a] dark:text-[#f5f5f8]">
                {appTitle}
              </span>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-8 p-4 rounded-xl border ${statusInfo.bgColor} ${statusInfo.borderColor}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${statusInfo.color}`} />
              <div>
                <h2 className={`font-albert text-lg font-semibold ${statusInfo.color}`}>
                  {statusInfo.title}
                </h2>
                <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                  {statusInfo.description}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Main Content - Two Columns */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column - Plan Selection */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px] mb-6">
                {previousPlan ? 'Select Your Plan' : 'Choose a Plan'}
              </h2>

              {isLoadingSubscription ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#313746] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.id;
                    const wasPreviousPlan = previousPlan === plan.id;

                    return (
                      <button
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative w-full p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-[#a07855] dark:border-[#b8896a] bg-white dark:bg-[#171b22] shadow-lg shadow-[#a07855]/10'
                            : 'border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#171b22] hover:border-[#d4d0cb] dark:hover:border-[#424958]'
                        }`}
                      >
                        {/* Previous plan badge */}
                        {wasPreviousPlan && (
                          <div className="absolute -top-2.5 left-4">
                            <span className="bg-[#6366f1] text-white font-albert text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                              Previous Plan
                            </span>
                          </div>
                        )}

                        {/* Popular badge */}
                        {plan.popular && !wasPreviousPlan && (
                          <div className="absolute -top-2.5 left-4">
                            <span className="bg-[#a07855] text-white font-albert text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                              Most Popular
                            </span>
                          </div>
                        )}

                        {/* Selection indicator */}
                        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-[#a07855] dark:border-[#b8896a] bg-[#a07855] dark:bg-[#b8896a]'
                            : 'border-[#d4d0cb] dark:border-[#424958]'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>

                        <div className="flex items-start justify-between pr-10">
                          <div>
                            <h3 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                              {plan.name}
                            </h3>
                            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
                              {plan.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                              ${plan.price}
                            </span>
                            <span className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">/mo</span>
                          </div>
                        </div>

                        {/* Limits */}
                        <div className="flex gap-4 mt-4">
                          {plan.limits.map((limit) => (
                            <div key={limit.label} className="text-center bg-[#f9f8f7] dark:bg-[#1e222a] rounded-lg px-3 py-2">
                              <div className="font-albert text-sm font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                                {limit.value}
                              </div>
                              <div className="font-sans text-[10px] text-[#5f5a55] dark:text-[#b2b6c2]">
                                {limit.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Right Column - Payment */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px] mb-6">
                <CreditCard className="w-6 h-6 inline mr-2 text-[#a07855] dark:text-[#b8896a]" />
                Payment Details
              </h2>

              <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#313746] p-6">
                {/* Selected Plan Summary */}
                <div className="mb-6 p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        Selected plan
                      </p>
                      <p className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {PLANS.find(p => p.id === selectedPlan)?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        ${PLANS.find(p => p.id === selectedPlan)?.price}
                      </p>
                      <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        per month
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reactivate Button */}
                <button
                  onClick={handleReactivate}
                  disabled={isStartingCheckout || isLoadingSubscription}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#a07855] hover:bg-[#8b6847] text-white rounded-xl font-sans font-semibold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStartingCheckout ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Reactivate Subscription
                    </>
                  )}
                </button>

                {error && (
                  <p className="mt-3 text-center font-sans text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                )}

                {/* Security Note */}
                <div className="mt-6 flex items-center justify-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Lock className="w-4 h-4" />
                  <span className="font-sans text-xs">
                    Secured by Stripe. Your payment info is encrypted.
                  </span>
                </div>

                {/* Features of selected plan */}
                <div className="mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#313746]">
                  <p className="font-sans text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                    What's included:
                  </p>
                  <ul className="space-y-2">
                    {PLANS.find(p => p.id === selectedPlan)?.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
                        <span className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
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
              className="relative w-full max-w-lg bg-white dark:bg-[#1a1e26] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#313746]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#a07855] rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                      Reactivate {PLANS.find(p => p.id === selectedPlan)?.name}
                    </h2>
                    <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      ${PLANS.find(p => p.id === selectedPlan)?.price}/month
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseCheckout}
                  className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                >
                  <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </button>
              </div>

              {/* Checkout Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ 
                    clientSecret,
                    onComplete: handleCheckoutComplete,
                  }}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>

              {/* Security Badge */}
              <div className="px-6 py-4 border-t border-[#e1ddd8] dark:border-[#313746] bg-[#f9f8f7] dark:bg-[#171b22]">
                <div className="flex items-center justify-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Lock className="w-4 h-4" />
                  <span className="font-sans text-xs">
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

