import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { MorningCheckIn, ClerkPublicMetadata } from '@/types';

/**
 * Generate document ID for morning check-in: `${organizationId}_${userId}_${date}`
 * Multi-tenancy: Check-ins are scoped per organization
 */
function getCheckInDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

// GET - Fetch today's check-in
// MULTI-TENANCY: Fetches check-in for current organization
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Try new top-level collection first
    const docId = getCheckInDocId(organizationId, userId, date);
    let checkInDoc = await adminDb.collection('morning_checkins').doc(docId).get();

    // Legacy fallback: Check user subcollection
    if (!checkInDoc.exists) {
      const legacyRef = adminDb.collection('users').doc(userId).collection('checkins').doc(date);
      checkInDoc = await legacyRef.get();
    }

    if (!checkInDoc.exists) {
      return NextResponse.json({ checkIn: null });
    }

    return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
  } catch (error) {
    console.error('Error fetching check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new check-in
// MULTI-TENANCY: Creates check-in scoped to current organization
export async function POST(_request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const docId = getCheckInDocId(organizationId, userId, today);
    const checkInRef = adminDb.collection('morning_checkins').doc(docId);
    const existingDoc = await checkInRef.get();

    // If check-in already exists, return it
    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const now = new Date().toISOString();
    const newCheckIn: Omit<MorningCheckIn, 'id'> = {
      date: today,
      userId,
      organizationId,
      emotionalState: 'neutral',
      manifestIdentityCompleted: false,
      manifestGoalCompleted: false,
      tasksPlanned: false,
      createdAt: now,
      updatedAt: now,
    };

    await checkInRef.set(newCheckIn);

    return NextResponse.json({ checkIn: { id: docId, ...newCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to create check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update check-in progress
// MULTI-TENANCY: Updates check-in scoped to current organization
export async function PATCH(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const updates = await request.json();
    const today = new Date().toISOString().split('T')[0];
    
    // Try new top-level collection first
    const docId = getCheckInDocId(organizationId, userId, today);
    let checkInRef = adminDb.collection('morning_checkins').doc(docId);
    let existingDoc = await checkInRef.get();

    // Legacy fallback: Check user subcollection
    if (!existingDoc.exists) {
      const legacyRef = adminDb.collection('users').doc(userId).collection('checkins').doc(today);
      existingDoc = await legacyRef.get();
      if (existingDoc.exists) {
        checkInRef = legacyRef as FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
      }
    }

    if (!existingDoc.exists) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    // Update alignment when morning check-in is completed (org-scoped)
    if (updates.completedAt) {
      try {
        // Check if tasks were also planned (from the Plan Day step)
        const didSetTasks = updates.tasksPlanned === true;
        
        await updateAlignmentForToday(userId, organizationId, {
          didMorningCheckin: true,
          didSetTasks: didSetTasks || undefined, // Only set if true
        });
      } catch (alignmentError) {
        // Don't fail the check-in if alignment update fails
        console.error('[MORNING_CHECKIN] Alignment update failed:', alignmentError);
      }
    }

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error('Error updating check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to update check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

