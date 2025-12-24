/**
 * Stream Activity Feeds - Server Utilities
 * 
 * This module provides server-side utilities for Stream Activity Feeds.
 * Uses the same Stream credentials as Stream Chat.
 * 
 * Feed Structure per Organization:
 * - org:{orgId}          → Main org timeline (all posts)
 * - user:{userId}        → User's personal feed (their posts)
 * - story:{userId}       → User's ephemeral stories (24hr TTL)
 * - timeline:{userId}    → User's aggregated timeline (posts from followed users)
 */

import { connect, StreamClient } from 'getstream';

// Singleton client instance
let feedClient: StreamClient | null = null;

/**
 * Get or create the Stream Feeds server client
 * Uses the same API credentials as Stream Chat
 */
export function getStreamFeedsClient(): StreamClient {
  if (!feedClient) {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    const appId = process.env.STREAM_APP_ID;

    if (!apiKey || !apiSecret) {
      throw new Error('Stream API key and secret must be defined');
    }

    // Note: appId is optional for some operations but recommended
    feedClient = connect(apiKey, apiSecret, appId || undefined);
  }

  return feedClient;
}

/**
 * Generate a user token for client-side Stream Feeds access
 * @param userId - The user's ID (typically Clerk user ID)
 */
export function generateFeedToken(userId: string): string {
  const client = getStreamFeedsClient();
  return client.createUserToken(userId);
}

/**
 * Get the organization's main feed
 * All posts in the org appear here
 * @param orgId - The Clerk organization ID
 */
export function getOrgFeed(orgId: string) {
  const client = getStreamFeedsClient();
  // Remove 'org_' prefix for cleaner feed names
  const cleanOrgId = orgId.replace('org_', '');
  return client.feed('org', cleanOrgId);
}

/**
 * Get a user's personal feed (posts they've created)
 * @param userId - The user's ID
 */
export function getUserFeed(userId: string) {
  const client = getStreamFeedsClient();
  return client.feed('user', userId);
}

/**
 * Get a user's story feed (ephemeral stories, 24hr TTL)
 * @param userId - The user's ID
 */
export function getStoryFeed(userId: string) {
  const client = getStreamFeedsClient();
  return client.feed('story', userId);
}

/**
 * Get a user's timeline feed (aggregated posts from followed users)
 * @param userId - The user's ID
 */
export function getTimelineFeed(userId: string) {
  const client = getStreamFeedsClient();
  return client.feed('timeline', userId);
}

/**
 * Get a user's notification feed
 * @param userId - The user's ID
 */
export function getNotificationFeed(userId: string) {
  const client = getStreamFeedsClient();
  return client.feed('notification', userId);
}

// =============================================================================
// FEED ACTIVITY TYPES
// =============================================================================

export interface FeedPostActivity {
  actor: string;              // User ID who created the post
  verb: 'post';
  object: string;             // Activity ID (auto-generated)
  // Custom fields
  text?: string;              // Post text content
  images?: string[];          // Array of image URLs
  videoUrl?: string;          // Video URL (if video post)
  organizationId: string;     // Clerk org ID for multi-tenancy
  // Stream fields
  foreign_id?: string;        // For deduplication
  time?: string;              // ISO timestamp
  to?: string[];              // Target feeds (for fan-out)
  // Index signature for Stream compatibility
  [key: string]: unknown;
}

export interface FeedStoryActivity {
  actor: string;              // User ID who created the story
  verb: 'story';
  object: string;             // Activity ID
  // Custom fields
  imageUrl?: string;          // Story image URL
  videoUrl?: string;          // Story video URL
  caption?: string;           // Optional caption
  organizationId: string;     // Clerk org ID
  expiresAt: string;          // ISO timestamp (24hrs from creation)
  // Stream fields
  foreign_id?: string;
  time?: string;
  // Index signature for Stream compatibility
  [key: string]: unknown;
}

