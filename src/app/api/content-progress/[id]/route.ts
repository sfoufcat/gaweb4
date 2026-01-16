/**
 * Content Progress ID API
 *
 * GET /api/content-progress/[id] - Get a specific progress record
 * PATCH /api/content-progress/[id] - Update a progress record
 * DELETE /api/content-progress/[id] - Delete a progress record
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ContentProgress } from '@/types';

const COLLECTION = 'content_progress';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/content-progress/[id]
 * Get a specific progress record
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const organizationId = await getEffectiveOrgId();

    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Progress record not found' }, { status: 404 });
    }

    const data = doc.data() as ContentProgress;

    // Security check: user can only access their own progress (or coaches can access client progress)
    if (data.userId !== userId && data.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      progress: { ...data, id: doc.id },
    });
  } catch (error) {
    console.error('[CONTENT_PROGRESS] GET ID Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/content-progress/[id]
 * Update a progress record
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Progress record not found' }, { status: 404 });
    }

    const existing = doc.data() as ContentProgress;

    // Security check: user can only update their own progress
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const {
      status,
      progressPercent,
      watchProgress,
      manuallyCompleted,
    } = body;

    const updates: Partial<ContentProgress> = {
      lastAccessedAt: now,
      updatedAt: now,
    };

    // Handle status changes
    if (status !== undefined) {
      updates.status = status;

      if (status === 'in_progress' && existing.status === 'not_started') {
        updates.startedAt = now;
      }

      if (status === 'completed' && existing.status !== 'completed') {
        updates.completedAt = now;
        if (!existing.firstCompletedAt) {
          updates.firstCompletedAt = now;
        }
        updates.completionCount = (existing.completionCount || 0) + 1;
        if (manuallyCompleted) {
          updates.manuallyCompleted = true;
        }
      }
    }

    // Handle progress updates
    if (progressPercent !== undefined) {
      updates.progressPercent = progressPercent;
    }

    if (watchProgress !== undefined) {
      updates.watchProgress = watchProgress;

      // Auto-complete at 90% watch progress
      if (watchProgress >= 90 && existing.status !== 'completed') {
        updates.status = 'completed';
        updates.completedAt = now;
        updates.autoCompleted = true;
        if (!existing.firstCompletedAt) {
          updates.firstCompletedAt = now;
        }
        updates.completionCount = (existing.completionCount || 0) + 1;
      }
    }

    await docRef.update(updates);

    return NextResponse.json({
      progress: { ...existing, ...updates, id: doc.id },
    });
  } catch (error) {
    console.error('[CONTENT_PROGRESS] PATCH Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/content-progress/[id]
 * Delete a progress record (soft reset)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const docRef = adminDb.collection(COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Progress record not found' }, { status: 404 });
    }

    const existing = doc.data() as ContentProgress;

    // Security check: user can only delete their own progress
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CONTENT_PROGRESS] DELETE Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
