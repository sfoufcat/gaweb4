'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  Loader2, 
  Check, 
  Shield, 
  FileText, 
  BookOpen, 
  Calendar, 
  Download, 
  Link as LinkIcon,
  ArrowLeft,
  Lock,
  CreditCard,
  Plus,
  CircleCheck,
} from 'lucide-react';
import type { PurchasableContentType } from '@/types/discover';

// Saved payment method type
interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface ContentPurchaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: {
    id: string;
    type: PurchasableContentType;
    title: string;
    description?: string;
    coverImageUrl?: string;
    priceInCents: number;
    currency?: string;
    coachName?: string;
    coachImageUrl?: string;
    keyOutcomes?: string[];
    organizationId?: string; // For fetching saved cards
  };
  onPurchaseComplete?: () => void;
}

type PurchaseStep = 'preview' | 'loading' | 'selectMethod' | 'payment' | 'processing' | 'success';

/**
 * Helper to convert hex to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get icon for content type
 */
function getContentTypeIcon(type: PurchasableContentType) {
  switch (type) {
    case 'article':
      return FileText;
    case 'course':
      return BookOpen;
    case 'event':
      return Calendar;
    case 'download':
      return Download;
    case 'link':
      return LinkIcon;
    default:
      return FileText;
  }
}

/**
 * Get content URL for navigation
 */
function getContentUrl(type: PurchasableContentType, id: string): string {
  switch (type) {
    case 'article':
      return `/discover/articles/${id}`;
    case 'course':
      return `/discover/courses/${id}`;
    case 'event':
      return `/discover/events/${id}`;
    case 'download':
      return `/discover/downloads/${id}`;
    case 'link':
      return `/discover/links/${id}`;
    default:
      return `/discover`;
  }
}

/**
 * Format price from cents
 */
