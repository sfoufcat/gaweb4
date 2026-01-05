'use client';

import { useState, useEffect } from 'react';
import {
  Video,
  Calendar,
  ExternalLink,
  Clock,
  Loader2,
  CalendarPlus,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { UnifiedEvent } from '@/types';

interface SquadCallSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  squadId: string;
  squadName?: string;
  onScheduleCall?: () => void;
}

/**
 * SquadCallSheet
 *
 * A dialog that shows upcoming squad calls and meeting links.
 * Squad calls use external meeting providers (Zoom/Google Meet)
 * instead of native Stream Video calls.
 */
export function SquadCallSheet({
  open,
  onOpenChange,
  squadId,
  squadName,
  onScheduleCall,
}: SquadCallSheetProps) {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && squadId) {
      fetchUpcomingCalls();
    }
  }, [open, squadId]);

  const fetchUpcomingCalls = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch upcoming events for this squad
      const now = new Date().toISOString();
      const response = await fetch(
        `/api/events?squadId=${squadId}&startAfter=${now}&limit=5`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      // Filter to squad calls or events with meeting URLs
      const callEvents = (data.events || []).filter(
        (e: UnifiedEvent) => e.meetingUrl || e.eventType === 'squad_call'
      );
      setEvents(callEvents);
    } catch (err) {
      console.error('Error fetching squad calls:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calls');
    } finally {
      setLoading(false);
    }
  };

  const formatEventTime = (event: UnifiedEvent) => {
    if (!event.startTime) return 'Time TBD';
    const start = new Date(event.startTime);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    };
    return start.toLocaleDateString('en-US', options);
  };

  const getMeetingProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'zoom':
        return '📹';
      case 'google_meet':
        return '🎥';
      default:
        return <Video className="h-4 w-4" />;
    }
  };

  const addToCalendar = (event: UnifiedEvent) => {
    if (!event.startTime) return;

    // Generate Google Calendar URL
    const start = new Date(event.startTime).toISOString().replace(/-|:|\.\d{3}/g, '');
    const end = event.endTime
      ? new Date(event.endTime).toISOString().replace(/-|:|\.\d{3}/g, '')
      : start;

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title,
      dates: `${start}/${end}`,
      details: event.description || '',
      location: event.meetingUrl || '',
    });

    window.open(`https://calendar.google.com/calendar/render?${params}`, '_blank');
  };

  const nextEvent = events[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Squad Calls
          </DialogTitle>
          <DialogDescription>
            {squadName ? `Upcoming calls for ${squadName}` : 'View and join scheduled squad calls'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchUpcomingCalls}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : nextEvent ? (
            <>
              {/* Next call highlight */}
              <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
                      Next Call
                    </p>
                    <p className="font-medium">{nextEvent.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatEventTime(nextEvent)}
                    </p>
                  </div>
                  <div className="text-2xl">
                    {typeof getMeetingProviderIcon(nextEvent.meetingProvider) === 'string'
                      ? getMeetingProviderIcon(nextEvent.meetingProvider)
                      : getMeetingProviderIcon(nextEvent.meetingProvider)}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  {nextEvent.meetingUrl && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => window.open(nextEvent.meetingUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Join Call
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addToCalendar(nextEvent)}
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Other upcoming calls */}
              {events.length > 1 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    More Upcoming
                  </p>
                  {events.slice(1).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-3 rounded-md border bg-card"
                    >
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatEventTime(event)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {event.meetingUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => window.open(event.meetingUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => addToCalendar(event)}
                        >
                          <CalendarPlus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Calendar className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No upcoming squad calls scheduled
              </p>
            </div>
          )}

          {/* Schedule call button */}
          {onScheduleCall && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  onScheduleCall();
                }}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule a Call
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
