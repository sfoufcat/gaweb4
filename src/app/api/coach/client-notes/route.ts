import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { UserRole, OrgRole, ClerkPublicMetadata } from '@/types';

/**
 * Coach Client Notes API
 * 
 * Allows coaches to save and retrieve personal notes about clients.
 * Notes are stored per coach-client pair and are private to the coach.
 * 
 * Collection: coach_client_notes
 * Document ID format: {organizationId}_{coachId}_{clientId}
 */

interface CoachClientNotes {
  organizationId: string;
  coachId: string;
  clientId: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/coach/client-notes?clientId={clientId}
 * Fetches coach's notes for a specific client
 */
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Document ID: orgId_coachId_clientId
    const docId = `${organizationId}_${userId}_${clientId}`;
    const notesDoc = await adminDb.collection('coach_client_notes').doc(docId).get();

    if (!notesDoc.exists) {
      return NextResponse.json({
        notes: '',
        clientId,
      });
    }

    const data = notesDoc.data() as CoachClientNotes;

    return NextResponse.json({
      notes: data.notes || '',
      clientId,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error('[COACH_CLIENT_NOTES_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/client-notes
 * Saves or updates coach's notes for a specific client
 * 
 * Body: { clientId: string, notes: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const { clientId, notes } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    if (typeof notes !== 'string') {
      return NextResponse.json({ error: 'notes must be a string' }, { status: 400 });
    }

    // Verify client exists in the organization
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', clientId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      // Also check users collection as fallback
      const userDoc = await adminDb.collection('users').doc(clientId).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }
    }

    const now = new Date().toISOString();
    const docId = `${organizationId}_${userId}_${clientId}`;
    
    const notesData: CoachClientNotes = {
      organizationId,
      coachId: userId,
      clientId,
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    };

    // Check if document exists to preserve createdAt
    const existingDoc = await adminDb.collection('coach_client_notes').doc(docId).get();
    if (existingDoc.exists) {
      const existingData = existingDoc.data() as CoachClientNotes;
      notesData.createdAt = existingData.createdAt;
    }

    await adminDb.collection('coach_client_notes').doc(docId).set(notesData);

    return NextResponse.json({
      success: true,
      updatedAt: now,
    });
  } catch (error) {
    console.error('[COACH_CLIENT_NOTES_PUT_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

