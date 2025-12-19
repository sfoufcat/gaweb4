'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { useWeeklyReflection } from '@/hooks/useWeeklyReflection';
import { format } from 'date-fns';

export default function WeeklyEvaluatePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { checkIn, isLoading, updateProgress } = useWeeklyReflection();
  
  const [displayProgress, setDisplayProgress] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [goalData, setGoalData] = useState<{ goal: string; targetDate: string } | null>(null);
  
  // Slider momentum state
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const velocityRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const progressRef = useRef(50);
  
  // Audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickValue = useRef(50);

  // Fetch goal data
  useEffect(() => {
    async function fetchGoal() {
      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          if (data.goal) {
            setGoalData({
              goal: data.goal.goal,
              targetDate: data.goal.targetDate,
            });
          }
          const initialProgress = data.user?.goalProgress || data.goal?.progress?.percentage || 0;
          setDisplayProgress(initialProgress);
          progressRef.current = initialProgress;
          lastTickValue.current = Math.round(initialProgress / 5) * 5;
        }
      } catch (error) {
        console.error('Failed to fetch goal:', error);
      }
    }

    if (isLoaded && user) {
      fetchGoal();
    }
  }, [isLoaded, user]);

  // Initialize with check-in data
  useEffect(() => {
    if (checkIn?.progress !== undefined) {
      setDisplayProgress(checkIn.progress);
      progressRef.current = checkIn.progress;
      lastTickValue.current = Math.round(checkIn.progress / 5) * 5;
    }
  }, [checkIn]);

  // Play tick sound
  const playTickSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 1200 + Math.random() * 200;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.06, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.025);
    } catch (_e) {
      // Audio not supported
    }
  }, []);

  // Smooth momentum animation
  const applyMomentum = useCallback((initialVelocity: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    let velocity = initialVelocity;
    const friction = 0.88;
    const minVelocity = 0.3;

    const animate = () => {
      velocity *= friction;
      
      if (Math.abs(velocity) < minVelocity) {
        const snapped = Math.round(progressRef.current / 5) * 5;
        progressRef.current = snapped;
        setDisplayProgress(snapped);
        animationRef.current = null;
        return;
      }

      const delta = velocity * 0.25;
      let newProgress = progressRef.current - delta;
      newProgress = Math.max(0, Math.min(100, newProgress));
      
      progressRef.current = newProgress;
      setDisplayProgress(newProgress);
      
      const currentTick = Math.round(newProgress / 5) * 5;
      if (currentTick !== lastTickValue.current) {
        playTickSound();
        lastTickValue.current = currentTick;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [playTickSound]);

  // Drag handlers
  const handleDragStart = useCallback((clientX: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    setIsDragging(true);
    lastX.current = clientX;
    lastTime.current = performance.now();
    velocityRef.current = 0;
  }, []);

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging) return;
    
    const now = performance.now();
    const dt = now - lastTime.current;
    
    if (dt > 0) {
      const dx = clientX - lastX.current;
      velocityRef.current = velocityRef.current * 0.6 + (dx / dt * 16) * 0.4;
    }
    
    lastX.current = clientX;
    lastTime.current = now;
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    const velocity = velocityRef.current;
    if (Math.abs(velocity) > 0.3) {
      applyMomentum(velocity * 4);
    }
  }, [isDragging, applyMomentum]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  }, [handleDragStart]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  }, [handleDragStart]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleDragMove(e.touches[0].clientX);
    const onMouseUp = () => handleDragEnd();
    const onTouchEnd = () => handleDragEnd();

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', onTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaX || e.deltaY;
    applyMomentum(delta * 3);
  }, [applyMomentum]);

  const handleContinue = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const finalProgress = Math.round(displayProgress / 5) * 5;

    try {
      await updateProgress(finalProgress);
      
      // If progress is 100%, go to goal achieved screen
      if (finalProgress >= 100) {
        router.push('/checkin/weekly/finish?completed=true');
      } else {
        // Otherwise continue to reflection questions
        router.push('/checkin/weekly/went-well');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      setIsSubmitting(false);
    }
  };

  const finalProgress = Math.round(displayProgress / 5) * 5;
  const isGoalComplete = finalProgress >= 100;

  // Scale values and positions
  const allValues = Array.from({ length: 21 }, (_, i) => i * 5);
  const ITEM_WIDTH = 50;
  const centerOffset = displayProgress / 5 * ITEM_WIDTH;

  // Format the target date for display
  const formatTargetDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return `by ${format(date, 'MMMM d, yyyy')}`;
    } catch {
      return '';
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-[#faf8f6] flex items-center justify-center z-[9999]"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a1a1a]" />
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] bg-[#faf8f6] flex flex-col overflow-hidden"
    >
      {/* Header with back and close buttons */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <button
          onClick={() => router.push('/checkin/weekly/checkin')}
          className="p-2 -ml-2 text-[#1a1a1a] hover:text-[#5f5a55] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => router.push('/')}
          className="p-2 -mr-2 text-[#5f5a55] hover:text-[#1a1a1a] transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:items-center md:justify-center px-6 overflow-y-auto">
        <div className="w-full max-w-[400px] mx-auto flex-1 md:flex-initial flex flex-col">
          {/* Header */}
          <h1 className="font-albert text-[26px] md:text-[36px] text-[#1a1a1a] tracking-[-2px] leading-[1.2] mb-4 md:mb-6">
            How are you progressing toward your goal?
          </h1>

          {/* Goal Display Card - Rose/Pink gradient like Figma */}
          {goalData && (
            <div 
              className="rounded-[20px] p-6 md:p-7 mb-4 md:mb-6 text-center aspect-[5/3] md:aspect-auto flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, rgba(232, 218, 210, 0.9) 0%, rgba(218, 195, 185, 0.95) 100%)',
              }}
            >
              <p className="font-albert text-[24px] md:text-[36px] font-medium text-[#1a1a1a] tracking-[-1.5px] leading-[1.2] mb-2">
                {goalData.goal}
              </p>
              {goalData.targetDate && (
                <p className="font-sans text-[13px] md:text-[14px] text-[#5f5a55] tracking-[-0.3px] leading-[1.2]">
                  {formatTargetDate(goalData.targetDate)}
                </p>
              )}
            </div>
          )}

          {/* Progress Label */}
          <h2 className="font-sans text-[15px] md:text-[16px] text-[#5f5a55] tracking-[-0.3px] leading-[1.3] mb-2">
            Rate your progress, %
          </h2>
          
          {/* Current Value */}
          <div className="text-center mb-3 md:mb-4">
            <span className="font-albert font-medium text-[44px] md:text-[56px] text-[#1a1a1a] tracking-[-2px]">
              {Math.round(displayProgress / 5) * 5}
            </span>
          </div>
          
          {/* Slider Track */}
          <div 
            ref={sliderRef}
            className={`relative h-14 md:h-16 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onWheel={handleWheel}
          >
            {/* Scale strip - centered with transform */}
            <div 
              className="absolute top-0 h-full flex items-end"
              style={{
                left: '50%',
                transform: `translateX(calc(-50% - ${centerOffset - (ITEM_WIDTH * 10)}px))`,
                transition: isDragging ? 'none' : 'transform 0.05s ease-out',
              }}
            >
              {allValues.map((value) => {
                const distance = Math.abs(value - Math.round(displayProgress / 5) * 5);
                const isSelected = distance === 0;
                const opacity = Math.max(0.3, 1 - distance / 35);
                
                return (
                  <div
                    key={value}
                    className="flex flex-col items-center justify-end h-full"
                    style={{ 
                      width: `${ITEM_WIDTH}px`,
                      opacity,
                    }}
                  >
                    <span className="font-sans text-[13px] md:text-[14px] text-[#a7a39e] mb-2">
                      {value}
                    </span>
                    <div 
                      className={`rounded-full transition-all duration-100 ${
                        isSelected 
                          ? 'h-8 md:h-10 w-[3px] bg-[#1a1a1a]' 
                          : 'h-4 md:h-5 w-[2px] bg-[#a7a39e]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          
          <p className="text-center text-[13px] md:text-[14px] text-[#a7a39e] mt-3 md:mt-4">
            Flick left or right
          </p>

          {/* Spacer on mobile to push button down */}
          <div className="flex-1 md:hidden" />

          {/* Continue button */}
          <div className="mt-6 md:mt-10 pb-8 md:pb-0">
            <button
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full max-w-[400px] mx-auto block bg-[#2c2520] text-white py-4 rounded-full font-sans text-[16px] font-bold tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Loading...' : isGoalComplete ? 'Mark goal complete' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}



