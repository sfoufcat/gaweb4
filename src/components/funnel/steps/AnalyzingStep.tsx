'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { FunnelStepConfigAnalyzing, FunnelTestimonial } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';

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

// Testimonial Card Component
function TestimonialCard({ testimonial, delay }: { testimonial: FunnelTestimonial; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white border border-[#e1ddd8] rounded-xl p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {testimonial.imageUrl ? (
            <Image
              src={testimonial.imageUrl}
              alt={testimonial.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
              unoptimized={testimonial.imageUrl.startsWith('http')}
            />
          ) : (
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: primaryVar }}
            >
              {testimonial.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary leading-relaxed">"{testimonial.text}"</p>
          <p className="text-xs text-text-muted mt-2">— {testimonial.name}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function AnalyzingStep({
  config,
  onComplete,
  data,
}: AnalyzingStepProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const messages: string[] = config.messages?.length ? config.messages : DEFAULT_MESSAGES;
  const duration = config.durationMs || 3000;
  const testimonials = config.testimonials || [];

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
          className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent"
          style={{ borderTopColor: primaryVar }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        {/* Inner pulse */}
        <motion.div
          className="absolute inset-4 rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${primaryVar} 10%, transparent)` }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </motion.div>

      {/* Animated message */}
      <div>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-text-secondary text-lg text-center"
          >
            {String(messages[currentMessageIndex])}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8">
        {messages.map((_, index) => (
          <motion.div
            key={index}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: index <= currentMessageIndex ? primaryVar : '#e1ddd8' }}
            animate={{
              scale: index === currentMessageIndex ? [1, 1.3, 1] : 1,
            }}
            transition={{ duration: 0.5, repeat: index === currentMessageIndex ? Infinity : 0 }}
          />
        ))}
      </div>

      {/* Summary of what we're analyzing (optional) */}
      {typeof data.goal === 'string' && data.goal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 p-4 bg-[#faf8f6] rounded-xl text-center"
        >
          <p className="text-sm text-text-muted">Your goal:</p>
          <p className="text-text-primary font-medium">{data.goal}</p>
        </motion.div>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <div className="mt-8 w-full space-y-3">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard 
              key={index} 
              testimonial={testimonial} 
              delay={0.8 + index * 0.2}
            />
          ))}
        </div>
      )}
    </div>
  );
}

