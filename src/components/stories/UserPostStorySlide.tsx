'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface UserPostStorySlideProps {
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  createdAt?: string;
  expiresAt?: string;
  isPaused?: boolean;
}

/**
 * UserPostStorySlide - Displays user-uploaded story content
 * 
 * Supports:
 * - Full-screen image display
 * - Video with auto-play/pause based on isPaused prop
 * - Caption overlay at bottom
 * - Timestamp indicator
 */
export function UserPostStorySlide({
  imageUrl,
  videoUrl,
  caption,
  createdAt,
  isPaused = false,
}: UserPostStorySlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Handle video play/pause based on isPaused prop
  useEffect(() => {
    if (!videoRef.current) return;

    if (isPaused) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {
        // Auto-play might be blocked, that's okay
      });
    }
  }, [isPaused]);

  // Format timestamp
  const timeAgo = createdAt 
    ? formatDistanceToNow(new Date(createdAt), { addSuffix: true })
    : null;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {/* Image */}
      {imageUrl && !videoUrl && (
        <>
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {imageError ? (
            <div className="flex flex-col items-center justify-center text-white/60">
              <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Failed to load image</p>
            </div>
          ) : (
            <Image
              src={imageUrl}
              alt="Story"
              fill
              className={`object-contain transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              priority
            />
          )}
        </>
      )}

      {/* Video */}
      {videoUrl && (
        <>
          {!videoLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            playsInline
            muted
            loop
            onLoadedData={() => setVideoLoaded(true)}
          />
        </>
      )}

      {/* Gradient overlay for text readability */}
      {(caption || timeAgo) && (
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />
      )}

      {/* Caption and timestamp */}
      <div className="absolute inset-x-0 bottom-0 p-6 pb-8">
        {caption && (
          <p className="text-white text-[15px] leading-relaxed mb-2 drop-shadow-lg">
            {caption}
          </p>
        )}
        {timeAgo && (
          <p className="text-white/60 text-[12px] drop-shadow">
            {timeAgo}
          </p>
        )}
      </div>

      {/* Video play indicator (when paused) */}
      {videoUrl && isPaused && videoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