function formatPrice(cents: number, currency = 'usd') {
  if (cents === 0) return 'Free';
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
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
  currency,
  accentColor,
}: {
  savedMethods: SavedPaymentMethod[];
  selectedMethodId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
  onPay: () => void;
  isProcessing: boolean;
  priceInCents: number;
  currency: string;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pb-4">
        <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8]">
          Choose payment method
        </h3>
        <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">
          Select a saved card or add a new one
        </p>
      </div>

      {/* Saved cards list */}
      <div className="flex-1 px-6 pb-4 overflow-y-auto">
        <div className="space-y-3">
          {savedMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => onSelect(method.id)}
              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 text-left ${
                selectedMethodId === method.id
                  ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/5'
                  : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[var(--accent-color)]/50'
              }`}
              style={{ '--accent-color': accentColor } as React.CSSProperties}
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
                    <span className="text-xs px-2 py-0.5 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full text-text-muted">
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
                <CircleCheck 
                  className="w-6 h-6 flex-shrink-0"
                  style={{ color: accentColor }}
                />
              )}
            </button>
          ))}

          {/* Add new card option */}
          <button
            type="button"
            onClick={onAddNew}
            className="w-full p-4 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-[var(--accent-color)]/50 transition-all flex items-center gap-4 text-left"
            style={{ '--accent-color': accentColor } as React.CSSProperties}
          >
            <div 
              className="w-12 h-8 rounded-md flex items-center justify-center"
              style={{ backgroundColor: hexToRgba(accentColor, 0.1) }}
            >
              <Plus className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <span className="font-medium text-text-primary dark:text-[#f5f5f8]">
              Add new card
            </span>
          </button>
        </div>
      </div>

      {/* Footer with pay button */}
      <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-6 py-5">
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
              Pay {formatPrice(priceInCents, currency)}
            </>
          )}
        </button>

        {/* Security note */}
        <p className="text-center text-xs text-text-muted dark:text-[#7d8190] mt-3">
          <Shield className="w-3 h-3 inline mr-1" />
          Your saved payment info is securely stored by Stripe
        </p>
      </div>
    </div>
  );
}

/**
 * Stripe Payment Form
 */
function StripePaymentForm({
  onSuccess,
  onBack,
  priceInCents,
  currency,
  contentTitle,
  accentColor,
  organizationId,
  contentType,
  contentId,
  connectedAccountId,
}: {
  onSuccess: () => void;
  onBack: () => void;
  priceInCents: number;
  currency: string;
  contentTitle: string;
  accentColor: string;
  organizationId?: string | null;
  contentType: string;
  contentId: string;
  connectedAccountId: string | null;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(true); // Auto-checked

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
      // Immediately confirm the purchase to create the record (don't rely on webhooks)
      try {
        const confirmRes = await fetch('/api/content/confirm-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            contentType,
            contentId,
            connectedAccountId,
          }),
        });

        if (!confirmRes.ok) {
          const confirmError = await confirmRes.json();
          console.error('Failed to confirm purchase:', confirmError);
          // Don't fail - the webhook will eventually create the record
        }
      } catch (err) {
        console.error('Error confirming purchase:', err);
        // Don't fail - the webhook will eventually create the record
      }

      // If user chose not to save card, delete it after successful payment
      if (!saveCard && organizationId && paymentIntent.payment_method) {
        try {
          await fetch('/api/payment-methods', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              paymentMethodId: paymentIntent.payment_method,
            }),
          });
        } catch (err) {
          // Non-critical error, don't block success
          console.error('Failed to remove saved card:', err);
        }
      }
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="px-6 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
        </button>
        <div>
          <h3 className="font-albert font-semibold text-lg text-text-primary dark:text-[#f5f5f8]">
            Complete Payment
          </h3>
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2] line-clamp-1">
            {contentTitle}
          </p>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 px-6 pb-4 overflow-y-auto">
        {/* Order summary */}
        <div className="bg-[#faf8f6] dark:bg-[#11141b] rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">Total</span>
            <span className="font-albert text-xl font-semibold text-text-primary dark:text-[#f5f5f8]">
              {formatPrice(priceInCents, currency)}
            </span>
          </div>
        </div>

        {/* Payment Element */}
        <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-text-secondary dark:text-[#b2b6c2]" />
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
                className="w-5 h-5 rounded-md border-2 border-[#d1ccc5] dark:border-[#3d424d] peer-checked:border-transparent transition-colors flex items-center justify-center"
                style={{ backgroundColor: saveCard ? accentColor : 'transparent' }}
              >
                {saveCard && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
            <span className="text-sm text-text-secondary dark:text-[#b2b6c2]">
              Save card for future purchases
            </span>
          </label>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl"
            >
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with submit */}
      <div className="border-t border-[#e1ddd8] dark:border-[#262b35] px-6 py-5">
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
              Pay {formatPrice(priceInCents, currency)}
            </>
          )}
        </button>

        {/* Security note */}
        <p className="text-center text-xs text-text-muted dark:text-[#7d8190] mt-3">
          <Lock className="w-3 h-3 inline mr-1" />
          Secured by Stripe. Your payment info is never stored on our servers.
        </p>
      </div>
    </form>
  );
}

/**
 * Preview Content View
 */
function PreviewContent({
  content,
  onPurchase,
  isPurchasing,
  isSignedIn,
  hasSavedCards,
}: {
  content: ContentPurchaseSheetProps['content'];
  onPurchase: () => void;
  isPurchasing: boolean;
  isSignedIn: boolean;
  hasSavedCards?: boolean;
}) {
  const { colors } = useBrandingValues();
  const ContentIcon = getContentTypeIcon(content.type);
  
  return (
    <div className="flex flex-col">
      {/* Content Preview */}
      <div className="px-5 sm:px-6 pb-6">
        <div className="flex gap-5">
          {/* Cover Image or Icon */}
          <div className="flex-shrink-0">
            {content.coverImageUrl ? (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={content.coverImageUrl}
                  alt={content.title}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl flex items-center justify-center shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                style={{ backgroundColor: hexToRgba(colors.accentLight, 0.08) }}
              >
                <ContentIcon 
                  className="w-9 h-9 sm:w-10 sm:h-10" 
                  style={{ color: colors.accentLight }} 
                />
              </div>
            )}
          </div>
          
          {/* Content Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div 
              className="text-xs font-semibold px-2.5 py-1 rounded-md w-fit mb-2"
              style={{ 
                backgroundColor: hexToRgba(colors.accentLight, 0.1),
                color: colors.accentLight 
              }}
            >
              {content.type.charAt(0).toUpperCase() + content.type.slice(1)}
            </div>
            <h3 className="font-albert font-semibold text-lg sm:text-xl text-text-primary dark:text-[#f5f5f8] line-clamp-2 leading-snug tracking-[-0.3px]">
              {content.title}
            </h3>
            {content.coachName && (
              <p className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-1.5">
                by {content.coachName}
              </p>
            )}
          </div>
        </div>
        
        {/* Description */}
        {content.description && (
          <div 
            className="text-sm text-text-secondary dark:text-[#b2b6c2] mt-5 line-clamp-4 leading-relaxed prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0"
            dangerouslySetInnerHTML={{ __html: content.description }}
          />
        )}
        
        {/* Key Outcomes */}
        {content.keyOutcomes && content.keyOutcomes.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
              What you&apos;ll get:
            </p>
            <ul className="space-y-1.5">
              {content.keyOutcomes.slice(0, 3).map((outcome, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <Check 
                    className="w-4 h-4 mt-0.5 flex-shrink-0" 
                    style={{ color: colors.accentLight }}
                  />
                  <span className="text-sm text-text-secondary dark:text-[#b2b6c2] leading-snug">
                    {outcome}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Price & CTA */}
      <div className="border-t border-[#e8e4df] dark:border-[#262b35] bg-[#faf9f7] dark:bg-[#11141b] px-5 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              {formatPrice(content.priceInCents, content.currency)}
            </span>
            {content.priceInCents > 0 && (
              <span className="text-sm text-text-muted dark:text-[#7d8190]">
                one-time
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-text-muted dark:text-[#7d8190]">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">Secure checkout</span>
          </div>
        </div>
        
        <Button
          onClick={onPurchase}
          disabled={isPurchasing}
          className="w-full h-12 text-[15px] text-white font-semibold rounded-xl transition-all hover:brightness-105 active:scale-[0.98]"
          style={{ 
            background: `linear-gradient(135deg, ${colors.accentLight}, ${colors.accentDark})`,
          }}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : !isSignedIn ? (
            'Sign in to purchase'
          ) : content.priceInCents === 0 ? (
            'Get for free'
          ) : hasSavedCards ? (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay {formatPrice(content.priceInCents, content.currency)}
            </>
          ) : (
            `Purchase for ${formatPrice(content.priceInCents, content.currency)}`
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Success View
 */
function SuccessContent() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      {/* Success checkmark circle */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          duration: 0.4,
          ease: [0.34, 1.56, 0.64, 1]
        }}
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
        Payment Successful!
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-sm text-text-secondary dark:text-[#b2b6c2]"
      >
        Redirecting to your content...
      </motion.p>
    </div>
  );
}

/**
 * Loading View
 */
function LoadingContent({ accentColor }: { accentColor: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
        <div 
          className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
          style={{ borderTopColor: accentColor }}
        />
      </div>
      <p className="text-text-secondary dark:text-[#b2b6c2]">Setting up payment...</p>
    </div>
  );
}

/**
 * Main Content Wrapper - handles all step animations
 */
function SheetContent({
  content,
  step,
  setStep,
  stripePromise,
  clientSecret,
  connectedAccountId,
  savedMethods,
  selectedMethodId,
  setSelectedMethodId,
  onPurchaseComplete,
  onOpenChange,
  organizationId,
}: {
  content: ContentPurchaseSheetProps['content'];
  step: PurchaseStep;
  setStep: (step: PurchaseStep) => void;
  stripePromise: Promise<Stripe | null> | null;
  clientSecret: string | null;
  connectedAccountId: string | null;
  savedMethods: SavedPaymentMethod[];
  selectedMethodId: string | null;
  setSelectedMethodId: (id: string | null) => void;
  onPurchaseComplete?: () => void;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
}) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { colors } = useBrandingValues();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if this is the initial mount to skip animation on first open
  const isInitialMount = useRef(true);
  useEffect(() => {
    // After first render, mark initial mount as complete
    isInitialMount.current = false;
  }, []);

  const handleStartPurchase = async () => {
    if (!isSignedIn) {
      const returnPath = window.location.pathname;
      router.push(`/sign-in?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }

    // For free content, use the old purchase flow
    if (content.priceInCents === 0) {
      setIsPurchasing(true);
      try {
        const response = await fetch('/api/content/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: content.type,
            contentId: content.id,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.error || 'Purchase failed');
        }
        
        setStep('success');
        setTimeout(() => {
          onOpenChange(false);
          onPurchaseComplete?.();
          router.push(getContentUrl(content.type, content.id));
        }, 1500);
      } catch (err) {
        console.error('Purchase error:', err);
      } finally {
        setIsPurchasing(false);
      }
      return;
    }

    // For paid content, check if we have saved methods
    if (savedMethods.length > 0) {
      // Show saved methods selection
      setStep('selectMethod');
      // Pre-select default method
      const defaultMethod = savedMethods.find(m => m.isDefault);
      if (defaultMethod) {
        setSelectedMethodId(defaultMethod.id);
      } else {
        setSelectedMethodId(savedMethods[0].id);
      }
    } else {
      // No saved methods, go directly to payment
      setStep('loading');
    }
  };

  const handlePayWithSavedMethod = async () => {
    if (!selectedMethodId) return;
    
    setIsPurchasing(true);
    setError(null);
    setStep('processing');

    try {
      const response = await fetch('/api/content/charge-saved-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: content.type,
          contentId: content.id,
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
      setIsPurchasing(false);
    }
  };

  const handleAddNewCard = () => {
    // Go to new card payment flow
    setStep('loading');
  };

  const handlePaymentSuccess = () => {
    setStep('success');
    
    // Navigate to content page after animation
    setTimeout(() => {
      onOpenChange(false);
      onPurchaseComplete?.();
      router.push(getContentUrl(content.type, content.id));
    }, 1500);
  };

  const handleBackToPreview = () => {
    setStep('preview');
    setError(null);
  };

  const handleBackToMethodSelection = () => {
    if (savedMethods.length > 0) {
      setStep('selectMethod');
    } else {
      setStep('preview');
    }
  };

  // Slide animation variants
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  const direction = step === 'preview' ? -1 : 1;

  return (
    <div className="flex flex-col min-h-0">
      <AnimatePresence mode="wait" custom={direction}>
        {step === 'preview' && (
          <motion.div
            key="preview"
            custom={direction}
            variants={slideVariants}
            initial={isInitialMount.current ? false : "enter"}
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <PreviewContent
              content={content}
              onPurchase={handleStartPurchase}
              isPurchasing={isPurchasing}
              isSignedIn={!!isSignedIn}
              hasSavedCards={savedMethods.length > 0}
            />
          </motion.div>
        )}

        {step === 'selectMethod' && (
          <motion.div
            key="selectMethod"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Back button header */}
            <div className="px-6 pb-2">
              <button
                type="button"
                onClick={handleBackToPreview}
                className="p-2 -ml-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary dark:text-[#b2b6c2]" />
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mx-6 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}

            <SavedCardsSelection
              savedMethods={savedMethods}
              selectedMethodId={selectedMethodId}
              onSelect={setSelectedMethodId}
              onAddNew={handleAddNewCard}
              onPay={handlePayWithSavedMethod}
              isProcessing={isPurchasing}
              priceInCents={content.priceInCents}
              currency={content.currency || 'usd'}
              accentColor={colors.accentLight}
            />
          </motion.div>
        )}

        {step === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoadingContent accentColor={colors.accentLight} />
          </motion.div>
        )}

        {step === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8] dark:border-[#262b35]" />
                <div 
                  className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent animate-spin"
                  style={{ borderTopColor: colors.accentLight }}
                />
              </div>
              <p className="text-text-secondary dark:text-[#b2b6c2]">Processing payment...</p>
            </div>
          </motion.div>
        )}

        {step === 'payment' && clientSecret && stripePromise && (
          <motion.div
            key="payment"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: isDark ? 'night' : 'stripe',
                  variables: {
                    colorPrimary: isDark ? colors.accentDark : colors.accentLight,
                    colorBackground: isDark ? '#1a1e26' : '#ffffff',
                    colorText: isDark ? '#e8e6e3' : '#1a1816',
                    colorTextSecondary: isDark ? '#9ca3af' : undefined,
                    colorDanger: '#ef4444',
                    fontFamily: 'Albert Sans, system-ui, -apple-system, sans-serif',
                    borderRadius: '12px',
                  },
                  rules: {
                    '.Input': {
                      borderColor: isDark ? '#313746' : '#e1ddd8',
                    },
                    '.Input:focus': {
                      borderColor: isDark ? colors.accentDark : colors.accentLight,
                      boxShadow: isDark ? `0 0 0 1px ${colors.accentDark}` : `0 0 0 1px ${colors.accentLight}`,
                    },
                    '.Tab': {
                      borderColor: isDark ? '#313746' : '#e1ddd8',
                    },
                    '.Tab--selected': {
                      borderColor: isDark ? colors.accentDark : colors.accentLight,
                      backgroundColor: isDark ? '#262b35' : '#faf8f6',
                    },
                  },
                },
              }}
            >
              <StripePaymentForm
                onSuccess={handlePaymentSuccess}
                onBack={handleBackToMethodSelection}
                priceInCents={content.priceInCents}
                currency={content.currency || 'usd'}
                contentTitle={content.title}
                accentColor={colors.accentLight}
                organizationId={organizationId}
                contentType={content.type}
                contentId={content.id}
                connectedAccountId={connectedAccountId}
              />
            </Elements>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <SuccessContent />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * ContentPurchaseSheet - Slide-up on mobile, modal on desktop
 * Shows content preview and embedded Stripe checkout for purchases.
 */
