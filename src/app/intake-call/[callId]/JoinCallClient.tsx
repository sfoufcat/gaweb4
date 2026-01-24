'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Video, Shield, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface JoinCallClientProps {
  event: {
    id: string;
    title: string;
    startDateTime: string;
    endDateTime?: string;
    durationMinutes?: number;
    meetingProvider?: string;
    meetingLink?: string;
    callId?: string;
    prospectName?: string;
    prospectEmail?: string;
  };
  host: {
    name: string;
    avatarUrl?: string;
  };
  branding: {
    name?: string;
    logoUrl?: string;
    hidePoweredBy?: boolean;
  };
  bookingToken: string;
  callId: string;
}

export function JoinCallClient({
  event,
  host,
  branding,
  bookingToken,
  callId,
}: JoinCallClientProps) {
  const router = useRouter();
  const [guestName, setGuestName] = useState(event.prospectName || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format date/time for display
  const eventStart = parseISO(event.startDateTime);
  const formattedDate = format(eventStart, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(eventStart, 'h:mm a');

  // Check if call is happening soon or now
  const now = new Date();
  const timeDiff = eventStart.getTime() - now.getTime();
  const minutesUntilCall = Math.floor(timeDiff / (1000 * 60));
  const isCallTime = minutesUntilCall <= 15 && minutesUntilCall >= -(event.durationMinutes || 60);
  const isEarly = minutesUntilCall > 15;

  // Format time until call in human-readable form
  const formatTimeUntil = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) {
      if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${days} day${days !== 1 ? 's' : ''} and ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  };

  const handleJoinCall = async () => {
    if (!guestName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      // Get guest token from API
      const response = await fetch('/api/public/video-guest-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: bookingToken,
          guestName: guestName.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join call');
      }

      const data = await response.json();

      // Store guest credentials in sessionStorage for the room page
      sessionStorage.setItem('guestCallData', JSON.stringify({
        streamToken: data.streamToken,
        guestUserId: data.guestUserId,
        guestName: guestName.trim(),
        apiKey: data.apiKey,
        callId: data.callId,
        callType: data.callType,
        event: data.event,
        branding: data.branding,
      }));

      // Navigate to the call room
      router.push(`/intake-call/${callId}/room`);
    } catch (err) {
      console.error('Error joining call:', err);
      setError(err instanceof Error ? err.message : 'Failed to join call');
      setIsJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-[#1d222b] rounded-2xl shadow-lg p-6 sm:p-8">
          {/* Logo/branding at top of card */}
          {(branding.logoUrl || branding.name) && (
            <div className="flex justify-center mb-6">
              {branding.logoUrl ? (
                <Image
                  src={branding.logoUrl}
                  alt={branding.name || 'Coach'}
                  width={120}
                  height={40}
                  className="h-8 w-auto object-contain"
                />
              ) : branding.name ? (
                <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {branding.name}
                </span>
              ) : null}
            </div>
          )}

          {/* Call info */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Join Your Call
            </h1>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {event.title} with {host.name}
            </p>
          </div>

          {/* Call details */}
          <div className="bg-[#f9f7f5] dark:bg-[#262b35] rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">
                {formattedTime} ({event.durationMinutes || 30} min)
              </span>
            </div>
          </div>

          {/* Early warning */}
          {isEarly && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your call starts in {formatTimeUntil(minutesUntilCall)}. You can join when it&apos;s time.
              </p>
            </div>
          )}

          {/* Name input */}
          <div className="mb-6">
            <label
              htmlFor="guestName"
              className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2"
            >
              Your Name
            </label>
            <input
              id="guestName"
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                setError(null);
              }}
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent"
              disabled={isJoining}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isJoining) {
                  handleJoinCall();
                }
              }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">{error}</p>
            )}
          </div>

          {/* Join button */}
          <button
            onClick={handleJoinCall}
            disabled={isJoining || !guestName.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-brand-accent text-white rounded-xl font-medium font-albert hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Join Call
              </>
            )}
          </button>

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
            <Shield className="w-3 h-3" />
            <span>Secure, encrypted video call</span>
          </div>

          {/* Powered by - only show if not hidden */}
          {!branding.hidePoweredBy && (
            <div className="mt-4 text-center">
              <p className="text-xs text-[#a7a39e] dark:text-[#6b7280]">
                Powered by Coachful
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
