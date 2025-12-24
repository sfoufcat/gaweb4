/**
 * Feed Notifications - Helper functions for feed-related notifications
 * 
 * These functions wrap the base notifyUser function to provide
 * standardized feed notification messages and formatting.
 */

import { notifyUser } from './notifications';
import { adminDb } from './firebase-admin';

// =============================================================================
// HELPER: Get user name
// =============================================================================

async function getUserName(userId: string): Promise<string> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    return userData?.firstName || 'Someone';
  } catch {
    return 'Someone';
  }
}

// =============================================================================
// FEED NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * Notify a user that someone liked their post
 */
export async function notifyPostLike(
  postAuthorId: string,
  likerUserId: string,
  postId: string,
  postPreview: string,
  organizationId: string
): Promise<string | null> {
  // Don't notify yourself
  if (postAuthorId === likerUserId) return null;

  const likerName = await getUserName(likerUserId);

  return notifyUser({
    userId: postAuthorId,
    type: 'feed_like',
    title: `${likerName} liked your post`,
    body: postPreview.length > 60 ? postPreview.substring(0, 60) + '...' : postPreview,
    actionRoute: `/feed?post=${postId}`,
    organizationId,
  });
}

/**
 * Notify a user that someone commented on their post
 */
export async function notifyPostComment(
  postAuthorId: string,
  commenterId: string,
  postId: string,
  commentPreview: string,
  organizationId: string
): Promise<string | null> {
  // Don't notify yourself
  if (postAuthorId === commenterId) return null;

  const commenterName = await getUserName(commenterId);

  return notifyUser({
    userId: postAuthorId,
    type: 'feed_comment',
    title: `${commenterName} commented on your post`,
    body: commentPreview.length > 60 ? commentPreview.substring(0, 60) + '...' : commentPreview,
    actionRoute: `/feed?post=${postId}`,
    organizationId,
  });
}

/**
 * Notify a user that someone reposted their post
 */
export async function notifyRepost(
  postAuthorId: string,
  reposterId: string,
  postId: string,
  organizationId: string
): Promise<string | null> {
  // Don't notify yourself
  if (postAuthorId === reposterId) return null;

  const reposterName = await getUserName(reposterId);

  return notifyUser({
    userId: postAuthorId,
    type: 'feed_repost',
    title: `${reposterName} reposted your post`,
    body: 'Your post was shared with their followers',
    actionRoute: `/feed?post=${postId}`,
    organizationId,
  });
}

/**
 * Notify a user that they were mentioned in a post
 */
export async function notifyMention(
  mentionedUserId: string,
  authorId: string,
  postId: string,
  postPreview: string,
  organizationId: string
): Promise<string | null> {
  // Don't notify yourself
  if (mentionedUserId === authorId) return null;

  const authorName = await getUserName(authorId);

  return notifyUser({
    userId: mentionedUserId,
    type: 'feed_mention',
    title: `${authorName} mentioned you in a post`,
    body: postPreview.length > 60 ? postPreview.substring(0, 60) + '...' : postPreview,
    actionRoute: `/feed?post=${postId}`,
    organizationId,
  });
}

/**
 * Notify a user that someone reacted to their story
 */
export async function notifyStoryReaction(
  storyAuthorId: string,
  reactorId: string,
  storyId: string,
  reactionType: string,
  organizationId: string
): Promise<string | null> {
  // Don't notify yourself
  if (storyAuthorId === reactorId) return null;

  const reactorName = await getUserName(reactorId);

  return notifyUser({
    userId: storyAuthorId,
    type: 'story_reaction',
    title: `${reactorName} reacted to your story`,
    body: `${reactionType === 'like' ? '❤️ Liked' : '👀 Viewed'} your story`,
    actionRoute: `/feed`,
    organizationId,
  });
}

// =============================================================================
// BATCH NOTIFICATION FOR AGGREGATED ACTIVITIES
// =============================================================================

/**
 * Send aggregated notification (e.g., "5 people liked your post")
 * Use this when you want to batch multiple similar notifications
 */
export async function notifyAggregatedActivity(
  userId: string,
  type: 'feed_like' | 'feed_comment' | 'feed_repost',
  actorIds: string[],
  postId: string,
  organizationId: string
): Promise<string | null> {
  if (actorIds.length === 0) return null;
  
  // Don't notify yourself
  const filteredActors = actorIds.filter(id => id !== userId);
  if (filteredActors.length === 0) return null;

  // Get first actor's name
  const firstName = await getUserName(filteredActors[0]);

  // Build title based on count
  const count = filteredActors.length;
  let title: string;
  let body: string;

  switch (type) {
    case 'feed_like':
      title = count === 1
        ? `${firstName} liked your post`
        : `${firstName} and ${count - 1} others liked your post`;
      body = 'See who liked your post';
      break;
    case 'feed_comment':
      title = count === 1
        ? `${firstName} commented on your post`
        : `${firstName} and ${count - 1} others commented on your post`;
      body = 'See new comments';
      break;
    case 'feed_repost':
      title = count === 1
        ? `${firstName} reposted your post`
        : `${firstName} and ${count - 1} others reposted your post`;
      body = 'Your post is getting shared';
      break;
  }

  return notifyUser({
    userId,
    type,
    title,
    body,
    actionRoute: `/feed?post=${postId}`,
    organizationId,
  });
}

// =============================================================================
// MODERATION NOTIFICATIONS
// =============================================================================

/**
 * Notify coach about a new report
 */
export async function notifyCoachOfReport(
  coachId: string,
  reporterId: string,
  postId: string,
  reason: string,
  organizationId: string
): Promise<string | null> {
  const reporterName = await getUserName(reporterId);

  // Note: We're using 'feed_mention' as a generic notification type for now
  // You may want to add a specific 'feed_report' type
  return notifyUser({
    userId: coachId,
    type: 'feed_mention', // Or add 'feed_report' to NotificationType
    title: 'New content report',
    body: `${reporterName} reported a post for ${reason}`,
    actionRoute: `/coach?tab=moderation&post=${postId}`,
    organizationId,
  });
}

