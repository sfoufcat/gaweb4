'use client';

import { useState, useCallback } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { ShareToChatModal } from './ShareToChatModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface ShareSheetProps {
  postId: string;
  onClose: () => void;
}

export function ShareSheet({ postId, onClose }: ShareSheetProps) {
  const { colors } = useBrandingValues();
  const [copied, setCopied] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const accentColor = colors.accentLight || 'var(--brand-accent-light)';
  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/feed?post=${postId}`
    : `/feed?post=${postId}`;

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = postUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [postUrl]);

  // Native share (mobile)
  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post',
          url: postUrl,
        });
        onClose();
      } catch {
        // User cancelled or error
      }
    }
  }, [postUrl, onClose]);

  // Share to chat - open channel selector modal
  const handleShareToChat = useCallback(() => {
    setShowChatModal(true);
  }, []);

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  // Show chat modal instead of main share sheet
  if (showChatModal) {
    return (
      <ShareToChatModal
        postId={postId}
        postUrl={postUrl}
        onClose={onClose}
        onSuccess={onClose}
      />
    );
  }

  // Shared content for both Dialog and Drawer
  const shareContent = (
    <>
      {/* Title */}
      <div className="px-6 pt-4 md:pt-6 pb-2">
        <h2 className="font-semibold text-[18px] text-[#1a1a1a] dark:text-[#faf8f6]">
          Share Post
        </h2>
      </div>

      {/* Options */}
      <div className="px-6 py-4 space-y-2">
        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            {copied ? (
              <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </div>
          <div className="text-left">
            <p className="font-medium text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
              {copied ? 'Copied!' : 'Copy Link'}
            </p>
            <p className="text-[13px] text-[#8a857f]">
              Copy post link to clipboard
            </p>
          </div>
        </button>

        {/* Share to Chat */}
        <button
          onClick={handleShareToChat}
          className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15` }}
          >
            <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-medium text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
              Share to Chat
            </p>
            <p className="text-[13px] text-[#8a857f]">
              Send to a conversation
            </p>
          </div>
        </button>

        {/* Native Share (mobile only) */}
        {canNativeShare && !isDesktop && (
          <button
            onClick={handleNativeShare}
            className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <svg className="w-5 h-5" style={{ color: accentColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-[15px] text-[#1a1a1a] dark:text-[#faf8f6]">
                More Options
              </p>
              <p className="text-[13px] text-[#8a857f]">
                Share via other apps
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Close button */}
      <div className="px-6 pb-6 pt-2">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[15px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );

  // Desktop: Dialog (centered modal)
  if (isDesktop) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
        <DialogContent hideCloseButton className="sm:max-w-[400px] p-0 bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border border-[#e8e4df]/50 dark:border-[#262b35]/50 rounded-2xl shadow-2xl">
          {shareContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slides up from bottom)
  return (
    <Drawer
      open={true}
      onOpenChange={(open) => !open && onClose()}
      shouldScaleBackground={false}
    >
      <DrawerContent className="bg-white/95 dark:bg-[#171b22]/95 backdrop-blur-xl border-t border-[#e8e4df]/50 dark:border-[#262b35]/50">
        {shareContent}
      </DrawerContent>
    </Drawer>
  );
}
