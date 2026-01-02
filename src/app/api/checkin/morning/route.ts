import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { updateAlignmentForToday } from '@/lib/alignment';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { updateLastActivity } from '@/lib/analytics/lastActivity';
import type { MorningCheckIn } from '@/types';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';

/**
 * Generate document ID for morning check-in: `${organizationId}_${userId}_${date}`
 * Multi-tenancy: Check-ins are scoped per organization
 */
function getCheckInDocId(organizationId: string, userId: string, date: string): string {
  return `${organizationId}_${userId}_${date}`;
}

// GET - Fetch today's check-in
// MULTI-TENANCY: Fetches check-in for current organization (with legacy fallback)
export async function GET(request: NextRequest) {
  try {
    // Demo mode: return demo check-in data
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse({ 
        checkIn: {
          id: 'demo-morning-checkin',
          date: new Date().toISOString().split('T')[0],
          emotionalState: 'steady',
          affirmation: 'I am capable of achieving my goals',
          gratitude: ['My morning routine', 'Great progress on my project', 'Supportive community'],
          intention: 'Stay focused and present throughout the day',
          completed: false,
          createdAt: new Date().toISOString(),
        }
      });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain
    const organizationId = await getEffectiveOrgId();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Try new top-level collection if we have organizationId
    if (organizationId) {
      const docId = getCheckInDocId(organizationId, userId, date);
      const checkInDoc = await adminDb.collection('morning_checkins').doc(docId).get();
      if (checkInDoc.exists) {
        return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
      }
    }

    // Legacy fallback: Check user subcollection (for backward compatibility)
    const legacyRef = adminDb.collection('users').doc(userId).collection('checkins').doc(date);
    const legacyDoc = await legacyRef.get();
    
    if (legacyDoc.exists) {
      return NextResponse.json({ checkIn: { id: legacyDoc.id, ...legacyDoc.data() } });
    }

    return NextResponse.json({ checkIn: null });
  } catch (error) {
    console.error('Error fetching check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new check-in
// MULTI-TENANCY: Creates check-in scoped to current organization (with legacy fallback)
export async function POST(_request: NextRequest) {
  try {
    // Demo mode: return mock check-in
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse({ 
        checkIn: {
          id: 'demo-morning-checkin',
          date: new Date().toISOString().split('T')[0],
          emotionalState: 'neutral',
          createdAt: new Date().toISOString(),
        }
      });
    }

    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    // If we have organizationId, use new structure
    if (organizationId) {
      const docId = getCheckInDocId(organizationId, userId, today);
      const checkInRef = adminDb.collection('morning_checkins').doc(docId);
      const existingDoc = await checkInRef.get();

      // If check-in already exists, return it
      if (existingDoc.exists) {
        return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
      }

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
    }

    // Legacy fallback: Use user subcollection
    console.warn('[MORNING_CHECKIN] No organization context, using legacy structure for user', userId);
    const legacyRef = adminDb.collection('users').doc(userId).collection('checkins').doc(today);
    const existingDoc = await legacyRef.get();

    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const legacyCheckIn = {
      date: today,
      userId,
      emotionalState: 'neutral',
      manifestIdentityCompleted: false,
      manifestGoalCompleted: false,
      tasksPlanned: false,
      createdAt: now,
      updatedAt: now,
    };

    await legacyRef.set(legacyCheckIn);
    return NextResponse.json({ checkIn: { id: today, ...legacyCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating check-in:', error);
    const message = error instanceof Error ? error.message : 'Failed to create check-in';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update check-in progress
// MULTI-TENANCY: Updates check-in scoped to current organization (with legacy fallback)
export async function PATCH(request: NextRequest) {
  try {
    // Demo mode: simulate success
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const updates = await request.json();
      return demoResponse({ 
        success: true,
        checkIn: {
          id: 'demo-morning-checkin',
          date: new Date().toISOString().split('T')[0],
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      });
    }

    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const organizationId = await getEffectiveOrgId();

    const updates = await request.json();
    const today = new Date().toISOString().split('T')[0];
    
    let checkInRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;
    let existingDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Try new top-level collection first if we have organizationId
    if (organizationId) {
      const docId = getCheckInDocId(organizationId, userId, today);
      checkInRef = adminDb.collection('morning_checkins').doc(docId);
      existingDoc = await checkInRef.get();
    }

    // Legacy fallback: Check user subcollection
    if (!existingDoc?.exists) {
      const legacyRef = adminDb.collection('users').doc(userId).collection('checkins').doc(today);
      existingDoc = await legacyRef.get();
      if (existingDoc.exists) {
        checkInRef = legacyRef;
      }
    }

    if (!existingDoc?.exists || !checkInRef) {
      return NextResponse.json({ error: 'Check-in not found' }, { status: 404 });
    }

    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    // Update alignment when morning check-in is completed (org-scoped)
    if (updates.completedAt && organizationId) {
      try {
        // Check if tasks were also planned (from the Plan Day step)
        const didSetTasks = updates.tasksPlanned === true;
        
        await updateAlignmentForToday(userId, organizationId, {
          didMorningCheckin: true,
          didSetTasks: didSetTasks || undefined, // Only set if true
        });
        
        // Update lastActivityAt for analytics (non-blocking)
        updateLastActivity(userId, organizationId, 'checkin').catch(err => {
          console.error('[MORNING_CHECKIN] Failed to update lastActivityAt:', err);
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

