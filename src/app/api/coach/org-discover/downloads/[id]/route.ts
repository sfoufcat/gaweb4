/**
 * Coach API: Single Download Management (Organization-scoped)
 * 
 * GET /api/coach/org-discover/downloads/[id] - Get download details
 * PATCH /api/coach/org-discover/downloads/[id] - Update download
 * DELETE /api/coach/org-discover/downloads/[id] - Delete download
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
    const downloadDoc = await adminDb.collection('program_downloads').doc(id).get();

    if (!downloadDoc.exists) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    const downloadData = downloadDoc.data();
    
    // Verify the download belongs to this organization
    if (downloadData?.organizationId && downloadData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    const download = {
      id: downloadDoc.id,
      ...downloadData,
      createdAt: downloadData?.createdAt?.toDate?.()?.toISOString?.() || downloadData?.createdAt,
      updatedAt: downloadData?.updatedAt?.toDate?.()?.toISOString?.() || downloadData?.updatedAt,
    };

    return NextResponse.json({ download });
  } catch (error) {
    console.error('[COACH_ORG_DOWNLOAD_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch download' }, { status: 500 });
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

    // Check if download exists
    const downloadDoc = await adminDb.collection('program_downloads').doc(id).get();
    if (!downloadDoc.exists) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    const downloadData = downloadDoc.data();
    
    // Verify the download belongs to this organization
    if (downloadData?.organizationId && downloadData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only update fields that are provided
    const allowedFields = ['title', 'description', 'fileUrl', 'fileType', 'programIds', 'order'];

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

    await adminDb.collection('program_downloads').doc(id).update(updateData);

    console.log(`[COACH_ORG_DOWNLOAD] Updated download ${id} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Download updated successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_DOWNLOAD_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update download' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { id } = await params;

    // Check if download exists
    const downloadDoc = await adminDb.collection('program_downloads').doc(id).get();
    if (!downloadDoc.exists) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    const downloadData = downloadDoc.data();
    
    // Verify the download belongs to this organization
    if (downloadData?.organizationId && downloadData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Download not found' }, { status: 404 });
    }

    await adminDb.collection('program_downloads').doc(id).delete();

    console.log(`[COACH_ORG_DOWNLOAD] Deleted download ${id} from organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Download deleted successfully' 
    });
  } catch (error) {
    console.error('[COACH_ORG_DOWNLOAD_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete download' }, { status: 500 });
  }
}

