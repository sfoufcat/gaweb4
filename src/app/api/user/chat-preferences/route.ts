import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  ChatPreference,
  ChatPreferenceAction,
  ChatChannelType,
  CHAT_PREFERENCES_COLLECTION,
  canPerformAction,
} from '@/types/chat-preferences';

/**
 * GET /api/user/chat-preferences
 * Fetch all chat preferences for the current user
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prefsRef = adminDb
      .collection('users')
      .doc(userId)
      .collection(CHAT_PREFERENCES_COLLECTION);

    const snapshot = await prefsRef.get();

    const preferences: ChatPreference[] = [];
    snapshot.docs.forEach((doc) => {
      preferences.push({
        channelId: doc.id,
        ...doc.data(),
      } as ChatPreference);
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('[CHAT_PREFERENCES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/chat-preferences
 * Update a chat preference (pin, unpin, archive, unarchive, delete, undelete)
 *
 * Body: { channelId: string, channelType: ChatChannelType, action: ChatPreferenceAction }
 */
export async function POST(req: Request) {
  console.log('[CHAT_PREFERENCES_POST] Received request');
  try {
    const { userId } = await auth();
    console.log('[CHAT_PREFERENCES_POST] userId:', userId);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    console.log('[CHAT_PREFERENCES_POST] body:', body);
    const { channelId, channelType, action } = body as {
      channelId: string;
      channelType: ChatChannelType;
      action: ChatPreferenceAction;
    };

    // Validate required fields
    if (!channelId || !channelType || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: channelId, channelType, action' },
        { status: 400 }
      );
    }

    // Validate channel type
    if (!['dm', 'squad', 'org'].includes(channelType)) {
      return NextResponse.json(
        { error: `Invalid channelType: ${channelType}` },
        { status: 400 }
      );
    }

    // Validate action is allowed for this channel type
    if (!canPerformAction(channelType, action)) {
      return NextResponse.json(
        {
          error: `Action '${action}' is not allowed for ${channelType} channels`,
        },
        { status: 400 }
      );
    }

    const prefRef = adminDb
      .collection('users')
      .doc(userId)
      .collection(CHAT_PREFERENCES_COLLECTION)
      .doc(channelId);

    const now = new Date().toISOString();

    // Build updates based on action
    const updates: Partial<ChatPreference> = {
      channelId,
      channelType,
      updatedAt: now,
    };

    switch (action) {
      case 'pin':
        updates.isPinned = true;
        updates.pinnedAt = now;
        break;
      case 'unpin':
        updates.isPinned = false;
        break;
      case 'archive':
        updates.isArchived = true;
        updates.archivedAt = now;
        break;
      case 'unarchive':
        updates.isArchived = false;
        break;
      case 'delete':
        updates.isDeleted = true;
        updates.deletedAt = now;
        break;
      case 'undelete':
        updates.isDeleted = false;
        break;
    }

    // Get current preference to merge with
    const currentDoc = await prefRef.get();
    const currentData = currentDoc.exists ? currentDoc.data() : {};

    // Merge with defaults for missing fields
    const newPreference: ChatPreference = {
      channelId,
      channelType,
      isPinned: false,
      isArchived: false,
      isDeleted: false,
      updatedAt: now,
      ...currentData,
      ...updates,
    };

    await prefRef.set(newPreference);

    console.log(
      `[CHAT_PREFERENCES_POST] User ${userId} performed ${action} on channel ${channelId}`
    );

    return NextResponse.json({
      success: true,
      preference: newPreference,
    });
  } catch (error) {
    console.error('[CHAT_PREFERENCES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update chat preference' },
      { status: 500 }
    );
  }
}
