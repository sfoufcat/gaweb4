'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import type { FunnelStepConfigSuccess } from '@/types';

// CSS variable helper - uses values set by FunnelClient
const primaryVar = 'var(--funnel-primary, #a07855)';

// Fade duration in milliseconds
const FADE_DURATION = 500;

interface SuccessStepProps {
  config: FunnelStepConfigSuccess;
  onComplete: (data: Record<string, unknown>) => void;
  program: {
    name: string;
  };
  branding?: {
    primaryColor?: string;
  };
}

export function SuccessStep({
  config,
  onComplete,
  program,
  branding,
}: SuccessStepProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fade out audio smoothly
  const fadeOutAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const fadeStep = 0.05;
    const fadeInterval = FADE_DURATION / (1 / fadeStep);

    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume > fadeStep) {
        audio.volume = Math.max(0, audio.volume - fadeStep);
      } else {
        audio.volume = 0;
        audio.pause();
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }
    }, fadeInterval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Handle celebration music
  useEffect(() => {
    if (!config.celebrationSound || config.showConfetti === false) return;

    let isMounted = true;

    async function playMusic() {
      try {
        // Fetch track list to get URL
        const res = await fetch('/api/music/list');
        const data = await res.json();
        
        if (!isMounted || !data.success) return;
        
        const track = data.tracks?.find((t: { id: string }) => t.id === config.celebrationSound);
        if (!track) return;

        // Create audio element
        const audio = new Audio(track.url);
        audio.volume = 0;
        audioRef.current = audio;

        // Start playing and fade in
        await audio.play();
        
        // Fade in
        const fadeStep = 0.05;
        const fadeInterval = FADE_DURATION / (1 / fadeStep);
        const maxVolume = 0.7;
        
        const fadeInInterval = setInterval(() => {
          if (audio.volume < maxVolume - fadeStep) {
            audio.volume = Math.min(maxVolume, audio.volume + fadeStep);
          } else {
            audio.volume = maxVolume;
            clearInterval(fadeInInterval);
          }
        }, fadeInterval);

        // Schedule fade out before confetti ends
        const confettiDuration = 3000;
        const fadeOutTime = confettiDuration - FADE_DURATION;
        
        setTimeout(() => {
          if (isMounted) {
            fadeOutAudio();
          }
        }, fadeOutTime);

      } catch (err) {
        console.error('Failed to play celebration music:', err);
      }
    }

    playMusic();

    return () => {
      isMounted = false;
    };
  }, [config.celebrationSound, config.showConfetti, fadeOutAudio]);

  useEffect(() => {
    // Trigger confetti if enabled
    if (config.showConfetti !== false) {
      const duration = 3000;
      const end = Date.now() + duration;

      // Festive confetti colors including the brand accent
      const colors = [
        branding?.primaryColor || '#a07855',  // Brand color
        '#FFD700',  // Gold
        '#FF6B6B',  // Coral red
        '#4ECDC4',  // Teal
        '#A855F7',  // Purple
        '#F472B6',  // Pink
      ];

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
  }, [config.showConfetti, config.redirectDelay, onComplete, branding?.primaryColor]);

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

