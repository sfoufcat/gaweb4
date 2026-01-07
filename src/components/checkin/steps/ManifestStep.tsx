'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ManifestStepProps } from './types';

type ManifestSlide = 'identity' | 'goal';

/**
 * ManifestStep - Instagram story-style manifestation
 *
 * Extracted from /src/app/checkin/morning/manifest/page.tsx
 * Features:
 * - Instagram story-style progress bars (2 bars at top)
 * - Two slides: Identity (pastel gradient) -> Goal (purple gradient)
 * - 3 pulsing concentric circles (4s, 5s, 6s durations)
 * - Floating orbs with blur-3xl for goal slide
 * - Audio: plays from center, fade-in 2s, fade-out 1.5s
 * - Timing: Identity 10s unlock, 20s auto-advance; Goal 20s duration
 * - Tap zones: left 25% = back, right 25% = forward
 */
export function ManifestStep({ config, onComplete }: ManifestStepProps) {
  const [currentSlide, setCurrentSlide] = useState<ManifestSlide>('identity');
  const [identity, setIdentity] = useState<string | null>(null);
  const [hasIdentity, setHasIdentity] = useState(false);
  const [goal, setGoal] = useState<{ goal: string; targetDate: string } | null>(null);
  const [hasGoal, setHasGoal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Identity timer state
  const [identityProgress, setIdentityProgress] = useState(0);
  const [canContinueIdentity, setCanContinueIdentity] = useState(false);

  // Goal timer state
  const [goalProgress, setGoalProgress] = useState(0);
  const [canContinueGoal, setCanContinueGoal] = useState(false);

  const [isNavigating, setIsNavigating] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioStarted = useRef(false);
  const hasAutoAdvancedIdentity = useRef(false);
  const identityStartTime = useRef<number | null>(null);
  const goalStartTime = useRef<number | null>(null);

  // Configurable durations with defaults
  const identityUnlockDuration = (config.identityUnlockDuration as number) || 10;
  const identityAutoContinueDuration = (config.identityAutoContinueDuration as number) || 20;
  const goalDuration = (config.goalDuration as number) || 20;

  // Fade in audio
  const fadeInAudio = useCallback((audio: HTMLAudioElement, targetVolume: number = 0.7, fadeDuration: number = 2000) => {
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
  }, []);

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

  // Finish and complete step (defined before goToGoalSlide since it may call this)
  const finishManifest = useCallback(async () => {
    if (isNavigating) return;

    setIsNavigating(true);

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    // Fade out audio
    if (audioRef.current) {
      fadeOutAudio(audioRef.current);
    }

    // Update check-in
    await fetch('/api/checkin/morning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifestGoalCompleted: true }),
    });

    onComplete();
  }, [isNavigating, fadeOutAudio, onComplete]);

  // Move to goal slide - NO audio changes here
  const goToGoalSlide = useCallback(async () => {
    if (currentSlide === 'goal' || hasAutoAdvancedIdentity.current) return;

    hasAutoAdvancedIdentity.current = true;

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

    // If goal shouldn't be shown, complete the step instead
    if (!hasGoal) {
      finishManifest();
      return;
    }

    setCurrentSlide('goal');
    goalStartTime.current = Date.now();
  }, [currentSlide, hasGoal, finishManifest]);

  // Config settings (default to true for backwards compatibility)
  const showIdentityConfig = config.showIdentity !== false;
  const showGoalConfig = config.showGoal !== false;

  // Fetch user data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/user/me');
        const data = await response.json();

        // Check if user has identity AND config allows showing it
        const userHasIdentity = !!data.user?.identity;
        const shouldShowIdentity = showIdentityConfig && userHasIdentity;
        
        if (shouldShowIdentity) {
          setIdentity(data.user.identity);
          setHasIdentity(true);
        } else {
          // Either config disabled identity or user doesn't have one
          setHasIdentity(false);
        }

        // Check if user has goal
        let userGoal = null;
        if (data.goal) {
          userGoal = {
            goal: data.goal.goal,
            targetDate: data.goal.targetDate,
          };
        } else if (data.user?.goal) {
          userGoal = {
            goal: data.user.goal,
            targetDate: data.user.goalTargetDate || '',
          };
        }

        const shouldShowGoal = showGoalConfig && !!userGoal;

        if (shouldShowGoal && userGoal) {
          setGoal(userGoal);
          setHasGoal(true);
        } else {
          setHasGoal(false);
        }

        // Determine what to show
        if (!shouldShowIdentity && !shouldShowGoal) {
          // Nothing to show - complete immediately
          setIsLoading(false);
          onComplete();
          return;
        } else if (!shouldShowIdentity) {
          // Skip identity, go to goal
          setCurrentSlide('goal');
          goalStartTime.current = Date.now();
          hasAutoAdvancedIdentity.current = true;
        } else if (!shouldShowGoal) {
          // Show identity only, will complete after identity
          // Goal slide will complete immediately when reached
        }
        // else: show both (identity first, then goal)
      } catch (error) {
        console.error('Error fetching data:', error);
        // On error, complete immediately
        onComplete();
        return;
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [showIdentityConfig, showGoalConfig, onComplete]);

  // Audio playback - separate effect, runs ONCE when loaded
  useEffect(() => {
    if (isLoading || audioStarted.current) return;

    audioStarted.current = true;

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
  }, [isLoading, fadeInAudio]);

  // Timer logic - separate from audio
  useEffect(() => {
    if (isLoading) return;

    // Initialize identity start time only if we have identity
    if (hasIdentity && !identityStartTime.current) {
      identityStartTime.current = Date.now();
    }

    // Clear any existing interval
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressInterval.current = setInterval(() => {
      const now = Date.now();

      if (currentSlide === 'identity' && identityStartTime.current && hasIdentity) {
        const elapsed = now - identityStartTime.current;
        const seconds = elapsed / 1000;

        const newProgress = Math.min(100, (seconds / identityUnlockDuration) * 100);
        setIdentityProgress(newProgress);

        if (seconds >= identityUnlockDuration) {
          setCanContinueIdentity(true);
        }

        if (seconds >= identityAutoContinueDuration && !hasAutoAdvancedIdentity.current) {
          goToGoalSlide();
        }
      } else if (currentSlide === 'goal' && goalStartTime.current) {
        const elapsed = now - goalStartTime.current;
        const newProgress = Math.min(100, (elapsed / (goalDuration * 1000)) * 100);
        setGoalProgress(newProgress);

        if (elapsed >= goalDuration * 1000) {
          setCanContinueGoal(true);
        }
      }
    }, 100);

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [isLoading, hasIdentity, currentSlide, goToGoalSlide, identityUnlockDuration, identityAutoContinueDuration, goalDuration]);

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

  const handleContinue = () => {
    if (currentSlide === 'identity' && hasIdentity) {
      if (!canContinueIdentity) return;
      goToGoalSlide();
    } else {
      if (!canContinueGoal || isNavigating) return;
      finishManifest();
    }
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

  const canContinue = (currentSlide === 'identity' && hasIdentity) ? canContinueIdentity : canContinueGoal;

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full h-full relative">
        <div className="w-full h-full animate-page-fade-in">
          {/* Audio element */}
          <audio ref={audioRef} loop src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/audio%2Fmanifest%20(1).mp3?alt=media&token=84b6136a-ba75-42ee-9941-261cf3ebbd6c" id="manifest-audio" />

          {/* Instagram story-style progress indicators */}
          <div className="absolute top-[20px] left-[20px] right-[20px] z-50 flex gap-2">
            {/* Identity progress bar - only show if user has identity */}
            {hasIdentity && (
              <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white/70"
                  initial={{ width: 0 }}
                  animate={{ width: currentSlide === 'identity' ? `${identityProgress}%` : '100%' }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}
            {/* Goal progress bar - only show if goal should be shown */}
            {hasGoal && (
              <div className="flex-1 h-[3px] bg-white/20 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white/70"
                  initial={{ width: 0 }}
                  animate={{ width: currentSlide === 'goal' ? `${goalProgress}%` : '0%' }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}
          </div>

          {/* Animated background gradient */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
              style={{
                background: (currentSlide === 'identity' && hasIdentity)
                  ? 'linear-gradient(180deg, #B8D4D4 0%, #D4B8C8 50%, #E8C8B8 100%)'
                  : 'linear-gradient(180deg, #E066FF 0%, #9933FF 50%, #6600CC 100%)'
              }}
            />
          </AnimatePresence>

          {/* Decorative elements */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Pulsing circles */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="absolute w-[320px] h-[320px] md:w-[450px] md:h-[450px] rounded-full border"
                style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)' }}
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
              <motion.div
                className="absolute w-[380px] h-[380px] md:w-[520px] md:h-[520px] rounded-full border"
                style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)' }}
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
              <motion.div
                className="absolute w-[440px] h-[440px] md:w-[600px] md:h-[600px] rounded-full border"
                style={{ borderColor: (currentSlide === 'identity' && hasIdentity) ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)' }}
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

            {/* Floating orbs for goal slide */}
            {currentSlide === 'goal' && (
              <>
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
              </>
            )}
          </div>

          {/* Content slides */}
          <div className="h-full flex flex-col items-center justify-center px-8 relative z-10">
            <AnimatePresence mode="wait">
              {currentSlide === 'identity' && hasIdentity ? (
                <motion.div
                  key="identity"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="text-center max-w-[500px]"
                >
                  <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-[#1a1a1a] tracking-[-2px] leading-[1.2]">
                    I am {identity}
                  </h1>
                </motion.div>
              ) : (
                <motion.div
                  key="goal"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="text-center max-w-[500px]"
                >
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="font-albert text-[20px] md:text-[24px] text-white/70 tracking-[-1px] leading-[1.2] mb-4"
                  >
                    I want to
                  </motion.p>

                  {goal ? (
                    <>
                      <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2] capitalize">
                        {goal.goal}
                      </h1>

                      {goal.targetDate && (
                        <p className="mt-4 font-sans text-[16px] md:text-[18px] text-white/60 tracking-[-0.4px]">
                          by {formatTargetDate(goal.targetDate)}
                        </p>
                      )}
                    </>
                  ) : (
                    <h1 className="font-albert text-[42px] md:text-[56px] font-medium text-white tracking-[-2px] leading-[1.2]">
                      Set your goal
                    </h1>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Continue button */}
          <div className="absolute bottom-[40px] left-0 right-0 px-6 z-50">
            <button
              onClick={handleContinue}
              disabled={!canContinue || isNavigating}
              className="w-full max-w-[400px] mx-auto block py-4 md:py-5 rounded-full font-sans text-[16px] md:text-[18px] font-bold tracking-[-0.5px] border transition-all shadow-[0px_8px_30px_0px_rgba(0,0,0,0.2)] cursor-pointer disabled:cursor-not-allowed"
              style={{
                backgroundColor: (currentSlide === 'identity' && hasIdentity)
                  ? canContinue ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'
                  : canContinue && !isNavigating ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                color: (currentSlide === 'identity' && hasIdentity)
                  ? canContinue ? '#2c2520' : 'rgba(255,255,255,0.4)'
                  : canContinue && !isNavigating ? '#ffffff' : 'rgba(255,255,255,0.4)',
                borderColor: canContinue ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)',
              }}
            >
              {isNavigating ? 'Continuing...' : 'Continue'}
            </button>
          </div>

          {/* Tap zones for navigation (like Instagram stories) */}
          <div className="absolute inset-0 flex z-20 pointer-events-none">
            {/* Left tap zone - go back (only on goal AND if user has identity to go back to) */}
            {currentSlide === 'goal' && hasIdentity && (
              <button
                onClick={() => {
                  setCurrentSlide('identity');
                  goalStartTime.current = null;
                  setGoalProgress(0);
                  setCanContinueGoal(false);
                  hasAutoAdvancedIdentity.current = false;
                }}
                className="w-1/4 h-full pointer-events-auto"
                aria-label="Previous"
              />
            )}
            <div className="flex-1" />
            {/* Right tap zone - go forward (only on identity when can continue) */}
            {currentSlide === 'identity' && canContinueIdentity && hasIdentity && (
              <button
                onClick={goToGoalSlide}
                className="w-1/4 h-full pointer-events-auto"
                aria-label="Next"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
