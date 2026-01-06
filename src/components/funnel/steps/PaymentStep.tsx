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
import { Lock, CreditCard, Check, ArrowLeft, Plus, CircleCheck, Shield, Loader2, Repeat } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@clerk/nextjs';
import type { FunnelStepConfigPayment } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

// Saved payment method type
interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
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
    subscriptionEnabled?: boolean;
    billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  };
  skipPayment: boolean;
  isFirstStep: boolean;
  organizationId?: string;
}

/**
 * Get interval label for display (e.g., "/month")
 */
function getIntervalLabel(interval?: 'monthly' | 'quarterly' | 'yearly'): string {
  switch (interval) {
    case 'monthly': return '/mo';
    case 'quarterly': return '/qtr';
    case 'yearly': return '/yr';
    default: return '/mo';
  }
}

/**
 * Get billing display name (e.g., "Monthly")
 */
function getBillingDisplayName(interval?: 'monthly' | 'quarterly' | 'yearly'): string {
  switch (interval) {
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    default: return 'Monthly';
  }
}

/**
 * Saved Cards Selection for funnel
 */
function SavedCardsForFunnel({
  savedMethods,
  selectedMethodId,
  onSelect,
  onAddNew,
  onPay,
  isProcessing,
  priceInCents,
  currency,
  programName,
  features,
  subscriptionEnabled,
  billingInterval,
}: {
  savedMethods: SavedPaymentMethod[];
  selectedMethodId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onPay: () => void;
  isProcessing: boolean;
  priceInCents: number;
  currency: string;
  programName: string;
  features?: string[];
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
}) {
  const formatPrice = (cents: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr.toUpperCase(),
    }).format(cents / 100);
  };

  const isRecurring = subscriptionEnabled && billingInterval;

  return (
    <div className="space-y-6">
      {/* Plan summary */}
      <div className="bg-[#faf8f6] rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-medium text-text-primary">{programName}</h3>
            <p className="text-sm text-text-secondary flex items-center gap-1.5">
              {isRecurring && <Repeat className="w-3.5 h-3.5" />}
              {isRecurring ? 'Subscription' : 'Full access'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-albert text-2xl font-semibold text-text-primary">
              {formatPrice(priceInCents, currency)}{isRecurring && getIntervalLabel(billingInterval)}
            </p>
          </div>
        </div>

        {/* Subscription info box for recurring */}
        {isRecurring && (
          <div className="border-t border-[#e1ddd8] pt-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Billing</span>
              <span className="text-text-primary font-medium">{getBillingDisplayName(billingInterval)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-primary font-medium">Due today</span>
              <span className="text-text-primary font-semibold">{formatPrice(priceInCents, currency)}</span>
            </div>
          </div>
        )}

        {features && features.length > 0 && (
          <div className={`${isRecurring ? '' : 'border-t border-[#e1ddd8] pt-4 '}space-y-2`}>
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-accent" />
                <span className="text-sm text-text-secondary">{feature}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saved cards */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-primary">
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
                : 'border-[#e1ddd8] hover:border-brand-accent/50'
            }`}
          >
            {/* Card icon */}
            <div className="w-12 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-md flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            
            {/* Card info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">
                  {getCardBrandName(method.brand)} •••• {method.last4}
                </span>
                {method.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-[#e1ddd8] rounded-full text-text-muted">
                    Default
                  </span>
                )}
              </div>
              <span className="text-sm text-text-secondary">
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
          className="w-full p-4 rounded-xl border-2 border-dashed border-[#e1ddd8] hover:border-brand-accent/50 transition-all flex items-center gap-4 text-left"
        >
          <div className="w-12 h-8 rounded-md flex items-center justify-center bg-brand-accent/10">
            <Plus className="w-5 h-5 text-brand-accent" />
          </div>
          <span className="font-medium text-text-primary">
            Add new card
          </span>
        </button>
      </div>

      {/* Pay button */}
      <button
        type="button"
        onClick={onPay}
        disabled={!selectedMethodId || isProcessing}
        className="w-full py-4 px-6 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        style={{ backgroundColor: primaryVar }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            {isRecurring 
              ? `Subscribe ${formatPrice(priceInCents, currency)}${getIntervalLabel(billingInterval)}`
              : `Pay ${formatPrice(priceInCents, currency)}`
            }
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-text-muted">
        <Shield className="w-3 h-3 inline mr-1" />
        {isRecurring 
          ? 'Secure subscription powered by Stripe. Cancel anytime.'
          : 'Your saved payment info is securely stored by Stripe'
        }
      </p>
    </div>
  );
}

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string, paymentMethodId?: string) => void;
  programName: string;
  priceInCents: number;
  currency: string;
  features?: string[];
  organizationId?: string;
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
}

function PaymentForm({ onSuccess, programName, priceInCents, currency, features, organizationId, subscriptionEnabled, billingInterval }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true); // Auto-checked

  const isRecurring = subscriptionEnabled && billingInterval;

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
      // Extract payment method ID for upsells (it's a string ID, not the full object)
      const paymentMethodId = typeof paymentIntent.payment_method === 'string' 
        ? paymentIntent.payment_method 
        : paymentIntent.payment_method?.toString();
      
      // If user chose not to save card, delete it after successful payment
      if (!saveCard && organizationId && paymentMethodId) {
        try {
          await fetch('/api/payment-methods', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              paymentMethodId,
            }),
          });
        } catch (err) {
          // Non-critical error, don't block success
          console.error('Failed to remove saved card:', err);
        }
      }
      onSuccess(paymentIntent.id, paymentMethodId);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan summary */}
      <div className="bg-[#faf8f6] rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-medium text-text-primary">{programName}</h3>
            <p className="text-sm text-text-secondary flex items-center gap-1.5">
              {isRecurring && <Repeat className="w-3.5 h-3.5" />}
              {isRecurring ? 'Subscription' : 'Full access'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-albert text-2xl font-semibold text-text-primary">
              {formatPrice(priceInCents, currency)}{isRecurring && getIntervalLabel(billingInterval)}
            </p>
          </div>
        </div>

        {/* Subscription info box for recurring */}
        {isRecurring && (
          <div className="border-t border-[#e1ddd8] pt-4 mb-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Billing</span>
              <span className="text-text-primary font-medium">{getBillingDisplayName(billingInterval)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-primary font-medium">Due today</span>
              <span className="text-text-primary font-semibold">{formatPrice(priceInCents, currency)}</span>
            </div>
          </div>
        )}

        {features && features.length > 0 && (
          <div className={`${isRecurring ? '' : 'border-t border-[#e1ddd8] pt-4 '}space-y-2`}>
            {features.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-brand-accent" />
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
              link: 'never',
            },
          }}
        />

        {/* Save card checkbox */}
        <label className="flex items-center gap-3 mt-4 cursor-pointer select-none">
          <div className="relative">
            <input 
              type="checkbox" 
              checked={saveCard}
              onChange={(e) => setSaveCard(e.target.checked)}
              className="sr-only peer"
            />
            <div 
              className="w-5 h-5 rounded-md border-2 border-[#d1ccc5] peer-checked:border-transparent transition-colors flex items-center justify-center"
              style={{ backgroundColor: saveCard ? primaryVar : 'transparent' }}
            >
              {saveCard && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
          </div>
          <span className="text-sm text-text-secondary">
            Save card for future purchases
          </span>
        </label>
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
            {isRecurring 
              ? `Subscribe ${formatPrice(priceInCents, currency)}${getIntervalLabel(billingInterval)}`
              : `Pay ${formatPrice(priceInCents, currency)}`
            }
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-text-muted">
        <Lock className="w-3 h-3 inline mr-1" />
        {isRecurring 
          ? 'Secure subscription powered by Stripe. Cancel anytime.'
          : 'Secured by Stripe. Your payment info is never stored on our servers.'
        }
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
  organizationId,
}: PaymentStepProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Saved cards state - only available for authenticated users
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showSavedCards, setShowSavedCards] = useState(true);
  const [isProcessingSaved, setIsProcessingSaved] = useState(false);
  
  // Guest checkout: saved cards are not available
  const canShowSavedCards = authLoaded && isSignedIn && organizationId;

  // Determine price
  const priceInCents = config.useProgramPricing 
    ? program.priceInCents 
    : (config.priceInCents || program.priceInCents);
  
  const currency = program.currency || 'usd';
  const stripePriceId = config.stripePriceId || program.stripePriceId;

  // Fetch saved payment methods - only for authenticated users
  const fetchSavedMethods = useCallback(async () => {
    // Skip for guest checkout - saved cards require authentication
    if (!canShowSavedCards) {
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
  }, [canShowSavedCards, organizationId]);

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

    // Wait for auth state to be loaded before deciding flow
    if (!authLoaded) return;

    // For guest checkout, skip to payment form directly (no saved cards)
    if (!canShowSavedCards) {
      setShowSavedCards(false);
      createPaymentIntent();
      return;
    }

    // For authenticated users, fetch saved methods first
    fetchSavedMethods();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipPayment, priceInCents, authLoaded, canShowSavedCards]);

  // After fetching saved methods (authenticated users only), decide what to show
  useEffect(() => {
    if (skipPayment || priceInCents === 0 || !authLoaded || !canShowSavedCards) return;
    
    // If we have saved methods, wait for user choice
    if (savedMethods.length > 0) {
      setIsLoading(false);
      setShowSavedCards(true);
    } else {
      // No saved methods, create payment intent right away
      setShowSavedCards(false);
      createPaymentIntent();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [savedMethods, priceInCents, skipPayment, authLoaded, canShowSavedCards]);

  const createPaymentIntent = async () => {
    setIsLoading(true);
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

      const result = await response.json();
      const { clientSecret: secret, connectedAccountId: accountId, subscriptionId: subId } = result;
      setClientSecret(secret);
      setConnectedAccountId(accountId);
      
      // Store subscription ID if this is a recurring payment
      if (subId) {
        setSubscriptionId(subId);
      }
      
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

  const handlePayWithSavedMethod = async () => {
    if (!selectedMethodId || !organizationId) return;

    setIsProcessingSaved(true);
    setError(null);

    try {
      // Create payment intent and immediately charge the saved method
      const response = await fetch('/api/funnel/charge-saved-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethodId: selectedMethodId,
          priceInCents,
          currency,
          programId: data.programId,
          flowSessionId: data.flowSessionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment failed');
      }

      handlePaymentSuccess(result.paymentIntentId, result.connectedAccountId, undefined, result.subscriptionId);
    } catch (err) {
      console.error('Saved method payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setIsProcessingSaved(false);
    }
  };

  const handleAddNewCard = () => {
    setShowSavedCards(false);
    createPaymentIntent();
  };

  const handlePaymentSuccess = async (
    paymentIntentId: string, 
    accountId?: string | null,
    paymentMethodId?: string,
    subId?: string | null
  ) => {
    // Store payment method ID in flow session for upsells (new card payments)
    // Note: saved card payments already store this via charge-saved-method API
    if (paymentMethodId && data.flowSessionId) {
      try {
        await fetch(`/api/funnel/session/${data.flowSessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: {
              stripePaymentMethodId: paymentMethodId,
              stripeConnectAccountId: accountId || connectedAccountId,
              ...(subId && { stripeSubscriptionId: subId }),
            },
          }),
        });
      } catch (err) {
        // Log but don't block - upsells will fail gracefully with clear error
        console.error('Failed to store payment method for upsells:', err);
      }
    }

    // Use the subscription ID passed directly or fall back to state
    const finalSubscriptionId = subId || subscriptionId;

    onComplete({
      stripePaymentIntentId: paymentIntentId,
      paidAmount: priceInCents,
      connectedAccountId: accountId || connectedAccountId,
      ...(finalSubscriptionId && { stripeSubscriptionId: finalSubscriptionId }),
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

  // Show saved cards selection
  if (showSavedCards && savedMethods.length > 0) {
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

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SavedCardsForFunnel
            savedMethods={savedMethods}
            selectedMethodId={selectedMethodId}
            onSelect={setSelectedMethodId}
            onAddNew={handleAddNewCard}
            onPay={handlePayWithSavedMethod}
            isProcessing={isProcessingSaved}
            priceInCents={priceInCents}
            currency={currency}
            programName={program.name}
            features={config.features}
            subscriptionEnabled={program.subscriptionEnabled}
            billingInterval={program.billingInterval}
          />
        </motion.div>
      </div>
    );
  }

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
                theme: isDark ? 'night' : 'stripe',
                variables: {
                  colorPrimary: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
                  colorBackground: isDark ? '#1a1e26' : '#ffffff',
                  colorText: isDark ? '#e8e6e3' : '#1a1816',
                  ...(isDark && { colorTextSecondary: '#9ca3af' }),
                  colorDanger: '#ef4444',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  borderRadius: '12px',
                },
                rules: {
                  '.Input': {
                    borderColor: isDark ? '#313746' : '#e1ddd8',
                  },
                  '.Input:focus': {
                    borderColor: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
                    boxShadow: isDark ? '0 0 0 1px var(--brand-accent-dark)' : '0 0 0 1px var(--brand-accent-light)',
                  },
                  '.Tab': {
                    borderColor: isDark ? '#313746' : '#e1ddd8',
                  },
                  '.Tab--selected': {
                    borderColor: isDark ? 'var(--brand-accent-dark)' : 'var(--brand-accent-light)',
                    backgroundColor: isDark ? '#262b35' : '#faf8f6',
                  },
                },
              },
            }}
          >
            <PaymentForm
              onSuccess={(paymentIntentId, paymentMethodId) => 
                handlePaymentSuccess(paymentIntentId, connectedAccountId, paymentMethodId)
              }
              programName={program.name}
              priceInCents={priceInCents}
              currency={currency}
              features={config.features}
              organizationId={organizationId}
              subscriptionEnabled={program.subscriptionEnabled}
              billingInterval={program.billingInterval}
            />
          </Elements>
        </motion.div>
      )}
    </div>
  );
}
