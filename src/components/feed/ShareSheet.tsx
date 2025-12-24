'use client';

import { useState, useCallback } from 'react';
import { useBrandingValues } from '@/contexts/BrandingContext';

interface ShareSheetProps {
  postId: string;
  onClose: () => void;
}

export function ShareSheet({ postId, onClose }: ShareSheetProps) {
  const { colors, isDefault } = useBrandingValues();
  const [copied, setCopied] = useState(false);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;
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

  // Share to chat (open chat with pre-filled message)
  const handleShareToChat = useCallback(() => {
    // Navigate to chat with the post link
    window.location.href = `/chat?share=${encodeURIComponent(postUrl)}`;
  }, [postUrl]);

  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-[#13171f] rounded-t-2xl z-50 overflow-hidden shadow-xl safe-area-inset-bottom">
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-[#d1ccc6] dark:bg-[#3a3f4a]" />
        </div>

        {/* Title */}
        <div className="px-4 pb-2">
          <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
            Share Post
          </h2>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2">
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
          {canNativeShare && (
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

        {/* Cancel button */}
        <div className="p-4 pt-0">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[15px] font-medium text-[#5f5a55] dark:text-[#b5b0ab] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

