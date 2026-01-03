'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { DiscardConfirmationModal } from './ConfirmationModal';
import { RichTextEditor } from '@/components/editor';
import type { FeedPost } from '@/hooks/useFeed';

interface EditPostModalProps {
  isOpen: boolean;
  post: FeedPost;
  onClose: () => void;
  onPostUpdated: (post: FeedPost) => void;
}

const MAX_IMAGES = 4;

export function EditPostModal({
  isOpen,
  post,
  onClose,
  onPostUpdated,
}: EditPostModalProps) {
  const { user } = useUser();
  const [content, setContent] = useState<{ json: object; html: string; text: string } | null>(null);
  const [images, setImages] = useState<string[]>(post.images || []);
  const [videoUrl, setVideoUrl] = useState<string | null>(post.videoUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0); // Force editor remount
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Track if content has changed
  const originalContent = useRef({
    text: post.text || '',
    html: post.contentHtml || '',
    images: post.images || [],
    videoUrl: post.videoUrl || null,
  });

  const hasChanges = 
    (content?.text || '') !== originalContent.current.text ||
    JSON.stringify(images) !== JSON.stringify(originalContent.current.images) ||
    videoUrl !== originalContent.current.videoUrl;

  const hasContent = (content?.text?.trim()) || images.length > 0 || videoUrl;
  const canAddImage = images.length < MAX_IMAGES && !videoUrl;
  const canAddVideo = images.length === 0 && !videoUrl;

  // Reset form when post changes
  useEffect(() => {
    if (isOpen) {
      setImages(post.images || []);
      setVideoUrl(post.videoUrl || null);
      setContent(null); // Will be set by editor
      setEditorKey(prev => prev + 1); // Force editor remount with new content
      originalContent.current = {
        text: post.text || '',
        html: post.contentHtml || '',
        images: post.images || [],
        videoUrl: post.videoUrl || null,
      };
    }
  }, [isOpen, post]);

  // Handle close - show discard modal if there are changes
  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardModal(true);
      return;
    }
    onClose();
  }, [hasChanges, onClose]);

  // Confirm discard
  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardModal(false);
    onClose();
  }, [onClose]);

  // Handle image upload for rich text editor
  const handleUploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.url;
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const file = files[0];
      const isVideo = file.type.startsWith('video/');

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

      if (isVideo) {
        setVideoUrl(data.url);
        setImages([]); // Clear images if adding video
      } else {
        setImages((prev) => [...prev.slice(0, MAX_IMAGES - 1), data.url]);
        setVideoUrl(null); // Clear video if adding images
      }
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
  }, []);

  // Remove image
  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Remove video
  const removeVideo = useCallback(() => {
    setVideoUrl(null);
  }, []);

  // Handle content change
  const handleContentChange = useCallback((newContent: { json: object; html: string; text: string }) => {
    setContent(newContent);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!hasContent || isSubmitting || !hasChanges) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/feed/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content?.text?.trim() || undefined,
          content: content?.json || undefined,
          contentHtml: content?.html || undefined,
          images: images.length > 0 ? images : [],
          videoUrl: videoUrl || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update post');
      }

      const data = await response.json();

      // Call callback with updated post
      onPostUpdated({
        ...post,
        text: data.post.text,
        content: data.post.content,
        contentHtml: data.post.contentHtml,
        images: data.post.images,
        videoUrl: data.post.videoUrl,
        updatedAt: data.post.updatedAt,
      });

      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update post');
    } finally {
      setIsSubmitting(false);
    }
  }, [hasContent, isSubmitting, hasChanges, post, content, images, videoUrl, onPostUpdated, onClose]);

  if (!isOpen) return null;

  // Initial content for editor (use HTML if available, otherwise plain text)
  const initialEditorContent = post.contentHtml || post.text || '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-backdrop-fade-in"
        onClick={handleClose}
      />

      {/* Modal Container - uses flex centering on desktop */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div 
          className="w-full md:w-full md:max-w-2xl bg-white dark:bg-[#171b22] rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85dvh] flex flex-col overflow-hidden pointer-events-auto animate-modal-slide-up md:animate-modal-zoom-in"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e8e4df] dark:border-[#262b35]">
          <button
            onClick={handleClose}
            className="text-[15px] text-[#8a857f] hover:text-[#5f5a55] transition-colors"
          >
            Cancel
          </button>
          <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Edit Post
          </h2>
          <button
            onClick={handleSubmit}
            disabled={!hasContent || isSubmitting || !hasChanges}
            className={`px-4 py-1.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              hasChanges && hasContent 
                ? 'bg-brand-accent text-brand-accent-foreground' 
                : 'bg-[#e8e4df] dark:bg-[#262b35] text-[#8a857f]'
            }`}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* User info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f5f3f0] dark:bg-[#262b35] flex-shrink-0">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Your avatar"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#5f5a55]">
                  {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[12px] text-[#8a857f]">Editing post</p>
            </div>
          </div>

          {/* Rich Text Editor */}
          <RichTextEditor
            key={editorKey}
            initialContent={initialEditorContent}
            placeholder="What's on your mind?"
            onChange={handleContentChange}
            onUploadImage={handleUploadImage}
            autoFocus={true}
            minHeight="120px"
            maxHeight="300px"
          />

          {/* Image preview */}
          {images.length > 0 && (
            <div className={`grid gap-2 mt-4 ${
              images.length === 1 ? 'grid-cols-1' :
              images.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {images.map((image, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                  <Image
                    src={image}
                    alt={`Upload ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Video preview */}
          {videoUrl && (
            <div className="relative aspect-video rounded-lg overflow-hidden mt-4 bg-black">
              <video
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
              />
              <button
                onClick={removeVideo}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Upload progress */}
          {isUploading && (
            <div className="flex items-center gap-2 mt-4 text-[14px] text-[#8a857f]">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          )}

          {/* Error message */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-sans text-[13px] text-red-800 dark:text-red-200">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setErrorMessage(null)}
                  className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Media buttons */}
        <div className="p-4 border-t border-[#e8e4df] dark:border-[#262b35]">
          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Add image button */}
            <button
              onClick={() => canAddImage && fileInputRef.current?.click()}
              disabled={!canAddImage || isUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Photo
            </button>

            {/* Add video button */}
            <button
              onClick={() => {
                if (canAddVideo && fileInputRef.current) {
                  fileInputRef.current.accept = 'video/*';
                  fileInputRef.current.click();
                }
              }}
              disabled={!canAddVideo || isUploading}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Discard confirmation modal */}
      <DiscardConfirmationModal
        isOpen={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onConfirm={handleConfirmDiscard}
        itemName="changes"
      />
    </>
  );
}
