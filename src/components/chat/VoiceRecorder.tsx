'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Get the best supported audio MIME type for MediaRecorder
 * Firefox has different codec support than Chrome/Safari
 */
function getSupportedMimeType(): string | undefined {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  // Return undefined to use browser default
  return undefined;
}

/**
 * useVoiceRecorder Hook
 * 
 * Custom hook that manages voice recording state and MediaRecorder lifecycle.
 * This hook should be used in the parent component to keep the recording
 * session alive regardless of UI changes.
 */
export function useVoiceRecorder({
  onRecordingComplete,
}: {
  onRecordingComplete: (audioBlob: Blob) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isCancelledRef = useRef(false);

  // Helper to stop all media tracks
  const stopAllTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
  }, []);

  // Clear the timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Dismiss recording error message
  const dismissRecordingError = useCallback(() => {
    setRecordingError(null);
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    // Prevent starting if already recording
    if (isRecording || mediaRecorderRef.current) {
      return;
    }
    
    isCancelledRef.current = false;
    setRecordingError(null);
    
    let stream: MediaStream | null = null;
    
    try {
      // Request microphone permission
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
    } catch (error) {
      console.error('Failed to get microphone permission:', error);
      setPermissionDenied(true);
      return;
    }
    
    try {
      // Get the best supported MIME type
      const mimeType = getSupportedMimeType();
      
      // Create MediaRecorder with or without explicit mimeType
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isCancelledRef.current) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setRecordingError('Recording failed. Please try again.');
        // Inline cleanup to avoid circular dependency with cancelRecording
        isCancelledRef.current = true;
        audioChunksRef.current = [];
        clearTimer();
        stopAllTracks();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setDuration(0);
      };
      
      mediaRecorder.onstop = () => {
        // Stop all tracks FIRST
        stopAllTracks();
        
        // Only process if we have chunks AND not cancelled
        if (audioChunksRef.current.length > 0 && !isCancelledRef.current) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm'
          });
          onRecordingComplete(audioBlob);
        }
        
        // Reset refs
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        
        // Reset state
        setIsRecording(false);
        setDuration(0);
      };
      
      // Start recording
      mediaRecorder.start();
      setDuration(0);
      setPermissionDenied(false);
      setIsRecording(true);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to create MediaRecorder:', error);
      // This is NOT a permission error - it's a browser compatibility issue
      setRecordingError('Voice recording is not supported in your browser. Please try Chrome or Safari.');
      stopAllTracks();
    }
  }, [isRecording, onRecordingComplete, stopAllTracks, clearTimer]);

  // Stop recording and send
  const stopRecording = useCallback(() => {
    clearTimer();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      // If not recording, just stop tracks
      stopAllTracks();
      setIsRecording(false);
      setDuration(0);
    }
  }, [clearTimer, stopAllTracks]);

  // Cancel recording without sending
  const cancelRecording = useCallback(() => {
    // Mark as cancelled FIRST
    isCancelledRef.current = true;
    audioChunksRef.current = [];
    
    clearTimer();
    
    // Stop tracks immediately
    stopAllTracks();
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setDuration(0);
  }, [clearTimer, stopAllTracks]);

  // Dismiss permission denied message
  const dismissPermissionDenied = useCallback(() => {
    setPermissionDenied(false);
  }, []);

  // Cleanup on unmount - ALWAYS stop tracks
  useEffect(() => {
    return () => {
      clearTimer();
      // Always stop tracks on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        // Mark as cancelled so onstop doesn't send
        isCancelledRef.current = true;
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    };
  }, [clearTimer]);

  return {
    isRecording,
    duration,
    permissionDenied,
    recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
    dismissPermissionDenied,
    dismissRecordingError,
  };
}

/**
 * Format duration as MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * VoiceRecordingButton Component
 * 
 * The microphone button shown when not recording.
 * This is a pure presentation component.
 */
export function VoiceRecordingButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] transition-colors"
      aria-label="Record voice message"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
}

/**
 * VoiceRecordingUI Component
 * 
 * The full-width recording bar shown while recording.
 * This is a pure presentation component.
 */
