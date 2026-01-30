'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import * as tus from 'tus-js-client';
import { Loader2, Play } from 'lucide-react';
import { pollForThumbnail } from '@/lib/video-thumbnail';
import { VideoPlayer } from '@/components/video/VideoPlayer';

type MediaType = 'image' | 'video' | 'any' | 'file';

interface MediaUploadProps {
  value: string; // Current URL
  onChange: (url: string) => void;
  folder: 'events' | 'articles' | 'courses' | 'courses/lessons' | 'downloads' | 'links' | 'programs' | 'squads' | 'promo' | 'websites';
  type?: MediaType;
  label?: string;
  required?: boolean;
  /** Custom upload endpoint URL (defaults to /api/admin/upload-media) */
  uploadEndpoint?: string;
  /** Hide the label row (use when providing external label) */
  hideLabel?: boolean;
  /** Aspect ratio for preview container (matches how image will be displayed) */
  aspectRatio?: '2:1' | '16:9' | '1:1' | '4:3';
  /** Preview size: 'full' (default) shows full-width preview, 'thumbnail' shows compact square */
  previewSize?: 'full' | 'thumbnail';
  /** When true, preview is shown in a collapsible drawer to save space in modals */
  collapsiblePreview?: boolean;
  /** Callback when a Bunny video is created (for tracking pending uploads that need cleanup on discard) */
  onBunnyVideoCreated?: (videoId: string) => void;
  /** Callback when auto-generated thumbnail is ready (after polling Bunny CDN) - only for video type */
  onThumbnailReady?: (thumbnailUrl: string) => void;
}

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const FILE_TYPES = ['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

const getAcceptedTypes = (type: MediaType) => {
  switch (type) {
    case 'image':
      return IMAGE_TYPES;
    case 'video':
      return VIDEO_TYPES;
    case 'file':
      return FILE_TYPES;
    case 'any':
      return [...IMAGE_TYPES, ...VIDEO_TYPES, ...FILE_TYPES];
  }
};

const getAcceptString = (type: MediaType) => {
  switch (type) {
    case 'image':
      return 'image/jpeg,image/jpg,image/png,image/webp,image/gif';
    case 'video':
      return 'video/mp4,video/webm,video/quicktime';
    case 'file':
      return 'application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.doc,.docx,.xls,.xlsx,.zip';
    case 'any':
      return 'image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,application/zip,.pdf,.doc,.docx,.xls,.xlsx,.zip';
  }
};

const getMaxSize = (type: MediaType) => {
  // Images: 10MB, Videos: 500MB, Files: 50MB
  if (type === 'video') return 500 * 1024 * 1024;
  if (type === 'file') return 50 * 1024 * 1024;
  return 10 * 1024 * 1024;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const isVideoUrl = (url: string) => {
  // Match traditional video files
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return true;
  // Match HLS streams (.m3u8)
  if (/\.m3u8(\?|$)/i.test(url)) return true;
  // Match Bunny CDN video URLs (pattern: vz-*.b-cdn.net/{videoId}/*)
  if (/vz-[a-z0-9-]+\.b-cdn\.net\/[a-f0-9-]+/i.test(url)) return true;
  return false;
};

const isImageUrl = (url: string) => {
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);
};

const getFileTypeFromUrl = (url: string): { type: string; icon: 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'audio' | 'generic'; color: string } => {
  const ext = url.split('.').pop()?.toLowerCase()?.split('?')[0] || '';

  if (ext === 'pdf') return { type: 'PDF', icon: 'pdf', color: '#dc2626' };
  if (['doc', 'docx'].includes(ext)) return { type: 'Word', icon: 'word', color: '#2563eb' };
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { type: 'Excel', icon: 'excel', color: '#16a34a' };
  if (['ppt', 'pptx'].includes(ext)) return { type: 'PowerPoint', icon: 'powerpoint', color: '#ea580c' };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { type: 'Archive', icon: 'zip', color: '#eab308' };
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) return { type: 'Audio', icon: 'audio', color: '#8b5cf6' };

  return { type: ext.toUpperCase() || 'File', icon: 'generic', color: '#6b7280' };
};

const getFileNameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const filename = path.split('/').pop() || 'file';
    // Remove timestamp prefix if present (e.g., "1234567890-filename.pdf" -> "filename.pdf")
    return filename.replace(/^\d+-/, '');
  } catch {
    return url.split('/').pop()?.split('?')[0] || 'file';
  }
};

