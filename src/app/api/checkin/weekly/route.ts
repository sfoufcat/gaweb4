import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { summarizeWeeklyFocus } from '@/lib/anthropic';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { WeeklyReflectionCheckIn, ClerkPublicMetadata } from '@/types';

// Get the week identifier (Monday of the current week)
function getWeekId(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Generate document ID for weekly reflection: `${organizationId}_${userId}_${weekId}`
 * Multi-tenancy: Reflections are scoped per organization
 */
function getWeeklyReflectionDocId(organizationId: string, userId: string, weekId: string): string {
  return `${organizationId}_${userId}_${weekId}`;
}

// GET - Fetch current week's reflection
// MULTI-TENANCY: Fetches reflection for current organization (with legacy fallback)
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

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId') || getWeekId();

    // Try new top-level collection first if we have organizationId
    if (organizationId) {
      const docId = getWeeklyReflectionDocId(organizationId, userId, weekId);
      const checkInDoc = await adminDb.collection('weekly_reflections').doc(docId).get();
      if (checkInDoc.exists) {
        return NextResponse.json({ checkIn: { id: checkInDoc.id, ...checkInDoc.data() } });
      }
    }

    // Legacy fallback: Check user subcollection
    const legacyRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
    const legacyDoc = await legacyRef.get();
    
    if (legacyDoc.exists) {
      return NextResponse.json({ checkIn: { id: legacyDoc.id, ...legacyDoc.data() } });
    }

    return NextResponse.json({ checkIn: null });
  } catch (error) {
    console.error('Error fetching weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Start a new weekly reflection
// MULTI-TENANCY: Creates reflection scoped to current organization (with legacy fallback)
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

    const weekId = getWeekId();
    const now = new Date().toISOString();

    // Get user's current goal progress
    let currentProgress = 0;
    if (organizationId) {
      const membershipSnapshot = await adminDb.collection('org_memberships')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        currentProgress = membershipSnapshot.docs[0].data()?.goalProgress || 0;
      }
    }
    
    // Legacy fallback for progress
    if (currentProgress === 0) {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      currentProgress = userDoc.data()?.goalProgress || 0;
    }

    // If we have organizationId, use new structure
    if (organizationId) {
      const docId = getWeeklyReflectionDocId(organizationId, userId, weekId);
      const checkInRef = adminDb.collection('weekly_reflections').doc(docId);
      const existingDoc = await checkInRef.get();

      // If check-in already exists, return it
      if (existingDoc.exists) {
        return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
      }

      const newCheckIn: Omit<WeeklyReflectionCheckIn, 'id'> = {
        date: weekId,
        userId,
        organizationId,
        onTrackStatus: 'not_sure',
        progress: currentProgress,
        previousProgress: currentProgress,
        createdAt: now,
        updatedAt: now,
      };

      await checkInRef.set(newCheckIn);
      return NextResponse.json({ checkIn: { id: docId, ...newCheckIn } }, { status: 201 });
    }

    // Legacy fallback: Use user subcollection
    console.warn('[WEEKLY_CHECKIN] No organization context, using legacy structure for user', userId);
    const legacyRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
    const existingDoc = await legacyRef.get();

    if (existingDoc.exists) {
      return NextResponse.json({ checkIn: { id: existingDoc.id, ...existingDoc.data() } });
    }

    const legacyCheckIn = {
      date: weekId,
      userId,
      onTrackStatus: 'not_sure',
      progress: currentProgress,
      previousProgress: currentProgress,
      createdAt: now,
      updatedAt: now,
    };

    await legacyRef.set(legacyCheckIn);
    return NextResponse.json({ checkIn: { id: weekId, ...legacyCheckIn } }, { status: 201 });
  } catch (error) {
    console.error('Error creating weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to create weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update weekly reflection progress
// MULTI-TENANCY: Updates reflection scoped to current organization (with legacy fallback)
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

    const updates = await request.json();
    const weekId = getWeekId();
    
    let checkInRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null = null;
    let existingDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    // Try new top-level collection first if we have organizationId
    if (organizationId) {
      const docId = getWeeklyReflectionDocId(organizationId, userId, weekId);
      checkInRef = adminDb.collection('weekly_reflections').doc(docId);
      existingDoc = await checkInRef.get();
    }

    // Legacy fallback: Check user subcollection
    if (!existingDoc?.exists) {
      const legacyRef = adminDb.collection('users').doc(userId).collection('weeklyReflections').doc(weekId);
      existingDoc = await legacyRef.get();
      if (existingDoc.exists) {
        checkInRef = legacyRef;
      }
    }

    if (!existingDoc?.exists || !checkInRef) {
      return NextResponse.json({ error: 'Weekly reflection not found' }, { status: 404 });
    }

    const existingData = existingDoc.data() as WeeklyReflectionCheckIn;
    const updatedData: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // If marking as completed, set completedAt
    if (updates.completedAt === true) {
      updatedData.completedAt = new Date().toISOString();
      
      // Save to reflections collection for goal page (org-scoped) - only if we have org context
      if (organizationId) {
        const progressChange = (existingData.progress || 0) - (existingData.previousProgress || 0);
        const reflectionData = {
          userId,
          organizationId,
          goalId: `${organizationId}_${userId}_goal`,
          type: 'weekly',
          date: weekId,
          weekEndDate: new Date().toISOString().split('T')[0],
          progressChange,
          onTrackStatus: existingData.onTrackStatus || 'not_sure',
          whatWentWell: existingData.whatWentWell || '',
          biggestObstacles: existingData.biggestObstacles || '',
          nextWeekPlan: existingData.nextWeekPlan || '',
          publicFocus: existingData.publicFocus || updates.publicFocus || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save to top-level reflections collection with org scope
        await adminDb
          .collection('reflections')
          .doc(`${organizationId}_${userId}_weekly_${weekId}`)
          .set(reflectionData);

        // Update org_membership's publicFocus field for profile display
        const focusText = existingData.publicFocus || updates.publicFocus;
        if (focusText) {
          // Generate AI summary for the weekly focus
          const { summary: focusSummary } = await summarizeWeeklyFocus(focusText);
          
          // Update in org_memberships for multi-tenancy
          const membershipSnapshot = await adminDb.collection('org_memberships')
            .where('userId', '==', userId)
            .where('organizationId', '==', organizationId)
            .limit(1)
            .get();
          
          if (!membershipSnapshot.empty) {
            await membershipSnapshot.docs[0].ref.update({
              publicFocus: focusText,
              publicFocusSummary: focusSummary,
              publicFocusUpdatedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // If updating progress, also update org_membership's goalProgress (only with org context)
    if (typeof updates.progress === 'number' && organizationId) {
      const membershipSnapshot = await adminDb.collection('org_memberships')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        await membershipSnapshot.docs[0].ref.update({
          goalProgress: updates.progress,
        });
      }
    }

    // If marking goal as complete (only with org context)
    if (updates.goalCompleted === true) {
      updatedData.goalCompleted = true;
      updatedData.completedAt = new Date().toISOString();
      
      // Mark the goal as completed in org_membership (multi-tenancy)
      if (organizationId) {
        const membershipSnapshot = await adminDb.collection('org_memberships')
          .where('userId', '==', userId)
          .where('organizationId', '==', organizationId)
          .limit(1)
          .get();
        
        if (!membershipSnapshot.empty) {
          await membershipSnapshot.docs[0].ref.update({
            goalProgress: 100,
            goalCompletedAt: new Date().toISOString(),
            goalCompleted: true,
          });
        }
      }
    }

    await checkInRef.update(updatedData);
    const updatedDoc = await checkInRef.get();

    return NextResponse.json({ checkIn: { id: updatedDoc.id, ...updatedDoc.data() } });
  } catch (error) {
    console.error('Error updating weekly reflection:', error);
    const message = error instanceof Error ? error.message : 'Failed to update weekly reflection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}













