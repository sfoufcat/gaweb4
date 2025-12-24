'use client';

import { useEffect, useRef, useCallback } from 'react';
import { PostCard } from './PostCard';
import type { FeedPost } from '@/hooks/useFeed';

interface FeedListProps {
  posts: FeedPost[];
  isLoading: boolean;
  isValidating?: boolean;
  hasMore: boolean;
  isEmpty: boolean;
  onLoadMore: () => void;
  onLike: (postId: string, isLiked: boolean) => void;
  onBookmark: (postId: string, isBookmarked: boolean) => void;
  onShare: (postId: string) => void;
  onDelete: (postId: string) => void;
  onReport: (postId: string) => void;
}

export function FeedList({
  posts,
  isLoading,
  isValidating,
  hasMore,
  isEmpty,
  onLoadMore,
  onLike,
  onBookmark,
  onShare,
  onDelete,
  onReport,
}: FeedListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isValidating) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isValidating, onLoadMore]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-[#13171f] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden animate-pulse"
          >
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#f5f3f0] dark:bg-[#262b35]" />
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                  <div className="w-16 h-3 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
                </div>
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              <div className="w-full h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
              <div className="w-3/4 h-4 bg-[#f5f3f0] dark:bg-[#262b35] rounded" />
            </div>
            <div className="h-48 bg-[#f5f3f0] dark:bg-[#262b35]" />
            <div className="p-4 flex gap-4">
              <div className="w-16 h-8 bg-[#f5f3f0] dark:bg-[#262b35] rounded-full" />
              <div className="w-16 h-8 bg-[#f5f3f0] dark:bg-[#262b35] rounded-full" />
              <div className="w-16 h-8 bg-[#f5f3f0] dark:bg-[#262b35] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
          No posts yet
        </h3>
        <p className="text-[14px] text-[#8a857f] text-center max-w-sm">
          Be the first to share something with your community! Create a post to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onLike={onLike}
          onBookmark={onBookmark}
          onShare={onShare}
          onDelete={onDelete}
          onReport={onReport}
        />
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading more indicator */}
      {isValidating && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-[#a07855] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-8 text-[14px] text-[#8a857f]">
          You&apos;re all caught up!
        </div>
      )}
    </div>
  );
}

