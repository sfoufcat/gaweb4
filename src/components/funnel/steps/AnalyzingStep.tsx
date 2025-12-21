'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FunnelStepConfigAnalyzing } from '@/types';

const DEFAULT_MESSAGES = [
  'Analyzing your responses...',
  'Building your personalized plan...',
  'Optimizing for your goals...',
  'Almost ready...',
];

interface AnalyzingStepProps {
  config: FunnelStepConfigAnalyzing;
  onComplete: (data: Record<string, unknown>) => void;
  data: Record<string, unknown>;
}

export function AnalyzingStep({
  config,
  onComplete,
  data,
}: AnalyzingStepProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const messages = config.messages?.length ? config.messages : DEFAULT_MESSAGES;
  const duration = config.durationMs || 3000;

  useEffect(() => {
    // Cycle through messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, duration / messages.length);

    // Auto-complete after duration
    const completeTimeout = setTimeout(() => {
      onComplete({});
    }, duration);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(completeTimeout);
    };
  }, [messages.length, duration, onComplete]);

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
      {/* Animated spinner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-8"
      >
        {/* Outer ring */}
        <div className="w-20 h-20 rounded-full border-4 border-[#e1ddd8]" />
        {/* Spinning ring */}
        <motion.div
          className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-[#a07855]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner pulse */}
        <motion.div
          className="absolute inset-4 bg-[#a07855]/10 rounded-full"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>

      {/* Animated message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={currentMessageIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-text-secondary text-lg text-center"
        >
          {messages[currentMessageIndex]}
        </motion.p>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {messages.map((_, index) => (
          <motion.div
            key={index}
            className={`w-2 h-2 rounded-full ${
              index <= currentMessageIndex ? 'bg-[#a07855]' : 'bg-[#e1ddd8]'
            }`}
            animate={{
              scale: index === currentMessageIndex ? [1, 1.3, 1] : 1,
            }}
            transition={{ duration: 0.5, repeat: index === currentMessageIndex ? Infinity : 0 }}
          />
        ))}
      </div>

      {/* Summary of what we're analyzing (optional) */}
      {data.goal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-[#faf8f6] rounded-xl text-center"
        >
          <p className="text-sm text-text-muted">Your goal:</p>
          <p className="text-text-primary font-medium">{String(data.goal)}</p>
        </motion.div>
      )}
    </div>
  );
}

