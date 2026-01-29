'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from '@/components/ui/audio-player';
import { cn } from '@/lib/utils';

type MediaType = 'audio' | 'video' | 'unknown' | 'detecting';

interface MediaPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  onEnded?: () => void;
  /** Aspect ratio for video (ignored for audio) */
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

// Audio file extensions
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac', '.wma'];
// Video file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v', '.wmv'];

/**
 * Check if URL is from Bunny CDN
 */
function isBunnyCdnUrl(url: string): boolean {
  return url.includes('.b-cdn.net') || url.includes('bunnycdn');
}

/**
 * Detect media type from URL extension
 * For Bunny CDN URLs without extension, defaults to audio (most call recordings are audio-only)
 */
function getMediaTypeFromUrl(url: string): 'audio' | 'video' | 'unknown' {
  try {
    // Remove query params and get extension
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop() || '';
    const ext = lastSegment.includes('.') ? '.' + lastSegment.split('.').pop()?.toLowerCase() : '';

    if (ext && AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return 'video';

    // For Bunny CDN URLs without clear extension, default to audio
    // Bunny converts all uploads to video format (even audio gets a static speaker image)
    // so probing is unreliable. Most call recordings are audio-only.
    if (isBunnyCdnUrl(url)) {
      // Check if URL explicitly contains video quality indicator
      if (pathname.includes('play_') && pathname.endsWith('.mp4')) {
        return 'video';
      }
      // Default to audio for Bunny recordings
      return 'audio';
    }

    return 'unknown';
  } catch {
    // If URL parsing fails, try simpler approach
    const cleanUrl = url.split('?')[0];
    const lastSegment = cleanUrl.split('/').pop() || '';
    const ext = lastSegment.includes('.') ? '.' + lastSegment.split('.').pop()?.toLowerCase() : '';

    if (ext && AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (ext && VIDEO_EXTENSIONS.includes(ext)) return 'video';

    // Bunny CDN fallback
    if (isBunnyCdnUrl(url)) {
      return 'audio';
    }

    return 'unknown';
  }
}

/**
 * MediaPlayer
 *
 * Adaptive media player that shows AudioPlayer for audio files
 * and VideoPlayer for video files. Auto-detects media type from
 * URL extension or by probing the media element.
 */
export function MediaPlayer({
  src,
  poster,
  className,
  onEnded,
  aspectRatio = '16:9',
}: MediaPlayerProps) {
  const [mediaType, setMediaType] = useState<MediaType>(() => {
    // Initialize with detected type if possible
    if (!src) return 'unknown';
    const detected = getMediaTypeFromUrl(src);
    return detected !== 'unknown' ? detected : 'detecting';
  });

  const probeVideoRef = useRef<HTMLVideoElement | null>(null);
  const hasProbed = useRef(false);

  useEffect(() => {
    if (!src) {
      setMediaType('unknown');
      return;
    }

    // First try to detect from URL extension
    const typeFromUrl = getMediaTypeFromUrl(src);

    if (typeFromUrl !== 'unknown') {
      setMediaType(typeFromUrl);
      hasProbed.current = false;
      return;
    }

    // If already probed this URL, don't probe again
    if (hasProbed.current) return;

    // If unknown extension, need to probe
    setMediaType('detecting');
    hasProbed.current = true;

    // Create a temporary video element to probe (not rendered)
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    // Make absolutely sure it's not visible
    video.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';

    probeVideoRef.current = video;

    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      video.removeEventListener('loadedmetadata', handleMetadata);
      video.removeEventListener('error', handleError);
      video.src = '';
      video.load();
      probeVideoRef.current = null;
    };

    const handleMetadata = () => {
      if (isCleanedUp) return;
      // If videoWidth is 0, it's audio-only
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        setMediaType('audio');
      } else {
        setMediaType('video');
      }
      cleanup();
    };

    const handleError = () => {
      if (isCleanedUp) return;
      // On error, default to video player (it will show its own error)
      setMediaType('video');
      cleanup();
    };

    video.addEventListener('loadedmetadata', handleMetadata);
    video.addEventListener('error', handleError);

    // Timeout fallback - if metadata takes too long, assume video
    const timeout = setTimeout(() => {
      if (!isCleanedUp) {
        setMediaType('video');
        cleanup();
      }
    }, 5000);

    video.src = src;

    return () => {
      clearTimeout(timeout);
      cleanup();
    };
  }, [src]);

  // Loading state while detecting
  if (mediaType === 'detecting') {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl',
          'bg-[#f3f1ef] dark:bg-[#1e222a]',
          'border border-[#e1ddd8] dark:border-[#262b35]',
          'py-8',
          className
        )}
      >
        <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#8c919d]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading recording...</span>
        </div>
      </div>
    );
  }

  // Unknown state (no src)
  if (mediaType === 'unknown') {
    return null;
  }

  // Render AudioPlayer for audio files
  if (mediaType === 'audio') {
    return <AudioPlayer src={src} className={className} onEnded={onEnded} />;
  }

  // Render VideoPlayer for video files
  return (
    <VideoPlayer
      src={src}
      poster={poster}
      className={className}
      onEnded={onEnded}
      aspectRatio={aspectRatio}
    />
  );
}
