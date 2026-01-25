'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Loader2,
  FileAudio,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface InlineRecordingUploadProps {
  eventId: string;
  clientUserId?: string;
  cohortId?: string;
  squadId?: string;
  onUploadComplete?: (summaryId: string) => void;
  onProcessingStarted?: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const ACCEPTED_FORMATS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.pdf'];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * InlineRecordingUpload
 *
 * Compact recording upload component for EventDetailPopup.
 * Uploads external call recordings and generates AI summaries linked to the event.
 */
export function InlineRecordingUpload({
  eventId,
  clientUserId,
  cohortId,
  squadId,
  onUploadComplete,
  onProcessingStarted,
}: InlineRecordingUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Step 1: Get signed URL
      const signedUrlResponse = await fetch('/api/coach/recordings/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get upload URL');
      }

      const { uploadUrl, storagePath } = await signedUrlResponse.json();

      // Step 2: Upload to Firebase Storage
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);

      await uploadPromise;

      setStatus('processing');
      onProcessingStarted?.();

      // Step 3: Trigger processing with eventId
      const processResponse = await fetch('/api/coach/recordings/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath,
          fileName: file.name,
          fileSize: file.size,
          eventId,
          clientUserId,
          cohortId,
          squadId,
        }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Processing failed');
      }

      const result = await processResponse.json();

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      setStatus('completed');

      if (onUploadComplete && result.summaryId) {
        onUploadComplete(result.summaryId);
      }
    } catch (err) {
      console.error('Error uploading recording:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Idle state - show upload button
  if (status === 'idle' && !file) {
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
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert font-medium text-sm hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Recording for Summary
        </button>
        <p className="text-xs text-center text-[#5f5a55] dark:text-[#b2b6c2]">
          Audio, video, or PDF (max 500MB)
        </p>
      </div>
    );
  }

  // File selected - show file info and generate button
  if (file && status === 'idle') {
    return (
      <div className="space-y-3 p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          {file.type === 'application/pdf' ? (
            <FileText className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] shrink-0" />
          ) : (
            <FileAudio className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] shrink-0" />
          )}
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
        <Button
          onClick={handleUpload}
          className="w-full"
          size="sm"
        >
          Generate Summary
        </Button>
      </div>
    );
  }

  // Uploading state
  if (status === 'uploading') {
    return (
      <div className="space-y-2 p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
            Uploading...
          </span>
          <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] ml-auto">
            {progress}%
          </span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  // Processing state
  if (status === 'processing') {
    return (
      <div className="p-3 bg-[#f3f1ef] dark:bg-[#262b35] rounded-xl">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          <div>
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
              Generating summary...
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              This may take a few minutes
            </p>
          </div>
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
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Summary generated!
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error' && error) {
    return (
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
    );
  }

  return null;
}
