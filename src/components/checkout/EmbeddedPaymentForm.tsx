'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CreditCard, X } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

// Initialize Stripe outside of component to avoid recreating on render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  planName: string;
  price: string;
}

function CheckoutForm({ onSuccess: _onSuccess, onCancel, planName, price }: CheckoutFormProps) {
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

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/start/success`,
      },
    });

    // Only reaches here if there's an immediate error
    // (user stays on page, payment failed before redirect)
    if (submitError) {
      setError(submitError.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="w-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-albert text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
            Complete your sign-up
          </h3>
          <p className="font-sans text-[14px] text-text-secondary mt-1">
            {planName} — {price}/month
          </p>
        </div>
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="p-2 hover:bg-[#f5f3f0] rounded-full transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5 text-text-secondary" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Element Container */}
        <div className="bg-white rounded-2xl border border-[#e1ddd8] p-4">
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
              defaultValues: {
                billingDetails: {},
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
              className="p-4 bg-red-50 border border-red-200 rounded-xl"
            >
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-text-secondary">
          <Lock className="w-4 h-4" />
          <span className="font-sans text-[13px]">
            Secured by Stripe. Your payment info is encrypted.
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] tracking-[-0.5px] leading-[1.4] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing payment...
            </span>
          ) : (
            'Join Your Squad →'
          )}
        </button>

        {/* Cancel Link */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-full text-center font-sans text-[14px] text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          Cancel and go back
        </button>
      </form>
    </motion.div>
  );
}

interface EmbeddedPaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  planName: string;
  price: string;
}

export function EmbeddedPaymentForm({
  clientSecret,
  onSuccess,
  onCancel,
  planName,
  price,
}: EmbeddedPaymentFormProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

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
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance,
      }}
    >
      <CheckoutForm
        onSuccess={onSuccess}
        onCancel={onCancel}
        planName={planName}
        price={price}
      />
    </Elements>
  );
}

