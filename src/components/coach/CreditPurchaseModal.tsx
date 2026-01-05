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
import {
  Loader2,
  Sparkles,
  Check,
  CreditCard,
  Phone,
  ArrowLeft,
  Lock,
  Shield,
  Plus,
  CircleCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useBrandingValues } from '@/contexts/BrandingContext';

interface CreditPack {
  size: number;
  name: string;
  credits: number;
  priceInCents: number;
  priceFormatted: string;
}

interface CreditBalance {
  planAllocated: number;
  planUsed: number;
  planRemaining: number;
  purchasedRemaining: number;
  totalRemaining: number;
  periodStart: string | null;
  periodEnd: string | null;
}

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface CreditPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
}

type PurchaseStep = 'selectPack' | 'loading' | 'selectMethod' | 'payment' | 'processing' | 'success';

/**
 * Format price from cents
 */
function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
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
 * Saved Payment Methods Selection Component
 */
function SavedCardsSelection({
  savedMethods,
  selectedMethodId,
  onSelect,
  onAddNew,
  onPay,
  isProcessing,
  priceInCents,
  accentColor,
}: {
  savedMethods: SavedPaymentMethod[];
  selectedMethodId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onPay: () => void;
  isProcessing: boolean;
  priceInCents: number;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="pb-4">
        <h3 className="font-semibold text-lg text-text-primary dark:text-[#f5f5f8]">
          Choose payment method
        </h3>
        <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
          Select a saved card or add a new one
        </p>
      </div>

      {/* Saved cards list */}
      <div className="space-y-3 mb-4">
        {savedMethods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onSelect(method.id)}
            className={cn(
              'w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-left',
              selectedMethodId === method.id
                ? 'bg-[var(--accent-color)]/5'
                : 'border-border hover:border-[var(--accent-color)]/50'
            )}
            style={{
              '--accent-color': accentColor,
              borderColor: selectedMethodId === method.id ? accentColor : undefined,
            } as React.CSSProperties}
          >
            {/* Card icon */}
            <div className="w-12 h-8 bg-gradient-to-br from-gray-600 to-gray-800 rounded-md flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>

            {/* Card info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary dark:text-[#f5f5f8]">
                  {getCardBrandName(method.brand)} •••• {method.last4}
                </span>
                {method.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">
                Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear.toString().slice(-2)}
              </span>
            </div>

            {/* Selection indicator */}
            {selectedMethodId === method.id && (
              <CircleCheck className="w-6 h-6 flex-shrink-0" style={{ color: accentColor }} />
            )}
          </button>
        ))}

        {/* Add new card option */}
        <button
          type="button"
          onClick={onAddNew}
          className="w-full p-4 rounded-xl border-2 border-dashed border-border hover:opacity-80 transition-all flex items-center gap-4 text-left"
          style={{ '--accent-color': accentColor } as React.CSSProperties}
        >
          <div
            className="w-12 h-8 rounded-md flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <Plus className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <span className="font-medium text-text-primary dark:text-[#f5f5f8]">
            Add new card
          </span>
        </button>
      </div>

      {/* Pay button */}
      <button
        type="button"
        onClick={onPay}
        disabled={!selectedMethodId || isProcessing}
        className="w-full py-3.5 px-6 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        style={{ backgroundColor: accentColor }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {formatPrice(priceInCents)}
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-muted-foreground mt-3">
        <Shield className="w-3 h-3 inline mr-1" />
        Your saved payment info is securely stored by Stripe
      </p>
    </div>
  );
}

/**
 * Stripe Payment Form Component
 */
function StripePaymentForm({
  onSuccess,
  onBack,
  priceInCents,
  packCredits,
  accentColor,
}: {
  onSuccess: () => void;
  onBack: () => void;
  priceInCents: number;
  packCredits: number;
  accentColor: string;
}) {
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
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      {/* Header with back button */}
      <div className="pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div>
          <h3 className="font-semibold text-lg text-text-primary dark:text-[#f5f5f8]">
            Complete Payment
          </h3>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
            {packCredits} AI Call Summary Credits
          </p>
        </div>
      </div>

      {/* Order summary */}
      <div className="bg-muted/50 rounded-xl p-4 mb-5">
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
            {formatPrice(priceInCents)}
          </span>
        </div>
      </div>

      {/* Payment Element */}
      <div className="bg-white dark:bg-[#171b22] rounded-xl border border-border p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
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

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl"
          >
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3.5 px-6 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        style={{ backgroundColor: accentColor }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay {formatPrice(priceInCents)}
          </>
        )}
      </button>

      {/* Security note */}
      <p className="text-center text-xs text-muted-foreground mt-3">
        <Lock className="w-3 h-3 inline mr-1" />
        Secured by Stripe. Your payment info is never stored on our servers.
      </p>
    </form>
  );
}

