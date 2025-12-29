/**
 * API Route: Admin Feature Management (single feature)
 * 
 * GET /api/admin/features/[featureId] - Get single feature details
 * PATCH /api/admin/features/[featureId] - Update feature (status, priority, notes)
 * DELETE /api/admin/features/[featureId] - Delete feature
 * 
 * Only accessible by admin and super_admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClerkPublicMetadata, FeatureRequest, FeatureRequestStatus } from '@/types';

// =============================================================================
// GET - Get single feature
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { featureId } = await params;

    const featureDoc = await adminDb.collection('feature_requests').doc(featureId).get();

    if (!featureDoc.exists) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const feature = { id: featureDoc.id, ...featureDoc.data() } as FeatureRequest;

    // Get vote count breakdown
    const votesSnapshot = await adminDb
      .collection('feature_votes')
      .where('featureId', '==', featureId)
      .get();

    const voters: Array<{ userId: string; userName?: string; createdAt: string }> = [];
    votesSnapshot.forEach((doc) => {
      const data = doc.data();
      voters.push({
        userId: data.userId,
        userName: data.userName,
        createdAt: data.createdAt,
      });
    });

    return NextResponse.json({
      feature,
      voters,
    });

  } catch (error) {
    console.error('[ADMIN_FEATURE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update feature
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { featureId } = await params;
    const body = await request.json();

    const featureRef = adminDb.collection('feature_requests').doc(featureId);
    const featureDoc = await featureRef.get();

    if (!featureDoc.exists) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    const currentFeature = featureDoc.data() as FeatureRequest;
    const now = new Date().toISOString();

    // Build update object
    const updates: Partial<FeatureRequest> = {
      updatedAt: now,
    };

    // Handle status change
    if (body.status !== undefined) {
      const validStatuses: FeatureRequestStatus[] = ['suggested', 'in_progress', 'completed', 'declined'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      
      if (body.status !== currentFeature.status) {
        updates.status = body.status;
        updates.statusChangedAt = now;
        updates.statusChangedBy = userId;
      }
    }

    // Handle title update
    if (body.title !== undefined) {
      if (body.title.trim().length < 3) {
        return NextResponse.json({ error: 'Title too short' }, { status: 400 });
      }
      updates.title = body.title.trim();
    }

    // Handle description update
    if (body.description !== undefined) {
      updates.description = body.description.trim();
    }

    // Handle priority update
    if (body.priority !== undefined) {
      updates.priority = body.priority === null ? undefined : Number(body.priority);
    }

    // Handle admin notes
    if (body.adminNotes !== undefined) {
      updates.adminNotes = body.adminNotes?.trim() || undefined;
    }

    await featureRef.update(updates);

    console.log(`[ADMIN_FEATURE_PATCH] Admin ${userId} updated feature ${featureId}:`, updates);

    // Fetch updated feature
    const updatedDoc = await featureRef.get();
    const updatedFeature = { id: updatedDoc.id, ...updatedDoc.data() } as FeatureRequest;

    return NextResponse.json({
      success: true,
      feature: updatedFeature,
    });

  } catch (error) {
    console.error('[ADMIN_FEATURE_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete feature
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> }
) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { featureId } = await params;

    const featureRef = adminDb.collection('feature_requests').doc(featureId);
    const featureDoc = await featureRef.get();

    if (!featureDoc.exists) {
      return NextResponse.json({ error: 'Feature not found' }, { status: 404 });
    }

    // Delete all votes for this feature
    const votesSnapshot = await adminDb
      .collection('feature_votes')
      .where('featureId', '==', featureId)
      .get();

    const batch = adminDb.batch();
    votesSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    batch.delete(featureRef);
    await batch.commit();

    console.log(`[ADMIN_FEATURE_DELETE] Admin ${userId} deleted feature ${featureId} (${votesSnapshot.size} votes)`);

    return NextResponse.json({
      success: true,
      deletedVotes: votesSnapshot.size,
    });

  } catch (error) {
    console.error('[ADMIN_FEATURE_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature' },
      { status: 500 }
    );
  }
}






