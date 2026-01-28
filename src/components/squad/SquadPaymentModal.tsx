'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, X, Loader2, CheckCircle, AlertCircle, Repeat, CreditCard, Plus, CircleCheck, Shield } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useDiscountCode } from '@/hooks/useDiscountCode';
import { DiscountCodeInput } from '@/components/checkout';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Dialog } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';

// Saved payment method type
interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

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

/**
 * Get card brand display name
 */
function getCardBrandName(brand: string): string {
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand.toLowerCase()] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * Format price for display
 */
function formatPrice(cents: number, curr: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: curr.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Get billing interval label
 */
function getIntervalLabel(interval: string) {
  switch (interval) {
    case 'monthly': return '/month';
    case 'quarterly': return '/quarter';
    case 'yearly': return '/year';
    default: return '/month';
  }
}

/**
 * Saved Cards Selection for Squad
 */
function SavedCardsSelection({
  savedMethods,
  selectedMethodId,
  onSelect,
  onAddNew,
  onPay,
  isProcessing,
  squadName,
  priceInCents,
  basePriceInCents,
  currency,
  billingInterval,
  onCancel,
  discount,
}: {
  savedMethods: SavedPaymentMethod[];
  selectedMethodId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onPay: () => void;
  isProcessing: boolean;
  squadName: string;
  priceInCents: number;
  basePriceInCents: number;
  currency: string;
  billingInterval: string;
  onCancel: () => void;
  discount: ReturnType<typeof useDiscountCode>;
}) {
  const hasDiscount = discount.hasValidDiscount;

  return (
    <div className="space-y-6">
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

      {/* Saved cards */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
          Choose payment method
        </p>

        {savedMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method.id)}
            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-left ${
              selectedMethodId === method.id
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#313746] hover:border-brand-accent/50'
            }`}
          >
            {/* Card icon */}
            <div className="w-12 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-md flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {getCardBrandName(method.brand)} •••• {method.last4}
                </span>
                {method.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-[#e1ddd8] dark:bg-[#313746] rounded-full text-[#5f5a55] dark:text-[#b2b6c2]">
                    Default
                  </span>
                )}
              </div>
              <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear.toString().slice(-2)}
              </span>
            </div>

            {/* Selection indicator */}
            {selectedMethodId === method.id && (
              <CircleCheck className="w-6 h-6 flex-shrink-0 text-brand-accent" />
            )}
          </button>
        ))}

        {/* Add new card option */}
        <button
          type="button"
          onClick={onAddNew}
          className="w-full p-4 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#313746] hover:border-brand-accent/50 transition-all flex items-center gap-4 text-left"
        >
          <div className="w-12 h-8 rounded-md flex items-center justify-center bg-brand-accent/10">
            <Plus className="w-5 h-5 text-brand-accent" />
          </div>
          <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Add new card
          </span>
        </button>
      </div>

      {/* Discount code input */}
      {basePriceInCents > 0 && (
        <DiscountCodeInput discount={discount} compact />
      )}

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
        {hasDiscount && (
          <div className="flex justify-between text-sm">
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Discount</span>
            <span className="text-green-600 dark:text-green-400 font-medium">{discount.displayDiscount}</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">Total today</span>
          <div className="text-right">
            {hasDiscount && (
              <span className="text-sm text-[#a7a39e] dark:text-[#7d8190] line-through mr-2">
                {formatPrice(basePriceInCents, currency)}
              </span>
            )}
            <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-semibold">{formatPrice(priceInCents, currency)}</span>
          </div>
        </div>
      </div>

      {/* Pay button */}
      <button
        type="button"
        onClick={onPay}
        disabled={!selectedMethodId || isProcessing}
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
      <p className="text-center text-xs text-[#a7a39e] dark:text-[#7d8190] flex items-center justify-center gap-1.5">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FIcon.jpeg?alt=media&token=a0b3f96f-af0e-4f5e-87a8-50d4ddce4080"
          alt="Coachful"
          className="w-4 h-4 rounded-sm"
        />
        Secured by Stripe. Cancel anytime.
      </p>
    </div>
  );
}

interface PaymentFormProps {
  onSuccess: (subscriptionId: string) => void;
  onCancel: () => void;
  squadName: string;
  priceInCents: number;
  basePriceInCents: number;
  currency: string;
  billingInterval: string;
  discount: ReturnType<typeof useDiscountCode>;
}

function PaymentForm({ onSuccess, onCancel, squadName, priceInCents, basePriceInCents, currency, billingInterval, discount }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasDiscount = discount.hasValidDiscount;

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

      {/* Discount code input */}
      {basePriceInCents > 0 && (
        <DiscountCodeInput discount={discount} compact />
      )}

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
        {hasDiscount && (
          <div className="flex justify-between text-sm">
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Discount</span>
            <span className="text-green-600 dark:text-green-400 font-medium">{discount.displayDiscount}</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">Total today</span>
          <div className="text-right">
            {hasDiscount && (
              <span className="text-sm text-[#a7a39e] dark:text-[#7d8190] line-through mr-2">
                {formatPrice(basePriceInCents, currency)}
              </span>
            )}
            <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-semibold">{formatPrice(priceInCents, currency)}</span>
          </div>
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
      <p className="text-center text-xs text-[#a7a39e] dark:text-[#7d8190] flex items-center justify-center gap-1.5">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FIcon.jpeg?alt=media&token=a0b3f96f-af0e-4f5e-87a8-50d4ddce4080"
          alt="Coachful"
          className="w-4 h-4 rounded-sm"
        />
        Secured by Stripe. Cancel anytime.
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
  organizationId?: string;
}

export function SquadPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  squadId,
  squadName,
  priceInCents: basePriceInCents,
  currency,
  billingInterval,
  organizationId,
}: SquadPaymentModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Discount code support
  const discount = useDiscountCode({
    organizationId: organizationId || '',
    originalAmountCents: basePriceInCents,
    squadId,
  });

  // Final price after discount
  const priceInCents = discount.hasValidDiscount ? discount.finalPrice : basePriceInCents;

  // Payment intent state (for new card flow)
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  // Saved payment methods state
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showSavedCards, setShowSavedCards] = useState(true);
  const [isProcessingSaved, setIsProcessingSaved] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Fetch saved payment methods
  const fetchSavedMethods = useCallback(async () => {
    if (!organizationId) {
      setSavedMethods([]);
      return;
    }

    try {
      const response = await fetch(`/api/payment-methods?organizationId=${organizationId}`);
      if (response.ok) {
        const result = await response.json();
        const methods = result.paymentMethods || [];
        setSavedMethods(methods);
        
        // Pre-select default method
        if (methods.length > 0) {
          const defaultMethod = methods.find((m: SavedPaymentMethod) => m.isDefault);
          setSelectedMethodId(defaultMethod?.id || methods[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching saved payment methods:', err);
    }
  }, [organizationId]);

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset state
      setClientSecret(null);
      setConnectedAccountId(null);
      setSubscriptionId(null);
      setError(null);
      setSuccess(false);
      setCompleting(false);
      setShowSavedCards(true);
      setIsProcessingSaved(false);
      
      // Fetch saved methods
      fetchSavedMethods();
    }
  }, [isOpen, fetchSavedMethods]);

  // After fetching saved methods, decide what to show
  useEffect(() => {
    if (!isOpen) return;
    
    // If we have saved methods, show them
    if (savedMethods.length > 0) {
      setShowSavedCards(true);
      setLoading(false);
    } else if (savedMethods.length === 0 && organizationId) {
      // No saved methods and we've tried to fetch - show new card form
      setShowSavedCards(false);
      createSubscriptionIntent();
    }
  }, [savedMethods, isOpen, organizationId]);

  // If no organizationId provided, go straight to new card flow
  useEffect(() => {
    if (isOpen && !organizationId) {
      setShowSavedCards(false);
      createSubscriptionIntent();
    }
  }, [isOpen, organizationId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setClientSecret(null);
      setConnectedAccountId(null);
      setSubscriptionId(null);
      setSavedMethods([]);
      setSelectedMethodId(null);
      setError(null);
      setSuccess(false);
      setCompleting(false);
      setShowSavedCards(true);
      setIsProcessingSaved(false);
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

  const handlePayWithSavedMethod = async () => {
    if (!selectedMethodId) return;

    setIsProcessingSaved(true);
    setError(null);

    try {
      const response = await fetch('/api/squad/charge-saved-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          squadId,
          paymentMethodId: selectedMethodId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If card requires action, fall back to full payment form
        if (data.requiresAction) {
          setShowSavedCards(false);
          createSubscriptionIntent();
          return;
        }
        throw new Error(data.error || 'Payment failed');
      }

      // Success! Show success state
      setSuccess(true);
      
      // Wait a moment to show success, then close and trigger callback
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Saved method payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessingSaved(false);
    }
  };

  const handleAddNewCard = () => {
    setShowSavedCards(false);
    createSubscriptionIntent();
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

  const isDesktop = useMediaQuery('(min-width: 768px)');
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

  // Shared content for both Dialog and Drawer
  const content = (
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
      {error && !loading && !showSavedCards && (
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

      {/* Saved cards selection */}
      {showSavedCards && savedMethods.length > 0 && !loading && !success && !completing && (
        <>
          {/* Error message for saved cards */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
          <SavedCardsSelection
            savedMethods={savedMethods}
            selectedMethodId={selectedMethodId}
            onSelect={setSelectedMethodId}
            onAddNew={handleAddNewCard}
            onPay={handlePayWithSavedMethod}
            isProcessing={isProcessingSaved}
            squadName={squadName}
            priceInCents={priceInCents}
            basePriceInCents={basePriceInCents}
            currency={currency}
            billingInterval={billingInterval}
            onCancel={onClose}
            discount={discount}
          />
        </>
      )}

      {/* Payment form */}
      {!showSavedCards && clientSecret && stripeInstance && !loading && !error && !success && !completing && (
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
            basePriceInCents={basePriceInCents}
            currency={currency}
            billingInterval={billingInterval}
            discount={discount}
          />
        </Elements>
      )}
    </div>
  );

  // Desktop: Dialog with blurred backdrop that covers sidebar
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[10000] w-full max-w-md translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
            {content}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>
    );
  }

  // Mobile: Drawer that slides up from bottom
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="pb-safe">
        <div className="max-h-[85vh] overflow-y-auto">
          {content}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
