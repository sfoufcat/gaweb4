'use client';

import { useCallback } from 'react';
import { mutate } from 'swr';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { usePost, type FeedPost } from '@/hooks/useFeed';
import { PostCard } from './PostCard';
import { SIDEBAR_BOOKMARKS_KEY } from './FeedSidebar';

interface PostDetailModalProps {
  postId: string;
  onClose: () => void;
  onLike?: (postId: string, isLiked: boolean) => void;
  onBookmark?: (postId: string, isBookmarked: boolean) => void;
  onShare?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onEdit?: (post: FeedPost) => void;
  onReport?: (postId: string) => void;
}

export function PostDetailModal({
  postId,
  onClose,
  onLike,
  onBookmark,
  onShare,
  onDelete,
  onEdit,
  onReport,
}: PostDetailModalProps) {
  const { colors, isDefault } = useBrandingValues();
  const { post, isLoading, error, refresh } = usePost(postId);
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Handle like with local state update
  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    // Call parent handler if provided
    onLike?.(postId, isLiked);
    // Refresh modal's post data
    refresh();
  }, [onLike, refresh]);

  // Handle bookmark with local state update
  const handleBookmark = useCallback(async (postId: string, isBookmarked: boolean) => {
    // Call parent handler if provided
    onBookmark?.(postId, isBookmarked);
    // Refresh modal's post data
    refresh();
    // Revalidate sidebar bookmarks
    mutate(SIDEBAR_BOOKMARKS_KEY);
  }, [onBookmark, refresh]);

  // Handle delete
  const handleDelete = useCallback((postId: string) => {
    onDelete?.(postId);
    onClose();
  }, [onDelete, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="w-full max-w-2xl bg-[#faf8f6] dark:bg-[#0d1117] rounded-2xl shadow-xl max-h-[90vh] flex flex-col overflow-hidden pointer-events-auto animate-modal-zoom-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8e4df] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
            <h2 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6]">
              Post
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <svg className="w-5 h-5 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              // Loading skeleton
              <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden animate-pulse">
                {/* Header skeleton */}
                <div className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                    <div className="space-y-2 flex-1">
                      <div className="w-28 h-4 rounded-md bg-[#f5f3f0] dark:bg-[#262b35]" />
                      <div className="w-20 h-3 rounded-md bg-[#f5f3f0] dark:bg-[#262b35]" />
                    </div>
                  </div>
                </div>
                
                {/* Content skeleton */}
                <div className="px-4 pb-4 space-y-2.5">
                  <div className="w-full h-4 rounded-md bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="w-4/5 h-4 rounded-md bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="w-2/3 h-4 rounded-md bg-[#f5f3f0] dark:bg-[#262b35]" />
                </div>
                
                {/* Image placeholder */}
                <div className="mx-4 mb-4 h-52 rounded-xl bg-[#f5f3f0] dark:bg-[#262b35]" />
                
                {/* Action bar skeleton */}
                <div className="px-4 pb-4 flex gap-3">
                  <div className="w-14 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="w-14 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="w-14 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                  <div className="ml-auto w-8 h-8 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                </div>
              </div>
            ) : error ? (
              // Error state
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-[16px] text-[#1a1a1a] dark:text-[#faf8f6] mb-1">
                  Post not found
                </h3>
                <p className="text-[14px] text-[#8a857f] text-center">
                  This post may have been deleted or is unavailable.
                </p>
              </div>
            ) : post ? (
              // Post content
              <PostCard
                post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onShare={onShare}
                onDelete={handleDelete}
                onEdit={onEdit}
                onReport={onReport}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

