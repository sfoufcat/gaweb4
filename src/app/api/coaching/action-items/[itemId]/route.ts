import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClientCoachingData, UserRole } from '@/types';

/**
 * PATCH /api/coaching/action-items/[itemId]
 * Update an action item's completion status (client can toggle their own items)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has coaching access
    const publicMetadata = sessionClaims?.publicMetadata as {
      coaching?: boolean; // Legacy flag
      coachingStatus?: 'none' | 'active' | 'canceled' | 'past_due'; // New field
      role?: UserRole;
    } | undefined;

    // Check both new coachingStatus and legacy coaching flag for backward compatibility
    const hasCoaching = publicMetadata?.coachingStatus === 'active' || publicMetadata?.coaching === true;
    const role = publicMetadata?.role;
    const isStaff = role === 'coach' || role === 'admin' || role === 'super_admin';

    if (!hasCoaching && !isStaff) {
      return NextResponse.json({ error: 'Coaching subscription required' }, { status: 403 });
    }

    const body = await request.json();
    const { completed } = body;

    if (typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'completed field is required' }, { status: 400 });
    }

    // Fetch coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(userId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Coaching data not found' }, { status: 404 });
    }

    const coachingData = coachingDoc.data() as ClientCoachingData;
    const now = new Date().toISOString();

    // Find and update the action item
    const actionItems = coachingData.actionItems || [];
    const itemIndex = actionItems.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 });
    }

    // Update the item
    actionItems[itemIndex] = {
      ...actionItems[itemIndex],
      completed,
      completedAt: completed ? now : undefined,
    };

    // Save to Firestore
    await adminDb.collection('clientCoachingData').doc(userId).update({
      actionItems,
      updatedAt: now,
    });

    return NextResponse.json({ 
      success: true, 
      item: actionItems[itemIndex],
    });
  } catch (error) {
    console.error('[COACHING_ACTION_ITEM_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


