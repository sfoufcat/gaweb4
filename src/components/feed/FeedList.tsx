'use client';

import { useEffect, useRef } from 'react';
import { PostCard } from './PostCard';
import { useBrandingValues } from '@/contexts/BrandingContext';
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
  onEdit?: (post: FeedPost) => void;
  onReport: (postId: string) => void;
  onCommentAdded?: (postId: string) => void;
  onCreatePost?: () => void;
}

// Skeleton post card with shimmer animation
function PostCardSkeleton({ delay = 0 }: { delay?: number }) {
  const delayClass = delay === 0 ? '' : delay === 1 ? 'animation-delay-75' : delay === 2 ? 'animation-delay-150' : 'animation-delay-225';
  
  return (
    <div
      className={`bg-white dark:bg-[#171b22] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] overflow-hidden animate-feed-fade-up ${delayClass}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full animate-skeleton-shimmer" />
          <div className="space-y-2 flex-1">
            <div className="w-28 h-4 rounded-md animate-skeleton-shimmer" />
            <div className="w-20 h-3 rounded-md animate-skeleton-shimmer" />
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 pb-4 space-y-2.5">
        <div className="w-full h-4 rounded-md animate-skeleton-shimmer" />
        <div className="w-4/5 h-4 rounded-md animate-skeleton-shimmer" />
        <div className="w-2/3 h-4 rounded-md animate-skeleton-shimmer" />
      </div>
      
      {/* Image placeholder (randomly shown) */}
      {delay !== 1 && (
        <div className="mx-4 mb-4 h-52 rounded-xl animate-skeleton-shimmer" />
      )}
      
      {/* Action bar */}
      <div className="px-4 pb-4 flex gap-3">
        <div className="w-14 h-8 rounded-full animate-skeleton-shimmer" />
        <div className="w-14 h-8 rounded-full animate-skeleton-shimmer" />
        <div className="w-14 h-8 rounded-full animate-skeleton-shimmer" />
        <div className="ml-auto w-8 h-8 rounded-full animate-skeleton-shimmer" />
      </div>
    </div>
  );
}

// Empty state component
function EmptyState({ onCreatePost, accentColor }: { onCreatePost?: () => void; accentColor: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-feed-fade-up">
      {/* Illustration */}
      <div className="relative mb-6">
        {/* Background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#f5f3f0] to-[#e8e4df] dark:from-[#1a1f2a] dark:to-[#262b35] opacity-50" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#f5f3f0] to-[#ebe7e2] dark:from-[#1a1f2a] dark:to-[#171b22] opacity-70" />
        </div>
        {/* Icon container */}
        <div className="relative w-20 h-20 rounded-full bg-white dark:bg-[#171b22] shadow-lg flex items-center justify-center border border-[#e8e4df] dark:border-[#262b35]">
          {/* Chat bubbles icon */}
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: accentColor }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12c0-1.657-1.343-3-3-3H7c-1.657 0-3 1.343-3 3v5c0 1.657 1.343 3 3 3h1v2l3-2h6c1.657 0 3-1.343 3-3v-5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9V7c0-1.657 1.343-3 3-3h6c1.657 0 3 1.343 3 3v5c0 1.657-1.343 3-3 3h-1" />
          </svg>
        </div>
      </div>
      
      {/* Text */}
      <h3 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#faf8f6] mb-2 tracking-[-0.5px]">
        No posts yet
      </h3>
      <p className="text-[15px] text-[#8a857f] text-center max-w-xs mb-6 leading-relaxed">
        Be the first to share something with your community! Start a conversation.
      </p>
      
      {/* CTA Button */}
      {onCreatePost && (
        <button
          onClick={onCreatePost}
          className="px-6 py-3 rounded-full text-white text-[15px] font-semibold transition-all hover:scale-105 hover:shadow-lg active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          Create your first post
        </button>
      )}
    </div>
  );
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
  onEdit,
  onReport,
  onCommentAdded,
  onCreatePost,
}: FeedListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { colors, isDefault } = useBrandingValues();
  const accentColor = isDefault ? '#a07855' : colors.accentLight;

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
        {[0, 1, 2, 3].map((i) => (
          <PostCardSkeleton key={i} delay={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return <EmptyState onCreatePost={onCreatePost} accentColor={accentColor} />;
  }

  // Get animation delay class based on index (only for first 5 posts)
  const getDelayClass = (index: number) => {
    if (index >= 5) return '';
    const delays = ['animation-delay-0', 'animation-delay-75', 'animation-delay-150', 'animation-delay-225', 'animation-delay-300'];
    return delays[index] || '';
  };

  return (
    <div className="space-y-4">
      {posts.map((post, index) => (
        <div 
          key={post.id} 
          className={`animate-feed-fade-up ${getDelayClass(index)}`}
        >
          <PostCard
            post={post}
            onLike={onLike}
            onBookmark={onBookmark}
            onShare={onShare}
            onDelete={onDelete}
            onEdit={onEdit}
            onReport={onReport}
            onCommentAdded={onCommentAdded}
          />
        </div>
      ))}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {/* Loading more indicator */}
      {isValidating && (
        <div className="flex justify-center py-6">
          <div className="flex gap-1.5">
            <div 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: accentColor, animationDelay: '0ms' }}
            />
            <div 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: accentColor, animationDelay: '150ms' }}
            />
            <div 
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: accentColor, animationDelay: '300ms' }}
            />
          </div>
        </div>
      )}

      {/* End of feed */}
      {!hasMore && posts.length > 0 && (
        <div className="text-center py-10 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[14px] text-[#8a857f]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            You&apos;re all caught up!
          </div>
        </div>
      )}
    </div>
  );
}

