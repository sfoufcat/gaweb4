'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

type MediaType = 'image' | 'video' | 'any' | 'file';

interface MediaUploadProps {
  value: string; // Current URL
  onChange: (url: string) => void;
  folder: 'events' | 'articles' | 'courses' | 'courses/lessons' | 'downloads' | 'links' | 'programs' | 'squads' | 'promo';
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
    case 'any':
      return 'image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
  }
};

const getMaxSize = (type: MediaType) => {
  // Images: 10MB, Videos: 500MB
  return type === 'video' ? 500 * 1024 * 1024 : 10 * 1024 * 1024;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const isVideoUrl = (url: string) => {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
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
}: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = getAcceptedTypes(type);
  const maxSize = getMaxSize(type);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      const typeLabel = type === 'image' ? 'image (JPG, PNG, WebP, GIF)' 
        : type === 'video' ? 'video (MP4, WebM, MOV)' 
        : 'image or video';
      setError(`Please select a valid ${typeLabel} file`);
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${formatFileSize(maxSize)}`);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(10); // Show initial progress

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
        throw new Error(data.error || 'Upload failed');
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
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleClear = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isVideo = value && isVideoUrl(value);

  // Get label text based on type
  const getTypeLabel = () => {
    switch (type) {
      case 'image': return 'image';
      case 'video': return 'video';
      case 'any': return 'file';
    }
  };

  const getFormatHint = () => {
    switch (type) {
      case 'image': return `JPG, PNG, WebP, GIF (max ${formatFileSize(maxSize)})`;
      case 'video': return `MP4, WebM, MOV (max ${formatFileSize(maxSize)})`;
      case 'any': return `Images or videos (max ${formatFileSize(maxSize)})`;
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
          {/* Preview or Upload area */}
          {value ? (
            <div className={`relative ${previewSize === 'thumbnail' ? 'inline-block' : ''}`}>
              <div className={`relative rounded-lg overflow-hidden bg-[#f5f2ed] border border-[#e1ddd8] dark:border-[#262b35] ${
                previewSize === 'thumbnail' ? 'w-20 h-20' : 'w-full'
              }`}>
                {isVideo ? (
                  <video
                    src={value}
                    controls
                    className={previewSize === 'thumbnail' 
                      ? "w-full h-full object-cover bg-black" 
                      : "w-full h-auto max-h-48 object-contain bg-black"}
                  />
                ) : (
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
                className={`absolute bg-white/90 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm ${
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
              className={`
                relative rounded-lg border-2 border-dashed transition-colors
                ${previewSize === 'thumbnail' ? 'w-20 h-20' : `w-full ${getAspectRatioClass(aspectRatio)}`}
                ${uploading
                  ? 'border-brand-accent bg-brand-accent/5 cursor-wait' 
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
                        <circle cx="18" cy="18" r="16" fill="none" stroke="#a07855" strokeWidth="3" strokeDasharray={`${progress} 100`} strokeLinecap="round" />
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
                            stroke="#a07855"
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
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Click to upload {getTypeLabel()}</p>
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
