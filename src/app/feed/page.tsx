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
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#faf8f6] mb-2">
              {feedTitle} Not Available
            </h1>
            <p className="text-[15px] text-[#8a857f]">
              The social feed is not enabled for this community.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#faf8f6]">
            {feedTitle}
          </h1>
          <button
            onClick={refresh}
            className="p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            title="Refresh feed"
          >
            <svg className="w-5 h-5 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </header>

        {/* Create post card */}
        <div className="bg-white dark:bg-[#13171f] rounded-2xl border border-[#e8e4df] dark:border-[#262b35] p-4 mb-6">
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
              className="flex-1 text-left px-4 py-2.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[15px] text-[#8a857f] hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
            >
              What&apos;s on your mind?
            </button>

            {/* Quick image button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
            >
              <svg className="w-5 h-5 text-[#8a857f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