const FileIcon = ({ icon, size = 24 }: { icon: 'pdf' | 'word' | 'excel' | 'powerpoint' | 'zip' | 'audio' | 'generic'; size?: number }) => {
  const iconMap = {
    pdf: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
        <path d="M8 12h.01" />
        <path d="M8 16h.01" />
      </svg>
    ),
    word: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h2l1 4 1-4h2" />
      </svg>
    ),
    excel: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13v4" />
        <path d="M12 13v4" />
        <path d="M16 13v4" />
        <path d="M8 13h8" />
        <path d="M8 15.5h8" />
      </svg>
    ),
    powerpoint: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <rect x="8" y="12" width="8" height="6" rx="1" />
      </svg>
    ),
    zip: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M10 12h1v1h-1z" />
        <path d="M13 12h1v1h-1z" />
        <path d="M10 15h1v1h-1z" />
        <path d="M13 15h1v1h-1z" />
      </svg>
    ),
    audio: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    generic: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  };
  return iconMap[icon];
};

const getAspectRatioClass = (ratio?: '2:1' | '16:9' | '1:1' | '4:3') => {
  switch (ratio) {
    case '2:1': return 'aspect-[2/1]';
    case '16:9': return 'aspect-video';
    case '1:1': return 'aspect-square';
    case '4:3': return 'aspect-[4/3]';
    default: return 'h-32'; // Default fixed height
  }
};

// Vercel serverless functions have a 4.5MB body limit
// Videos typically exceed this, so we use direct-to-storage upload
const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;

