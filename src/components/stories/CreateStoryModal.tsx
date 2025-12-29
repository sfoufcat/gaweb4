'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useCreateStory } from '@/hooks/useUserStories';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

const MAX_CAPTION_LENGTH = 200;

/**
 * CreateStoryModal - Modal for creating new user-posted stories
 * 
 * Supports:
 * - Camera capture (mobile)
 * - Gallery selection
 * - Video recording (up to 15 seconds)
 * - Caption input
 * - Preview before posting
 */
export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const { user } = useUser();
  const { colors, isDefault } = useBrandingValues();
  const { createStory, isCreating } = useCreateStory();

  const [selectedMedia, setSelectedMedia] = useState<{
    type: 'image' | 'video';
    url: string;
    file: File;
  } | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const accentColor = colors.accentLight || 'var(--brand-accent-light)';

  // Reset state
  const resetState = useCallback(() => {
    setSelectedMedia(null);
    setCaption('');
    setError(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (selectedMedia && !confirm('Discard this story?')) return;
    resetState();
    onClose();
  }, [selectedMedia, resetState, onClose]);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setError('Please select an image or video file');
      return;
    }

    // Check file size (max 50MB for videos, 10MB for images)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${isVideo ? '50MB' : '10MB'}`);
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);

    setSelectedMedia({
      type: isVideo ? 'video' : 'image',
      url,
      file,
    });
    setError(null);
  }, []);

  // Handle post story
  const handlePost = useCallback(async () => {
    if (!selectedMedia || isCreating || isUploading) return;

    setIsUploading(true);
    setError(null);

    try {
      // Upload the media file first
      const formData = new FormData();
      formData.append('file', selectedMedia.file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload media');
      }

      const uploadData = await uploadResponse.json();

      // Create the story
      await createStory({
        imageUrl: selectedMedia.type === 'image' ? uploadData.url : undefined,
        videoUrl: selectedMedia.type === 'video' ? uploadData.url : undefined,
        caption: caption.trim() || undefined,
      });

      // Clean up preview URL
      URL.revokeObjectURL(selectedMedia.url);

      // Success
      resetState();
      onClose();
      onStoryCreated?.();
    } catch (err) {
      console.error('Story creation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create story');
    } finally {
      setIsUploading(false);
    }
  }, [selectedMedia, isCreating, isUploading, caption, createStory, resetState, onClose, onStoryCreated]);

  // Open camera
  const handleOpenCamera = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*';
      fileInputRef.current.capture = 'environment';
      fileInputRef.current.click();
    }
  }, []);

  // Open gallery
  const handleOpenGallery = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = 'image/*,video/*';
      fileInputRef.current.removeAttribute('capture');
      fileInputRef.current.click();
    }
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex flex-col">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 safe-area-inset-top">
          <button
            onClick={handleClose}
            className="text-white text-[15px] hover:text-white/80 transition-colors"
          >
            Cancel
          </button>
          <h2 className="font-semibold text-white text-[16px]">
            Add to Story
          </h2>
          {selectedMedia ? (
            <button
              onClick={handlePost}
              disabled={isCreating || isUploading}
              className="px-4 py-1.5 rounded-full text-[14px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: accentColor }}
            >
              {isCreating || isUploading ? 'Posting...' : 'Share'}
            </button>
          ) : (
            <div className="w-16" /> // Spacer
          )}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          {selectedMedia ? (
            // Preview mode
            <div className="flex-1 relative">
              {selectedMedia.type === 'image' ? (
                <Image
                  src={selectedMedia.url}
                  alt="Story preview"
                  fill
                  className="object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={selectedMedia.url}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                />
              )}

              {/* Remove button */}
              <button
                onClick={resetState}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Caption input */}
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION_LENGTH))}
                  placeholder="Add a caption..."
                  className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-md text-white placeholder-white/50 text-[15px] focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                <p className="text-right text-[11px] text-white/40 mt-1">
                  {caption.length}/{MAX_CAPTION_LENGTH}
                </p>
              </div>
            </div>
          ) : (
            // Selection mode
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              {/* User avatar */}
              <div className="w-20 h-20 rounded-full overflow-hidden mb-6 ring-4 ring-white/20">
                {user?.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt="Your avatar"
                    width={80}
                    height={80}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-2xl font-semibold">
                    {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                  </div>
                )}
              </div>

              <h3 className="text-xl font-semibold text-white mb-2">
                Share your moment
              </h3>
              <p className="text-white/60 text-[14px] text-center mb-8 max-w-xs">
                Capture a photo or video to share with your community for 24 hours
              </p>

              {/* Action buttons */}
              <div className="flex gap-4">
                {/* Camera button */}
                <button
                  onClick={handleOpenCamera}
                  className="w-32 py-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors flex flex-col items-center gap-2"
                >
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                  </svg>
                  <span className="text-white text-[14px] font-medium">Camera</span>
                </button>

                {/* Gallery button */}
                <button
                  onClick={handleOpenGallery}
                  className="w-32 py-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors flex flex-col items-center gap-2"
                >
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  <span className="text-white text-[14px] font-medium">Gallery</span>
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="absolute bottom-24 inset-x-4">
              <div className="p-3 rounded-xl bg-red-500/20 backdrop-blur-md text-red-200 text-[14px] text-center">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