export function ContentPurchaseSheet({
  open,
  onOpenChange,
  content,
  onPurchaseComplete,
}: ContentPurchaseSheetProps) {
  const { isSignedIn } = useAuth();
  const [step, setStep] = useState<PurchaseStep>('preview');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [connectedAccountId, setConnectedAccountId] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(content.organizationId || null);
  
  // Detect desktop vs mobile to render only one component
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Fetch saved payment methods when sheet opens
  const fetchSavedMethods = useCallback(async () => {
    if (!isSignedIn || !organizationId) return;

    try {
      const response = await fetch(`/api/payment-methods?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setSavedMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Error fetching saved payment methods:', err);
    }
  }, [isSignedIn, organizationId]);

  // Fetch organization ID from content if not provided
  useEffect(() => {
    if (!open || organizationId) return;

    const fetchOrganizationId = async () => {
      try {
        // Make a lightweight API call to get the organization ID
        const response = await fetch('/api/content/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: content.type,
            contentId: content.id,
            checkOnly: true, // Just get org info, don't create intent
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.organizationId) {
            setOrganizationId(data.organizationId);
          }
        }
      } catch {
        // Silently fail - we'll create payment intent when user clicks purchase
      }
    };

    fetchOrganizationId();
  }, [open, organizationId, content.type, content.id]);

  // Fetch saved methods when sheet opens and we have org ID
  useEffect(() => {
    if (open && organizationId && isSignedIn) {
      fetchSavedMethods();
    }
  }, [open, organizationId, isSignedIn, fetchSavedMethods]);
  
  // Reset state when sheet closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow close animation
      const timer = setTimeout(() => {
        setStep('preview');
        setClientSecret(null);
        setConnectedAccountId(null);
        setStripePromise(null);
        setError(null);
        setSelectedMethodId(null);
        // Don't reset savedMethods and organizationId - they can be reused
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Create payment intent when entering loading step
  useEffect(() => {
    if (step !== 'loading' || !open) return;

    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/content/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: content.type,
            contentId: content.id,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to initialize payment');
        }

        const { clientSecret: secret, connectedAccountId: accountId } = await response.json();
        setClientSecret(secret);
        setConnectedAccountId(accountId);

        // Load Stripe with the connected account
        const stripeInstance = loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
          accountId ? { stripeAccount: accountId } : undefined
        );
        setStripePromise(stripeInstance);
        
        // Move to payment step
        setStep('payment');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
        setStep('preview'); // Go back to preview on error
      }
    };

    createPaymentIntent();
  }, [step, open, content.type, content.id]);

  const sheetContent = (
    <SheetContent
      content={content}
      step={step}
      setStep={setStep}
      stripePromise={stripePromise}
      clientSecret={clientSecret}
      connectedAccountId={connectedAccountId}
      savedMethods={savedMethods}
      selectedMethodId={selectedMethodId}
      setSelectedMethodId={setSelectedMethodId}
      onPurchaseComplete={onPurchaseComplete}
      onOpenChange={onOpenChange}
      organizationId={organizationId}
    />
  );

  // Desktop: Dialog (larger size)
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl" hideCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>{content.title}</DialogTitle>
            <DialogDescription>Purchase this content</DialogDescription>
          </DialogHeader>
          
          <div className="pt-6 pb-2 flex-1 overflow-y-auto">
            {sheetContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Mobile: Drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{content.title}</DrawerTitle>
          <DrawerDescription>Purchase this content</DrawerDescription>
        </DrawerHeader>
        <div className="pt-2 pb-6">
          {sheetContent}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