/**
 * CreditPurchaseModal
 *
 * Modal for purchasing additional call summary credits.
 * Shows available packs with embedded Stripe checkout.
 */
export function CreditPurchaseModal({
  open,
  onOpenChange,
  onPurchaseComplete,
}: CreditPurchaseModalProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { colors } = useBrandingValues();
  const accentColor = colors.accentLight;

  const [step, setStep] = useState<PurchaseStep>('selectPack');
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<CreditPack | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stripe state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Saved payment methods
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [isProcessingSavedPayment, setIsProcessingSavedPayment] = useState(false);

  // Fetch credits info and saved cards when modal opens
  useEffect(() => {
    if (open) {
      fetchCreditsInfo();
      fetchSavedPaymentMethods();
    }
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep('selectPack');
        setSelectedPack(null);
        setClientSecret(null);
        setStripePromise(null);
        setError(null);
        setSelectedMethodId(null);
        setIsProcessingSavedPayment(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Create payment intent when entering loading step
  useEffect(() => {
    if (step !== 'loading' || !selectedPack) return;

    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/coach/credits/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packSize: selectedPack.size }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create payment');
        }

        const data = await response.json();

        if (data.success) {
          // Payment was completed with saved method
          handlePaymentSuccess();
          return;
        }

        setClientSecret(data.clientSecret);

        // Load Stripe (platform account, not connected)
        const stripeInstance = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
        setStripePromise(stripeInstance);

        // Move to payment step
        setStep('payment');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        setStep('selectPack');
      }
    };

    createPaymentIntent();
  }, [step, selectedPack]);

  const fetchCreditsInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/coach/credits/purchase');

      if (!response.ok) {
        throw new Error('Failed to fetch credits info');
      }

      const data = await response.json();
      setPacks(data.availablePacks || []);
      setBalance(data.credits || null);
    } catch (err) {
      console.error('Error fetching credits info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPaymentMethods = async () => {
    try {
      const response = await fetch('/api/coach/credits/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setSavedMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Error fetching saved payment methods:', err);
    }
  };

  const handlePackSelect = (pack: CreditPack) => {
    setSelectedPack(pack);
  };

  const handleContinue = () => {
    if (!selectedPack) return;

    if (savedMethods.length > 0) {
      // Show saved payment methods
      const defaultMethod = savedMethods.find(m => m.isDefault);
      setSelectedMethodId(defaultMethod?.id || savedMethods[0].id);
      setStep('selectMethod');
    } else {
      // Go directly to new payment
      setStep('loading');
    }
  };

  const handlePayWithSavedMethod = async () => {
    if (!selectedMethodId || !selectedPack) return;

    setIsProcessingSavedPayment(true);
    setError(null);
    setStep('processing');

    try {
      const response = await fetch('/api/coach/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packSize: selectedPack.size,
          paymentMethodId: selectedMethodId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Payment failed');
      }

      handlePaymentSuccess();
    } catch (err) {
      console.error('Saved method payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setStep('selectMethod');
    } finally {
      setIsProcessingSavedPayment(false);
    }
  };

  const handleAddNewCard = () => {
    setStep('loading');
  };

  const handlePaymentSuccess = () => {
    setStep('success');

    // Close and callback after animation
    setTimeout(() => {
      onOpenChange(false);
      onPurchaseComplete?.();
    }, 1500);
  };

  const handleBackToPackSelection = () => {
    setStep('selectPack');
    setError(null);
  };

  const handleBackToMethodSelection = () => {
    if (savedMethods.length > 0) {
      setStep('selectMethod');
    } else {
      setStep('selectPack');
    }
  };

  const getPricePerCredit = (pack: CreditPack): string => {
    return (pack.priceInCents / pack.credits / 100).toFixed(2);
  };

  // Render content based on step
  const renderContent = () => {
    switch (step) {
      case 'selectPack':
        return (
          <motion.div
            key="selectPack"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Current Balance */}
            {balance && (
              <div className="p-3 rounded-lg bg-muted/50 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Current Balance</span>
                  </div>
                  <span className="text-lg font-semibold">
                    {balance.totalRemaining} calls
                  </span>
                </div>
                {balance.purchasedRemaining > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {balance.planRemaining} from plan + {balance.purchasedRemaining} purchased
                  </p>
                )}
              </div>
            )}

            {/* Credit Packs */}
            <div className="space-y-2 mb-4">
              {packs.map((pack) => (
                <button
                  key={pack.size}
                  type="button"
                  onClick={() => handlePackSelect(pack)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 transition-all text-left',
                    selectedPack?.size === pack.size
                      ? 'bg-[var(--accent-color)]/5'
                      : 'border-border hover:border-[var(--accent-color)]/50'
                  )}
                  style={{
                    '--accent-color': accentColor,
                    borderColor: selectedPack?.size === pack.size ? accentColor : undefined,
                  } as React.CSSProperties}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{pack.credits} Credits</p>
                      <p className="text-xs text-muted-foreground">
                        ${getPricePerCredit(pack)} per call
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{pack.priceFormatted}</p>
                      {selectedPack?.size === pack.size && (
                        <Check className="h-4 w-4 ml-auto mt-1" style={{ color: accentColor }} />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Info text */}
            <p className="text-xs text-muted-foreground text-center mb-4">
              Purchased credits never expire and carry over each month.
            </p>

            {error && (
              <p className="text-sm text-destructive text-center mb-4">{error}</p>
            )}

            {/* Continue Button */}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedPack}
              className="w-full py-3 px-6 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <CreditCard className="h-4 w-4" />
              {selectedPack
                ? `Continue - ${selectedPack.priceFormatted}`
                : 'Select a Pack'}
            </button>
          </motion.div>
        );

      case 'selectMethod':
        return (
          <motion.div
            key="selectMethod"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Back button */}
            <button
              type="button"
              onClick={handleBackToPackSelection}
              className="p-2 -ml-2 mb-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <SavedCardsSelection
              savedMethods={savedMethods}
              selectedMethodId={selectedMethodId}
              onSelect={setSelectedMethodId}
              onAddNew={handleAddNewCard}
              onPay={handlePayWithSavedMethod}
              isProcessing={isProcessingSavedPayment}
              priceInCents={selectedPack?.priceInCents || 0}
              accentColor={accentColor}
            />
          </motion.div>
        );

      case 'loading':
        return (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="relative mb-4">
              <div className="w-12 h-12 rounded-full border-2 border-muted" />
              <div
                className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: accentColor }}
              />
            </div>
            <p className="text-muted-foreground">Setting up payment...</p>
          </motion.div>
        );

      case 'processing':
        return (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <div className="relative mb-4">
              <div className="w-12 h-12 rounded-full border-2 border-muted" />
              <div
                className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: accentColor }}
              />
            </div>
            <p className="text-muted-foreground">Processing payment...</p>
          </motion.div>
        );

      case 'payment':
        if (!clientSecret || !stripePromise) return null;

        return (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: isDark ? 'night' : 'stripe',
                  variables: {
                    colorPrimary: accentColor,
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
                      borderColor: accentColor,
                      boxShadow: `0 0 0 1px ${accentColor}`,
                    },
                    '.Tab': {
                      borderColor: isDark ? '#313746' : '#e1ddd8',
                    },
                    '.Tab--selected': {
                      borderColor: accentColor,
                      backgroundColor: isDark ? '#262b35' : '#faf8f6',
                    },
                  },
                },
              }}
            >
              <StripePaymentForm
                onSuccess={handlePaymentSuccess}
                onBack={handleBackToMethodSelection}
                priceInCents={selectedPack?.priceInCents || 0}
                packCredits={selectedPack?.credits || 0}
                accentColor={accentColor}
              />
            </Elements>
          </motion.div>
        );

      case 'success':
        return (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-6"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Check className="w-10 h-10 text-white stroke-[3]" />
              </motion.div>
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="text-xl font-semibold text-text-primary dark:text-[#f5f5f8] mb-2"
            >
              Credits Added!
            </motion.h3>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="text-sm text-muted-foreground"
            >
              {selectedPack?.credits} credits have been added to your account
            </motion.p>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Buy More Credits
          </DialogTitle>
          <DialogDescription>
            Purchase additional AI call summary credits for your coaching calls.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        )}
      </DialogContent>
    </Dialog>
  );
}
