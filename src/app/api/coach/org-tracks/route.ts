/**
 * @deprecated This API is deprecated. Tracks have been replaced by Programs.
 * Use /api/coach/org-programs instead for program management.
 * This API is kept for backward compatibility.
 * 
 * Coach API: Organization-scoped Tracks Management
 * 
 * GET /api/coach/org-tracks - List tracks in coach's organization
 * POST /api/coach/org-tracks - Create new track in coach's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { Track, UserTrack } from '@/types';

// Valid track slugs
const VALID_TRACK_SLUGS: UserTrack[] = [
  'content_creator',
  'saas',
  'coach_consultant',
  'ecom',
  'agency',
  'community_builder',
  'general',
];

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_TRACKS] Fetching tracks for organization: ${organizationId}`);

    // Fetch all tracks and filter to include org-specific OR global (no organizationId)
    // This allows coaches to see platform tracks plus their own customizations
    const allTracksSnapshot = await adminDb
      .collection('tracks')
      .orderBy('slug', 'asc')
      .get();

    const tracks = allTracksSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Include if org matches OR if no organizationId (global/platform content)
        return data.organizationId === organizationId || 
               data.organizationId === undefined || 
               data.organizationId === null;
      })
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString?.() || doc.data().updatedAt,
      })) as Track[];

    return NextResponse.json({ 
      tracks,
      totalCount: tracks.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_TRACKS_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch tracks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

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

    // Check if track with this slug already exists in this organization
    const existingTrack = await adminDb
      .collection('tracks')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', body.slug)
      .limit(1)
      .get();

    if (!existingTrack.empty) {
      return NextResponse.json(
        { error: `Track with slug "${body.slug}" already exists in your organization` },
        { status: 400 }
      );
    }

    const trackData: Omit<Track, 'id'> = {
      slug: body.slug,
      name: body.name,
      description: body.description || '',
      habitLabel: body.habitLabel,
      programBadgeLabel: body.programBadgeLabel,
      isActive: body.isActive !== false,
      organizationId, // Scope to coach's organization
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const docRef = await adminDb.collection('tracks').add({
      ...trackData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COACH_ORG_TRACKS] Created track ${body.slug} (${docRef.id}) in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      id: docRef.id,
      track: { id: docRef.id, ...trackData },
      message: 'Track created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('[COACH_ORG_TRACKS_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create track' }, { status: 500 });
  }
}

