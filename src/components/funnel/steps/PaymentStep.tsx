'use client';

import { useState, useEffect, useMemo } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CreditCard, Check, ArrowLeft } from 'lucide-react';
import type { FunnelStepConfigPayment } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';
const primaryHoverVar = 'var(--funnel-primary-hover, #8c6245)';

interface PaymentStepProps {
  config: FunnelStepConfigPayment;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  data: Record<string, unknown>;
  program: {
    name: string;
    priceInCents: number;
    currency: string;
    stripePriceId?: string;
  };
  skipPayment: boolean;
  isFirstStep: boolean;
}

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => void;
  programName: string;
  priceInCents: number;
  currency: string;
  features?: string[];
}

function PaymentForm({ onSuccess, programName, priceInCents, currency, features }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (cents: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr.toUpperCase(),
    }).format(cents / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan summary */}
      <div className="bg-[#faf8f6] rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-medium text-text-primary">{programName}</h3>
            <p className="text-sm text-text-secondary">Full access</p>
          </div>
          <div className="text-right">
            <p className="font-albert text-2xl font-semibold text-text-primary">
              {formatPrice(priceInCents, currency)}
            </p>
          </div>
        </div>

        {features && features.length > 0 && (
          <div className="border-t border-[#e1ddd8] pt-4 space-y-2">
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#a07855] dark:text-[#b8896a]" />
                <span className="text-sm text-text-secondary">{feature}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Element */}
      <div className="bg-white rounded-2xl border border-[#e1ddd8] p-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">
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

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl"
          >
            <p className="text-red-600 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        style={{ backgroundColor: primaryVar }}
        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
      >
        {isProcessing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {formatPrice(priceInCents, currency)}
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-text-muted">
        <Lock className="w-3 h-3 inline mr-1" />
        Secured by Stripe. Your payment info is never stored on our servers.
      </p>
    </form>
  );
}

export function PaymentStep({
  config,
  onComplete,
  onBack,
  data,
  program,
  skipPayment,
  isFirstStep,
}: PaymentStepProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine price
  const priceInCents = config.useProgramPricing 
    ? program.priceInCents 
    : (config.priceInCents || program.priceInCents);
  
  const currency = program.currency || 'usd';
  const stripePriceId = config.stripePriceId || program.stripePriceId;

  // Skip payment if marked as pre-paid
  useEffect(() => {
    if (skipPayment) {
      onComplete({ skippedPayment: true, prePaid: true });
      return;
    }

    // Free program
    if (priceInCents === 0) {
      onComplete({ freeProgram: true });
      return;
    }

    // Create payment intent
    createPaymentIntent();
  }, [skipPayment, priceInCents]);

  const createPaymentIntent = async () => {
    try {
      const response = await fetch('/api/funnel/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceInCents,
          currency,
          stripePriceId,
          programId: data.programId,
          flowSessionId: data.flowSessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment');
      }

      const { clientSecret: secret, connectedAccountId: accountId } = await response.json();
      setClientSecret(secret);
      setConnectedAccountId(accountId);
      
      // Load Stripe with the connected account
      // For Stripe Connect, we need to pass stripeAccount option
      const stripeInstance = loadStripe(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
        accountId ? { stripeAccount: accountId } : undefined
      );
      setStripePromise(stripeInstance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = (paymentIntentId: string) => {
    onComplete({
      stripePaymentIntentId: paymentIntentId,
      paidAmount: priceInCents,
      connectedAccountId,
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[300px]">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div 
            className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: primaryVar }}
          />
        </div>
        <p className="text-text-secondary">Setting up payment...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full max-w-xl mx-auto text-center relative">
        {/* Back button at top-left */}
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl mb-6">
            <p className="text-red-600">{error}</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setIsLoading(true);
              createPaymentIntent();
            }}
            className="py-3 px-6 text-white rounded-xl font-medium transition-colors"
            style={{ backgroundColor: primaryVar }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = primaryHoverVar}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  const heading = config.heading || 'Complete your enrollment';

  return (
    <div className="w-full max-w-xl mx-auto relative">
      {/* Back button at top-left */}
      {!isFirstStep && onBack && (
        <button
          onClick={onBack}
          className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3">
          {heading}
        </h1>
      </motion.div>

      {clientSecret && stripePromise && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#a07855',
                  colorBackground: '#ffffff',
                  colorText: '#1a1816',
                  colorDanger: '#ef4444',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  borderRadius: '12px',
                },
              },
            }}
          >
            <PaymentForm
              onSuccess={handlePaymentSuccess}
              programName={program.name}
              priceInCents={priceInCents}
              currency={currency}
              features={config.features}
            />
          </Elements>
        </motion.div>
      )}
    </div>
  );
}
