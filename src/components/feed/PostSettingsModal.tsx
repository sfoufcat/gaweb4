'use client';

import { useState, useCallback, useEffect } from 'react';
import { mutate } from 'swr';
import { SIDEBAR_BOOKMARKS_KEY, SIDEBAR_TRENDING_KEY } from './FeedSidebar';
import type { FeedPost } from '@/hooks/useFeed';

// Cache key for pinned posts
export const SIDEBAR_PINNED_KEY = '/api/feed/pinned?limit=5';

interface PostSettingsModalProps {
  isOpen: boolean;
  post: FeedPost;
  onClose: () => void;
  onSettingsUpdated: (post: FeedPost) => void;
}

/**
 * PostSettingsModal - Coach-only modal for editing post display settings
 * 
 * Settings:
 * - Pin to Feed: Show post at top of feed
 * - Pin to Sidebar: Show post in sidebar "Pinned" section
 * - Hide Metadata: Hide author name, avatar, and date
 * - Disable Interactions: Hide like/comment/share/save buttons
 */
export function PostSettingsModal({
  isOpen,
  post,
  onClose,
  onSettingsUpdated,
}: PostSettingsModalProps) {

  // Settings state
  const [pinnedToFeed, setPinnedToFeed] = useState(post.pinnedToFeed || false);
  const [pinnedToSidebar, setPinnedToSidebar] = useState(post.pinnedToSidebar || false);
  const [hideMetadata, setHideMetadata] = useState(post.hideMetadata || false);
  const [disableInteractions, setDisableInteractions] = useState(post.disableInteractions || false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state with post prop when it changes (e.g., after save or when opening different post)
  useEffect(() => {
    setPinnedToFeed(post.pinnedToFeed || false);
    setPinnedToSidebar(post.pinnedToSidebar || false);
    setHideMetadata(post.hideMetadata || false);
    setDisableInteractions(post.disableInteractions || false);
  }, [post.id, post.pinnedToFeed, post.pinnedToSidebar, post.hideMetadata, post.disableInteractions]);

  // Check if any settings changed
  const hasChanges = 
    pinnedToFeed !== (post.pinnedToFeed || false) ||
    pinnedToSidebar !== (post.pinnedToSidebar || false) ||
    hideMetadata !== (post.hideMetadata || false) ||
    disableInteractions !== (post.disableInteractions || false);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!hasChanges || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/feed/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pinnedToFeed,
          pinnedToSidebar,
          hideMetadata,
          disableInteractions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }

      const data = await response.json();

      // Update the post with new settings
      onSettingsUpdated({
        ...post,
        pinnedToFeed: data.post.pinnedToFeed,
        pinnedToSidebar: data.post.pinnedToSidebar,
        hideMetadata: data.post.hideMetadata,
        disableInteractions: data.post.disableInteractions,
        pinnedAt: data.post.pinnedAt,
      });

      // Revalidate sidebar caches
      mutate(SIDEBAR_PINNED_KEY);
      mutate(SIDEBAR_TRENDING_KEY);
      mutate(SIDEBAR_BOOKMARKS_KEY);

      onClose();
    } catch (error) {
      console.error('Failed to update post settings:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  }, [hasChanges, isSubmitting, post, pinnedToFeed, pinnedToSidebar, hideMetadata, disableInteractions, onSettingsUpdated, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div 
          className="w-full md:w-full md:max-w-md bg-white dark:bg-[#171b22] rounded-t-2xl md:rounded-2xl shadow-xl max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto animate-modal-slide-up md:animate-modal-zoom-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#e8e4df] dark:border-[#262b35]">
            <button
              onClick={onClose}
              className="text-[15px] text-[#8a857f] hover:text-[#5f5a55] transition-colors"
            >
              Cancel
            </button>
            <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
              Post Settings
            </h2>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSubmitting}
              className={`px-4 py-1.5 rounded-full text-[14px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                hasChanges 
                  ? 'bg-brand-accent text-brand-accent-foreground' 
                  : 'bg-[#e8e4df] dark:bg-[#262b35] text-[#8a857f]'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {/* Pin to Feed */}
            <SettingsToggle
              label="Pin to Feed"
              description="Show this post at the top of the feed"
              checked={pinnedToFeed}
              onChange={setPinnedToFeed}
            />

            {/* Pin to Sidebar */}
            <SettingsToggle
              label="Pin to Sidebar"
              description="Show this post in the sidebar Pinned section"
              checked={pinnedToSidebar}
              onChange={setPinnedToSidebar}
            />

            {/* Divider */}
            <div className="h-px bg-[#e8e4df] dark:bg-[#262b35] my-3" />

            {/* Hide Metadata */}
            <SettingsToggle
              label="Hide Metadata"
              description="Hide author name, profile picture, and date"
              checked={hideMetadata}
              onChange={setHideMetadata}
            />

            {/* Disable Interactions */}
            <SettingsToggle
              label="Disable Interactions"
              description="Hide like, comment, share, and save buttons"
              checked={disableInteractions}
              onChange={setDisableInteractions}
            />

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
                </div>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="p-4 border-t border-[#e8e4df] dark:border-[#262b35]">
            <p className="text-[12px] text-[#8a857f] text-center">
              These settings are only visible to coaches and admins
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// Toggle component for settings
function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#f5f3f0] dark:hover:bg-[#1a1f2a] transition-colors"
    >
      <div className="text-left">
        <p className="text-[15px] font-medium text-[#1a1a1a] dark:text-[#faf8f6]">
          {label}
        </p>
        <p className="text-[13px] text-[#8a857f] mt-0.5">
          {description}
        </p>
      </div>
      
      {/* Toggle switch */}
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-brand-accent' : 'bg-[#e8e4df] dark:bg-[#262b35]'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </button>
  );
}