export interface FeedCommentActivity {
  actor: string;              // User ID who commented
  verb: 'comment';
  object: string;             // The post ID being commented on
  // Custom fields
  text: string;               // Comment text
  parentCommentId?: string;   // For threaded replies
  organizationId: string;
  // Stream fields
  foreign_id?: string;
  time?: string;
  // Index signature for Stream compatibility
  [key: string]: unknown;
}

export interface FeedReactionActivity {
  actor: string;              // User ID who reacted
  verb: 'like' | 'bookmark' | 'repost';
  object: string;             // The post ID being reacted to
  organizationId: string;
  // Stream fields
  foreign_id?: string;
  time?: string;
  // Index signature for Stream compatibility
  [key: string]: unknown;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a post and fan it out to the org feed
 * @param userId - The user creating the post
 * @param orgId - The organization ID
 * @param postData - The post content
 */
export async function createPost(
  userId: string,
  orgId: string,
  postData: {
    text?: string;
    images?: string[];
    videoUrl?: string;
  }
): Promise<{ id: string; activity: FeedPostActivity }> {
  const userFeed = getUserFeed(userId);
  const cleanOrgId = orgId.replace('org_', '');
  
  const activity: FeedPostActivity = {
    actor: userId,
    verb: 'post',
    object: `post:${Date.now()}`, // Temporary, will be replaced by Stream
    text: postData.text,
    images: postData.images,
    videoUrl: postData.videoUrl,
    organizationId: orgId,
    foreign_id: `post:${userId}:${Date.now()}`,
    time: new Date().toISOString(),
    // Fan out to org feed
    to: [`org:${cleanOrgId}`],
  };

  const response = await userFeed.addActivity(activity);
  
  return {
    id: response.id,
    activity: { ...activity, object: response.id },
  };
}

/**
 * Create an ephemeral story (24hr TTL)
 * @param userId - The user creating the story
 * @param orgId - The organization ID
 * @param storyData - The story content
 */
export async function createStory(
  userId: string,
  orgId: string,
  storyData: {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
  }
): Promise<{ id: string; activity: FeedStoryActivity }> {
  const storyFeed = getStoryFeed(userId);
  
  // Calculate expiry (24 hours from now)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  const activity: FeedStoryActivity = {
    actor: userId,
    verb: 'story',
    object: `story:${Date.now()}`,
    imageUrl: storyData.imageUrl,
    videoUrl: storyData.videoUrl,
    caption: storyData.caption,
    organizationId: orgId,
    expiresAt,
    foreign_id: `story:${userId}:${Date.now()}`,
    time: new Date().toISOString(),
  };

  const response = await storyFeed.addActivity(activity);
  
  return {
    id: response.id,
    activity: { ...activity, object: response.id },
  };
}

/**
 * Delete a post
 * @param userId - The user who owns the post (or a coach)
 * @param activityId - The activity ID to delete
 */
export async function deletePost(userId: string, activityId: string): Promise<void> {
  const userFeed = getUserFeed(userId);
  await userFeed.removeActivity(activityId);
}

/**
 * Get posts from an org feed with pagination
 * @param orgId - The organization ID
 * @param options - Pagination options
 */
export async function getOrgPosts(
  orgId: string,
  options: {
    limit?: number;
    id_lt?: string;  // For pagination: get activities older than this ID
    id_gt?: string;  // For pagination: get activities newer than this ID
  } = {}
) {
  const orgFeed = getOrgFeed(orgId);
  
  const response = await orgFeed.get({
    limit: options.limit || 20,
    id_lt: options.id_lt,
    id_gt: options.id_gt,
    enrich: true, // Include user data
  });
  
  return response;
}

/**
 * Get a user's stories (only non-expired ones)
 * @param userId - The user ID
 */
export async function getUserStories(userId: string) {
  const storyFeed = getStoryFeed(userId);
  const now = new Date().toISOString();
  
  const response = await storyFeed.get({
    limit: 20,
    enrich: true,
  });
  
  // Filter out expired stories
  const activeStories = response.results.filter((activity) => {
    const expiresAt = (activity as unknown as FeedStoryActivity).expiresAt;
    return expiresAt && expiresAt > now;
  });
  
  return activeStories;
}

