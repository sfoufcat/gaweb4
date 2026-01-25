'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Clock } from 'lucide-react';
import type { DiscoverVideo } from '@/types/discover';
import { AddToContentButton } from './AddToContentButton';
import { ContentPurchaseSheet } from './ContentPurchaseSheet';

interface VideoCardProps {
  video: DiscoverVideo;
}

// Format price from cents
function formatPrice(cents: number, currency = 'usd') {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format duration in seconds to mm:ss or hh:mm:ss
function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoCard({ video }: VideoCardProps) {
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);
  const isFree = !video.priceInCents || video.priceInCents === 0;
  const thumbnailUrl = video.customThumbnailUrl || video.thumbnailUrl;

  const CardContent = () => (
    <>
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video w-full bg-earth-100 dark:bg-[#262b35] group/thumb">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={video.title}
            fill
            className="object-cover"
            sizes="220px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-10 h-10 text-earth-300 dark:text-[#7d8190]" />
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-6 h-6 text-[#1a1a1a] ml-1" />
          </div>
        </div>

        {/* Duration badge */}
        {video.durationSeconds != null && video.durationSeconds > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs font-medium rounded px-1.5 py-0.5 flex items-center gap-1 font-albert">
            <Clock className="w-3 h-3" />
            {formatDuration(video.durationSeconds)}
          </div>
        )}

        {/* Add to Content button - only for free content */}
        {isFree && (
          <AddToContentButton
            contentType="video"
            contentId={video.id}
            priceInCents={video.priceInCents}
            compact
            className="absolute top-2 right-2"
          />
        )}

        {/* Price badge - only for paid content */}
        {!isFree && video.priceInCents && (
          <div className="absolute top-2 right-2 bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm">
            <span className="font-albert font-bold text-sm text-text-primary dark:text-[#f5f5f8]">
              {formatPrice(video.priceInCents, video.currency)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1">
        {/* Title */}
        <h3 className="font-albert font-semibold text-base text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3] line-clamp-2">
          {video.title}
        </h3>

        {/* Description - 1 line */}
        {video.description && (
          <p className="text-xs text-text-muted dark:text-[#7d8190] leading-relaxed line-clamp-1">
            {video.description}
          </p>
        )}

        {/* Coach info */}
        {video.coachName && (
          <div className="flex items-center gap-1.5 mt-1">
            {video.coachImageUrl && (
              <Image
                src={video.coachImageUrl}
                alt={video.coachName}
                width={16}
                height={16}
                className="rounded-full"
              />
            )}
            <span className="text-xs text-text-muted dark:text-[#7d8190] font-albert">
              {video.coachName}
            </span>
          </div>
        )}
      </div>
    </>
  );

  // For paid content, render a clickable div that opens the purchase sheet
  if (!isFree) {
    return (
      <>
        <div
          onClick={() => setShowPurchaseSheet(true)}
          className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[220px] flex-shrink-0 hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer overflow-hidden"
        >
          <CardContent />
        </div>

        <ContentPurchaseSheet
          open={showPurchaseSheet}
          onOpenChange={setShowPurchaseSheet}
          content={{
            id: video.id,
            type: 'video',
            title: video.title,
            description: video.description,
            coverImageUrl: thumbnailUrl,
            priceInCents: video.priceInCents || 0,
            currency: video.currency,
            coachName: video.coachName,
            coachImageUrl: video.coachImageUrl,
            keyOutcomes: video.keyOutcomes,
            // Include preview video URL for the purchase sheet
            previewVideoUrl: video.previewPlaybackUrl,
          }}
        />
      </>
    );
  }

  // For free content, use Link for direct navigation
  return (
    <Link href={`/discover/videos/${video.id}`}>
      <div className="bg-white/70 dark:bg-[#171b22] rounded-[20px] w-[220px] flex-shrink-0 hover:shadow-md dark:hover:shadow-black/30 transition-shadow cursor-pointer overflow-hidden">
        <CardContent />
      </div>
    </Link>
  );
}
