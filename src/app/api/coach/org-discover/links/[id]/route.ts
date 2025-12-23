/**
 * Coach API: Single Link Management (Organization-scoped)
 * 
 * GET /api/coach/org-discover/links/[id] - Get link details
 * PATCH /api/coach/org-discover/links/[id] - Update link
 * DELETE /api/coach/org-discover/links/[id] - Delete link
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;
    const linkDoc = await adminDb.collection('program_links').doc(id).get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const linkData = linkDoc.data();
    
    // Verify the link belongs to this organization
    if (linkData?.organizationId && linkData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const link = {
      id: linkDoc.id,
      ...linkData,
      createdAt: linkData?.createdAt?.toDate?.()?.toISOString?.() || linkData?.createdAt,
      updatedAt: linkData?.updatedAt?.toDate?.()?.toISOString?.() || linkData?.updatedAt,
    };

    return NextResponse.json({ link });
  } catch (error) {
    console.error('[COACH_ORG_LINK_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch link' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;
    const body = await request.json();

    // Check if link exists
    const linkDoc = await adminDb.collection('program_links').doc(id).get();
    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const linkData = linkDoc.data();
    
    // Verify the link belongs to this organization
    if (linkData?.organizationId && linkData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update fields that are provided
    const allowedFields = ['title', 'description', 'url', 'programIds', 'order'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Also update programId for backwards compatibility
    if (body.programIds !== undefined) {
      updateData.programId = Array.isArray(body.programIds) && body.programIds.length > 0 
        ? body.programIds[0] 
        : null;
    }

    await adminDb.collection('program_links').doc(id).update(updateData);

    console.log(`[COACH_ORG_LINK] Updated link ${id} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Link updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_LINK_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update link' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;

    // Check if link exists
    const linkDoc = await adminDb.collection('program_links').doc(id).get();
    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const linkData = linkDoc.data();
    
    // Verify the link belongs to this organization
    if (linkData?.organizationId && linkData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await adminDb.collection('program_links').doc(id).delete();

    console.log(`[COACH_ORG_LINK] Deleted link ${id} from organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Link deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_LINK_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete link' }, { status: 500 });
  }
}

