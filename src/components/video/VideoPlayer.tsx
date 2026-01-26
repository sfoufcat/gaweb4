'use client';

import { useState, useRef, useCallback } from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = require('react-player').default as any;
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  onProgress?: (progress: number) => void;
  onEnded?: () => void;
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

export function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
  onProgress,
  onEnded,
  aspectRatio = '16:9',
}: VideoPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [played, setPlayed] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasError, setHasError] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const aspectRatioClass = {
    '16:9': 'aspect-video',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
  }[aspectRatio];

  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = useCallback(() => {
    if (!hasStarted) setHasStarted(true);
    setPlaying((prev) => !prev);
  }, [hasStarted]);

  const handleProgress = useCallback(
    (state: { played: number; loaded: number; playedSeconds: number }) => {
      if (!seeking) {
        setPlayed(state.played);
        setLoaded(state.loaded);
        onProgress?.(state.played * 100);
      }
    },
    [seeking, onProgress]
  );

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPlayed(parseFloat(e.target.value));
  }, []);

  const handleSeekMouseDown = useCallback(() => {
    setSeeking(true);
  }, []);

  const handleSeekMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    setSeeking(false);
    playerRef.current?.seekTo(parseFloat((e.target as HTMLInputElement).value));
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [playing]);

  const handleMouseLeave = useCallback(() => {
    if (playing) {
      setShowControls(false);
    }
  }, [playing]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    onEnded?.();
  }, [onEnded]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black rounded-xl overflow-hidden group',
        aspectRatioClass,
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video Player */}
      <ReactPlayer
        ref={playerRef}
        url={src}
        playing={playing}
        muted={muted}
        volume={volume}
        width="100%"
        height="100%"
        style={{ position: 'absolute', top: 0, left: 0 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onProgress={handleProgress as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onDuration={setDuration as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onEnded={handleEnded as any}
        onBuffer={() => setIsBuffering(true)}
        onBufferEnd={() => setIsBuffering(false)}
        onStart={() => setHasStarted(true)}
        onError={() => setHasError(true)}
        config={{
          file: {
            attributes: {
              poster,
              preload: 'metadata',
              playsInline: true,
              crossOrigin: 'anonymous',
            },
            forceHLS: src?.includes('.m3u8'),
          },
        }}
      />

      {/* Poster Overlay (before playing) */}
      {!hasStarted && poster && (
        <div
          className="absolute inset-0 bg-cover bg-center z-10"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      {/* Buffering Indicator */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}

      {/* Error Indicator */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/70">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-white/80 font-medium">Video unavailable</p>
          <p className="text-white/50 text-sm mt-1">Unable to load video</p>
        </div>
      )}

      {/* Big Play Button (before playing, hide on error) */}
      {!hasStarted && !hasError && (
        <button
          onClick={handlePlayPause}
          className="absolute inset-0 flex items-center justify-center z-20 group/play"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 group-hover/play:bg-white group-hover/play:scale-110 flex items-center justify-center transition-all shadow-lg">
            <Play className="w-8 h-8 text-[#1a1a1a] ml-1" />
          </div>
        </button>
      )}

      {/* Controls Overlay - hide when error */}
      {!hasError && (
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300 z-30',
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Click to play/pause */}
        <button
          className="absolute inset-0 w-full h-full cursor-pointer"
          onClick={handlePlayPause}
          aria-label={playing ? 'Pause' : 'Play'}
        />

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress Bar */}
          <div className="relative h-1 mb-3 group/progress">
            {/* Loaded progress */}
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${loaded * 100}%` }}
            />
            {/* Played progress */}
            <div
              className="absolute inset-y-0 left-0 bg-brand-accent rounded-full"
              style={{ width: `${played * 100}%` }}
            />
            {/* Seek Input */}
            <input
              type="range"
              min={0}
              max={0.999999}
              step="any"
              value={played}
              onChange={handleSeekChange}
              onMouseDown={handleSeekMouseDown}
              onMouseUp={handleSeekMouseUp}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {/* Seek Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-brand-accent rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `calc(${played * 100}% - 6px)` }}
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 appearance-none bg-white/30 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
              />
            </div>

            {/* Time */}
            <div className="text-sm text-white/90 font-albert ml-2">
              {formatTime(played * duration)} / {formatTime(duration)}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
