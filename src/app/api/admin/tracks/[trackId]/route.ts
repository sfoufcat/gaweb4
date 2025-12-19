/**
 * Admin API: Single Track Management
 * 
 * GET /api/admin/tracks/[trackId] - Get track details
 * PUT /api/admin/tracks/[trackId] - Update track
 * DELETE /api/admin/tracks/[trackId] - Delete track (with safeguards)
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection, isAdmin } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { Track, UserTrack, ClerkPublicMetadata } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'general',
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { trackId } = await params;
    const trackDoc = await adminDb.collection('tracks').doc(trackId).get();

    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const track = {
      id: trackDoc.id,
      ...trackDoc.data(),
      createdAt: trackDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || trackDoc.data()?.createdAt,
      updatedAt: trackDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || trackDoc.data()?.updatedAt,
    } as Track;

    return NextResponse.json({ track });
  } catch (error) {
    console.error('[ADMIN_TRACK_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch track' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { trackId } = await params;
    const body = await request.json();

    const trackDoc = await adminDb.collection('tracks').doc(trackId).get();
    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Validate slug if being changed
    if (body.slug && !VALID_TRACK_SLUGS.includes(body.slug)) {
      return NextResponse.json(
        { error: `Invalid track slug. Must be one of: ${VALID_TRACK_SLUGS.join(', ')}` },
        { status: 400 }
      );
    }

    // If changing slug, check it doesn't conflict with another track
    if (body.slug && body.slug !== trackDoc.data()?.slug) {
      const existingTrack = await adminDb
        .collection('tracks')
        .where('slug', '==', body.slug)
        .limit(1)
        .get();

      if (!existingTrack.empty && existingTrack.docs[0].id !== trackId) {
        return NextResponse.json(
          { error: `Track with slug "${body.slug}" already exists` },
          { status: 400 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.habitLabel !== undefined) updateData.habitLabel = body.habitLabel;
    if (body.programBadgeLabel !== undefined) updateData.programBadgeLabel = body.programBadgeLabel;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.weeklyFocusDefaults !== undefined) updateData.weeklyFocusDefaults = body.weeklyFocusDefaults;

    await adminDb.collection('tracks').doc(trackId).update(updateData);

    console.log(`[ADMIN_TRACK_PUT] Updated track: ${trackId}`);

    // Fetch updated track
    const updatedDoc = await adminDb.collection('tracks').doc(trackId).get();
    const updatedTrack = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data()?.createdAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.createdAt,
      updatedAt: updatedDoc.data()?.updatedAt?.toDate?.()?.toISOString?.() || updatedDoc.data()?.updatedAt,
    } as Track;

    return NextResponse.json({ 
      success: true, 
      track: updatedTrack,
      message: 'Track updated successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_TRACK_PUT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update track' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    // Only admin can delete tracks
    if (!isAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { trackId } = await params;
    const trackDoc = await adminDb.collection('tracks').doc(trackId).get();

    if (!trackDoc.exists) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const trackSlug = trackDoc.data()?.slug;

    // Safety check: Don't allow deleting tracks that are in use
    // Check if any starter programs use this track
    const programsUsingTrack = await adminDb
      .collection('starter_programs')
      .where('track', '==', trackSlug)
      .limit(1)
      .get();

    if (!programsUsingTrack.empty) {
      return NextResponse.json(
        { error: `Cannot delete track "${trackSlug}" - it has associated starter programs. Deactivate it instead.` },
        { status: 400 }
      );
    }

    // Check if any dynamic prompts use this track
    const promptsUsingTrack = await adminDb
      .collection('dynamic_prompts')
      .where('trackId', '==', trackId)
      .limit(1)
      .get();

    if (!promptsUsingTrack.empty) {
      return NextResponse.json(
        { error: `Cannot delete track "${trackSlug}" - it has associated dynamic prompts. Deactivate it instead.` },
        { status: 400 }
      );
    }

    await adminDb.collection('tracks').doc(trackId).delete();

    console.log(`[ADMIN_TRACK_DELETE] Deleted track: ${trackId} (${trackSlug})`);

    return NextResponse.json({ 
      success: true, 
      message: 'Track deleted successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_TRACK_DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}


