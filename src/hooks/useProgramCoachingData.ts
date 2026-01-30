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
  eventId?: string;
  locationType?: string;
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
  // Next call from events collection (primary source)
  const [nextCall, setNextCall] = useState<NextCallInfo | null>(null);

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
      
      // If user has active enrollment, fetch all data in parallel
      if (promoData.hasActiveIndividualEnrollment) {
        // Set coach info from promo data immediately
        if (promoData.coachInfo) {
          setCoach({
            id: '',
            name: promoData.coachInfo.name,
            imageUrl: promoData.coachInfo.imageUrl,
          });
        }

        // Build events URL for upcoming calls (for nextCall display)
        const now = new Date();
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + 3);
        const upcomingEventsParams = new URLSearchParams({
          startDate: now.toISOString(),
          endDate: futureDate.toISOString(),
          types: 'coaching_1on1',
          status: 'confirmed',
          role: 'all',
        });

        // Build events URL for all calls this month (for credits calculation)
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        const monthEventsParams = new URLSearchParams({
          startDate: monthStart.toISOString(),
          endDate: monthEnd.toISOString(),
          types: 'coaching_1on1',
          status: 'confirmed',
          role: 'all',
        });

        // Fetch all data in parallel
        const [coachingRes, creditsRes, settingsRes, eventsRes, monthEventsRes] = await Promise.all([
          fetch('/api/coaching/data').catch(() => null),
          fetch('/api/scheduling/credits').catch(() => null),
          fetch('/api/scheduling/call-settings').catch(() => null),
          fetch(`/api/scheduling/events?${upcomingEventsParams}`).catch(() => null),
          fetch(`/api/scheduling/events?${monthEventsParams}`).catch(() => null),
        ]);

        // Process coaching data
        if (coachingRes?.ok) {
          const coachingResult = await coachingRes.json();
          if (coachingResult.exists && coachingResult.data) {
            setCoachingData(coachingResult.data);
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

        // Process settings
        if (settingsRes?.ok) {
          const settingsResult = await settingsRes.json();
          if (settingsResult.settings) {
            setCallSettings(settingsResult.settings);
          }
        }

        // Process upcoming events (for nextCall display)
        if (eventsRes?.ok) {
          const eventsResult = await eventsRes.json();
          const upcomingEvents = eventsResult.events || [];

          if (upcomingEvents.length > 0) {
            const nextEvent = upcomingEvents[0];
            setNextCall({
              datetime: nextEvent.startDateTime,
              timezone: nextEvent.timezone || 'America/New_York',
              location: nextEvent.locationType === 'chat' ? 'Chat' : (nextEvent.meetingLink || 'Online'),
              title: nextEvent.title,
              eventId: nextEvent.id,
              locationType: nextEvent.locationType,
            });
          }
        }

        // Count all calls this month (past + future)
        let callsThisMonth = 0;
        if (monthEventsRes?.ok) {
          const monthResult = await monthEventsRes.json();
          callsThisMonth = (monthResult.events || []).length;
        }

        // Process credits - calculate remaining based on all calls this month
        if (creditsRes?.ok) {
          const creditsResult = await creditsRes.json();
          if (creditsResult.credits) {
            const monthlyAllowance = creditsResult.credits.monthlyAllowance;
            const creditsRemaining = Math.max(0, monthlyAllowance - callsThisMonth);
            setCallCredits({
              creditsRemaining,
              monthlyAllowance,
              creditsUsedThisMonth: callsThisMonth,
            });
          }
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

  // If no nextCall from events, check coachingData.nextCall as fallback (legacy data)
  let finalNextCall = nextCall;
  if (!finalNextCall && coachingData?.nextCall?.datetime) {
    const callTime = new Date(coachingData.nextCall.datetime);
    const now = new Date();
    if (callTime > now) {
      finalNextCall = {
        datetime: coachingData.nextCall.datetime,
        timezone: coachingData.nextCall.timezone || 'America/New_York',
        location: coachingData.nextCall.location || 'Chat',
        title: coachingData.nextCall.title,
      };
    }
  }

  return {
    coachingData,
    coach,
    nextCall: finalNextCall,
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

