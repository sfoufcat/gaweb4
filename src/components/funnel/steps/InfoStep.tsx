'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import type { FunnelStepConfigInfo } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, var(--brand-accent-light))';
const primaryHoverVar = 'var(--funnel-primary-hover, var(--brand-accent-dark))';

interface InfoStepProps {
  config: FunnelStepConfigInfo;
  onComplete: (data: Record<string, unknown>) => void;
  onBack?: () => void;
  isFirstStep: boolean;
}

export function InfoStep({
  config,
  onComplete,
  onBack,
  isFirstStep,
}: InfoStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = async () => {
    setIsSubmitting(true);
    await onComplete({});
    setIsSubmitting(false);
  };

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

      {config.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 rounded-2xl overflow-hidden"
        >
          <Image
            src={config.imageUrl}
            alt=""
            width={600}
            height={400}
            className="w-full h-auto object-cover"
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4">
          {config.heading}
        </h1>
        <p className="text-text-secondary text-lg leading-relaxed whitespace-pre-line">
          {config.body}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={handleContinue}
          disabled={isSubmitting}
          className="w-full py-3 px-6 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
          style={{ backgroundColor: primaryVar }}
          onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = primaryHoverVar)}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = primaryVar}
        >
          {isSubmitting ? 'Loading...' : config.ctaText || 'Continue'}
        </button>
      </motion.div>
    </div>
  );
}

