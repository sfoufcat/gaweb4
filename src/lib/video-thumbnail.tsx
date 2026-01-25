'use client';

import { useState, useEffect } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';

/**
 * Build the thumbnail URL for a Bunny video
 */
export function getThumbnailUrl(videoId: string): string {
  const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'vz-0775a2c7-585.b-cdn.net';
  return `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
}

/**
 * Poll for auto-generated thumbnail from Bunny CDN
 * Bunny generates thumbnails after video encoding starts
 *
 * @param videoId - The Bunny video ID
 * @param options - Polling options
 * @returns The thumbnail URL (may not be ready yet but will work once encoding completes)
 */
export async function pollForThumbnail(
  videoId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    initialDelayMs?: number;
  }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? 20;
  const intervalMs = options?.intervalMs ?? 3000;
  const initialDelayMs = options?.initialDelayMs ?? 5000;
  const thumbnailUrl = getThumbnailUrl(videoId);

  const checkThumbnail = async (): Promise<boolean> => {
    try {
      const response = await fetch(thumbnailUrl, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Wait before checking (longer wait initially as encoding takes time)
    await new Promise(resolve =>
      setTimeout(resolve, attempt === 0 ? initialDelayMs : intervalMs)
    );

    const isReady = await checkThumbnail();
    if (isReady) {
      return thumbnailUrl;
    }
  }

  // Return URL even if timeout - may work later when encoding finishes
  return thumbnailUrl;
}

interface ThumbnailWithFallbackProps {
  src: string;
  alt?: string;
  className?: string;
  /** Show label text next to thumbnail */
  showLabel?: boolean;
  /** Custom label text when loading */
  loadingLabel?: string;
  /** Custom label text when loaded */
  loadedLabel?: string;
}

/**
 * Thumbnail component with loading state and error fallback
 * Auto-retries if image fails to load (thumbnail might not be ready yet)
 */
export function ThumbnailWithFallback({
  src,
  alt = 'Video thumbnail',
  className = '',
  showLabel = true,
  loadingLabel = 'Loading thumbnail...',
  loadedLabel = 'Auto-generated from video',
}: ThumbnailWithFallbackProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Auto-retry if image fails to load (thumbnail might not be ready yet)
  useEffect(() => {
    if (hasError && retryCount < 5) {
      const timer = setTimeout(() => {
        setHasError(false);
        setIsLoading(true);
        setRetryCount(prev => prev + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [hasError, retryCount]);

  // Reset state when src changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setRetryCount(0);
  }, [src]);

  if (hasError && retryCount >= 5) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="w-20 h-12 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35] flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-[#8c8c8c]" />
        </div>
        {showLabel && (
          <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Thumbnail generating...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-20 h-12">
        {isLoading && (
          <div className="absolute inset-0 rounded-lg bg-[#e1ddd8] dark:bg-[#262b35] animate-pulse flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-[#8c8c8c]" />
          </div>
        )}
        <img
          src={`${src}?t=${retryCount}`}
          alt={alt}
          className={`w-20 h-12 object-cover rounded-lg transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      </div>
      {showLabel && (
        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          {isLoading ? loadingLabel : loadedLabel}
        </span>
      )}
    </div>
  );
}
