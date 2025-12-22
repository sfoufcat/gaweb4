import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClerkPublicMetadata } from '@/types';

/**
 * GET /api/goal/reflections
 * Fetches all reflections for the user's active goal
 * 
 * MULTI-TENANCY: Reflections are scoped per organization
 * 
 * Query params:
 * - type: 'daily' | 'weekly' | 'all' (default: 'all')
 * - limit: number (default: 20)
 */
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get user's active goal ID (from org_memberships for multi-tenancy)
    let goalId: string | null = null;
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (!membershipSnapshot.empty) {
      const memberData = membershipSnapshot.docs[0].data();
      if (memberData?.goal) {
        goalId = `${organizationId}_${userId}_goal`;
      }
    } else {
      // Legacy fallback
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists && userDoc.data()?.goal) {
        goalId = `${userId}_goal`;
      }
    }
    
    if (!goalId) {
      return NextResponse.json({ reflections: [] });
    }

    // Fetch reflections from top-level collection (org-scoped)
    let query = adminDb
      .collection('reflections')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .limit(limit);

    if (type !== 'all') {
      query = adminDb
        .collection('reflections')
        .where('userId', '==', userId)
        .where('organizationId', '==', organizationId)
        .where('type', '==', type)
        .orderBy('createdAt', 'desc')
        .limit(limit);
    }

    const snapshot = await query.get();
    const reflections = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Legacy fallback: Also check user subcollection if no results
    if (reflections.length === 0) {
      const legacyQuery = type !== 'all'
        ? adminDb.collection('users').doc(userId).collection('reflections')
            .where('type', '==', type).orderBy('createdAt', 'desc').limit(limit)
        : adminDb.collection('users').doc(userId).collection('reflections')
            .orderBy('createdAt', 'desc').limit(limit);
      
      const legacySnapshot = await legacyQuery.get();
      const legacyReflections = legacySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return NextResponse.json({
        reflections: legacyReflections,
        goalId,
      });
    }

    return NextResponse.json({
      reflections,
      goalId,
    });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goal/reflections
 * Creates a new reflection
 * 
 * MULTI-TENANCY: Reflections are scoped per organization
 */
export async function POST(req: Request) {
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

    const body = await req.json();
    const { type, ...reflectionData } = body;

    if (!type || !['daily', 'weekly'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid reflection type' },
        { status: 400 }
      );
    }

    // Get user's active goal (from org_memberships for multi-tenancy)
    let goalId: string | null = null;
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (!membershipSnapshot.empty) {
      const memberData = membershipSnapshot.docs[0].data();
      if (memberData?.goal) {
        goalId = `${organizationId}_${userId}_goal`;
      }
    } else {
      // Legacy fallback
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists && userDoc.data()?.goal) {
        goalId = `${userId}_goal`;
      }
    }

    if (!goalId) {
      return NextResponse.json(
        { error: 'No active goal found' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const reflectionId = `${organizationId}_${userId}_${type}_${Date.now()}`;

    const newReflection = {
      userId,
      organizationId,
      goalId,
      type,
      ...reflectionData,
      createdAt: now,
      updatedAt: now,
    };

    // Save to top-level reflections collection (org-scoped)
    await adminDb
      .collection('reflections')
      .doc(reflectionId)
      .set(newReflection);

    return NextResponse.json({
      success: true,
      reflection: {
        id: reflectionId,
        ...newReflection,
      },
    });
  } catch (error) {
    console.error('Error creating reflection:', error);
    return NextResponse.json(
      { error: 'Failed to create reflection' },
      { status: 500 }
    );
  }
}














