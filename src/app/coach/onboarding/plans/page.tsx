'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { 
  Check, 
  X,
  ArrowRight,
  Lock,
  Zap,
  Shield,
  Gift,
  Loader2
} from 'lucide-react';
import type { CoachTier } from '@/types';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Plan definitions with trial emphasis - matches exact spec
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
      'Accountability + check-ins (morning/evening/weekly)',
      'Programs + Masterminds + Squads',
      'Tasks + habits (incl. program-assigned)',
      'Social feed + chat + voice/video calls',
      'Courses + events + articles',
      'Custom funnels (basic steps)',
      'Basic analytics',
      'Stripe Connect payments',
    ],
  },
  {
    id: 'pro' as CoachTier,
    name: 'Pro',
    price: 129,
    description: 'For growing coaching businesses',
    popular: true,
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
    highlight: true,
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
      'Higher limits (members/programs/funnels)',
      'AI Builder / AI Helper',
      'Priority support',
    ],
  },
];

// Stripe appearance configuration
const stripeAppearance: import('@stripe/stripe-js').Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#a07855',
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
      borderColor: '#a07855',
      boxShadow: '0 0 0 1px #a07855',
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
      borderColor: '#a07855',
      backgroundColor: '#faf8f6',
    },
  },
};

// Payment Form Component (inside Elements provider)
interface PaymentFormProps {
  selectedPlan: CoachTier;
  onSuccess: () => void;
  onCancel: () => void;
  setupIntentId: string;
}

