'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import type { FunnelStepConfigInfo } from '@/types';

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
    <div className="w-full max-w-xl mx-auto">
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
        className="flex gap-3"
      >
        {!isFirstStep && onBack && (
          <button
            onClick={onBack}
            className="px-6 py-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={handleContinue}
          disabled={isSubmitting}
          className="flex-1 py-3 px-6 bg-[#a07855] text-white rounded-xl font-medium hover:bg-[#8c6245] disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Loading...' : config.ctaText || 'Continue'}
        </button>
      </motion.div>
    </div>
  );
}

