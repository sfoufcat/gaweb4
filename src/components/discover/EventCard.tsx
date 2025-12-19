'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { DiscoverEvent } from '@/types/discover';

interface EventCardProps {
  event: DiscoverEvent;
  isPast?: boolean;
}

export function EventCard({ event, isPast = false }: EventCardProps) {
  // Format date: "Oct 20, 18:00"
  const formatEventDate = (dateStr: string, time: string) => {
    const date = new Date(dateStr);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}, ${time}`;
  };

  const hasRecording = isPast && event.recordingUrl;

  return (
    <Link href={`/discover/events/${event.id}`}>
      <div className={`bg-white dark:bg-[#171b22] rounded-[20px] w-[180px] flex-shrink-0 hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer overflow-hidden ${isPast && !hasRecording ? 'opacity-70' : ''}`}>
        {/* Cover Image with overlaid badges */}
        <div className="relative h-[100px] w-full bg-earth-100 dark:bg-[#262b35]">
          {event.coverImageUrl ? (
            <Image
              src={event.coverImageUrl}
              alt={event.title}
              fill
              className="object-cover"
              sizes="180px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-earth-300 dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Badges overlay on image */}
          {!isPast && event.featured && (
            <div className="absolute top-2 right-2 bg-white/90 dark:bg-[#171b22]/90 backdrop-blur-sm rounded-full p-1">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          )}
          {hasRecording && (
            <div className="absolute top-2 right-2">
              <div className="bg-earth-500 text-white text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Recording</span>
              </div>
            </div>
          )}
          {isPast && !hasRecording && (
            <div className="absolute top-2 left-2">
              <span className="text-[10px] text-white bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full font-medium">Ended</span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-3 flex flex-col gap-1.5">
          {/* Date & Time */}
          <span className="font-sans text-xs text-text-muted dark:text-[#7d8190] leading-[1.2]">
            {formatEventDate(event.date, event.startTime)}
          </span>
          
          {/* Title */}
          <h3 className="font-albert font-semibold text-base text-text-secondary dark:text-[#b2b6c2] tracking-[-0.5px] leading-[1.3] line-clamp-2">
            {event.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