function PaymentForm({ selectedPlan, onSuccess, onCancel, setupIntentId }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = PLANS.find(p => p.id === selectedPlan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Confirm the SetupIntent
      const { error: submitError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href, // Not used for redirect: 'if_required'
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
        return;
      }

      if (setupIntent?.status === 'succeeded') {
        // Create the subscription on the backend
        const confirmResponse = await fetch('/api/coach/subscription/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            setupIntentId: setupIntent.id,
            tier: selectedPlan,
            trial: true,
            onboarding: true,
          }),
        });

        const confirmData = await confirmResponse.json();

        if (!confirmResponse.ok) {
          throw new Error(confirmData.error || 'Failed to activate subscription');
        }

        onSuccess();
      } else {
        setError('Payment setup incomplete. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan Summary */}
      <div className="bg-gradient-to-r from-[#fef9e7] to-[#fef3c7] dark:from-[#422006]/30 dark:to-[#451a03]/30 rounded-xl p-4 border border-[#fde047]/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-sm text-[#92400e] dark:text-[#fbbf24]">
              {plan?.name} plan
            </p>
            <p className="font-albert text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
              7 days free
            </p>
          </div>
          <div className="text-right">
            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              then
            </p>
            <p className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              ${plan?.price}/mo
            </p>
          </div>
        </div>
      </div>

      {/* Payment Element - Native Stripe with Apple Pay, Google Pay, Cards */}
      <div className="bg-white dark:bg-[#1e222a] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#313746]">
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

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl"
          >
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full flex items-center justify-center gap-2 py-4 bg-[#a07855] hover:bg-[#8b6847] text-white rounded-xl font-albert text-[16px] font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Start 7-day free trial
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-full py-3 text-[#5f5a55] dark:text-[#b2b6c2] font-sans text-sm hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {/* Security note */}
      <p className="text-center font-sans text-xs text-[#a7a39e] dark:text-[#7d8190]">
        <Lock className="w-3 h-3 inline mr-1" />
        Secured by Stripe. You won't be charged until after the trial.
      </p>
    </form>
  );
}

/**
 * Coach Onboarding - Plans Page
 * 
 * Step 2 of coach onboarding: Select a plan and start 7-day free trial.
 * Uses native Stripe PaymentElement with Apple Pay, Google Pay, and card support.
 */
export default function OnboardingPlansPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [selectedPlan, setSelectedPlan] = useState<CoachTier>('starter');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupIntentId, setSetupIntentId] = useState<string | null>(null);

  // Check onboarding state on mount
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    const checkState = async () => {
      try {
        const response = await fetch('/api/coach/onboarding-state');
        if (response.ok) {
          const data = await response.json();
          
          // If not a coach, redirect to marketplace
          if (!data.isCoach) {
            router.push('/marketplace');
            return;
          }
          
          // If profile not completed, go back to profile step
          if (data.state === 'needs_profile') {
            router.push('/coach/onboarding/profile');
            return;
          }
          
          // If already active, go to dashboard
          if (data.state === 'active') {
            router.push('/coach');
            return;
          }
        }
      } catch (err) {
        console.error('Error checking onboarding state:', err);
      }
    };
    
    checkState();
  }, [isLoaded, user, router]);

  const handleStartTrial = async () => {
    if (!selectedPlan) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/coach/subscription/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tier: selectedPlan,
          trial: true,
          onboarding: true,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout');
      }
      
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
        // Extract setupIntent ID from client secret
        const intentId = data.clientSecret.split('_secret_')[0];
        setSetupIntentId(intentId);
        setShowCheckout(true);
      } else {
        throw new Error('No payment session received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    // Redirect to welcome page
    router.push('/coach/welcome');
  };

  const handleCloseCheckout = () => {
    setShowCheckout(false);
    setClientSecret(null);
    setSetupIntentId(null);
  };

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#faf8f6] to-[#f5f2ed] dark:from-[#0a0c10] dark:to-[#11141b] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#a07855]/20 border-t-[#a07855] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#11141b]">
      <div className="bg-gradient-to-b from-[#faf8f6] to-transparent dark:from-[#0a0c10] dark:to-transparent min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#faf8f6]/95 dark:bg-[#0a0c10]/95 backdrop-blur-sm border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden relative">
              <Image
                src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af"
                alt="Growth Addicts"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <span className="font-albert text-[18px] font-bold tracking-[-0.5px] text-[#1a1a1a] dark:text-[#f5f5f8]">
              Growth<span className="text-[#a07855] dark:text-[#b8896a]">Addicts</span>
            </span>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#22c55e]/20 flex items-center justify-center">
              <Check className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div className="w-8 h-1 bg-[#a07855] dark:bg-[#b8896a] rounded-full" />
            <div className="w-8 h-8 rounded-full bg-[#a07855] dark:bg-[#b8896a] flex items-center justify-center">
              <span className="text-white text-sm font-bold">2</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {/* Trial Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#e8b923]/20 to-[#d4a61d]/10 border border-[#e8b923]/30 rounded-full mb-6">
            <Gift className="w-4 h-4 text-[#e8b923]" />
            <span className="font-albert text-[14px] font-semibold text-[#9a7f13] dark:text-[#e8b923]">
              7-day free trial • No credit card charged today
            </span>
          </div>
          
          <h1 className="font-albert text-[36px] sm:text-[44px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.1] mb-4">
            Choose your plan
          </h1>
          <p className="font-sans text-[16px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-xl mx-auto">
            Start with a 7-day free trial. You won't be charged until the trial ends, 
            and you can cancel anytime.
          </p>
        </motion.div>

        {/* Plan Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-5 mb-10"
        >
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-[#a07855] dark:border-[#b8896a] bg-white dark:bg-[#171b22] shadow-xl shadow-[#a07855]/10'
                    : 'border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#171b22] hover:border-[#d4d0cb] dark:hover:border-[#424958]'
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-[#a07855] to-[#b8896a] text-white font-albert text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
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
                
                {/* Plan info */}
                <div className="mb-4 pr-8">
                  <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] mb-1">
                    {plan.name}
                  </h3>
                  <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    {plan.description}
                  </p>
                </div>
                
                {/* Pricing */}
                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-albert text-[36px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px]">
                      ${plan.price}
                    </span>
                    <span className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      /month
                    </span>
                  </div>
                  <p className="font-sans text-[12px] text-[#22c55e] font-medium">
                    Free for 7 days
                  </p>
                </div>
                
                {/* Limits */}
                <div className="grid grid-cols-3 gap-2 mb-4 p-3 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
                  {plan.limits.map((limit) => (
                    <div key={limit.label} className="text-center">
                      <div className="font-albert text-[16px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {limit.value}
                      </div>
                      <div className="font-sans text-[10px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        {limit.label}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Features */}
                <ul className="space-y-2">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#22c55e] flex-shrink-0" />
                      <span className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-md mx-auto text-center"
        >
          <button
            onClick={handleStartTrial}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-4 bg-[#a07855] hover:bg-[#8b6847] text-white rounded-xl font-albert text-[16px] font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Start 7-day free trial
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          
          {error && (
            <p className="mt-3 font-sans text-[13px] text-red-600">{error}</p>
          )}
          
          <p className="mt-4 font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
            You'll be charged ${PLANS.find(p => p.id === selectedPlan)?.price}/month after the trial ends.
            <br />Cancel anytime during the trial to avoid charges.
          </p>
        </motion.div>

        {/* Trust Signals */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16 max-w-2xl mx-auto"
        >
          <div className="flex flex-wrap items-center justify-center gap-6 text-[#5f5a55] dark:text-[#b2b6c2]">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="font-sans text-[13px]">Cancel anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span className="font-sans text-[13px]">Secure checkout</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="font-sans text-[13px]">Instant access</span>
            </div>
          </div>
        </motion.div>
      </div>
      </div>

      {/* Payment Modal with Native Stripe Elements */}
      <AnimatePresence>
        {showCheckout && clientSecret && setupIntentId && (
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
              className="relative w-full max-w-md bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#313746]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#e8b923] to-[#d4a61d] rounded-xl flex items-center justify-center">
                    <Gift className="w-5 h-5 text-[#2c2520]" />
                  </div>
                  <div>
                    <h2 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px]">
                      Start your free trial
                    </h2>
                    <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      {PLANS.find(p => p.id === selectedPlan)?.name} plan • 7 days free
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

              {/* Payment Form with Stripe Elements */}
              <div className="flex-1 overflow-y-auto p-6">
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: stripeAppearance,
                  }}
                >
                  <PaymentForm
                    selectedPlan={selectedPlan}
                    onSuccess={handlePaymentSuccess}
                    onCancel={handleCloseCheckout}
                    setupIntentId={setupIntentId}
                  />
                </Elements>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
