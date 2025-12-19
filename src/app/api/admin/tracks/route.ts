/**
 * Admin API: Tracks Management
 * 
 * GET /api/admin/tracks - List all tracks
 * POST /api/admin/tracks - Create new track
 * 
 * Editor and Super Admin can access these endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { canAccessEditorSection } from '@/lib/admin-utils-shared';
import { FieldValue } from 'firebase-admin/firestore';
import type { Track, UserTrack } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'general',
];

export async function GET() {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const tracksSnapshot = await adminDb
      .collection('tracks')
      .orderBy('slug', 'asc')
      .get();

    const tracks = tracksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
    })) as Track[];

    return NextResponse.json({ tracks });
  } catch (error) {
    console.error('[ADMIN_TRACKS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as any)?.role;
    
    if (!canAccessEditorSection(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['slug', 'name', 'habitLabel', 'programBadgeLabel'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate slug is a valid track type
    if (!VALID_TRACK_SLUGS.includes(body.slug)) {
      return NextResponse.json(
        { error: `Invalid track slug. Must be one of: ${VALID_TRACK_SLUGS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if track with this slug already exists
    const existingTrack = await adminDb
      .collection('tracks')
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingTrack.empty) {
      return NextResponse.json(
        { error: `Track with slug "${body.slug}" already exists` },
        { status: 400 }
      );
    }

    const trackData: Omit<Track, 'id'> = {
      slug: body.slug,
      name: body.name,
      description: body.description || '',
      habitLabel: body.habitLabel,
      programBadgeLabel: body.programBadgeLabel,
      isActive: body.isActive !== false, // Default to true
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('tracks').add({
      ...trackData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[ADMIN_TRACKS_POST] Created track: ${body.slug} (${docRef.id})`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      track: { id: docRef.id, ...trackData },
      message: 'Track created successfully' 
    });
  } catch (error) {
    console.error('[ADMIN_TRACKS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create track' },
      { status: 500 }
    );
  }
}



