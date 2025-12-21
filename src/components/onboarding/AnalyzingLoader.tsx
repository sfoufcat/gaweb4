'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useBrandingValues } from '@/contexts/BrandingContext';

const TESTIMONIALS = [
  {
    text: "This structure helped me stay consistent for the first time in my life.",
    author: "Amina A.",
    rating: 5,
  },
  {
    text: "Finally, a system that actually keeps me accountable to my goals.",
    author: "Marcus T.",
    rating: 5,
  },
  {
    text: "The daily check-ins changed everything. I've never been this focused.",
    author: "Sarah K.",
    rating: 5,
  },
  {
    text: "Went from dreaming about my goals to actually crushing them.",
    author: "David L.",
    rating: 5,
  },
];

const BENEFIT_LINES = [
  "Using your answers to build a clear, step-by-step strategy.",
  "Preparing a personalized roadmap tailored to your goal.",
  "Crafting daily habits that align with your mission.",
  "Designing your path to transformation.",
];

interface AnalyzingLoaderProps {
  onComplete?: () => void;
  duration?: number; // in milliseconds
}

export function AnalyzingLoader({ onComplete, duration = 4000 }: AnalyzingLoaderProps) {
  const { logoUrl, appTitle } = useBrandingValues();
  const [progress, setProgress] = useState(0);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [benefitIndex, setBenefitIndex] = useState(0);

  // Animate progress from 0 to 100
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
        // Small delay before completing to show 100%
        setTimeout(() => {
          onComplete?.();
        }, 500);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  // Rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Rotate benefit lines
  useEffect(() => {
    const interval = setInterval(() => {
      setBenefitIndex((prev) => (prev + 1) % BENEFIT_LINES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const testimonial = TESTIMONIALS[currentTestimonial];
  const circumference = 2 * Math.PI * 54; // radius = 54
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center px-6">
      {/* Logo at top - centered */}
      <div className="absolute top-8 left-0 right-0 flex justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Image 
            src={logoUrl} 
            alt={appTitle} 
            width={48} 
            height={48} 
            className="rounded-lg"
            unoptimized
          />
        </motion.div>
      </div>

      <motion.div 
        className="w-full max-w-md mx-auto flex flex-col items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Circular Progress */}
        <motion.div 
          className="relative mb-8"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <svg width="140" height="140" viewBox="0 0 120 120" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#e1ddd8"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-100 ease-out"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#a07855" />
                <stop offset="50%" stopColor="#c9a07a" />
                <stop offset="100%" stopColor="#f7c948" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span 
              className="font-albert text-[42px] font-bold text-text-primary tracking-[-2px]"
              key={Math.round(progress)}
            >
              {Math.round(progress)}
              <span className="text-[24px]">%</span>
            </motion.span>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2 
          className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Creating your personalized Growth Plan…
        </motion.h2>

        {/* Rotating benefit line */}
        <motion.div 
          className="h-12 flex items-center justify-center mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={benefitIndex}
              className="font-sans text-[15px] text-text-secondary text-center max-w-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              {BENEFIT_LINES[benefitIndex]}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Testimonial Card */}
        <motion.div 
          className="w-full"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTestimonial}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-2xl p-6 border border-[#e1ddd8] shadow-sm"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <span key={i} className="text-[#f7c948] text-lg">★</span>
                ))}
              </div>
              
              {/* Quote */}
              <p className="font-sans text-[15px] text-text-primary leading-relaxed mb-4">
                &quot;{testimonial.text}&quot;
              </p>
              
              {/* Author */}
              <p className="font-sans text-[13px] text-text-secondary">
                — {testimonial.author}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Progress dots */}
        <div className="flex gap-2 mt-6">
          {TESTIMONIALS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === currentTestimonial 
                  ? 'bg-[#a07855] w-6' 
                  : 'bg-[#e1ddd8]'
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
