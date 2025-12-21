'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { FunnelStepConfigSuccess } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';
const primaryHoverVar = 'var(--funnel-primary-hover, #8c6245)';

interface SuccessStepProps {
  config: FunnelStepConfigSuccess;
  onComplete: (data: Record<string, unknown>) => void;
  program: {
    name: string;
  };
}

export function SuccessStep({
  config,
  onComplete,
  program,
}: SuccessStepProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    // Trigger confetti if enabled
    if (config.showConfetti !== false) {
      const duration = 3000;
      const end = Date.now() + duration;

      const colors = ['#a07855', '#c9a07a', '#8c6245', '#d4b896'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }

    // Auto-redirect after delay
    const redirectDelay = config.redirectDelay || 3000;
    const timer = setTimeout(() => {
      setIsRedirecting(true);
      onComplete({});
    }, redirectDelay);

    return () => clearTimeout(timer);
  }, [config.showConfetti, config.redirectDelay, onComplete]);

  const heading = config.heading || `Welcome to ${program.name}! 🎉`;
  const body = config.body || "You're all set! Taking you to your dashboard...";

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[400px] text-center">
      {/* Success checkmark */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-8"
      >
        <motion.svg
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="w-12 h-12 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      </motion.div>

      {/* Heading */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-albert text-[28px] sm:text-[36px] text-text-primary tracking-[-1.5px] leading-[1.15] mb-4"
      >
        {heading}
      </motion.h1>

      {/* Body */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-text-secondary text-lg"
      >
        {body}
      </motion.p>

      {/* Loading indicator */}
      {isRedirecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full border-2 border-[#e1ddd8]" />
            <div 
              className="absolute inset-0 w-8 h-8 rounded-full border-2 border-transparent animate-spin"
              style={{ borderTopColor: primaryVar }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

