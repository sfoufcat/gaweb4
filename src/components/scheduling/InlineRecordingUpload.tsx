'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Loader2,
  FileAudio,
  FileVideo,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DiscardUploadDialog } from '@/components/ui/DiscardUploadDialog';
import * as tus from 'tus-js-client';

interface InlineRecordingUploadProps {
  eventId: string;
  /** Called when upload completes successfully */
  onUploadComplete?: () => void;
  /** Called with the recording URL after it's set on the event */
  onRecordingUploaded?: (recordingUrl: string) => void;
  /** Display variant - 'default' shows full button with helper text, 'compact' shows button only, 'link' shows text link */
  variant?: 'default' | 'compact' | 'link';
}

type UploadStatus = 'idle' | 'uploading' | 'encoding' | 'saving' | 'completed' | 'error';

const ACCEPTED_FORMATS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.mov'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * InlineRecordingUpload
 *
 * Compact recording upload component for EventDetailPopup.
 * Uploads recordings to Bunny Stream (video/audio) for compression and CDN delivery.
 * Summary generation is a separate step (via "Get Summary" button).
 */
export function InlineRecordingUpload({
  eventId,
  onUploadComplete,
  onRecordingUploaded,
  variant = 'default',
}: InlineRecordingUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  // Track pending Bunny video for cleanup on discard
  const [pendingBunnyVideoId, setPendingBunnyVideoId] = useState<string | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileSelect = useCallback((selectedFile: File) => {
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(extension)) {
      setError(`Invalid file type. Use: ${ACCEPTED_FORMATS.join(', ')}`);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum 500MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = async () => {
    if (!file) return;

    try {
      setStatus('uploading');
      setProgress(0);
      setError(null);

      // Step 1: Get upload configuration from API
      const configResponse = await fetch('/api/coach/recordings/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!configResponse.ok) {
        const errorData = await configResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const uploadConfig = await configResponse.json();

      if (uploadConfig.uploadType === 'bunny') {
        // Bunny Stream upload using TUS protocol
        await uploadToBunny(uploadConfig);
      } else {
        // Firebase upload for PDFs (fallback, though PDFs shouldn't use this component)
        await uploadToFirebase(uploadConfig);
      }
    } catch (err) {
      console.error('Error uploading recording:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  };

  const uploadToBunny = async (config: {
    videoId: string;
    tusEndpoint: string;
    tusHeaders: Record<string, string>;
  }) => {
    const { videoId, tusEndpoint, tusHeaders } = config;

    // Track this video ID for cleanup if user cancels
    setPendingBunnyVideoId(videoId);

    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file!, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: tusHeaders,
        metadata: {
          filename: file!.name,
          filetype: file!.type,
        },
        onError: (error) => {
          console.error('TUS upload error:', error);
          reject(new Error('Upload failed: ' + error.message));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(percentage);
        },
        onSuccess: async () => {
          try {
            setStatus('encoding');
            setProgress(100);

            // Link the Bunny video to the event
            // The webhook will update recordingUrl when encoding completes
            const recordingResponse = await fetch(`/api/events/${eventId}/recording`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bunnyVideoId: videoId,
              }),
            });

            if (!recordingResponse.ok) {
              const errorData = await recordingResponse.json().catch(() => ({}));
              throw new Error(errorData.error || 'Failed to save recording');
            }

            setStatus('completed');
            // Video is now linked to event, no longer needs cleanup
            setPendingBunnyVideoId(null);

            // Notify parent - recording is being encoded, will be ready soon
            onUploadComplete?.();
            // Don't call onRecordingUploaded yet - no URL until webhook fires
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      });

      uploadRef.current = upload;

      // Check for previous uploads to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  const uploadToFirebase = async (config: {
    uploadUrl: string;
    downloadUrl: string;
  }) => {
    const { uploadUrl, downloadUrl } = config;

    // Upload to Firebase using XHR
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percentComplete = Math.round((e.loaded / e.total) * 100);
        setProgress(percentComplete);
      }
    });

    await new Promise<void>((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file!.type);
      xhr.send(file);
    });

    setStatus('saving');

    // Link recording to event
    const recordingResponse = await fetch(`/api/events/${eventId}/recording`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordingUrl: downloadUrl,
      }),
    });

    if (!recordingResponse.ok) {
      const errorData = await recordingResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to save recording');
    }

    setStatus('completed');
    onUploadComplete?.();
    onRecordingUploaded?.(downloadUrl);
  };

  // Check if we have a pending upload that needs cleanup
  const hasPendingUpload = pendingBunnyVideoId !== null && status !== 'completed';

  const deletePendingVideo = async () => {
    if (!pendingBunnyVideoId) return;

    setIsDeleting(true);
    try {
      await fetch(`/api/coach/bunny-video/${pendingBunnyVideoId}`, { method: 'DELETE' }).catch(
        (err) => console.warn(`Failed to delete orphaned video ${pendingBunnyVideoId}:`, err)
      );
    } finally {
      setIsDeleting(false);
      setPendingBunnyVideoId(null);
    }
  };

  const handleReset = () => {
    // If there's a pending upload, show confirmation dialog
    if (hasPendingUpload) {
      setShowDiscardDialog(true);
      return;
    }

    doReset();
  };

  const doReset = () => {
    // Abort any ongoing TUS upload
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }

    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    setPendingBunnyVideoId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDiscardConfirm = async () => {
    await deletePendingVideo();
    setShowDiscardDialog(false);
    doReset();
  };

  const handleDiscardCancel = () => {
    setShowDiscardDialog(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Idle state - show upload button or link
  if (status === 'idle' && !file) {
    // Link variant - compact text link
    if (variant === 'link') {
      return (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:underline transition-colors"
          >
            Upload Instead
          </button>
        </>
      );
    }

    // Compact variant - button only, no helper text
    if (variant === 'compact') {
      return (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:border-violet-300 dark:hover:border-violet-700 transition-all"
          >
            <Upload className="w-4 h-4 text-violet-500" />
            Upload Recording
          </button>
        </>
      );
    }

    // Default variant - full button with helper text
    return (
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] hover:border-violet-300 dark:hover:border-violet-700 transition-all"
        >
          <Upload className="w-4 h-4 text-violet-500" />
          Upload Recording
        </button>
        <p className="text-xs text-center text-[#9a958f] dark:text-[#6b7280]">
          Audio or video (max 500MB)
        </p>
      </div>
    );
  }

  // Helper to get the right icon for file type
  const getFileIcon = () => {
    if (file?.type.startsWith('video/')) {
      return <FileVideo className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] shrink-0" />;
    }
    return <FileAudio className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] shrink-0" />;
  };

  // File selected - show file info and upload button
  if (file && status === 'idle') {
    return (
      <div className="space-y-3 p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          {getFileIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-[#1a1a1a] dark:text-[#f5f5f8]">
              {file.name}
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              {formatFileSize(file.size)}
            </p>
          </div>
          <button
            onClick={handleReset}
            className="p-1 hover:bg-[#e1ddd8] dark:hover:bg-[#313746] rounded-md transition-colors"
          >
            <X className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </button>
        </div>
        <Button onClick={handleUpload} className="w-full" size="sm">
          Upload Recording
        </Button>
      </div>
    );
  }

  // Shared discard dialog component
  const discardDialog = (
    <DiscardUploadDialog
      isOpen={showDiscardDialog}
      onStay={handleDiscardCancel}
      onDiscard={handleDiscardConfirm}
      isDeleting={isDeleting}
      title="Discard Recording?"
      description="You have an uploaded recording that hasn't been saved. If you leave now, the recording will be permanently deleted."
    />
  );

  // Uploading state
  if (status === 'uploading') {
    return (
      <>
        <div className="space-y-2 p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
            <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Uploading...
            </span>
            <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] ml-auto">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        {discardDialog}
      </>
    );
  }

  // Encoding state (Bunny is processing the video)
  if (status === 'encoding') {
    return (
      <>
        <div className="p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
            <div>
              <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Processing video...
              </p>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                This may take a few minutes
              </p>
            </div>
          </div>
        </div>
        {discardDialog}
      </>
    );
  }

  // Saving state (linking to event)
  if (status === 'saving') {
    return (
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Saving recording...
          </p>
        </div>
      </div>
    );
  }

  // Completed state
  if (status === 'completed') {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Recording uploaded!
            </p>
            <p className="text-xs text-green-600 dark:text-green-400">
              Will be ready shortly after processing
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error' && error) {
    return (
      <>
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error.includes('Insufficient credits') ? 'Insufficient credits' : 'Upload failed'}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 truncate">
                {error.includes('Insufficient credits') ? (
                  <a href="/coach/plan" className="underline">
                    Upgrade your plan
                  </a>
                ) : (
                  error
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Try again
          </button>
        </div>
        {discardDialog}
      </>
    );
  }

  // Fallback - render discard dialog if needed (for any status)
  return discardDialog;
}
