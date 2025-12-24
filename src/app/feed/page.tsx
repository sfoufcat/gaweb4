'use client';

import { useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { useFeed, type FeedPost } from '@/hooks/useFeed';
import { useBrandingValues, useMenuTitles, useFeedEnabled } from '@/contexts/BrandingContext';
import { FeedList } from '@/components/feed/FeedList';
import { CreatePostModal } from '@/components/feed/CreatePostModal';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { ShareSheet } from '@/components/feed/ShareSheet';
import { ReportModal } from '@/components/feed/ReportModal';
import { StoriesRow } from '@/components/feed/StoriesRow';

export default function FeedPage() {
  const { user } = useUser();
  const { colors, isDefault } = useBrandingValues();
  const { feed: feedTitle } = useMenuTitles();
  const feedEnabled = useFeedEnabled(); // From Edge Config via SSR - instant, no flash
  
  const {
    posts,
    isLoading,
    isValidating,
    hasMore,
    isEmpty,
    loadMore,
    refresh,
    optimisticLike,
    optimisticBookmark,
    addPost,
    removePost,
  } = useFeed();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostForComment, setSelectedPostForComment] = useState<string | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<string | null>(null);
  const [selectedPostForReport, setSelectedPostForReport] = useState<string | null>(null);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Handle post creation
  const handlePostCreated = useCallback((post: FeedPost) => {
    addPost(post);
    setShowCreateModal(false);
  }, [addPost]);

  // Handle comment
  const handleComment = useCallback((postId: string) => {
    setSelectedPostForComment(postId);
  }, []);

  // Handle share
  const handleShare = useCallback((postId: string) => {
    setSelectedPostForShare(postId);
  }, []);

  // Handle report
  const handleReport = useCallback((postId: string) => {
    setSelectedPostForReport(postId);
  }, []);

  // Handle delete
  const handleDelete = useCallback((postId: string) => {
    removePost(postId);
  }, [removePost]);

  // Feed not enabled for this org (instant check from SSR Edge Config)
  if (!feedEnabled) {
    return (
      <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-4">
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-24 h-24 rounded-full bg-[#f3f1ef] dark:bg-[#171b22] flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-text-secondary dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="font-albert text-[24px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.3] text-center mb-3">
              {feedTitle} Not Available
            </h2>
            <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] text-center max-w-sm">
              The social feed is not enabled for this community.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-4">
        {/* Page Title */}
        <div className="mb-6">
          <h1 className="font-albert text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] leading-[1.2]">
            {feedTitle}
          </h1>
        </div>

        {/* Stories Row */}
        <section className="mb-6">
          <StoriesRow 
            onCreateStory={() => setShowCreateModal(true)}
            onViewStory={(userId) => {
              // TODO: Open story viewer for this user
              console.log('View story for user:', userId);
            }}
          />
        </section>

        {/* Two Column Layout on Desktop */}
        <div className="flex gap-8">
          {/* Main Feed Column */}
          <div className="flex-1 max-w-2xl">
            {/* Create post card */}
            <div className="bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8]/50 dark:border-[#262b35] p-4 mb-6">
              <div className="flex items-center gap-3">
                {/* Avatar */}
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
                    <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#5f5a55] dark:text-[#b5b0ab]">
                      {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
                    </div>
                  )}
                </div>

                {/* Input placeholder button */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex-1 text-left px-4 py-2.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[15px] text-text-secondary hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
                >
                  What&apos;s on your mind?
                </button>

                {/* Quick image button */}
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="p-2.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                >
                  <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Feed list */}
            <FeedList
              posts={posts}
              isLoading={isLoading}
              isValidating={isValidating}
              hasMore={hasMore}
              isEmpty={isEmpty}
              onLoadMore={loadMore}
              onLike={optimisticLike}
              onBookmark={optimisticBookmark}
              onComment={handleComment}
              onShare={handleShare}
              onDelete={handleDelete}
              onReport={handleReport}
            />
          </div>

          {/* Sidebar - Hidden on mobile */}
          <div className="hidden lg:block w-80 flex-shrink-0">
            {/* Placeholder for future sidebar content (trending, suggestions, etc.) */}
          </div>
        </div>

        {/* Floating create button (mobile) */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-24 right-4 lg:hidden w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Create post modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Comment sheet */}
      {selectedPostForComment && (
        <CommentSheet
          postId={selectedPostForComment}
          onClose={() => setSelectedPostForComment(null)}
        />
      )}

      {/* Share sheet */}
      {selectedPostForShare && (
        <ShareSheet
          postId={selectedPostForShare}
          onClose={() => setSelectedPostForShare(null)}
        />
      )}

      {/* Report modal */}
      {selectedPostForReport && (
        <ReportModal
          postId={selectedPostForReport}
          onClose={() => setSelectedPostForReport(null)}
        />
      )}
    </div>
  );
}

