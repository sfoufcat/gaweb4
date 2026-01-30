'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { DiscardConfirmationModal } from './ConfirmationModal';
import { RichTextEditor } from '@/components/editor';
import { PollComposer } from '@/components/chat/PollComposer';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_USER } from '@/lib/demo-utils';
import type { FeedPost } from '@/hooks/useFeed';
import type { PollFormData, ChatPollState } from '@/types/poll';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: (post: FeedPost) => void;
}

const MAX_IMAGES = 4;

export function CreatePostModal({
  isOpen,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { user: clerkUser } = useUser();
  const { isDemoMode } = useDemoMode();
  
  // In demo mode, use demo user data
  const user = isDemoMode ? {
    id: DEMO_USER.id,
    firstName: DEMO_USER.firstName,
    lastName: DEMO_USER.lastName,
    imageUrl: DEMO_USER.imageUrl,
  } : clerkUser;
  
  const [content, setContent] = useState<{ json: object; html: string; text: string } | null>(null);
  const [showDemoMessage, setShowDemoMessage] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Poll state
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [attachedPoll, setAttachedPoll] = useState<ChatPollState | null>(null);


  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const hasContent = (content?.text?.trim()) || images.length > 0 || videoUrl || attachedPoll;
  const canAddImage = images.length < MAX_IMAGES && !videoUrl;
  const canAddVideo = images.length === 0 && !videoUrl;
  const canAddPoll = !attachedPoll;

  // Reset form
  const resetForm = useCallback(() => {
    setContent(null);
    setImages([]);
    setVideoUrl(null);
    setIsUploading(false);
    setIsSubmitting(false);
    setErrorMessage(null);
    setShowDiscardModal(false);
    setAttachedPoll(null);
    setShowPollComposer(false);
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

  // Handle file selection for attachments
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

  // Handle poll creation
  const handlePollSubmit = useCallback(async (pollData: PollFormData) => {
    try {
      // Create poll via API (without channelId for feed posts)
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: pollData.question,
          options: pollData.options,
          settings: {
            activeTill: pollData.settings.activeTill.toISOString(),
            anonymous: pollData.settings.anonymous,
            multipleAnswers: pollData.settings.multipleAnswers,
            participantsCanAddOptions: pollData.settings.participantsCanAddOptions,
          },
          // No channelId - this is for feed
          forFeed: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create poll');
      }

      const { poll } = await response.json() as { poll: ChatPollState };
      setAttachedPoll(poll);
      setShowPollComposer(false);
    } catch (error) {
      console.error('Failed to create poll:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create poll');
    }
  }, []);

  // Remove attached poll
  const removePoll = useCallback(() => {
    setAttachedPoll(null);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!hasContent || isSubmitting) return;

    // Demo mode: show message instead of posting
    if (isDemoMode) {
      setShowDemoMessage(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content?.text?.trim() || undefined,
          content: content?.json || undefined,
          contentHtml: content?.html || undefined,
          images: images.length > 0 ? images : undefined,
          videoUrl: videoUrl || undefined,
          pollId: attachedPoll?.id || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create post');
      }

      const data = await response.json();

      // Call callback with new post
      onPostCreated({
        ...data.post,
        author: {
          id: user?.id,
          firstName: user?.firstName,
          lastName: user?.lastName,
          imageUrl: user?.imageUrl,
        },
        pollId: attachedPoll?.id,
        pollData: attachedPoll || undefined,
      });

      resetForm();
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  }, [hasContent, isSubmitting, isDemoMode, content, images, videoUrl, attachedPoll, onPostCreated, user, resetForm, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - only visible on desktop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10001] animate-backdrop-fade-in hidden md:block"
        onClick={handleClose}
      />

      {/* Modal - Full screen on mobile, centered card on desktop */}
      <div
        className="fixed inset-0 z-[10001] md:flex md:items-center md:justify-center md:p-4"
        onClick={handleClose}
      >
        <div
          className="h-full w-full md:h-auto md:max-h-[85vh] md:w-full md:max-w-2xl bg-white/95 dark:bg-[#171b22] backdrop-blur-xl md:rounded-3xl shadow-xl shadow-black/10 flex flex-col overflow-hidden animate-modal-slide-up md:animate-modal-zoom-in md:border md:border-white/20 dark:md:border-[#262b35]"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div
          className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#f0ebe5]/60 dark:border-[#262b35]"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))' }}
        >
          <button
            onClick={handleClose}
            className="text-[15px] text-[#9a958f] hover:text-[#5f5a55] transition-colors font-medium"
          >
            Cancel
          </button>
          <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Create Post
          </h2>
          <button
            onClick={handleSubmit}
            disabled={!hasContent || isSubmitting}
            className={`px-5 py-2 rounded-full text-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              hasContent
                ? 'bg-brand-accent text-brand-accent-foreground shadow-sm hover:shadow-md'
                : 'bg-[#f5f2ef] dark:bg-[#262b35] text-[#a5a09a]'
            }`}
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 overscroll-contain">
          {/* User info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full overflow-hidden bg-[#faf7f4] dark:bg-[#262b35] flex-shrink-0 ring-2 ring-white/60 dark:ring-transparent shadow-sm">
              {user?.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="Your avatar"
                  width={44}
                  height={44}
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
            </div>
          </div>

          {/* Rich Text Editor */}
          <RichTextEditor
            placeholder="What's on your mind?"
            onChange={handleContentChange}
            onUploadImage={handleUploadImage}
            autoFocus={true}
            minHeight="120px"
            maxHeight="300px"
          />

          {/* Image preview (attachments) */}
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

          {/* Poll preview */}
          {attachedPoll && (
            <div className="relative mt-4 p-4 bg-[#f5f3f0] dark:bg-[#1a1f2a] rounded-xl">
              <button
                onClick={removePoll}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors z-10"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-[13px] font-medium text-brand-accent">Poll attached</span>
              </div>
              <h4 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
                {attachedPoll.question}
              </h4>
              <div className="space-y-1">
                {attachedPoll.options.slice(0, 3).map((option) => (
                  <div 
                    key={option.id}
                    className="px-3 py-2 bg-white dark:bg-[#262b35] rounded-lg text-[14px] text-[#5f5a55] dark:text-[#b5b0ab]"
                  >
                    {option.text}
                  </div>
                ))}
                {attachedPoll.options.length > 3 && (
                  <div className="text-[13px] text-[#8a857f] pl-3">
                    +{attachedPoll.options.length - 3} more options
                  </div>
                )}
              </div>
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

        {/* Footer - Media buttons (for attachments separate from inline images) */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-[#f0ebe5]/60 dark:border-[#262b35] bg-[#fdfcfb]/80 dark:bg-transparent"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Add attachment button */}
            <button
              onClick={() => canAddImage && fileInputRef.current?.click()}
              disabled={!canAddImage || isUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 dark:bg-[#1a1f2a] border border-[#f0ebe5]/80 dark:border-[#262b35] text-[13px] font-medium text-[#6b665f] dark:text-[#b5b0ab] hover:bg-white hover:border-[#e5e0da] dark:hover:bg-[#262b35] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Attach Photo
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 dark:bg-[#1a1f2a] border border-[#f0ebe5]/80 dark:border-[#262b35] text-[13px] font-medium text-[#6b665f] dark:text-[#b5b0ab] hover:bg-white hover:border-[#e5e0da] dark:hover:bg-[#262b35] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video
            </button>

            {/* Add poll button */}
            <button
              onClick={() => setShowPollComposer(true)}
              disabled={!canAddPoll || isUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/70 dark:bg-[#1a1f2a] border border-[#f0ebe5]/80 dark:border-[#262b35] text-[13px] font-medium text-[#6b665f] dark:text-[#b5b0ab] hover:bg-white hover:border-[#e5e0da] dark:hover:bg-[#262b35] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Poll
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
        itemName="post"
      />

      {/* Poll composer modal */}
      <PollComposer
        isOpen={showPollComposer}
        onClose={() => setShowPollComposer(false)}
        onSubmit={handlePollSubmit}
      />

      {/* Demo mode message modal */}
      {showDemoMessage && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10002]"
            onClick={() => setShowDemoMessage(false)}
          />
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="bg-white dark:bg-[#171b22] rounded-2xl p-6 shadow-xl max-w-sm w-full pointer-events-auto animate-modal-zoom-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-3xl">🚫</span>
                </div>
                <h3 className="font-albert text-[20px] font-semibold text-text-primary mb-2">
                  Cannot Post in Demo Mode
                </h3>
                <p className="font-sans text-[15px] text-text-secondary mb-6">
                  Creating posts is not available in demo mode. Sign up to start sharing with the community!
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDemoMessage(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-[15px] bg-[#f3f1ef] dark:bg-[#262b35] text-text-primary hover:bg-[#e9e5e0] dark:hover:bg-[#2d333d] transition-colors"
                  >
                    Got it
                  </button>
                  <a
                    href="/signup"
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-[15px] bg-brand-accent text-white hover:opacity-90 transition-opacity text-center"
                  >
                    Sign Up
                  </a>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
