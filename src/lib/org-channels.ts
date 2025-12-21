/**
 * Organization Chat Channels
 * 
 * Manages organization-scoped chat channels. Each org has its own set of channels
 * (Announcements, Social Corner, Share Wins, and custom channels).
 * 
 * Data is stored in Firestore `orgChannels` collection.
 * Actual chat functionality uses Stream Chat.
 */

import { adminDb } from '@/lib/firebase-admin';

// ============================================================================
// TYPES
// ============================================================================

export type OrgChannelType = 'announcements' | 'social' | 'wins' | 'custom';

export interface OrgChannel {
  id: string;                    // Firestore doc ID
  organizationId: string;        // Clerk org ID
  streamChannelId: string;       // Stream Chat channel ID (e.g., "org-{orgId}-announcements")
  type: OrgChannelType;          // Channel type
  title: string;                 // Display title (e.g., "Announcements")
  subtitle?: string;             // Description (e.g., "Updates from your coach")
  icon?: string;                 // Icon identifier (e.g., "megaphone", "chat", "sparkles")
  imageUrl?: string;             // Custom image URL (optional, overrides icon)
  order: number;                 // Display order (lower = first)
  isPinned: boolean;             // Show at top of channel list
  allowMemberMessages: boolean;  // false = only coach can post
  allowCalling: boolean;         // Enable audio/video calls
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

export interface CreateOrgChannelInput {
  organizationId: string;
  type: OrgChannelType;
  title: string;
  subtitle?: string;
  icon?: string;
  imageUrl?: string;
  order?: number;
  isPinned?: boolean;
  allowMemberMessages?: boolean;
  allowCalling?: boolean;
}

export interface UpdateOrgChannelInput {
  title?: string;
  subtitle?: string;
  icon?: string;
  imageUrl?: string;
  order?: number;
  isPinned?: boolean;
  allowMemberMessages?: boolean;
  allowCalling?: boolean;
}

// ============================================================================
// COACHING PROMO TYPES
// ============================================================================

/**
 * Organization coaching promo settings
 * Displayed in the chat sidebar to promote coaching services
 */
export interface OrgCoachingPromo {
  id: string;                    // Same as organizationId
  organizationId: string;        // Clerk org ID
  title: string;                 // Display title (default: "Get your personal coach")
  subtitle: string;              // Display subtitle (default: "Work with a performance psychologist 1:1")
  imageUrl: string;              // Promo image URL
  isVisible: boolean;            // Show/hide toggle
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

export interface UpdateOrgCoachingPromoInput {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
  isVisible?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Default icons for channel types
export const DEFAULT_CHANNEL_ICONS: Record<OrgChannelType, string> = {
  announcements: 'megaphone',
  social: 'chat',
  wins: 'sparkles',
  custom: 'hash',
};

// Default coaching promo configuration
export const DEFAULT_COACHING_PROMO: Omit<OrgCoachingPromo, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'> = {
  title: 'Get your personal coach',
  subtitle: 'Work with a performance psychologist 1:1',
  imageUrl: 'https://images.unsplash.com/photo-1580518324671-c2f0833a3af3?q=80&w=987&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
  isVisible: true,
};

// Default channel configurations
export const DEFAULT_CHANNELS_CONFIG: Array<{
  type: OrgChannelType;
  title: string;
  subtitle: string;
  icon: string;
  order: number;
  isPinned: boolean;
  allowMemberMessages: boolean;
  allowCalling: boolean;
}> = [
  {
    type: 'announcements',
    title: 'Announcements',
    subtitle: 'Updates from your coach',
    icon: 'megaphone',
    order: 0,
    isPinned: true,
    allowMemberMessages: false, // Coach-only
    allowCalling: false,
  },
  {
    type: 'social',
    title: 'Social Corner',
    subtitle: 'Chat with the community',
    icon: 'chat',
    order: 1,
    isPinned: false,
    allowMemberMessages: true,
    allowCalling: false,
  },
  {
    type: 'wins',
    title: 'Share your wins',
    subtitle: 'Celebrate with the community',
    icon: 'sparkles',
    order: 2,
    isPinned: false,
    allowMemberMessages: true,
    allowCalling: false,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a Stream Chat channel ID for an org channel
 */
export function getOrgStreamChannelId(organizationId: string, type: OrgChannelType, customSlug?: string): string {
  // Remove 'org_' prefix from Clerk org ID if present for cleaner IDs
  const orgIdShort = organizationId.replace('org_', '');
  
  if (type === 'custom' && customSlug) {
    return `org-${orgIdShort}-custom-${customSlug}`;
  }
  return `org-${orgIdShort}-${type}`;
}

/**
 * Parse org ID from a Stream channel ID
 */
export function parseOrgIdFromStreamChannelId(streamChannelId: string): string | null {
  const match = streamChannelId.match(/^org-([^-]+)-/);
  if (match) {
    return `org_${match[1]}`;
  }
  return null;
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

const COLLECTION = 'orgChannels';

/**
 * Get all channels for an organization
 */
export async function getOrgChannels(organizationId: string): Promise<OrgChannel[]> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where('organizationId', '==', organizationId)
    .get();

  const channels = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as OrgChannel[];

  // Sort by order, then by createdAt
  return channels.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

/**
 * Get a single channel by ID
 */
export async function getOrgChannel(channelId: string): Promise<OrgChannel | null> {
  const doc = await adminDb.collection(COLLECTION).doc(channelId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as OrgChannel;
}

/**
 * Get a channel by its Stream channel ID
 */
export async function getOrgChannelByStreamId(streamChannelId: string): Promise<OrgChannel | null> {
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where('streamChannelId', '==', streamChannelId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as OrgChannel;
}

/**
 * Create a new org channel
 */
export async function createOrgChannel(input: CreateOrgChannelInput): Promise<OrgChannel> {
  const now = new Date().toISOString();
  
  // Generate Stream channel ID
  const customSlug = input.type === 'custom' 
    ? input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20)
    : undefined;
  const streamChannelId = getOrgStreamChannelId(input.organizationId, input.type, customSlug);
  
  // Get the next order number if not provided
  let order = input.order;
  if (order === undefined) {
    const existingChannels = await getOrgChannels(input.organizationId);
    order = existingChannels.length > 0 
      ? Math.max(...existingChannels.map(c => c.order)) + 1 
      : 0;
  }

  const channelData: Omit<OrgChannel, 'id'> = {
    organizationId: input.organizationId,
    streamChannelId,
    type: input.type,
    title: input.title,
    subtitle: input.subtitle,
    icon: input.icon || DEFAULT_CHANNEL_ICONS[input.type],
    imageUrl: input.imageUrl,
    order,
    isPinned: input.isPinned ?? false,
    allowMemberMessages: input.allowMemberMessages ?? true,
    allowCalling: input.allowCalling ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await adminDb.collection(COLLECTION).add(channelData);
  
  return {
    id: docRef.id,
    ...channelData,
  };
}

/**
 * Update an org channel
 */
export async function updateOrgChannel(
  channelId: string, 
  updates: UpdateOrgChannelInput
): Promise<OrgChannel | null> {
  const docRef = adminDb.collection(COLLECTION).doc(channelId);
  const doc = await docRef.get();
  
  if (!doc.exists) return null;

  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await docRef.update(updateData);

  const updatedDoc = await docRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as OrgChannel;
}

/**
 * Delete an org channel
 */
export async function deleteOrgChannel(channelId: string): Promise<boolean> {
  const docRef = adminDb.collection(COLLECTION).doc(channelId);
  const doc = await docRef.get();
  
  if (!doc.exists) return false;
  
  await docRef.delete();
  return true;
}

/**
 * Reorder channels for an organization
 */
export async function reorderOrgChannels(
  organizationId: string, 
  channelOrder: { channelId: string; order: number }[]
): Promise<void> {
  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const item of channelOrder) {
    const docRef = adminDb.collection(COLLECTION).doc(item.channelId);
    batch.update(docRef, { order: item.order, updatedAt: now });
  }

  await batch.commit();
}

/**
 * Setup default channels for a new organization
 * Returns the created channels
 */
export async function setupDefaultOrgChannels(organizationId: string): Promise<OrgChannel[]> {
  // Check if org already has channels
  const existingChannels = await getOrgChannels(organizationId);
  if (existingChannels.length > 0) {
    console.log(`[ORG_CHANNELS] Org ${organizationId} already has ${existingChannels.length} channels`);
    return existingChannels;
  }

  console.log(`[ORG_CHANNELS] Setting up default channels for org ${organizationId}`);

  const createdChannels: OrgChannel[] = [];

  for (const config of DEFAULT_CHANNELS_CONFIG) {
    const channel = await createOrgChannel({
      organizationId,
      type: config.type,
      title: config.title,
      subtitle: config.subtitle,
      icon: config.icon,
      order: config.order,
      isPinned: config.isPinned,
      allowMemberMessages: config.allowMemberMessages,
      allowCalling: config.allowCalling,
    });
    createdChannels.push(channel);
    console.log(`[ORG_CHANNELS] Created channel: ${channel.title} (${channel.streamChannelId})`);
  }

  return createdChannels;
}

/**
 * Check if a user can send messages in a channel
 */
export function canUserPostInChannel(channel: OrgChannel, userRole?: string): boolean {
  // If channel allows member messages, everyone can post
  if (channel.allowMemberMessages) return true;
  
  // Otherwise, only coach/admin/super_admin can post
  return userRole === 'coach' || userRole === 'admin' || userRole === 'super_admin';
}

// ============================================================================
// COACHING PROMO FIRESTORE OPERATIONS
// ============================================================================

const COACHING_PROMO_COLLECTION = 'orgCoachingPromo';

/**
 * Get coaching promo settings for an organization
 * Returns default values if no custom settings exist
 */
export async function getOrgCoachingPromo(organizationId: string): Promise<OrgCoachingPromo> {
  const docRef = adminDb.collection(COACHING_PROMO_COLLECTION).doc(organizationId);
  const doc = await docRef.get();
  
  if (!doc.exists) {
    // Return default promo settings
    const now = new Date().toISOString();
    return {
      id: organizationId,
      organizationId,
      ...DEFAULT_COACHING_PROMO,
      createdAt: now,
      updatedAt: now,
    };
  }
  
  return { id: doc.id, ...doc.data() } as OrgCoachingPromo;
}

/**
 * Update coaching promo settings for an organization
 * Creates the document if it doesn't exist
 */
export async function updateOrgCoachingPromo(
  organizationId: string,
  updates: UpdateOrgCoachingPromoInput
): Promise<OrgCoachingPromo> {
  const docRef = adminDb.collection(COACHING_PROMO_COLLECTION).doc(organizationId);
  const doc = await docRef.get();
  const now = new Date().toISOString();
  
  if (!doc.exists) {
    // Create new document with defaults + updates
    const newData: Omit<OrgCoachingPromo, 'id'> = {
      organizationId,
      ...DEFAULT_COACHING_PROMO,
      ...updates,
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(newData);
    return { id: organizationId, ...newData };
  }
  
  // Update existing document
  const updateData = {
    ...updates,
    updatedAt: now,
  };
  await docRef.update(updateData);
  
  const updatedDoc = await docRef.get();
  return { id: updatedDoc.id, ...updatedDoc.data() } as OrgCoachingPromo;
}

