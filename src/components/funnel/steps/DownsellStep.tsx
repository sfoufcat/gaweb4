'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Check, Loader2, Gift, AlertCircle, CheckCircle2, PartyPopper } from 'lucide-react';
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

// Confetti animation using canvas
function fireConfetti(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    rotation: number;
    rotationSpeed: number;
  }> = [];

  const colors = ['#a07855', '#d4a574', '#8b6f47', '#c9956c', '#e8c4a0', '#FFD700', '#FF6B6B', '#4ECDC4'];

  // Create particles
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20 - 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 10 + 5,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
    });
  }

  let animationId: number;
  const gravity = 0.3;
  const friction = 0.99;

  function animate() {
    if (!ctx || !canvas) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeParticles = 0;

    particles.forEach((p) => {
      p.vy += gravity;
      p.vx *= friction;
      p.vy *= friction;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height + 50) {
        activeParticles++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });

    if (activeParticles > 0) {
      animationId = requestAnimationFrame(animate);
    }
  }

  animate();

  // Cleanup after animation
  setTimeout(() => {
    cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 3000);
}

export function DownsellStep({
  config,
  flowSessionId,
  stepId,
  onAccept,
  onDecline,
  productPrice: externalProductPrice,
}: DownsellStepProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [successData, setSuccessData] = useState<{ enrollmentId: string; productId: string; productType: string } | null>(null);
  
  // Self-contained price fetching
  const [fetchedPrice, setFetchedPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch the real product price on mount
  useEffect(() => {
    // Skip if external price is already provided or if not a program type
    if (externalProductPrice !== undefined) {
      return;
    }

    // Only fetch for program type products
    if (config.productType !== 'program' || !config.productId) {
      return;
    }

    setIsLoadingPrice(true);

    fetch(`/api/programs/${config.productId}/price`)
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Failed to fetch price');
      })
      .then(data => {
        if (data.priceInCents !== undefined) {
          setFetchedPrice(data.priceInCents);
        }
      })
      .catch(err => {
        console.error('[DOWNSELL_STEP] Failed to fetch product price:', err);
        // Fall back to config price (already set as default)
      })
      .finally(() => {
        setIsLoadingPrice(false);
      });
  }, [config.productId, config.productType, externalProductPrice]);

  // Determine the display price - priority: external prop > fetched > config
  const displayPrice = externalProductPrice?.priceInCents ?? fetchedPrice ?? config.finalPriceInCents;
  const originalDisplayPrice = externalProductPrice?.priceInCents ?? fetchedPrice ?? config.originalPriceInCents;
  
  // Recalculate discount based on actual prices
  const hasDiscount = config.discountType !== 'none' && originalDisplayPrice !== displayPrice;
  const discountLabel = getDiscountLabel(
    originalDisplayPrice,
    displayPrice,
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

      // Show success animation
      setSuccessData({
        enrollmentId: data.enrollmentId,
        productId: data.productId,
        productType: data.productType,
      });
      setPurchaseSuccess(true);
      setIsProcessing(false);

      // Fire confetti
      setTimeout(() => {
        fireConfetti(confettiCanvasRef);
      }, 100);

      // Auto-advance after showing success
      setTimeout(() => {
        onAccept({
          accepted: true,
          enrollmentId: data.enrollmentId,
          productId: data.productId,
          productType: data.productType,
        });
      }, 2500);

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

  // Success state view
  if (purchaseSuccess) {
    return (
      <div className="w-full max-w-lg mx-auto relative">
        {/* Confetti canvas - fixed position over everything */}
        <canvas
          ref={confettiCanvasRef}
          className="fixed inset-0 pointer-events-none z-50"
          style={{ width: '100vw', height: '100vh' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.6 }}
          className="text-center py-12"
        >
          {/* Success icon with animated ring */}
          <div className="relative w-24 h-24 mx-auto mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2, duration: 0.5 }}
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: `${primaryVar}15` }}
            />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3, duration: 0.5 }}
              className="absolute inset-2 rounded-full"
              style={{ backgroundColor: `${primaryVar}25` }}
            />
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.4, duration: 0.6 }}
              className="absolute inset-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: primaryVar }}
            >
              <CheckCircle2 className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          {/* Success message */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <PartyPopper className="w-6 h-6" style={{ color: primaryVar }} />
              <h2 className="font-albert text-[28px] sm:text-[32px] text-text-primary tracking-[-1px] font-semibold">
                Great Choice!
              </h2>
              <PartyPopper className="w-6 h-6 scale-x-[-1]" style={{ color: primaryVar }} />
            </div>
            <p className="text-text-secondary text-lg mb-2">
              {config.productName} has been added to your order
            </p>
            <p className="text-text-tertiary text-sm">
              Redirecting you to the next step...
            </p>
          </motion.div>

          {/* Animated dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex justify-center gap-1.5 mt-6"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: primaryVar }}
                animate={{ y: [0, -8, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      </div>
    );
  }

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
              {formatPrice(originalDisplayPrice)}
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
          <AnimatePresence mode="wait">
            <motion.span
              key={displayPrice}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-4xl font-bold text-text-primary"
            >
              {isLoadingPrice ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </span>
              ) : (
                formatPrice(displayPrice)
              )}
            </motion.span>
          </AnimatePresence>
          {config.isRecurring && !isLoadingPrice && (
            <span className="text-text-secondary">
              /{config.recurringInterval === 'year' ? 'year' : 'month'}
            </span>
          )}
        </div>
        {hasDiscount && !isLoadingPrice && (
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
          disabled={isProcessing || isLoadingPrice}
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
              <span className="opacity-80">({formatPrice(displayPrice)})</span>
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
