'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { useCreateStory } from '@/hooks/useUserStories';
import { DiscardConfirmationModal } from './ConfirmationModal';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

/**
 * CreateStoryModal - A dedicated modal for creating story content.
 * 
 * Unlike feed posts, stories are visual-only (image/video) with an optional caption.
 * This provides a quick, focused experience for adding ephemeral content.
 */
export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const { user } = useUser();
  const { colors, isDefault } = useBrandingValues();
  const { createStory, isCreating, error: createError } = useCreateStory();
  
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;
  const hasContent = !!mediaUrl;

  // Auto-open file picker when modal opens
  useEffect(() => {
    if (isOpen && !mediaUrl) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mediaUrl]);

  // Reset form
  const resetForm = useCallback(() => {
    setMediaUrl(null);
    setIsVideo(false);
    setCaption('');
    setIsUploading(false);
    setErrorMessage(null);
    setShowDiscardModal(false);
  }, []);

  // Handle close - show discard modal if there's content
  const handleClose = useCallback(() => {
    if (hasContent) {
      setShowDiscardModal(true);
      return;
    }
    resetForm();
    onClose();
  }, [hasContent, resetForm, onClose]);

  // Confirm discard
  const handleConfirmDiscard = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      // User cancelled file picker - close modal if no media
      if (!mediaUrl) {
        onClose();
      }
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const file = files[0];
      const isVideoFile = file.type.startsWith('video/');

      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload to file storage
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setMediaUrl(data.url);
      setIsVideo(isVideoFile);
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [mediaUrl, onClose]);

  // Remove media
  const removeMedia = useCallback(() => {
    setMediaUrl(null);
    setIsVideo(false);
    // Reopen file picker
    setTimeout(() => fileInputRef.current?.click(), 100);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!mediaUrl || isCreating) return;

    try {
      await createStory({
        imageUrl: isVideo ? undefined : mediaUrl,
        videoUrl: isVideo ? mediaUrl : undefined,
        caption: caption.trim() || undefined,
      });

      resetForm();
      onClose();
      onStoryCreated?.();
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(createError || 'Failed to create story');
    }
  }, [mediaUrl, isVideo, caption, isCreating, createStory, createError, resetForm, onClose, onStoryCreated]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-backdrop-fade-in"
        onClick={handleClose}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Modal Container - uses flex centering */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div 
          className="w-full md:w-full md:max-w-md bg-[#171b22] rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto animate-modal-slide-up md:animate-modal-zoom-in"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#262b35]">
          <button
            onClick={handleClose}
            className="text-[15px] text-[#8a857f] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <h2 className="font-semibold text-[16px] text-white">
            Add to Story
          </h2>
          <button
            onClick={handleSubmit}
            disabled={!hasContent || isCreating}
            className="px-4 py-1.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: hasContent ? accentColor : '#262b35',
              color: hasContent ? '#fff' : '#8a857f',
            }}
          >
            {isCreating ? 'Sharing...' : 'Share'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[300px]">
          {/* Upload state */}
          {isUploading && (
            <div className="flex flex-col items-center gap-4 text-white">
              <div className="w-12 h-12 border-3 border-current border-t-transparent rounded-full animate-spin" />
              <p className="text-[15px]">Uploading...</p>
            </div>
          )}

          {/* No media yet - prompt to add */}
          {!isUploading && !mediaUrl && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-dashed border-[#3a3f4a] hover:border-[#5a5f6a] transition-colors"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-medium text-[15px]">Add Photo or Video</p>
                <p className="text-[#8a857f] text-[13px] mt-1">Stories disappear after 24 hours</p>
              </div>
            </button>
          )}

          {/* Media preview */}
          {!isUploading && mediaUrl && (
            <div className="relative w-full max-w-sm aspect-[9/16] rounded-2xl overflow-hidden bg-black">
              {isVideo ? (
                <video
                  src={mediaUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <Image
                  src={mediaUrl}
                  alt="Story preview"
                  fill
                  className="object-contain"
                />
              )}
              
              {/* Remove button */}
              <button
                onClick={removeMedia}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* User avatar overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/80">
                  {user?.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.firstName || 'You'}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-white bg-[#3a3f4a]">
                      {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                    </div>
                  )}
                </div>
                <span className="text-white text-[13px] font-medium drop-shadow-md">
                  Your Story
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-900/20 border border-red-800 rounded-xl max-w-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[13px] text-red-200 flex-1">{errorMessage}</p>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="text-red-400 hover:text-red-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Caption input */}
        {mediaUrl && (
          <div className="p-4 border-t border-[#262b35]">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 200))}
              placeholder="Add a caption..."
              className="w-full px-4 py-3 rounded-xl bg-[#1a1f2a] text-white text-[15px] placeholder-[#8a857f] focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
          </div>
        )}
        </div>
      </div>

      {/* Discard confirmation modal */}
      <DiscardConfirmationModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleConfirmDiscard}
        itemName="story"
      />
    </>
  );
}

