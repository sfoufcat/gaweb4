import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import type { 
  ClientCoachingData, 
  UserRole, 
  OrgRole,
  FirebaseUser, 
  Coach,
  CoachingActionItem,
  CoachingSessionHistory,
  CoachingResource,
  CoachPrivateNotes
} from '@/types';

/**
 * GET /api/coaching/clients/[clientId]
 * Fetches detailed coaching data for a specific client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Fetch coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const coachingData = { id: coachingDoc.id, ...coachingDoc.data() } as ClientCoachingData;

    // Verify coach has access to this client (global coach role or assigned org coach)
    const isGlobalCoach = role === 'coach';
    const isOrgCoach = orgRole === 'coach';
    if ((isGlobalCoach || isOrgCoach) && coachingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch user details
    const userDoc = await adminDb.collection('users').doc(clientId).get();
    let user: Partial<FirebaseUser> | null = null;
    if (userDoc.exists) {
      const userData = userDoc.data() as FirebaseUser;
      user = {
        id: userDoc.id,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        imageUrl: userData.imageUrl,
        timezone: userData.timezone,
        goal: userData.goal,
        goalTargetDate: userData.goalTargetDate,
        goalProgress: userData.goalProgress,
      };
    }

    // Fetch coach info
    let coach: Coach | null = null;
    if (coachingData.coachId) {
      const coachDoc = await adminDb.collection('coaches').doc(coachingData.coachId).get();
      if (coachDoc.exists) {
        coach = { id: coachDoc.id, ...coachDoc.data() } as Coach;
      }
    }

    return NextResponse.json({
      data: coachingData,
      user,
      coach,
    });
  } catch (error) {
    console.error('[COACHING_CLIENT_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coaching/clients/[clientId]
 * Updates coaching data for a specific client (coach only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const patchMetadata = sessionClaims?.publicMetadata as { role?: UserRole; orgRole?: OrgRole };
    const patchRole = patchMetadata?.role;
    const patchOrgRole = patchMetadata?.orgRole;

    if (!canAccessCoachDashboard(patchRole, patchOrgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    // Fetch existing coaching data
    const coachingDoc = await adminDb.collection('clientCoachingData').doc(clientId).get();

    if (!coachingDoc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const existingData = coachingDoc.data() as ClientCoachingData;

    // Verify coach has access to this client (global coach role or assigned org coach)
    const isPatchGlobalCoach = patchRole === 'coach';
    const isPatchOrgCoach = patchOrgRole === 'coach';
    if ((isPatchGlobalCoach || isPatchOrgCoach) && existingData.coachId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Build update object - only allow specific fields
    const updateData: Partial<ClientCoachingData> = {
      updatedAt: now,
    };

    // Focus areas
    if (body.focusAreas !== undefined && Array.isArray(body.focusAreas)) {
      updateData.focusAreas = body.focusAreas;
    }

    // Action items
    if (body.actionItems !== undefined && Array.isArray(body.actionItems)) {
      updateData.actionItems = body.actionItems.map((item: Partial<CoachingActionItem>) => ({
        id: item.id || `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: item.text || '',
        completed: item.completed || false,
        completedAt: item.completedAt,
        createdAt: item.createdAt || now,
      }));
    }

    // Session history (add or update)
    if (body.sessionHistory !== undefined && Array.isArray(body.sessionHistory)) {
      updateData.sessionHistory = body.sessionHistory.map((session: Partial<CoachingSessionHistory>) => ({
        id: session.id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date: session.date || now.split('T')[0],
        title: session.title || 'Coaching Session',
        summary: session.summary || '',
        takeaways: session.takeaways || [],
        createdAt: session.createdAt || now,
        updatedAt: now,
      }));
    }

    // Resources
    if (body.resources !== undefined && Array.isArray(body.resources)) {
      updateData.resources = body.resources.map((resource: Partial<CoachingResource>) => ({
        id: resource.id || `resource_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: resource.title || 'Resource',
        url: resource.url || '',
        description: resource.description,
        createdAt: resource.createdAt || now,
      }));
    }

    // Private notes (coach only)
    if (body.privateNotes !== undefined && Array.isArray(body.privateNotes)) {
      updateData.privateNotes = body.privateNotes.map((note: Partial<CoachPrivateNotes>) => ({
        sessionId: note.sessionId || `note_${Date.now()}`,
        notes: note.notes || '',
        plannedTopics: note.plannedTopics,
        tags: note.tags || [],
        createdAt: note.createdAt || now,
        updatedAt: now,
      }));
    }

    // Update Firestore
    await adminDb.collection('clientCoachingData').doc(clientId).update(updateData);

    return NextResponse.json({ success: true, updatedAt: now });
  } catch (error) {
    console.error('[COACHING_CLIENT_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}









