'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFeed, type FeedPost, usePost } from '@/hooks/useFeed';
import { useBrandingValues, useMenuTitles, useFeedEnabled } from '@/contexts/BrandingContext';
import { useSquad } from '@/hooks/useSquad';
import { useFeedStories, useCurrentUserHasStory } from '@/hooks/useFeedStories';
import { FeedList } from '@/components/feed/FeedList';
import { CreatePostModal } from '@/components/feed/CreatePostModal';
import { EditPostModal } from '@/components/feed/EditPostModal';
import { CreateStoryModal } from '@/components/feed/CreateStoryModal';
import { ShareSheet } from '@/components/feed/ShareSheet';
import { ReportModal } from '@/components/feed/ReportModal';
import { StoriesRow } from '@/components/feed/StoriesRow';
import { FeedSidebar } from '@/components/feed/FeedSidebar';
import { PostDetailModal } from '@/components/feed/PostDetailModal';
import { StoryPlayerWrapper } from '@/components/feed/StoryPlayerWrapper';

export default function FeedPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const postId = searchParams.get('post');
  
  // Single post data
  const { post: singlePost, isLoading: isSinglePostLoading, error: singlePostError } = usePost(postId);

  const { colors, isDefault } = useBrandingValues();
  const { feed: feedTitle } = useMenuTitles();
  const feedEnabled = useFeedEnabled(); // From Edge Config via SSR - instant, no flash
  
  // Get squad data for stories - use squadId mode for instant loading (no waterfall)
  const { members: squadMembers, activeSquadId, isLoading: isLoadingSquad } = useSquad();
  const { storyUsers, isLoading: isLoadingStories, refetch: refetchStories } = useFeedStories({ 
    squadId: activeSquadId,
    squadMembers, // Fallback for when squadId is not yet available
  });
  
  // Story status for current user
  const currentUserStoryStatus = useCurrentUserHasStory();
  
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
    incrementCommentCount,
    decrementCommentCount,
    addPost,
    removePost,
  } = useFeed();

  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [selectedPostForShare, setSelectedPostForShare] = useState<string | null>(null);
  const [selectedPostForReport, setSelectedPostForReport] = useState<string | null>(null);
  const [selectedPostForView, setSelectedPostForView] = useState<string | null>(null);
  const [selectedStoryStartIndex, setSelectedStoryStartIndex] = useState<number | null>(null);

  const accentColor = isDefault ? '#a07855' : colors.accentLight;

  // Current user info for story viewer
  const currentUserInfo = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.imageUrl || '',
    };
  }, [user]);

  // Build full story user queue including current user at the start
  const fullStoryQueue = useMemo(() => {
    if (!user) return storyUsers;
    
    // Add current user at the beginning if they have a story
    const currentUserStory = {
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      imageUrl: user.imageUrl || '',
      hasUnseenStory: !currentUserStoryStatus.isLoading && currentUserStoryStatus.hasStory,
      hasStory: currentUserStoryStatus.hasStory,
      hasDayClosed: currentUserStoryStatus.hasDayClosed,
      hasWeekClosed: currentUserStoryStatus.hasWeekClosed,
      hasTasks: currentUserStoryStatus.hasTasks,
      hasGoal: currentUserStoryStatus.hasGoal,
      contentHash: currentUserStoryStatus.contentHash,
    };
    
    return [currentUserStory, ...storyUsers];
  }, [user, storyUsers, currentUserStoryStatus]);

  // Handle post creation
  const handlePostCreated = useCallback((post: FeedPost) => {
    addPost(post);
    setShowCreatePostModal(false);
  }, [addPost]);

  // Handle share
  const handleShare = useCallback((postId: string) => {
    setSelectedPostForShare(postId);
  }, []);

  // Handle report
  const handleReport = useCallback((postId: string) => {
    setSelectedPostForReport(postId);
  }, []);

  // Handle edit
  const handleEdit = useCallback((post: FeedPost) => {
    setEditingPost(post);
  }, []);

  // Handle post updated
  const handlePostUpdated = useCallback((updatedPost: FeedPost) => {
    // Update post in the feed (will trigger re-render)
    refresh();
    setEditingPost(null);
  }, [refresh]);

  // Handle delete
  const handleDelete = useCallback((postId: string) => {
    removePost(postId);
  }, [removePost]);

  // Handle story viewer close - also refetch stories to get fresh data
  const handleStoryClose = useCallback(() => {
    setSelectedStoryStartIndex(null);
    // Refetch stories to update cache after viewing
    refetchStories();
  }, [refetchStories]);

  // Handle back to feed
  const handleBackToFeed = useCallback(() => {
    router.push('/feed');
  }, [router]);

  // Feed not enabled for this org (instant check from SSR Edge Config)
  if (!feedEnabled) {
    return (
      <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
        {/* Header - matches Discover page */}
        <section className="px-4 pt-5 pb-4">
          <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
            {feedTitle}
          </h1>
        </section>

        <section className="px-4 py-8">
          <div className="flex flex-col items-center justify-center py-16">
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
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg pb-24 lg:pb-8">
      {/* Header - matches Discover page */}
      <section className="px-4 pt-5 pb-4">
        <h1 className="font-albert font-normal text-4xl text-text-primary tracking-[-2px] leading-[1.2]">
          {feedTitle}
        </h1>
      </section>

      {/* Stories Row - Hide in single post view */}
      {!postId && (
        <section className="px-4 pt-4 pb-3">
          <div className="flex gap-3 overflow-x-auto pb-2 pt-1 -mx-4 px-4 scrollbar-hide">
            <StoriesRow 
              storyUsers={storyUsers}
              isLoading={isLoadingSquad || isLoadingStories}
              onCreateStory={() => setShowCreateStoryModal(true)}
              onViewStory={(userId) => {
                // Find the index in the full queue (current user is at index 0)
                let index = fullStoryQueue.findIndex(u => u.id === userId);
                
                // Fallback: if user not found but is current user, use index 0
                if (index === -1 && userId === user?.id) {
                  index = 0;
                }
                
                // Fallback: if user still not found, try finding in storyUsers
                if (index === -1) {
                  const storyUserIndex = storyUsers.findIndex(u => u.id === userId);
                  if (storyUserIndex !== -1) {
                    // +1 for current user at position 0 (if they have a story)
                    index = user && currentUserStoryStatus.hasStory 
                      ? storyUserIndex + 1 
                      : storyUserIndex;
                  }
                }
                
                // Final fallback: always open something rather than do nothing
                // This ensures clicks always work even if data is stale
                if (index === -1) {
                  index = 0;
                }
                
                setSelectedStoryStartIndex(index);
              }}
            />
          </div>
        </section>
      )}

      {/* Main Content with Sidebar */}
      <section className="px-4 py-4">
        <div className="flex gap-6">
          {/* Left: Main Feed */}
          <div className="flex-1 min-w-0">
            {postId ? (
              // Single Post View
              <div className="space-y-4">
                {/* Back button */}
                <button
                  onClick={handleBackToFeed}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-2"
                >
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                  <span className="font-medium text-[15px]">Back to Feed</span>
                </button>

                {isSinglePostLoading ? (
                  <div className="bg-white dark:bg-[#171b22] rounded-[24px] p-6 animate-pulse">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35]" />
                      <div className="space-y-2">
                        <div className="w-32 h-4 rounded bg-[#f3f1ef] dark:bg-[#262b35]" />
                        <div className="w-24 h-3 rounded bg-[#f3f1ef] dark:bg-[#262b35]" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="w-full h-4 rounded bg-[#f3f1ef] dark:bg-[#262b35]" />
                      <div className="w-full h-4 rounded bg-[#f3f1ef] dark:bg-[#262b35]" />
                      <div className="w-3/4 h-4 rounded bg-[#f3f1ef] dark:bg-[#262b35]" />
                    </div>
                  </div>
                ) : singlePostError ? (
                  <div className="bg-white dark:bg-[#171b22] rounded-[24px] p-8 text-center border border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">Post not found</h3>
                    <p className="text-[#5f5a55] dark:text-[#b5b0ab] mb-6">
                      This post may have been deleted or does not exist.
                    </p>
                    <button
                      onClick={handleBackToFeed}
                      className="px-6 py-2 rounded-xl bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] font-medium"
                    >
                      Go back to feed
                    </button>
                  </div>
                ) : singlePost ? (
                  <FeedList
                    posts={[singlePost]}
                    isLoading={false}
                    isValidating={false}
                    hasMore={false}
                    isEmpty={false}
                    onLoadMore={() => {}}
                    onLike={optimisticLike}
                    onBookmark={optimisticBookmark}
                    onShare={handleShare}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onReport={handleReport}
                    onCommentAdded={incrementCommentCount}
                    onCommentDeleted={decrementCommentCount}
                    onCreatePost={() => setShowCreatePostModal(true)}
                  />
                ) : null}
              </div>
            ) : (
              // Default Feed View
              <>
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
                      onClick={() => setShowCreatePostModal(true)}
                      className="flex-1 text-left px-4 py-2.5 rounded-full bg-[#f5f3f0] dark:bg-[#1a1f2a] text-[15px] text-text-secondary hover:bg-[#ebe7e2] dark:hover:bg-[#262b35] transition-colors"
                    >
                      What&apos;s on your mind?
                    </button>

                    {/* Quick image button */}
                    <button
                      onClick={() => setShowCreatePostModal(true)}
                      className="p-2.5 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors"
                    >
                      <svg className="w-5 h-5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Feed list */}
                <div>
                  <FeedList
                    posts={posts}
                    isLoading={isLoading}
                    isValidating={isValidating}
                    hasMore={hasMore}
                    isEmpty={isEmpty}
                    onLoadMore={loadMore}
                    onLike={optimisticLike}
                    onBookmark={optimisticBookmark}
                    onShare={handleShare}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                    onReport={handleReport}
                    onCommentAdded={incrementCommentCount}
                    onCommentDeleted={decrementCommentCount}
                    onCreatePost={() => setShowCreatePostModal(true)}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right: Sidebar (desktop only) */}
          <FeedSidebar onSelectPost={setSelectedPostForView} />
        </div>
      </section>

      {/* Floating create button (mobile) */}
      <button
        onClick={() => setShowCreatePostModal(true)}
        className="fixed bottom-24 right-4 lg:hidden w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: accentColor }}
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Create post modal */}
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Create story modal */}
      <CreateStoryModal
        isOpen={showCreateStoryModal}
        onClose={() => setShowCreateStoryModal(false)}
        onStoryCreated={() => {
          // Refresh stories after creation
          // The refetch will happen automatically on next view
        }}
      />

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

      {/* Edit post modal */}
      {editingPost && (
        <EditPostModal
          isOpen={!!editingPost}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onPostUpdated={handlePostUpdated}
        />
      )}

      {/* Post detail modal (for viewing saved/trending posts) */}
      {selectedPostForView && (
        <PostDetailModal
          postId={selectedPostForView}
          onClose={() => setSelectedPostForView(null)}
          onLike={optimisticLike}
          onBookmark={optimisticBookmark}
          onShare={handleShare}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onReport={handleReport}
        />
      )}

      {/* Story viewer with prefetching and auto-advance */}
      {selectedStoryStartIndex !== null && (
        <StoryPlayerWrapper
          storyUsers={fullStoryQueue}
          startIndex={selectedStoryStartIndex}
          onClose={handleStoryClose}
          currentUser={currentUserInfo}
        />
      )}
    </div>
  );
}


