/**
 * Admin API: Single Link Management
 * 
 * GET /api/admin/discover/links/[id] - Get link details
 * PATCH /api/admin/discover/links/[id] - Update link
 * DELETE /api/admin/discover/links/[id] - Delete link
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const linkDoc = await adminDb.collection('program_links').doc(id).get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const linkData = linkDoc.data();
    const link = {
      id: linkDoc.id,
      ...linkData,
      createdAt: linkData?.createdAt?.toDate?.()?.toISOString?.() || linkData?.createdAt,
      updatedAt: linkData?.updatedAt?.toDate?.()?.toISOString?.() || linkData?.updatedAt,
    };

    return NextResponse.json({ link });
  } catch (error) {
    console.error('[ADMIN_LINK_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch link' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check if link exists
    const linkDoc = await adminDb.collection('program_links').doc(id).get();
    if (!linkDoc.exists) {
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

    return NextResponse.json({ 
      success: true, 
      message: 'Link updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_LINK_PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if link exists
    const linkDoc = await adminDb.collection('program_links').doc(id).get();
    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await adminDb.collection('program_links').doc(id).delete();

    return NextResponse.json({ 
      success: true, 
      message: 'Link deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_LINK_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}

