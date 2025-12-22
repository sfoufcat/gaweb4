/**
 * Admin API: Program Downloads Management
 * 
 * GET /api/admin/discover/downloads - List all downloads
 * POST /api/admin/discover/downloads - Create new download
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canManageDiscoverContent } from '@/lib/admin-utils-shared';
import { getCurrentUserRole } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const downloadsSnapshot = await adminDb
      .collection('program_downloads')
      .orderBy('order', 'asc')
      .get();

    const downloads = downloadsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    }));

    return NextResponse.json({ downloads });
  } catch (error) {
    console.error('[ADMIN_DOWNLOADS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch downloads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const role = await getCurrentUserRole();
    if (!canManageDiscoverContent(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        { error: 'Missing required field: title' },
        { status: 400 }
      );
    }

    if (!body.fileUrl) {
      return NextResponse.json(
        { error: 'Missing required field: fileUrl' },
        { status: 400 }
      );
    }

    const downloadData = {
      title: body.title,
      description: body.description || '',
      fileUrl: body.fileUrl,
      fileType: body.fileType || '',
      programIds: Array.isArray(body.programIds) ? body.programIds : [],
      // Also store as programId for backwards compatibility with content API
      programId: Array.isArray(body.programIds) && body.programIds.length > 0 ? body.programIds[0] : null,
      order: body.order || 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection('program_downloads').add(downloadData);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      message: 'Download created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_DOWNLOADS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create download' },
      { status: 500 }
    );
  }
}

