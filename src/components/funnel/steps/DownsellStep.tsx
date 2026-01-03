'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Check, Loader2, Gift, AlertCircle } from 'lucide-react';
import type { FunnelStepConfigDownsell } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

interface DownsellStepProps {
  config: FunnelStepConfigDownsell;
  flowSessionId: string;
  stepId: string;
  onAccept: (data: { accepted: true; enrollmentId: string; productId: string; productType: string }) => void;
  onDecline: (data: { accepted: false }) => void;
  // Optional real product price from database (overrides static config price)
  productPrice?: {
    priceInCents: number;
    currency?: string;
  };
}

function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function getDiscountLabel(
  originalCents: number,
  finalCents: number,
  discountType: 'none' | 'percent' | 'fixed',
  discountValue?: number
): string | null {
  if (discountType === 'none' || originalCents === finalCents) return null;
  
  if (discountType === 'percent' && discountValue) {
    return `${discountValue}% OFF`;
  }
  
  const savedCents = originalCents - finalCents;
  return `Save ${formatPrice(savedCents)}`;
}

export function DownsellStep({
  config,
  flowSessionId,
  stepId,
  onAccept,
  onDecline,
  productPrice,
}: DownsellStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use real product price if available, otherwise fall back to config price
  const basePrice = productPrice?.priceInCents ?? config.originalPriceInCents;
  const finalPrice = productPrice?.priceInCents ?? config.finalPriceInCents;

  const hasDiscount = config.discountType !== 'none' && basePrice !== finalPrice;
  const discountLabel = getDiscountLabel(
    basePrice,
    finalPrice,
    config.discountType,
    config.discountValue
  );

  const handleAccept = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/funnel/upsell-charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flowSessionId,
          stepId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      onAccept({
        accepted: true,
        enrollmentId: data.enrollmentId,
        productId: data.productId,
        productType: data.productType,
      });
    } catch (err) {
      console.error('[DOWNSELL_STEP] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleDecline = () => {
    onDecline({ accepted: false });
  };

  // Parse description into bullet points if it contains newlines or bullet characters
  const descriptionPoints = config.description
    ?.split(/\n|•|✓/)
    .map(s => s.trim())
    .filter(Boolean) || [];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Special offer badge - different styling for downsell */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-center mb-6"
      >
        <div 
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border-2"
          style={{ 
            borderColor: primaryVar, 
            color: primaryVar,
            backgroundColor: `${primaryVar}10`
          }}
        >
          <Gift className="w-4 h-4" />
          <span>Wait! Here&apos;s a Better Deal</span>
        </div>
      </motion.div>

      {/* Product image */}
      {config.productImageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 rounded-2xl overflow-hidden shadow-lg"
        >
          <Image
            src={config.productImageUrl}
            alt={config.productName}
            width={600}
            height={340}
            className="w-full h-auto object-cover"
            unoptimized={config.productImageUrl.startsWith('http')}
          />
        </motion.div>
      )}

      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="text-center mb-6"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-3">
          {config.headline || 'Before You Go...'}
        </h1>
        <p className="text-text-secondary text-lg">
          {config.productName}
        </p>
      </motion.div>

      {/* Description / Benefits */}
      {descriptionPoints.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#f9f8f6] dark:bg-white/5 rounded-2xl p-6 mb-6"
        >
          <ul className="space-y-3">
            {descriptionPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-3">
                <div 
                  className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: `${primaryVar}20` }}
                >
                  <Check className="w-3 h-3" style={{ color: primaryVar }} />
                </div>
                <span className="text-text-primary">{point}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Price display - emphasize the discount more for downsell */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-center mb-6"
      >
        {hasDiscount && (
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-text-tertiary line-through text-xl">
              {formatPrice(basePrice)}
            </span>
            {discountLabel && (
              <span 
                className="text-sm font-bold px-3 py-1.5 rounded-full animate-pulse"
                style={{ 
                  backgroundColor: primaryVar, 
                  color: 'white' 
                }}
              >
                {discountLabel}
              </span>
            )}
          </div>
        )}
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold text-text-primary">
            {formatPrice(finalPrice)}
          </span>
          {config.isRecurring && (
            <span className="text-text-secondary">
              /{config.recurringInterval === 'year' ? 'year' : 'month'}
            </span>
          )}
        </div>
        {hasDiscount && (
          <p className="text-sm text-text-secondary mt-2">
            This is the lowest price we can offer!
          </p>
        )}
      </motion.div>

      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </motion.div>
      )}

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4"
      >
        <button
          onClick={handleAccept}
          disabled={isProcessing}
          className="w-full py-4 px-6 text-white rounded-xl font-semibold text-lg disabled:opacity-50 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryVar }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{config.ctaText || 'Yes, I Want This Deal!'}</span>
              <span className="opacity-80">({formatPrice(finalPrice)})</span>
            </>
          )}
        </button>

        {/* Decline link */}
        <button
          onClick={handleDecline}
          disabled={isProcessing}
          className="w-full py-2 text-text-tertiary hover:text-text-secondary text-sm transition-colors disabled:opacity-50"
        >
          {config.declineText || 'No thanks, I\'ll pass on this offer'}
        </button>
      </motion.div>

      {/* Security note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-text-tertiary text-xs mt-6"
      >
        Your payment method on file will be charged immediately.
        <br />
        Secure checkout powered by Stripe.
      </motion.p>
    </div>
  );
}









