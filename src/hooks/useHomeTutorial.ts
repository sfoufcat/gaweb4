'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface TutorialStep {
  id: string;
  target: string; // CSS selector e.g. [data-tour="profile-header"]
  title: string;
  body: string;
  position?: 'top' | 'bottom' | 'left' | 'right'; // Preferred tooltip position
}

export interface UseHomeTutorialReturn {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  completeTutorial: () => Promise<void>;
  exitTutorial: () => Promise<void>;
  hasCompletedTutorial: boolean;
  isLoading: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_COMPLETED = 'ga_home_tutorial_completed';
const STORAGE_KEY_STEP = 'ga_home_tutorial_step';

/**
 * Check if current time is within morning check-in window (7:00 - 12:00)
 */
function isWithinMorningCheckInWindow(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 12;
}

/**
 * Generate the final step body based on time of day
 */
function getFinalStepBody(): string {
  if (isWithinMorningCheckInWindow()) {
    return 'Complete your morning check-in to start day one of your program.';
  }
  return 'Your starter program begins with tomorrow\'s morning check-in. For now add your habits and join a squad so you are ready.';
}

/**
 * Tutorial steps configuration
 */
function getTutorialSteps(): TutorialStep[] {
  return [
    {
      id: 'profile',
      target: '[data-tour="profile-header"]',
      title: 'Your profile',
      body: 'Tap here to view and edit your profile. Use the avatar to see your current status.',
      position: 'bottom',
    },
    {
      id: 'streak',
      target: '[data-tour="streak"]',
      title: 'Alignment score and streak',
      body: 'Keep your streak by checking in, having an active goal, adding tasks and showing up in your squad chat.',
      position: 'bottom',
    },
    {
      id: 'dynamic',
      target: '[data-tour="dynamic-section"]',
      title: 'Daily updates',
      body: 'Here you see check-in prompts, your main goal and short tips for the day.',
      position: 'bottom',
    },
    {
      id: 'daily-focus',
      target: '[data-tour="daily-focus"]',
      title: 'Daily Focus',
      body: 'Add, edit and complete up to three key tasks for today. Use the assistant below if you want help with a task.',
      position: 'top',
    },
    {
      id: 'habits',
      target: '[data-tour="habits"]',
      title: 'Habits',
      body: 'Track repeatable actions you want to stick with. The number on the right shows how many times you have done each habit. Habits do not affect your streak yet.',
      position: 'top',
    },
    {
      id: 'squad',
      target: '[data-tour="my-squad"]',
      title: 'Your squad',
      body: 'Join or visit your squad here. This is where you share wins, ask for help and stay accountable with others on your track.',
      position: 'top',
    },
    {
      id: 'ready',
      target: '[data-tour="daily-focus"]', // Re-use daily focus as anchor for final step
      title: 'You are ready to start',
      body: getFinalStepBody(),
      position: 'top',
    },
  ];
}

// ============================================================================
// HOOK
// ============================================================================

interface UseHomeTutorialOptions {
  userId?: string;
  hasCompletedTutorialFromServer?: boolean;
  hasTrack?: boolean;
  isAuthenticated?: boolean;
  serverDataLoaded?: boolean; // Prevents auto-start until server response is received
}

export function useHomeTutorial(options: UseHomeTutorialOptions = {}): UseHomeTutorialReturn {
  const { 
    userId, 
    hasCompletedTutorialFromServer = false,
    hasTrack = false,
    isAuthenticated = false,
    serverDataLoaded = false,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(hasCompletedTutorialFromServer);
  const [isLoading, setIsLoading] = useState(true);

  const steps = useMemo(() => getTutorialSteps(), []);

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check localStorage for completion status
    const completedInStorage = localStorage.getItem(STORAGE_KEY_COMPLETED) === 'true';
    if (completedInStorage || hasCompletedTutorialFromServer) {
      setHasCompletedTutorial(true);
      setIsLoading(false);
      return;
    }

    // Check for saved step index (resume tutorial)
    const savedStep = localStorage.getItem(STORAGE_KEY_STEP);
    if (savedStep) {
      const stepIndex = parseInt(savedStep, 10);
      if (!isNaN(stepIndex) && stepIndex >= 0 && stepIndex < steps.length) {
        setCurrentStepIndex(stepIndex);
      }
    }

    setIsLoading(false);
  }, [hasCompletedTutorialFromServer, steps.length]);

  // Update from server data when it changes
  useEffect(() => {
    if (hasCompletedTutorialFromServer) {
      setHasCompletedTutorial(true);
      // Also sync to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
      }
    }
  }, [hasCompletedTutorialFromServer]);

  // Auto-start tutorial when conditions are met
  useEffect(() => {
    if (isLoading) return;
    if (!serverDataLoaded) return; // Wait for server data before deciding
    if (!isAuthenticated) return;
    if (hasCompletedTutorial) return;
    if (!hasTrack) return; // Wait for track to be set up

    // All conditions met - start tutorial
    setIsActive(true);
  }, [isLoading, serverDataLoaded, isAuthenticated, hasCompletedTutorial, hasTrack]);

  // Save step index to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isActive && !hasCompletedTutorial) {
      localStorage.setItem(STORAGE_KEY_STEP, currentStepIndex.toString());
    }
  }, [currentStepIndex, isActive, hasCompletedTutorial]);

  // Lock body scroll when tutorial is active
  useEffect(() => {
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isActive]);

  const startTutorial = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const markTutorialComplete = useCallback(async () => {
    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COMPLETED, 'true');
      localStorage.removeItem(STORAGE_KEY_STEP);
    }

    // Update state
    setHasCompletedTutorial(true);
    setIsActive(false);

    // Update server
    if (userId) {
      try {
        await fetch('/api/user/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hasCompletedHomeTutorial: true }),
        });
      } catch (error) {
        console.error('[HomeTutorial] Failed to update server:', error);
        // Still considered complete locally
      }
    }
  }, [userId]);

  const completeTutorial = useCallback(async () => {
    await markTutorialComplete();
  }, [markTutorialComplete]);

  const exitTutorial = useCallback(async () => {
    // Exit is same as complete - mark as done
    await markTutorialComplete();
  }, [markTutorialComplete]);

  const currentStep = isActive && currentStepIndex < steps.length 
    ? steps[currentStepIndex] 
    : null;

  return {
    isActive,
    currentStepIndex,
    currentStep,
    totalSteps: steps.length,
    startTutorial,
    nextStep,
    prevStep,
    completeTutorial,
    exitTutorial,
    hasCompletedTutorial,
    isLoading,
  };
}