export function VoiceRecordingUI({
  duration,
  onStop,
  onCancel,
}: {
  duration: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 w-full">
      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className="w-9 h-9 flex items-center justify-center text-[#5f5a55] hover:text-red-500 transition-colors"
        aria-label="Cancel recording"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      
      {/* Recording indicator */}
      <div className="flex items-center gap-2 flex-1">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="font-['Geist'] text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">
          Recording...
        </span>
        <span className="font-['Geist'] text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>
      
      {/* Waveform visualization (simplified) */}
      <div className="flex items-center gap-[2px] h-6">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="w-[3px] bg-brand-accent rounded-full animate-pulse"
            style={{
              height: `${Math.random() * 16 + 8}px`,
              animationDelay: `${i * 50}ms`,
            }}
          />
        ))}
      </div>
      
      {/* Send button */}
      <button
        type="button"
        onClick={onStop}
        className="w-9 h-9 rounded-full bg-[#2c2520] hover:bg-[#1a1a1a] dark:bg-brand-accent dark:hover:bg-brand-accent/90 flex items-center justify-center transition-colors shadow-lg"
        aria-label="Send voice message"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
          <path d="M8.33339 11.6667L17.5001 2.5M8.33339 11.6667L11.2501 17.5C11.2866 17.5798 11.3453 17.6474 11.4192 17.6948C11.493 17.7422 11.579 17.7674 11.6667 17.7674C11.7545 17.7674 11.8404 17.7422 11.9143 17.6948C11.9881 17.6474 12.0468 17.5798 12.0834 17.5L17.5001 2.5M8.33339 11.6667L2.50006 8.75C2.42027 8.71344 2.35266 8.65474 2.30526 8.58088C2.25786 8.50701 2.23267 8.4211 2.23267 8.33333C2.23267 8.24557 2.25786 8.15965 2.30526 8.08579C2.35266 8.01193 2.42027 7.95323 2.50006 7.91667L17.5001 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

/**
 * PermissionDeniedUI Component
 * 
 * Shown when microphone permission is denied.
 */
export function PermissionDeniedUI({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-red-50 px-4 py-3 text-red-600 text-[14px] w-full rounded-lg">
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="flex-1">Microphone access denied. Please enable it in your browser settings.</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-red-600 hover:text-red-800 font-medium"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * RecordingErrorUI Component
 * 
 * Shown when there's a recording error (e.g., browser compatibility issue).
 */
export function RecordingErrorUI({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-amber-50 px-4 py-3 text-amber-700 text-[14px] w-full rounded-lg">
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-amber-700 hover:text-amber-900 font-medium"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * VoiceMessageAttachment Component
 * 
 * Custom audio player for voice messages
 * Styled to match the message bubble (dark for sent, light for received)
 */
interface VoiceMessageAttachmentProps {
  audioUrl: string;
  duration?: number;
  isMine?: boolean;
}

export function VoiceMessageAttachment({ audioUrl, duration, isMine = false }: VoiceMessageAttachmentProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Colors based on isMine - with dark mode support
  // In dark mode, received messages need lighter colors for visibility
  const iconColor = isMine ? 'text-white/90' : 'text-[#7e6c5b] dark:text-[#d4b896]';
  const barActiveColor = isMine ? 'rgba(255,255,255,0.9)' : '#7e6c5b';
  const barInactiveColor = isMine ? 'rgba(255,255,255,0.4)' : 'rgba(126,108,91,0.3)';

  return (
    <div className="flex items-center gap-3 w-full min-w-[180px]">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${iconColor} hover:opacity-80 transition-opacity`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      
      {/* Duration display */}
      <span className={`text-[14px] font-['Geist'] font-medium ${isMine ? 'text-white' : 'text-[#1a1a1a] dark:text-[#d4b896]'} min-w-[36px]`}>
        {formatTime(isPlaying ? currentTime : audioDuration)}
      </span>
      
      {/* Waveform visualization */}
      <div className="flex-1 min-w-0">
        <div className="relative h-8 flex items-center">
          <div className="absolute inset-0 flex items-center gap-[3px]">
            {[...Array(20)].map((_, i) => {
              // Generate varied heights for waveform effect
              const heights = [12, 18, 24, 16, 22, 14, 20, 26, 18, 12, 22, 16, 24, 14, 20, 18, 26, 12, 16, 22];
              const height = heights[i % heights.length];
              const isActive = i < (progress / 100) * 20;
              
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-colors"
                  style={{
                    height: `${height}px`,
                    backgroundColor: isActive ? barActiveColor : barInactiveColor,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
