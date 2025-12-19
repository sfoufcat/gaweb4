'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function ManifestIdentityPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoAdvanced = useRef(false);
  
  const unlockDuration = 10; // 10 seconds to unlock Continue
  const autoContinueDuration = 20; // Auto-advance at 20 seconds

  // Fade in audio
  const fadeInAudio = (audio: HTMLAudioElement, targetVolume: number = 0.7, fadeDuration: number = 2000) => {
    audio.volume = 0;
    const steps = 20;
    const volumeStep = targetVolume / steps;
    const stepDuration = fadeDuration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      audio.volume = Math.min(targetVolume, volumeStep * currentStep);
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
      }
    }, stepDuration);

    return fadeInterval;
  };

  const navigateToGoal = useCallback(async () => {
    if (isNavigating || hasAutoAdvanced.current) return;
    
    setIsNavigating(true);
    hasAutoAdvanced.current = true;
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    // Update check-in
    try {
      await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestIdentityCompleted: true }),
      });
    } catch (error) {
      console.error('Error updating check-in:', error);
    }

    // Navigate without stopping audio - goal page will pick it up
    router.push('/checkin/morning/manifest-goal');
  }, [isNavigating, router]);

  useEffect(() => {
    // Fetch user identity
    const fetchIdentity = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        
        if (data.user?.identity) {
          setIdentity(data.user.identity);
        } else {
          setIdentity('becoming the best version of myself');
        }
      } catch (error) {
        console.error('Error fetching identity:', error);
        setIdentity('becoming the best version of myself');
      } finally {
        setIsLoading(false);
      }
    };

    fetchIdentity();
  }, []);

  useEffect(() => {
    if (isLoading || !identity) return;

    // Start progress timer
    const startTime = Date.now();

    progressInterval.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const seconds = elapsed / 1000;
      
      // Progress based on unlock duration for visual
      const newProgress = Math.min(100, (seconds / unlockDuration) * 100);
      setProgress(newProgress);
      
      // Unlock continue at 10 seconds
      if (seconds >= unlockDuration) {
        setCanContinue(true);
      }
      
      // Auto-advance at 20 seconds
      if (seconds >= autoContinueDuration && !hasAutoAdvanced.current) {
        navigateToGoal();
      }
    }, 100);

    // Play meditation audio from center with fade in
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const playFromCenter = () => {
        if (audio.duration && isFinite(audio.duration)) {
          audio.currentTime = audio.duration / 2;
        }
        audio.play().then(() => {
          fadeInAudio(audio);
        }).catch((error) => {
          console.log('Audio playback failed:', error);
        });
      };

      if (audio.readyState >= 1) {
        playFromCenter();
      } else {
        audio.addEventListener('loadedmetadata', playFromCenter, { once: true });
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      // Don't stop audio - it continues to goal page
    };
  }, [isLoading, identity, navigateToGoal]);

  const handleContinue = () => {
    if (!canContinue || isNavigating) return;
    navigateToGoal();
  };

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ 
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)'
        }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    // Fixed container - viewport positioning
    <div 
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ 
        minHeight: '100dvh',
        background: 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)'
      }}
    >
      {/* Inner container - handles layout */}
      <div className="w-full h-full relative">
        {/* CSS-animated wrapper - no Framer Motion for page fade, no hydration delay */}
        <div className="w-full h-full animate-page-fade-in">
          {/* Audio element - will continue to goal page */}
      <audio ref={audioRef} loop src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/audio%2Fmanifest%20(1).mp3?alt=media&token=84b6136a-ba75-42ee-9941-261cf3ebbd6c" id="manifest-audio" />

      {/* Progress bar at top */}
      <div className="absolute top-[20px] left-[20px] right-[20px] z-50">
        <div className="w-full h-[2px] bg-black/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-black/40"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Decorative pulsing circles - flower of life pattern */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        {/* Center pulsing circle */}
        <motion.div
          className="absolute w-[320px] h-[320px] md:w-[450px] md:h-[450px] rounded-full border border-black/20"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Second pulsing circle - offset timing */}
        <motion.div
          className="absolute w-[380px] h-[380px] md:w-[520px] md:h-[520px] rounded-full border border-black/15"
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
        />

        {/* Third outer circle */}
        <motion.div
          className="absolute w-[440px] h-[440px] md:w-[600px] md:h-[600px] rounded-full border border-black/10"
          animate={{
            scale: [1, 1.06, 1],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 2,
          }}
        />
      </div>

      {/* Main content */}
      <div className="h-full flex flex-col items-center justify-center px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-center max-w-[500px]"
        >
          <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-[#1a1a1a] tracking-[-2px] leading-[1.2]">
            I am {identity}
          </h1>
        </motion.div>
      </div>

      {/* Continue button */}
      <div className="absolute bottom-[40px] left-0 right-0 px-6 z-50">
        <button
          onClick={handleContinue}
          disabled={!canContinue || isNavigating}
          className="w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] border transition-all shadow-[0px_8px_30px_0px_rgba(0,0,0,0.2)] cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: canContinue && !isNavigating ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
            color: canContinue && !isNavigating ? '#2c2520' : 'rgba(255,255,255,0.4)',
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          {isNavigating ? 'Continuing...' : 'Continue'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
