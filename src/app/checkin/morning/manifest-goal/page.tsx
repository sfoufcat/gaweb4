'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function ManifestGoalPage() {
  const router = useRouter();
  const [goal, setGoal] = useState<{ goal: string; targetDate: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [canContinue, setCanContinue] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const duration = 20; // 20 seconds

  // Fade out audio
  const fadeOutAudio = useCallback((audio: HTMLAudioElement, fadeDuration: number = 1500) => {
    const startVolume = audio.volume;
    const steps = 15;
    const volumeStep = startVolume / steps;
    const stepDuration = fadeDuration / steps;
    let currentStep = 0;

    const fadeInterval = setInterval(() => {
      currentStep++;
      audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        audio.pause();
      }
    }, stepDuration);

    return fadeInterval;
  }, []);

  useEffect(() => {
    // Fetch user goal
    const fetchGoal = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();
        
        if (data.goal) {
          setGoal({
            goal: data.goal.goal,
            targetDate: data.goal.targetDate,
          });
        } else if (data.user?.goal) {
          setGoal({
            goal: data.user.goal,
            targetDate: data.user.goalTargetDate || '',
          });
        }
      } catch (error) {
        console.error('Error fetching goal:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoal();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    // Start progress timer
    const startTime = Date.now();

    progressInterval.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const newProgress = Math.min(100, (elapsed / (duration * 1000)) * 100);
      setProgress(newProgress);
      
      if (elapsed >= duration * 1000) {
        setCanContinue(true);
      }
    }, 100);

    // Try to get existing audio from identity page or create new
    const existingAudio = document.getElementById('manifest-audio') as HTMLAudioElement;
    if (existingAudio && !existingAudio.paused) {
      audioRef.current = existingAudio;
    } else {
      // If no existing audio, start fresh
      if (audioRef.current) {
        const audio = audioRef.current;
        
        const playFromCenter = () => {
          if (audio.duration && isFinite(audio.duration)) {
            audio.currentTime = audio.duration / 2;
          }
          audio.volume = 0.7;
          audio.play().catch((error) => {
            console.log('Audio playback failed:', error);
          });
        };

        if (audio.readyState >= 1) {
          playFromCenter();
        } else {
          audio.addEventListener('loadedmetadata', playFromCenter, { once: true });
        }
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      // Fade out audio when leaving
      if (audioRef.current) {
        fadeOutAudio(audioRef.current);
      }
    };
  }, [isLoading, fadeOutAudio]);

  const handleContinue = async () => {
    if (!canContinue || isNavigating) return;
    
    setIsNavigating(true);
    
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    // Fade out audio
    if (audioRef.current) {
      const audio = audioRef.current;
      const startVolume = audio.volume;
      const steps = 10;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      const fadeOut = setInterval(() => {
        currentStep++;
        audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
        if (currentStep >= steps) {
          clearInterval(fadeOut);
          audio.pause();
        }
      }, 50);
    }

    // Update check-in
    await fetch('/api/checkin/morning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifestGoalCompleted: true }),
    });

    router.push('/checkin/morning/plan-day');
  };

  // Format target date
  const formatTargetDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ 
          minHeight: '100dvh',
          background: 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)'
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
        background: 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)'
      }}
    >
      {/* Inner container - handles layout */}
      <div className="w-full h-full relative">
        {/* CSS-animated wrapper - no Framer Motion for page fade, no hydration delay */}
        <div className="w-full h-full animate-page-fade-in">
          {/* Fallback audio element */}
      <audio ref={audioRef} loop src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/audio%2Fmanifest%20(1).mp3?alt=media&token=84b6136a-ba75-42ee-9941-261cf3ebbd6c" />

      {/* Progress bar at top */}
      <div className="absolute top-[20px] left-[20px] right-[20px] z-50">
        <div className="w-full h-[2px] bg-white/20 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-white/70"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Slow Floating Orbs - calm ethereal effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Large floating orb 1 */}
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
          animate={{
            x: ['-20%', '120%'],
            y: ['20%', '60%'],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          style={{ left: '-10%', top: '10%', background: 'rgba(255, 255, 255, 0.15)' }}
        />
        
        {/* Large floating orb 2 */}
        <motion.div
          className="absolute w-[350px] h-[350px] rounded-full blur-3xl"
          animate={{
            x: ['100%', '-20%'],
            y: ['60%', '20%'],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: 5,
          }}
          style={{ right: '-10%', bottom: '10%', background: 'rgba(255, 255, 255, 0.12)' }}
        />

        {/* Medium floating orb 3 */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full blur-3xl"
          animate={{
            x: ['50%', '10%'],
            y: ['10%', '80%'],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
            delay: 10,
          }}
          style={{ left: '40%', top: '5%', background: 'rgba(255, 255, 255, 0.1)' }}
        />
      </div>

      {/* Decorative pulsing circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        {/* Center pulsing circle */}
        <motion.div
          className="absolute w-[320px] h-[320px] md:w-[400px] md:h-[400px] rounded-full border border-white/20"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        
        {/* Second pulsing circle - offset timing */}
        <motion.div
          className="absolute w-[380px] h-[380px] md:w-[470px] md:h-[470px] rounded-full border border-white/15"
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.15, 0.28, 0.15],
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
          className="absolute w-[440px] h-[440px] md:w-[540px] md:h-[540px] rounded-full border border-white/10"
          animate={{
            scale: [1, 1.06, 1],
            opacity: [0.1, 0.2, 0.1],
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
          {/* "I want to" label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="font-albert text-[20px] md:text-[24px] text-white/70 tracking-[-1px] leading-[1.2] mb-4"
          >
            I want to
          </motion.p>
          
          {goal ? (
            <>
              <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2]">
                {goal.goal}
              </h1>
              
              {goal.targetDate && (
                <p className="mt-4 font-sans text-[16px] md:text-[18px] text-white/60 tracking-[-0.4px]">
                  by {formatTargetDate(goal.targetDate)}
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2] mb-4">
                Set your goal
              </h1>
              <p className="font-sans text-[16px] md:text-[18px] text-white/60">
                Define what you want to achieve
              </p>
            </>
          )}
        </motion.div>
      </div>

      {/* Continue button */}
      <div className="absolute bottom-[40px] left-0 right-0 px-6 z-50">
        <button
          onClick={handleContinue}
          disabled={!canContinue || isNavigating}
          className="w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] border transition-all shadow-[0px_8px_30px_0px_rgba(0,0,0,0.2)] cursor-pointer disabled:cursor-not-allowed"
          style={{
            backgroundColor: canContinue && !isNavigating ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
            color: canContinue && !isNavigating ? '#ffffff' : 'rgba(255,255,255,0.4)',
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
