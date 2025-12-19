/**
 * Coach API: Single Track Management (Organization-scoped)
 * 
 * GET /api/coach/org-tracks/:trackId - Get single track
 * PUT /api/coach/org-tracks/:trackId - Update track
 * DELETE /api/coach/org-tracks/:trackId - Delete track
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { trackId } = await params;

    const trackDoc = await adminDb.collection('tracks').doc(trackId).get();

    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const trackData = trackDoc.data()!;
    
    // Verify track belongs to coach's organization
    if (trackData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Track not found in your organization' }, { status: 404 });
    }

    return NextResponse.json({
      id: trackDoc.id,
      ...trackData,
      createdAt: trackData.createdAt?.toDate?.()?.toISOString?.() || trackData.createdAt,
      updatedAt: trackData.updatedAt?.toDate?.()?.toISOString?.() || trackData.updatedAt,
    });
  } catch (error) {
    console.error('[COACH_ORG_TRACK_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch track' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { trackId } = await params;
    const body = await request.json();

    const trackRef = adminDb.collection('tracks').doc(trackId);
    const trackDoc = await trackRef.get();

    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Verify track belongs to coach's organization
    if (trackDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Track not found in your organization' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Update provided fields
    const allowedFields = [
      'name', 'description', 'habitLabel', 'programBadgeLabel', 
      'isActive', 'weeklyFocusDefaults'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await trackRef.update(updateData);

    console.log(`[COACH_ORG_TRACK_PUT] Updated track: ${trackId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Track updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_TRACK_PUT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { trackId } = await params;

    const trackRef = adminDb.collection('tracks').doc(trackId);
    const trackDoc = await trackRef.get();

    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Verify track belongs to coach's organization
    if (trackDoc.data()?.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Track not found in your organization' }, { status: 404 });
    }

    await trackRef.delete();

    console.log(`[COACH_ORG_TRACK_DELETE] Deleted track: ${trackId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Track deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_TRACK_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to delete track' }, { status: 500 });
  }
}
