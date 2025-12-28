/**
 * API Route: Admin Features Management
 * 
 * GET /api/admin/features - Get all feature requests with admin details
 * POST /api/admin/features - Create a new feature (admin can create in_progress features)
 * 
 * Only accessible by admin and super_admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClerkPublicMetadata, FeatureRequest } from '@/types';

// =============================================================================
// GET - List all feature requests (admin view)
// =============================================================================

export async function GET() {
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

    // Fetch all feature requests
    const featuresSnapshot = await adminDb
      .collection('feature_requests')
      .orderBy('createdAt', 'desc')
      .get();

    const features: FeatureRequest[] = [];
    featuresSnapshot.forEach((doc) => {
      features.push({ id: doc.id, ...doc.data() } as FeatureRequest);
    });

    // Group by status
    const byStatus = {
      in_progress: features.filter(f => f.status === 'in_progress')
        .sort((a, b) => (a.priority || 999) - (b.priority || 999)),
      suggested: features.filter(f => f.status === 'suggested')
        .sort((a, b) => b.voteCount - a.voteCount),
      completed: features.filter(f => f.status === 'completed')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      declined: features.filter(f => f.status === 'declined')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    };

    return NextResponse.json({
      features,
      byStatus,
      counts: {
        total: features.length,
        in_progress: byStatus.in_progress.length,
        suggested: byStatus.suggested.length,
        completed: byStatus.completed.length,
        declined: byStatus.declined.length,
      },
    });

  } catch (error) {
    console.error('[ADMIN_FEATURES_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new feature (admin can create as in_progress)
// =============================================================================

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { title, description, status, priority, adminNotes } = body;

    // Validate input
    if (!title || title.trim().length < 3) {
      return NextResponse.json(
        { error: 'Title must be at least 3 characters' },
        { status: 400 }
      );
    }

    const validStatuses = ['suggested', 'in_progress', 'completed', 'declined'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Create feature request
    const featureData: Omit<FeatureRequest, 'id'> = {
      title: title.trim(),
      description: description?.trim() || '',
      status: status || 'in_progress', // Default to in_progress for admin-created
      voteCount: 0,
      suggestedBy: userId,
      suggestedByName: 'Admin',
      priority: priority || undefined,
      adminNotes: adminNotes?.trim() || undefined,
      statusChangedAt: now,
      statusChangedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('feature_requests').add(featureData);

    console.log(`[ADMIN_FEATURES_POST] Admin ${userId} created feature ${docRef.id}: "${title}"`);

    return NextResponse.json({
      success: true,
      feature: { id: docRef.id, ...featureData },
    });

  } catch (error) {
    console.error('[ADMIN_FEATURES_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create feature' },
      { status: 500 }
    );
  }
}





