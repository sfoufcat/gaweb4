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
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
}

interface RecordingUploadProps {
  clients: Client[];
  onUploadComplete?: (summaryId: string) => void;
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const ACCEPTED_FORMATS = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.pdf'];;
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

/**
 * RecordingUpload
 *
 * Component for uploading external call recordings (from Zoom, Meet, etc.)
 * Allows coaches to generate AI summaries from uploaded recordings.
 */
export function RecordingUpload({
  clients,
  onUploadComplete,
}: RecordingUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState<string>('');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((selectedFile: File) => {
    // Validate file type
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(extension)) {
      setError(`Invalid file type. Accepted: ${ACCEPTED_FORMATS.join(', ')}`);
      return;
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 500MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (!file || !clientId) return;

    try {
      setStatus('uploading');
      setProgress(0);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientUserId', clientId);

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<{ summaryId: string }>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText?.slice(0, 100) || 'Unknown error'}`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error - please check your connection'));
      });

      xhr.open('POST', '/api/coach/recordings/upload');
      xhr.send(formData);

      setStatus('processing');
      const result = await uploadPromise;

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
    setClientId('');
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

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {status === 'idle' && !file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            'hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FORMATS.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Upload Recording or Document</p>
          <p className="text-sm text-muted-foreground mt-1">
            Drag and drop or click to select
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Supports: {ACCEPTED_FORMATS.join(', ')} (max 500MB)
          </p>
          <p className="text-xs text-muted-foreground">
            PDFs are free. Audio/video uses summary credits.
          </p>
        </div>
      )}

      {/* Selected File */}
      {file && status === 'idle' && (
        <div className="border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-muted">
              {file.type === 'application/pdf' ? (
                <FileText className="h-6 w-6 text-muted-foreground" />
              ) : (
                <FileAudio className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="shrink-0 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Client Selection */}
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Select Client
              </label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleUpload}
              disabled={!clientId}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </Button>
          </div>
        </div>
      )}

      {/* Uploading State */}
      {status === 'uploading' && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="font-medium">Uploading...</span>
            <span className="text-sm text-muted-foreground ml-auto">
              {progress}%
            </span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {/* Processing State */}
      {status === 'processing' && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">Processing Recording</p>
              <p className="text-sm text-muted-foreground">
                Transcribing and generating AI summary...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {status === 'completed' && (
        <div className="border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                Summary Generated
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                The call summary is ready for review.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="mt-3"
          >
            Upload Another
          </Button>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                {error.includes('Insufficient credits') ? 'Insufficient credits' : 'Upload Failed'}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {error.includes('Insufficient credits') ? (
                  <a href="/coach/plan" className="underline hover:text-red-700 dark:hover:text-red-300">
                    Upgrade your plan or buy extra credits
                  </a>
                ) : (
                  error
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="mt-3"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
