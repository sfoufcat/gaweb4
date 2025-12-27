import { useState, useEffect, useCallback } from 'react';
import type { MorningCheckIn, EmotionalState, CheckInProgress, MorningCheckInFlowStep } from '@/types';

interface UseMorningCheckInReturn {
  // Today's check-in status
  todayCheckIn: MorningCheckIn | null;
  isCheckInCompleted: boolean;
  isMorningWindow: boolean;
  shouldShowCheckIn: boolean;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Progress tracking
  progress: CheckInProgress;
  setProgress: (progress: CheckInProgress) => void;
  
  // Actions
  startCheckIn: () => Promise<MorningCheckIn | null>;
  updateCheckIn: (updates: Partial<MorningCheckIn>) => Promise<MorningCheckIn | null>;
  completeCheckIn: () => Promise<MorningCheckIn | null>;
  reframeThought: (thought: string) => Promise<string | null>;
  
  // Helpers
  getNextStep: (currentState: EmotionalState) => MorningCheckInFlowStep;
  shouldSkipReframe: (state: EmotionalState) => boolean;
}

export function useMorningCheckIn(): UseMorningCheckInReturn {
  const [todayCheckIn, setTodayCheckIn] = useState<MorningCheckIn | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CheckInProgress>({
    currentStep: 'start',
  });

  // Check if current time is within morning window (7 AM - 12 PM)
  const isMorningWindow = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 7 && hour < 12;
  }, []);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Fetch today's check-in status
  const fetchTodayCheckIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const today = getTodayDate();
      const response = await fetch(`/api/checkin/morning?date=${today}`);
      const data = await response.json();
      
      if (response.ok && data.checkIn) {
        setTodayCheckIn(data.checkIn);
        // Restore progress if check-in exists but not completed
        if (data.checkIn && !data.checkIn.completedAt) {
          setProgress({
            currentStep: 'start',
            emotionalState: data.checkIn.emotionalState,
            userThought: data.checkIn.userThought,
            aiReframe: data.checkIn.aiReframe,
            manifestIdentityCompleted: data.checkIn.manifestIdentityCompleted,
            manifestGoalCompleted: data.checkIn.manifestGoalCompleted,
          });
        }
      } else {
        setTodayCheckIn(null);
      }
    } catch (err: unknown) {
      console.error('Error fetching check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch check-in status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayCheckIn();
  }, [fetchTodayCheckIn]);

  // Start a new check-in
  const startCheckIn = useCallback(async (): Promise<MorningCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/morning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start check-in');
      }
      
      setTodayCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err: unknown) {
      console.error('Error starting check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to start check-in');
      return null;
    }
  }, []);

  // Update check-in progress
  const updateCheckIn = useCallback(async (updates: Partial<MorningCheckIn>): Promise<MorningCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update check-in');
      }
      
      setTodayCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err: unknown) {
      console.error('Error updating check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to update check-in');
      return null;
    }
  }, []);

  // Complete the check-in
  const completeCheckIn = useCallback(async (): Promise<MorningCheckIn | null> => {
    try {
      const response = await fetch('/api/checkin/morning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          completedAt: new Date().toISOString(),
          tasksPlanned: true,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete check-in');
      }
      
      setTodayCheckIn(data.checkIn);
      return data.checkIn;
    } catch (err: unknown) {
      console.error('Error completing check-in:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete check-in');
      return null;
    }
  }, []);

  // Reframe thought using AI
  const reframeThought = useCallback(async (thought: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/checkin/reframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thought }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reframe thought');
      }
      
      // Also save to check-in
      await updateCheckIn({
        userThought: thought,
        aiReframe: data.reframe,
      });
      
      return data.reframe;
    } catch (err: unknown) {
      console.error('Error reframing thought:', err);
      setError(err instanceof Error ? err.message : 'Failed to reframe thought');
      return null;
    }
  }, [updateCheckIn]);

  // Determine if user should skip reframe flow (confident/energized)
  const shouldSkipReframe = useCallback((state: EmotionalState): boolean => {
    return state === 'confident' || state === 'energized';
  }, []);

  // Get next step based on emotional state
  const getNextStep = useCallback((currentState: EmotionalState): MorningCheckInFlowStep => {
    if (shouldSkipReframe(currentState)) {
      return 'manifest-identity';
    }
    return 'accept';
  }, [shouldSkipReframe]);

  // Computed values
  const isCheckInCompleted = !!todayCheckIn?.completedAt;
  const shouldShowCheckIn = isMorningWindow() && !isCheckInCompleted;

  return {
    todayCheckIn,
    isCheckInCompleted,
    isMorningWindow: isMorningWindow(),
    shouldShowCheckIn,
    isLoading,
    error,
    progress,
    setProgress,
    startCheckIn,
    updateCheckIn,
    completeCheckIn,
    reframeThought,
    getNextStep,
    shouldSkipReframe,
  };
}

