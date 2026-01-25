'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import {
  BackButton,
  CopyLinkButton,
  AddToContentButton,
  ContentPurchaseSheet,
} from '@/components/discover';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { CheckCircle, Clock, Play, Lock } from 'lucide-react';
import type { DiscoverVideo } from '@/types/discover';

interface VideoPageProps {
  params: Promise<{ id: string }>;
}

interface VideoDetailData {
  video: DiscoverVideo & { coachName?: string; coachImageUrl?: string };
  isOwned: boolean;
  includedInProgramName?: string;
}

// Format duration in seconds to readable format
function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins} min`;
}

// Format price from cents
function formatPrice(cents: number, currency = 'usd') {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function VideoDetailPage({ params }: VideoPageProps) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const { isSignedIn } = useAuth();

  const [data, setData] = useState<VideoDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);

  const justPurchased = searchParams.get('purchased') === 'true';

  // Fetch video data
  const fetchVideo = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/discover/videos/${id}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Video not found');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching video:', err);
      setError(err instanceof Error ? err.message : 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Re-fetch after purchase
  useEffect(() => {
    if (justPurchased) {
      fetchVideo();
    }
  }, [justPurchased, fetchVideo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
        <section className="px-4 py-5">
          <div className="flex flex-col gap-3">
            {/* Navigation Row Skeleton */}
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
                <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              </div>
            </div>

            {/* Video Player Skeleton */}
            <div className="aspect-video rounded-[20px] bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />

            {/* Video Info Skeleton */}
            <div className="flex flex-col gap-2">
              <div className="h-8 w-3/4 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-4 w-1/4 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              <div className="h-4 w-5/6 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            {error || 'Video not found'}
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            The video you&apos;re looking for doesn&apos;t exist or is unavailable.
          </p>
        </div>
      </div>
    );
  }

  const { video, isOwned, includedInProgramName } = data;
  const isFree = !video.priceInCents || video.priceInCents === 0;
  const thumbnailUrl = video.customThumbnailUrl || video.thumbnailUrl;

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
      {/* Header Section */}
      <section className="px-4 py-5">
        <div className="flex flex-col gap-4">
          {/* Navigation Row */}
          <div className="flex items-center justify-between">
            <BackButton />
            <div className="flex items-center gap-2">
              <CopyLinkButton />
              {isFree && (
                <AddToContentButton
                  contentType="video"
                  contentId={video.id}
                  priceInCents={video.priceInCents}
                />
              )}
            </div>
          </div>

          {/* Just Purchased Banner */}
          {justPurchased && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-800/50 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200 font-albert">
                  Purchase complete!
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 font-albert">
                  You now have full access to this video.
                </p>
              </div>
            </div>
          )}

          {/* Video Player or Locked Preview */}
          {isOwned && video.playbackUrl ? (
            <VideoPlayer
              src={video.playbackUrl}
              poster={thumbnailUrl}
              className="rounded-[20px] overflow-hidden shadow-lg"
            />
          ) : (
            <div className="relative aspect-video rounded-[20px] overflow-hidden bg-[#1a1a1a]">
              {/* Thumbnail with blur for paid content */}
              {thumbnailUrl && (
                <Image
                  src={thumbnailUrl}
                  alt={video.title}
                  fill
                  className={`object-cover ${!isFree ? 'blur-sm scale-105' : ''}`}
                />
              )}

              {/* Overlay for paid content */}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                  {isFree ? (
                    <Play className="w-10 h-10 text-white ml-1" />
                  ) : (
                    <Lock className="w-10 h-10 text-white" />
                  )}
                </div>

                {!isFree && !isOwned && (
                  <div className="text-center px-4">
                    <p className="text-white font-semibold text-lg font-albert mb-2">
                      Premium Video
                    </p>
                    <button
                      onClick={() => setShowPurchaseSheet(true)}
                      className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl transition-colors font-albert"
                    >
                      Unlock for {formatPrice(video.priceInCents!, video.currency)}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Video Info */}
          <div className="flex flex-col gap-3">
            {/* Title */}
            <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert leading-tight">
              {video.title}
            </h1>

            {/* Meta info */}
            <div className="flex items-center gap-3 flex-wrap">
              {video.durationSeconds != null && video.durationSeconds > 0 && (
                <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-albert">{formatDuration(video.durationSeconds)}</span>
                </div>
              )}

              {video.coachName && (
                <div className="flex items-center gap-1.5">
                  {video.coachImageUrl && (
                    <Image
                      src={video.coachImageUrl}
                      alt={video.coachName}
                      width={20}
                      height={20}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                    {video.coachName}
                  </span>
                </div>
              )}

              {includedInProgramName && (
                <span className="text-sm text-brand-accent font-albert">
                  Included in {includedInProgramName}
                </span>
              )}
            </div>

            {/* Description */}
            {video.description && (
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed">
                {video.description}
              </p>
            )}

            {/* Key Outcomes (for paid content) */}
            {!isOwned && video.keyOutcomes && video.keyOutcomes.length > 0 && (
              <div className="mt-4 p-4 bg-white/60 dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
                <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                  What you&apos;ll learn
                </h3>
                <ul className="space-y-2">
                  {video.keyOutcomes.map((outcome, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        {outcome}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Purchase CTA for non-owners */}
            {!isOwned && !isFree && (
              <div className="mt-4">
                <button
                  onClick={() => setShowPurchaseSheet(true)}
                  className="w-full py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-xl transition-colors font-albert text-lg"
                >
                  Get Access - {formatPrice(video.priceInCents!, video.currency)}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Purchase Sheet */}
      {video.priceInCents && video.priceInCents > 0 && (
        <ContentPurchaseSheet
          open={showPurchaseSheet}
          onOpenChange={setShowPurchaseSheet}
          content={{
            id: video.id,
            type: 'video',
            title: video.title,
            description: video.description,
            coverImageUrl: thumbnailUrl,
            priceInCents: video.priceInCents,
            currency: video.currency,
            coachName: video.coachName,
            coachImageUrl: video.coachImageUrl,
            keyOutcomes: video.keyOutcomes,
            previewVideoUrl: video.previewPlaybackUrl,
          }}
        />
      )}
    </div>
  );
}
