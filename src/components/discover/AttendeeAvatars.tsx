'use client';

import Image from 'next/image';
import type { EventAttendee } from '@/types/discover';

interface AttendeeAvatarsProps {
  attendees: EventAttendee[];
  totalCount?: number;
  maxDisplay?: number;
}

export function AttendeeAvatars({ attendees, totalCount, maxDisplay = 5 }: AttendeeAvatarsProps) {
  const displayedAttendees = attendees.slice(0, maxDisplay);
  const remainingCount = (totalCount || attendees.length) - displayedAttendees.length;

  return (
    <div className="flex items-center gap-1">
      {/* Overlapping avatars */}
      <div className="flex items-center -space-x-2">
        {displayedAttendees.map((attendee, index) => (
          <div 
            key={attendee.userId}
            className="relative w-11 h-11 rounded-full border-2 border-white overflow-hidden"
            style={{ zIndex: maxDisplay - index }}
          >
            {attendee.avatarUrl ? (
              <Image
                src={attendee.avatarUrl}
                alt={`${attendee.firstName} ${attendee.lastName}`}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-earth-200 flex items-center justify-center">
                <span className="text-sm font-medium text-earth-600">
                  {attendee.firstName[0]}{attendee.lastName[0]}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Remaining count */}
      {remainingCount > 0 && (
        <span className="font-sans text-xs text-text-muted leading-[1.2] ml-1">
          +{remainingCount} going
        </span>
      )}
    </div>
  );
}

