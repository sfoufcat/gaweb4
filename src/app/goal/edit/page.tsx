'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

export default function EditGoalPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  
  // Form state
  const [goalTitle, setGoalTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [displayProgress, setDisplayProgress] = useState(50);
  
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
  
  // Play tick sound
  const playTickSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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

  // Fetch current goal data
  useEffect(() => {
    async function fetchGoal() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          if (data.goal) {
            setGoalTitle(data.goal.goal);
            setTargetDate(data.goal.targetDate);
            const initialProgress = data.user?.goalProgress || data.goal.progress?.percentage || 0;
            setDisplayProgress(initialProgress);
            progressRef.current = initialProgress;
            lastTickValue.current = Math.round(initialProgress / 5) * 5;
          }
        }
      } catch (error) {
        console.error('Failed to fetch goal:', error);
      } finally {
        setLoading(false);
      }
    }

    if (isLoaded) {
      fetchGoal();
    }
  }, [user, isLoaded]);

  // Smooth momentum animation - faster and more responsive
  const applyMomentum = useCallback((initialVelocity: number) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    let velocity = initialVelocity;
    const friction = 0.88; // Lower = stops faster
    const minVelocity = 0.3;

    const animate = () => {
      velocity *= friction;
      
      if (Math.abs(velocity) < minVelocity) {
        // Snap to nearest 5
        const snapped = Math.round(progressRef.current / 5) * 5;
        progressRef.current = snapped;
        setDisplayProgress(snapped);
        animationRef.current = null;
        return;
      }

      // Update progress (reversed: positive velocity decreases value)
      // Higher multiplier = faster movement
      const delta = velocity * 0.25;
      let newProgress = progressRef.current - delta;
      newProgress = Math.max(0, Math.min(100, newProgress));
      
      progressRef.current = newProgress;
      setDisplayProgress(newProgress);
      
      // Play tick when crossing a 5% boundary
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
      // Higher multiplier for more dramatic throw effect
      applyMomentum(velocity * 4);
    }
  }, [isDragging, applyMomentum]);

  // Event handlers
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

  // Check if progress is at 100%
  const isProgressComplete = Math.round(displayProgress / 5) * 5 === 100;

  // Save/Archive handlers
  const handleSave = async () => {
    if (!goalTitle.trim() || !targetDate) return;

    const finalProgress = Math.round(displayProgress / 5) * 5;
    
    // If progress is 100%, show confirmation modal
    if (finalProgress === 100) {
      setShowCompleteModal(true);
      return;
    }

    await saveGoal(finalProgress);
  };

  const saveGoal = async (finalProgress: number) => {
    setSaving(true);

    try {
      const response = await fetch('/api/goal/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalTitle.trim(),
          targetDate,
          progress: finalProgress,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // If goal was completed, redirect to accomplished goals
        if (data.completed) {
          router.push('/goal/accomplished');
        } else {
          router.push('/goal');
        }
      }
    } catch (error) {
      console.error('Error saving goal:', error);
    } finally {
      setSaving(false);
      setShowCompleteModal(false);
    }
  };

  const handleConfirmComplete = async () => {
    await saveGoal(100);
  };

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this goal?')) return;

    setArchiving(true);

    try {
      const response = await fetch('/api/goal/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        router.push('/');
      }
    } catch (error) {
      console.error('Error archiving goal:', error);
    } finally {
      setArchiving(false);
    }
  };

  // Scale values and positions
  const allValues = Array.from({ length: 21 }, (_, i) => i * 5);
  const ITEM_WIDTH = 50; // Width of each scale item in pixels
  const centerOffset = displayProgress / 5 * ITEM_WIDTH;

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {/* Header */}
      <div className="py-5 mb-6">
        <div className="flex lg:hidden items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f3f1ef] transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5 text-text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
            Edit my goal
          </h1>
        </div>
        <h1 className="hidden lg:block font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2]">
          Edit my goal
        </h1>
      </div>

      {/* Form */}
      <div className="space-y-12">
        {/* Goal Title */}
        <div>
          <label className="block font-sans text-[24px] text-text-secondary tracking-[-0.5px] leading-[1.2] mb-1">
            I want to:
          </label>
          <input
            type="text"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Enter your goal..."
            className="w-full font-sans text-[24px] text-text-primary tracking-[-0.5px] leading-[1.2] bg-transparent border-none outline-none placeholder:text-text-muted"
          />
        </div>

        {/* Target Date */}
        <div>
          <label className="block font-sans text-[24px] text-text-secondary tracking-[-0.5px] leading-[1.2] mb-1">
            Complete by:
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="font-sans text-[24px] text-text-primary tracking-[-0.5px] leading-[1.2] bg-transparent border-none outline-none cursor-pointer"
            style={{ colorScheme: 'light' }}
          />
        </div>

        {/* Progress Slider */}
        <div>
          <h2 className="font-albert text-[24px] font-medium text-text-primary tracking-[-1.5px] leading-[1.3] mb-8">
            Progress so far, %
          </h2>
          
          {/* Current Value */}
          <div className="text-center mb-6">
            <span className="font-albert font-medium text-[56px] text-text-primary tracking-[-2px]">
              {Math.round(displayProgress / 5) * 5}
            </span>
          </div>
          
          {/* Slider Track */}
          <div 
            ref={sliderRef}
            className={`relative h-16 overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
                    <span className="font-sans text-[14px] text-text-muted mb-2">
                      {value}
                    </span>
                    <div 
                      className={`rounded-full transition-all duration-100 ${
                        isSelected 
                          ? 'h-10 w-[3px] bg-text-primary' 
                          : 'h-5 w-[2px] bg-text-muted'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          
          <p className="text-center text-[14px] text-text-muted mt-4">
            Flick left or right
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-16 space-y-3">
        <button
          onClick={handleSave}
          disabled={saving || !goalTitle.trim() || !targetDate}
          className={`w-full py-4 text-white rounded-[32px] font-sans font-bold text-[16px] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 ${
            isProgressComplete 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
              : 'bg-button-primary dark:bg-[#b8896a]'
          }`}
        >
          {saving ? 'Saving...' : isProgressComplete ? '🎉 Mark as Complete' : 'Update'}
        </button>

        <button
          onClick={handleArchive}
          disabled={archiving}
          className="w-full py-4 bg-white dark:bg-[#1e222a] border border-border-secondary dark:border-[#262b35] rounded-[32px] font-sans font-bold text-[16px] text-button-primary dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50"
        >
          {archiving ? 'Archiving...' : 'Archive'}
        </button>
      </div>

      {/* Goal Complete Confirmation Modal */}
      <Transition appear show={showCompleteModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowCompleteModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-[24px] bg-white dark:bg-[#171b22] p-6 text-left align-middle shadow-xl transition-all">
                  {/* Trophy Icon */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                      <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.927 0" />
                      </svg>
                    </div>
                  </div>

                  <Dialog.Title
                    as="h3"
                    className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center leading-[1.3] mb-2"
                  >
                    Congratulations! 🎉
                  </Dialog.Title>
                  
                  <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] text-center leading-[1.4] mb-6">
                    You&apos;re marking this goal as <span className="font-semibold text-text-primary dark:text-[#f5f5f8]">100% complete</span>. 
                    This will move your goal to &quot;Accomplished Goals&quot;.
                  </p>

                  <div className="space-y-3">
                    <button
                      type="button"
                      className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[32px] font-sans font-bold text-[16px] tracking-[-0.5px] shadow-[0px_5px_15px_0px_rgba(0,0,0,0.2)] hover:scale-[1.02] transition-transform disabled:opacity-50"
                      onClick={handleConfirmComplete}
                      disabled={saving}
                    >
                      {saving ? 'Completing...' : 'Yes, complete this goal!'}
                    </button>
                    <button
                      type="button"
                      className="w-full py-4 bg-white dark:bg-[#1e222a] border border-border-secondary dark:border-[#262b35] rounded-[32px] font-sans font-bold text-[16px] text-text-secondary dark:text-[#b2b6c2] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                      onClick={() => setShowCompleteModal(false)}
                    >
                      Not yet
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
