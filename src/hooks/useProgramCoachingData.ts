import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import type { ClientCoachingData, Coach, CoachCallSettings, UserCallCredits } from '@/types';

interface CoachInfo {
  id: string;
  name: string;
  imageUrl: string;
  email?: string;
}

interface NextCallInfo {
  datetime: string | null;
  timezone: string;
  location: string;
  title?: string;
}

interface CallCreditsInfo {
  creditsRemaining: number;
  monthlyAllowance: number;
  creditsUsedThisMonth: number;
}

interface UseProgramCoachingDataReturn {
  /** Full coaching data including action items, focus areas, etc. */
  coachingData: ClientCoachingData | null;
  /** Coach information */
  coach: CoachInfo | null;
  /** Next scheduled call */
  nextCall: NextCallInfo | null;
  /** Chat channel ID for 1:1 coaching chat */
  chatChannelId: string | null;
  /** Call credits info (if using credit system) */
  callCredits: CallCreditsInfo | null;
  /** Call settings (pricing, allowed requests, etc.) */
  callSettings: CoachCallSettings | null;
  /** Whether user has an active individual program enrollment */
  hasActiveEnrollment: boolean;
  /** Whether coaching data exists */
  hasCoachingData: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refetch data */
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch coaching data for users enrolled in individual programs
 * 
 * Returns:
 * - coachingData: Full coaching data including nextCall, focus areas, etc.
 * - coach: Coach info (name, image)
 * - nextCall: Next scheduled call info
 * - chatChannelId: Chat channel ID for navigating to coaching chat
 * - callCredits: Call credits remaining (if using credit system)
 * - callSettings: Coach's call settings (pricing, etc.)
 * 
 * This is specifically for the Program page to show scheduling info
 */
export function useProgramCoachingData(): UseProgramCoachingDataReturn {
  const { user, isLoaded } = useUser();
  
  const [coachingData, setCoachingData] = useState<ClientCoachingData | null>(null);
  const [coach, setCoach] = useState<CoachInfo | null>(null);
  const [callCredits, setCallCredits] = useState<CallCreditsInfo | null>(null);
  const [callSettings, setCallSettings] = useState<CoachCallSettings | null>(null);
  const [hasActiveEnrollment, setHasActiveEnrollment] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isLoaded || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch coaching promo data (includes enrollment status, chatChannelId, coach info)
      const promoResponse = await fetch('/api/user/org-coaching-promo');
      if (!promoResponse.ok) {
        throw new Error('Failed to fetch coaching promo data');
      }
      const promoData = await promoResponse.json();
      
      setHasActiveEnrollment(promoData.hasActiveIndividualEnrollment || false);
      
      // If user has active enrollment, fetch full coaching data
      // Note: chatChannelId may not exist if coach hasn't started a chat yet
      if (promoData.hasActiveIndividualEnrollment) {
        // Set coach info from promo data
        if (promoData.coachInfo) {
          setCoach({
            id: '', // Will be filled from coaching data
            name: promoData.coachInfo.name,
            imageUrl: promoData.coachInfo.imageUrl,
          });
        }

        // Fetch full coaching data (nextCall, focus areas, etc.)
        try {
          const coachingResponse = await fetch('/api/coaching/data');
          if (coachingResponse.ok) {
            const coachingResult = await coachingResponse.json();
            if (coachingResult.exists && coachingResult.data) {
              setCoachingData(coachingResult.data);
              
              // Update coach with full info if available
              if (coachingResult.coach) {
                setCoach({
                  id: coachingResult.coach.id || coachingResult.data.coachId,
                  name: coachingResult.coach.name || promoData.coachInfo?.name || 'Coach',
                  imageUrl: coachingResult.coach.imageUrl || promoData.coachInfo?.imageUrl || '',
                  email: coachingResult.coach.email,
                });
              }
            }
          }
        } catch (coachingErr) {
          console.warn('[useProgramCoachingData] Could not fetch coaching data:', coachingErr);
          // Don't fail - we still have promo data
        }

        // Fetch call credits
        try {
          const creditsResponse = await fetch('/api/scheduling/credits');
          if (creditsResponse.ok) {
            const creditsResult = await creditsResponse.json();
            if (creditsResult.credits) {
              setCallCredits({
                creditsRemaining: creditsResult.credits.creditsRemaining,
                monthlyAllowance: creditsResult.credits.monthlyAllowance,
                creditsUsedThisMonth: creditsResult.credits.creditsUsedThisMonth,
              });
            }
          }
        } catch (creditsErr) {
          console.warn('[useProgramCoachingData] Could not fetch call credits:', creditsErr);
          // Don't fail - credits are optional
        }

        // Fetch call settings
        try {
          const settingsResponse = await fetch('/api/scheduling/call-settings');
          if (settingsResponse.ok) {
            const settingsResult = await settingsResponse.json();
            if (settingsResult.settings) {
              setCallSettings(settingsResult.settings);
            }
          }
        } catch (settingsErr) {
          console.warn('[useProgramCoachingData] Could not fetch call settings:', settingsErr);
          // Don't fail - settings are optional
        }
      }
    } catch (err) {
      console.error('[useProgramCoachingData] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load coaching data');
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive nextCall from coachingData
  const nextCall: NextCallInfo | null = coachingData?.nextCall?.datetime
    ? {
        datetime: coachingData.nextCall.datetime,
        timezone: coachingData.nextCall.timezone || 'America/New_York',
        location: coachingData.nextCall.location || 'Chat',
        title: coachingData.nextCall.title,
      }
    : null;

  return {
    coachingData,
    coach,
    nextCall,
    chatChannelId: coachingData?.chatChannelId || null,
    callCredits,
    callSettings,
    hasActiveEnrollment,
    hasCoachingData: !!coachingData,
    isLoading: !isLoaded || isLoading,
    error,
    refetch: fetchData,
  };
}