/**
 * Add a reaction (like, bookmark, repost) to a post
 * @param userId - The user reacting
 * @param activityId - The post being reacted to
 * @param kind - The reaction type
 */
export async function addReaction(
  userId: string,
  activityId: string,
  kind: 'like' | 'bookmark' | 'repost'
) {
  const client = getStreamFeedsClient();
  
  const reaction = await client.reactions.add(
    kind,
    activityId,
    { userId },
    { userId }
  );
  
  return reaction;
}

/**
 * Remove a reaction from a post
 * @param reactionId - The reaction ID to remove
 */
export async function removeReaction(reactionId: string) {
  const client = getStreamFeedsClient();
  await client.reactions.delete(reactionId);
}

/**
 * Add a comment to a post
 * @param userId - The user commenting
 * @param activityId - The post being commented on
 * @param text - The comment text
 * @param parentCommentId - Optional parent comment for threading
 */
export async function addComment(
  userId: string,
  activityId: string,
  text: string,
  parentCommentId?: string
) {
  const client = getStreamFeedsClient();
  
  const reaction = await client.reactions.add(
    'comment',
    activityId,
    { 
      text,
      parentCommentId,
    },
    { userId }
  );
  
  return reaction;
}

/**
 * Get comments for a post
 * @param activityId - The post ID
 * @param options - Pagination options
 */
export async function getComments(
  activityId: string,
  options: { limit?: number; id_lt?: string } = {}
) {
  const client = getStreamFeedsClient();
  
  const response = await client.reactions.filter({
    activity_id: activityId,
    kind: 'comment',
    limit: options.limit || 20,
    id_lt: options.id_lt,
  });
  
  return response;
}

/**
 * Follow the org feed to get posts in user's timeline
 * Called when user joins an org
 * @param userId - The user ID
 * @param orgId - The organization ID
 */
export async function followOrgFeed(userId: string, orgId: string) {
  const timelineFeed = getTimelineFeed(userId);
  const cleanOrgId = orgId.replace('org_', '');
  
  await timelineFeed.follow('org', cleanOrgId);
}

/**
 * Unfollow the org feed
 * Called when user leaves an org
 * @param userId - The user ID
 * @param orgId - The organization ID
 */
export async function unfollowOrgFeed(userId: string, orgId: string) {
  const timelineFeed = getTimelineFeed(userId);
  const cleanOrgId = orgId.replace('org_', '');
  
  await timelineFeed.unfollow('org', cleanOrgId);
}

/**
 * Search posts in an org by text content
 * Note: Requires Stream's search feature to be enabled
 * @param orgId - The organization ID
 * @param query - The search query
 */
export async function searchPosts(
  orgId: string,
  query: string,
  options: { limit?: number; offset?: number } = {}
) {
  // Note: Stream's built-in search may have limitations
  // For full-text search, consider using Algolia or Firestore
  const orgFeed = getOrgFeed(orgId);
  
  // Get recent posts and filter client-side (basic implementation)
  // For production, implement proper search indexing
  const response = await orgFeed.get({
    limit: options.limit || 50,
    enrich: true,
  });
  
  const queryLower = query.toLowerCase();
  const filtered = response.results.filter((activity) => {
    const text = (activity as unknown as FeedPostActivity).text;
    return text && text.toLowerCase().includes(queryLower);
  });
  
  return filtered.slice(0, options.limit || 20);
}

/**
 * Setup Stream user with profile data
 * Call this when user signs up or updates their profile
 * @param userId - The user ID
 * @param userData - User profile data
 */
export async function setupStreamUser(
  userId: string,
  userData: {
    name: string;
    profileImage?: string;
  }
) {
  const client = getStreamFeedsClient();
  
  await client.user(userId).getOrCreate({
    name: userData.name,
    profileImage: userData.profileImage,
  });
}

