'use client';

import { useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Loader2, CheckCircle, AlertCircle, Repeat } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// Initialize Stripe promise outside component
let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(connectedAccountId?: string) {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  
  // For connected accounts, we need to pass stripeAccount option
  if (connectedAccountId) {
    return loadStripe(key, { stripeAccount: connectedAccountId });
  }
  
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

interface PaymentFormProps {
  onSuccess: (subscriptionId: string) => void;
  onCancel: () => void;
  squadName: string;
  priceInCents: number;
  currency: string;
  billingInterval: string;
}

function PaymentForm({ onSuccess, onCancel, squadName, priceInCents, currency, billingInterval }: PaymentFormProps) {
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

  const getIntervalLabel = (interval: string) => {
    switch (interval) {
      case 'monthly': return '/month';
      case 'quarterly': return '/quarter';
      case 'yearly': return '/year';
      default: return '/month';
    }
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
      // Payment succeeded - the webhook will handle adding user to squad
      // But we also need to call the completion endpoint
      onSuccess(paymentIntent.id);
    } else if (paymentIntent && paymentIntent.status === 'processing') {
      // Payment is processing
      onSuccess(paymentIntent.id);
    } else {
      setError('Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Join {squadName}
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" />
            {formatPrice(priceInCents, currency)}{getIntervalLabel(billingInterval)} subscription
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
        >
          <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>

      {/* Payment Element */}
      <div className="bg-[#faf8f6] dark:bg-[#1d222b] rounded-xl p-4">
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
            className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription info */}
      <div className="p-4 bg-[#faf8f6] dark:bg-[#1d222b] rounded-xl space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Membership</span>
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">{squadName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Billing</span>
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium capitalize">{billingInterval}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">Total today</span>
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-semibold">{formatPrice(priceInCents, currency)}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-4 px-6 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Subscribe {formatPrice(priceInCents, currency)}{getIntervalLabel(billingInterval)}
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-[#a7a39e] dark:text-[#7d8190]">
        🔒 Secure payment powered by Stripe. Cancel anytime.
      </p>
    </form>
  );
}

interface SquadPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  squadId: string;
  squadName: string;
  priceInCents: number;
  currency: string;
  billingInterval: string;
}

export function SquadPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  squadId,
  squadName,
  priceInCents,
  currency,
  billingInterval,
}: SquadPaymentModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Create subscription intent when modal opens
  useEffect(() => {
    if (isOpen && !clientSecret) {
      createSubscriptionIntent();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setConnectedAccountId(null);
      setSubscriptionId(null);
      setError(null);
      setSuccess(false);
      setCompleting(false);
    }
  }, [isOpen]);

  const createSubscriptionIntent = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/squad/create-subscription-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      setClientSecret(data.clientSecret);
      setConnectedAccountId(data.connectedAccountId);
      setSubscriptionId(data.subscriptionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setCompleting(true);
    
    try {
      // Call completion endpoint to add user to squad
      const response = await fetch('/api/squad/complete-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          squadId,
          subscriptionId,
          paymentIntentId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete subscription');
      }

      setSuccess(true);
      
      // Wait a moment to show success, then close and trigger callback
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete subscription');
      setCompleting(false);
    }
  };

  if (!isOpen) return null;

  const stripeInstance = connectedAccountId ? getStripePromise(connectedAccountId) : null;

  const appearance: import('@stripe/stripe-js').Appearance = {
    theme: isDark ? 'night' : 'stripe',
    variables: {
      colorPrimary: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
      colorBackground: isDark ? '#1a1e26' : '#ffffff',
      colorText: isDark ? '#e8e6e3' : '#2c2520',
      colorTextSecondary: isDark ? '#9ca3af' : '#6b6560',
      colorDanger: '#ef4444',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSizeBase: '15px',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        borderColor: isDark ? '#313746' : '#e1ddd8',
        boxShadow: 'none',
        padding: '12px 14px',
      },
      '.Input:focus': {
        borderColor: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
        boxShadow: isDark ? '0 0 0 1px var(--brand-accent-dark)' : '0 0 0 1px var(--brand-accent-light)',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '6px',
        ...(isDark && { color: '#e8e6e3' }),
      },
      '.Tab': {
        borderColor: isDark ? '#313746' : '#e1ddd8',
      },
      '.Tab--selected': {
        borderColor: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
        backgroundColor: isDark ? '#262b35' : '#faf8f6',
      },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Loading state */}
                {loading && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
                    <p className="mt-4 text-[#5f5a55] dark:text-[#b2b6c2]">
                      Setting up payment...
                    </p>
                  </div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Something went wrong
                    </h3>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center mb-6">
                      {error}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createSubscriptionIntent}
                        className="px-4 py-2 text-sm font-medium text-white bg-brand-accent hover:bg-brand-accent/90 rounded-lg transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {/* Success state */}
                {success && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4"
                    >
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Welcome to the squad!
                    </h3>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      Your membership is now active.
                    </p>
                  </div>
                )}

                {/* Completing state */}
                {completing && !success && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
                    <p className="mt-4 text-[#5f5a55] dark:text-[#b2b6c2]">
                      Activating your membership...
                    </p>
                  </div>
                )}

                {/* Payment form */}
                {clientSecret && stripeInstance && !loading && !error && !success && !completing && (
                  <Elements
                    stripe={stripeInstance}
                    options={{
                      clientSecret,
                      appearance,
                    }}
                  >
                    <PaymentForm
                      onSuccess={handlePaymentSuccess}
                      onCancel={onClose}
                      squadName={squadName}
                      priceInCents={priceInCents}
                      currency={currency}
                      billingInterval={billingInterval}
                    />
                  </Elements>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