export function MediaUpload({
  value,
  onChange,
  folder,
  type = 'image',
  label = 'Media',
  required = false,
  uploadEndpoint = '/api/admin/upload-media',
  hideLabel = false,
  aspectRatio,
  previewSize = 'full',
  collapsiblePreview = false,
  onBunnyVideoCreated,
  onThumbnailReady,
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [isWaitingForThumbnail, setIsWaitingForThumbnail] = useState(false);

  // Reset thumbnail waiting state when video value changes
  useEffect(() => {
    setIsWaitingForThumbnail(false);
  }, [value]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const tusUploadRef = useRef<tus.Upload | null>(null);
  const dragCounterRef = useRef(0);

  const acceptedTypes = getAcceptedTypes(type);
  const maxSize = getMaxSize(type);

  // Determine if we should use direct upload (for large files that exceed Vercel's body limit)
  const shouldUseDirectUpload = (file: File) => {
    const isCoachEndpoint = uploadEndpoint.includes('/api/coach/');
    const exceedsLimit = file.size > VERCEL_BODY_LIMIT;
    // Use direct upload for any file type that exceeds the limit (videos, large documents, etc.)
    return isCoachEndpoint && exceedsLimit;
  };

  // Direct upload - routes to Bunny Stream (video/audio) or Firebase Storage (other files)
  const handleDirectUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      // Step 1: Get upload configuration from server
      const urlResponse = await fetch('/api/coach/org-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          folder,
        }),
      });

      if (!urlResponse.ok) {
        const data = await urlResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get upload URL');
      }

      const uploadConfig = await urlResponse.json();

      if (uploadConfig.uploadType === 'bunny') {
        // Bunny Stream upload for video/audio using TUS protocol
        await handleBunnyUpload(file, uploadConfig);
      } else if (uploadConfig.uploadType === 'bunny-storage') {
        // Bunny Storage for images - use server endpoint instead of direct upload
        // This happens when the file exceeds Vercel limit but is an image
        // Fall back to server upload which handles Bunny Storage
        await handleServerUpload(file);
      } else {
        // Firebase Storage upload for documents
        await handleFirebaseDirectUpload(file, uploadConfig);
      }
    } catch (err) {
      console.error('Direct upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
      xhrRef.current = null;
      tusUploadRef.current = null;
    }
  };

  // Bunny Stream upload using TUS protocol
  const handleBunnyUpload = async (
    file: File,
    config: {
      videoId: string;
      tusEndpoint: string;
      tusHeaders: Record<string, string>;
    }
  ) => {
    const { videoId, tusEndpoint, tusHeaders } = config;

    // Debug: Log what we're sending to TUS
    console.log('[BUNNY_TUS_CLIENT] Starting upload:', {
      videoId,
      tusEndpoint,
      headers: {
        ...tusHeaders,
        AuthorizationSignature: String(tusHeaders.AuthorizationSignature).substring(0, 20) + '...',
      },
    });

    return new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: tusHeaders,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onBeforeRequest: (req) => {
          // Debug: Log actual request headers
          console.log('[BUNNY_TUS_CLIENT] Request headers:', {
            method: req.getMethod(),
            url: req.getURL(),
            AuthorizationSignature: req.getHeader('AuthorizationSignature')?.substring(0, 20) + '...',
            AuthorizationExpire: req.getHeader('AuthorizationExpire'),
            VideoId: req.getHeader('VideoId'),
            LibraryId: req.getHeader('LibraryId'),
          });
        },
        onError: (error) => {
          console.error('TUS upload error:', error);
          reject(new Error('Upload failed: ' + error.message));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setProgress(percentage);
        },
        onSuccess: () => {
          setProgress(100);
          // For videos, the final URL comes from webhook after encoding
          // Return a placeholder that will be updated by webhook
          // The course editor will need to handle the encoding state
          const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'vz-cdn.b-cdn.net';
          const playbackUrl = `https://${cdnHostname}/${videoId}/playlist.m3u8`;

          setTimeout(() => {
            onChange(playbackUrl);
            setUploading(false);
            setProgress(0);
            tusUploadRef.current = null;
            resolve();
          }, 200);

          // Start polling for auto-generated thumbnail in background
          if (onThumbnailReady) {
            setIsWaitingForThumbnail(true);
            pollForThumbnail(videoId)
              .then((thumbnailUrl) => {
                onThumbnailReady(thumbnailUrl);
              })
              .finally(() => {
                setIsWaitingForThumbnail(false);
              });
          }
        },
      });

      tusUploadRef.current = upload;

      // Notify parent that a Bunny video was created (for cleanup on discard)
      onBunnyVideoCreated?.(videoId);

      // Check for previous uploads to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  };

  // Firebase Storage direct upload
  const handleFirebaseDirectUpload = async (
    file: File,
    config: { uploadUrl: string; publicUrl: string; storagePath: string }
  ) => {
    const { uploadUrl, publicUrl, storagePath } = config;

    // Upload directly to Firebase Storage with progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          // Use 0-90% for upload, 90-100% for making public
          const percent = Math.round((e.loaded / e.total) * 90);
          setProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload cancelled'));

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Make the file publicly accessible
    setProgress(95);
    const makePublicResponse = await fetch('/api/coach/org-make-public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath }),
    });

    if (!makePublicResponse.ok) {
      const data = await makePublicResponse.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to make file public');
    }

    setProgress(100);

    // Small delay to show 100% before clearing
    setTimeout(() => {
      onChange(publicUrl);
      setUploading(false);
      setProgress(0);
      xhrRef.current = null;
    }, 200);
  };

  // Server-side upload (for images and small files)
  const handleServerUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      // Simulate progress during upload
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // Provide user-friendly error messages
        if (response.status === 413 || data.code === 'FILE_TOO_LARGE_FOR_SERVER') {
          throw new Error(`File too large (${formatFileSize(file.size)}). Maximum size for this upload type is ${formatFileSize(VERCEL_BODY_LIMIT)}.`);
        }
        if (response.status === 401) {
          throw new Error('Please sign in to upload files.');
        }
        if (response.status === 403) {
          throw new Error('You don\'t have permission to upload files.');
        }
        throw new Error(data.error || data.details || 'Upload failed. Please try again.');
      }

      const data = await response.json();
      setProgress(100);

      // Small delay to show 100% before clearing
      setTimeout(() => {
        onChange(data.url);
        setUploading(false);
        setProgress(0);
      }, 200);
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      // Make network errors more friendly
      if (message === 'Failed to fetch' || message.includes('NetworkError')) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(message);
      }
      setUploading(false);
      setProgress(0);
    }
  };

  const processFile = async (file: File) => {
    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      const typeLabel = type === 'image' ? 'image (JPG, PNG, WebP, GIF)'
        : type === 'video' ? 'video (MP4, WebM, MOV)'
        : type === 'file' ? 'document (PDF, Word, Excel, ZIP)'
        : 'file';
      setError(`Please select a valid ${typeLabel} file`);
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${formatFileSize(maxSize)}`);
      return;
    }

    // Check if file exceeds Vercel limit but direct upload isn't available
    const isCoachEndpoint = uploadEndpoint.includes('/api/coach/');
    if (file.size > VERCEL_BODY_LIMIT && !isCoachEndpoint) {
      setError(`File too large (${formatFileSize(file.size)}). Files larger than ${formatFileSize(VERCEL_BODY_LIMIT)} require using the coach dashboard.`);
      return;
    }

    // Route to appropriate upload method
    if (shouldUseDirectUpload(file)) {
      await handleDirectUpload(file);
    } else {
      await handleServerUpload(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleClear = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isVideo = value && isVideoUrl(value);
  const isImage = value && isImageUrl(value);
  const isFile = value && !isVideo && !isImage;
  const fileInfo = isFile ? getFileTypeFromUrl(value) : null;
  const fileName = isFile ? getFileNameFromUrl(value) : null;

  // Get label text based on type
  const getTypeLabel = () => {
    switch (type) {
      case 'image': return 'image';
      case 'video': return 'video';
      case 'file': return 'file';
      case 'any': return 'file';
    }
  };

  const getFormatHint = () => {
    switch (type) {
      case 'image': return `JPG, PNG, WebP, GIF (max ${formatFileSize(maxSize)})`;
      case 'video': return `MP4, WebM, MOV (max ${formatFileSize(maxSize)})`;
      case 'file': return `PDF, Word, Excel, ZIP (max ${formatFileSize(maxSize)})`;
      case 'any': return `Images, videos, or documents (max ${formatFileSize(maxSize)})`;
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {label} {required && '*'}
          </label>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-brand-accent hover:text-brand-accent/90 font-albert"
          >
            {showUrlInput ? 'Upload file' : 'Enter URL manually'}
          </button>
        </div>
      )}

      {showUrlInput ? (
        // Manual URL input
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent font-albert"
        />
      ) : (
        // File upload
        <div className="space-y-2">
          {/* Collapsible mode - wraps both empty and filled states */}
          {collapsiblePreview ? (
            <div className="rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden bg-white dark:bg-[#1d222b]">
              {/* Collapsed header - always visible */}
              <button
                type="button"
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
                className="w-full flex items-center gap-3 p-3 hover:bg-[#f9f7f5] dark:hover:bg-[#262b35]/50 transition-colors"
              >
                {/* Small thumbnail or placeholder icon */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[#f5f2ed] dark:bg-[#1a1f2a] flex-shrink-0 flex items-center justify-center">
                  {value && isImage ? (
                    <Image
                      src={value}
                      alt="Cover preview"
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <svg className="w-6 h-6 text-[#a7a39e] dark:text-[#5f6670]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                {/* Label */}
                <span className="flex-1 text-left text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {value ? 'Cover Image' : 'Add Cover Image'}
                </span>
                {/* Chevron */}
                <svg
                  className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform duration-200 ${isPreviewExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expandable content area */}
              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${
                  isPreviewExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-3 pb-3">
                  {value && isImage ? (
                    // Show preview with remove button
                    <div className={`relative rounded-lg overflow-hidden bg-[#f5f2ed] dark:bg-[#1a1f2a] w-full ${getAspectRatioClass(aspectRatio)}`}>
                      <Image
                        src={value}
                        alt="Preview"
                        fill
                        className="object-cover"
                        sizes="400px"
                      />
                      {/* Remove button on image */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClear();
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-[#1a1f2a]/90 backdrop-blur-sm rounded-full hover:bg-white dark:hover:bg-[#1a1f2a] transition-colors shadow-sm"
                        title={`Remove ${getTypeLabel()}`}
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    // Show dropzone for upload
                    <div
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className={`
                        relative rounded-lg border-2 border-dashed transition-all cursor-pointer
                        w-full ${getAspectRatioClass(aspectRatio)}
                        ${uploading
                          ? 'border-brand-accent bg-brand-accent/5 cursor-wait'
                          : isDragging
                            ? 'border-brand-accent bg-brand-accent/10 ring-2 ring-brand-accent/20'
                            : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent hover:bg-[#faf8f6] dark:hover:bg-white/5'
                        }
                      `}
                    >
                      {uploading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-12 h-12 relative">
                            <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                              <circle cx="18" cy="18" r="16" fill="none" stroke="#e1ddd8" strokeWidth="2" />
                              <circle cx="18" cy="18" r="16" fill="none" stroke="var(--brand-accent-light)" strokeWidth="2" strokeDasharray={`${progress} 100`} strokeLinecap="round" />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-brand-accent font-albert">
                              {progress}%
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Uploading...</p>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <svg className="w-8 h-8 text-brand-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            {isDragging ? `Drop ${getTypeLabel()} here` : `Drag & drop or click to upload`}
                          </p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert mt-1">{getFormatHint()}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : value ? (
            // Non-collapsible mode with preview
            <div className={`relative ${previewSize === 'thumbnail' ? 'inline-block' : ''}`}>
              <div className={`relative rounded-xl overflow-hidden ${isVideo ? 'bg-black' : 'bg-[#f5f2ed] dark:bg-[#1a1f2a] border border-[#e1ddd8] dark:border-[#262b35]'} ${
                previewSize === 'thumbnail' ? 'w-20 h-20' : 'w-full'
              }`}>
                {isVideo ? (
                  previewSize === 'thumbnail' ? (
                    // Compact thumbnail mode - show play icon overlay
                    <div className="w-full h-full bg-black flex items-center justify-center">
                      <Play className="w-6 h-6 text-white/70" />
                    </div>
                  ) : (
                    // Full-width video player with HLS support
                    <div className="w-full">
                      <VideoPlayer
                        src={value}
                        aspectRatio={aspectRatio === '4:3' ? '4:3' : aspectRatio === '1:1' ? '1:1' : '16:9'}
                      />
                      {isWaitingForThumbnail && (
                        <div className="flex items-center gap-2 mt-2 px-1 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
                          <span>Uploaded - Generating thumbnail...</span>
                        </div>
                      )}
                    </div>
                  )
                ) : isFile && fileInfo ? (
                  // File preview (PDF, Word, Excel, etc.)
                  <div className={`flex items-center gap-3 p-4 ${
                    previewSize === 'thumbnail' ? 'flex-col justify-center h-full p-2' : ''
                  }`}>
                    <div
                      className={`flex-shrink-0 ${previewSize === 'thumbnail' ? '' : 'p-3 rounded-lg bg-white dark:bg-[#11141b]'}`}
                      style={{ color: fileInfo.color }}
                    >
                      <FileIcon icon={fileInfo.icon} size={previewSize === 'thumbnail' ? 28 : 36} />
                    </div>
                    {previewSize !== 'thumbnail' && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate font-albert">
                          {fileName}
                        </p>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                          {fileInfo.type} Document
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  // Image preview
                  <div className={previewSize === 'thumbnail'
                    ? "relative w-full h-full"
                    : `relative w-full ${getAspectRatioClass(aspectRatio)}`}>
                    <Image
                      src={value}
                      alt="Preview"
                      fill
                      className="object-cover"
                      sizes={previewSize === 'thumbnail' ? "80px" : "400px"}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleClear}
                className={`absolute bg-white/90 dark:bg-[#1a1f2a]/90 backdrop-blur-sm rounded-full hover:bg-white dark:hover:bg-[#1a1f2a] transition-colors shadow-sm ${
                  previewSize === 'thumbnail' ? '-top-1 -right-1 p-1' : 'top-2 right-2 p-1.5'
                }`}
                title={`Remove ${getTypeLabel()}`}
              >
                <svg className={`text-red-500 ${previewSize === 'thumbnail' ? 'w-3 h-3' : 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`
                relative rounded-lg border-2 border-dashed transition-all
                ${previewSize === 'thumbnail' ? 'w-20 h-20' : `w-full ${getAspectRatioClass(aspectRatio)}`}
                ${uploading
                  ? 'border-brand-accent bg-brand-accent/5 cursor-wait'
                  : isDragging
                    ? 'border-brand-accent bg-brand-accent/10 ring-2 ring-brand-accent/20 scale-[1.02]'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent hover:bg-[#faf8f6] dark:hover:bg-white/5 cursor-pointer'
                }
              `}
            >
              {uploading ? (
                // Upload progress
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {previewSize === 'thumbnail' ? (
                    // Compact progress for thumbnail mode
                    <div className="w-8 h-8 relative">
                      <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#e1ddd8" strokeWidth="3" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="var(--brand-accent-light)" strokeWidth="3" strokeDasharray={`${progress} 100`} strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-brand-accent font-albert">
                        {progress}%
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 relative">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            stroke="#e1ddd8"
                            strokeWidth="2"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="16"
                            fill="none"
                            stroke="var(--brand-accent-light)"
                            strokeWidth="2"
                            strokeDasharray={`${progress} 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-brand-accent font-albert">
                          {progress}%
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Uploading...</p>
                    </>
                  )}
                </div>
              ) : (
                // Upload prompt
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {previewSize === 'thumbnail' ? (
                    // Compact icon for thumbnail mode
                    <svg className="w-6 h-6 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                  ) : (
                    <>
                      {type === 'video' ? (
                        <svg className="w-8 h-8 text-brand-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-brand-accent mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        {isDragging ? `Drop ${getTypeLabel()} here` : `Drag & drop or click to upload`}
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert mt-1">{getFormatHint()}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptString(type)}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 font-albert">{error}</p>
      )}
    </div>
  );
}

// Keep backwards compatible export
export { MediaUpload as ImageUpload };
