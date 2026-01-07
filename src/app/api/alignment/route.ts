import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getFullAlignmentState,
  updateAlignmentForToday,
  initializeAlignmentForToday,
  getTodayDate,
  getOrgAlignmentConfig,
} from '@/lib/alignment';
import { DEFAULT_ALIGNMENT_CONFIG } from '@/types';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { AlignmentUpdatePayload } from '@/types';

/**
 * GET /api/alignment
 * 
 * Fetches the current user's alignment state for today.
 * If no alignment exists for today, it will be initialized.
 * 
 * MULTI-TENANCY: Alignment is scoped per organization
 * 
 * Query params:
 * - date: Optional date in YYYY-MM-DD format (defaults to today)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain
    const organizationId = await getEffectiveOrgId();

    // If no organization context, return empty alignment (backward compatibility during migration)
    if (!organizationId) {
      const date = new URL(request.url).searchParams.get('date') || getTodayDate();
      return NextResponse.json({
        success: true,
        alignment: {
          id: `legacy_${userId}_${date}`,
          userId,
          organizationId: '',
          date,
          didMorningCheckin: false,
          didSetTasks: false,
          didInteractWithSquad: false,
          hasActiveGoal: false,
          alignmentScore: 0,
          fullyAligned: false,
          streakOnThisDay: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        summary: {
          id: `legacy_${userId}`,
          userId,
          organizationId: '',
          currentStreak: 0,
          lastAlignedDate: null,
          updatedAt: new Date().toISOString(),
        },
        alignmentConfig: DEFAULT_ALIGNMENT_CONFIG,
      });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayDate();

    // If requesting today's alignment, ensure it's initialized
    const today = getTodayDate();
    if (date === today) {
      await initializeAlignmentForToday(userId, organizationId);
    }

    // Fetch alignment state and org config in parallel
    const [{ alignment, summary }, alignmentConfig] = await Promise.all([
      getFullAlignmentState(userId, organizationId, date),
      getOrgAlignmentConfig(organizationId),
    ]);

    return NextResponse.json({
      success: true,
      alignment,
      summary,
      alignmentConfig,
    });
  } catch (error) {
    console.error('[ALIGNMENT_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch alignment';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/alignment
 * 
 * Updates the current user's alignment for today.
 * 
 * MULTI-TENANCY: Alignment is scoped per organization
 * 
 * Body:
 * - didMorningCheckin?: boolean
 * - didSetTasks?: boolean
 * - didInteractWithSquad?: boolean
 * - hasActiveGoal?: boolean (usually computed automatically)
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain
    const organizationId = await getEffectiveOrgId();

    // If no organization context, return success without updating (backward compatibility)
    if (!organizationId) {
      console.warn('[ALIGNMENT] No organization context for user', userId);
      return NextResponse.json({
        success: true,
        alignment: null,
        summary: null,
        warning: 'No organization context - alignment not updated',
      });
    }

    const body = await request.json();
    
    // Validate and extract allowed update fields
    const updates: AlignmentUpdatePayload = {};
    
    if (typeof body.didMorningCheckin === 'boolean') {
      updates.didMorningCheckin = body.didMorningCheckin;
    }
    if (typeof body.didSetTasks === 'boolean') {
      updates.didSetTasks = body.didSetTasks;
    }
    if (typeof body.didInteractWithSquad === 'boolean') {
      updates.didInteractWithSquad = body.didInteractWithSquad;
    }
    if (typeof body.hasActiveGoal === 'boolean') {
      updates.hasActiveGoal = body.hasActiveGoal;
    }

    const alignment = await updateAlignmentForToday(userId, organizationId, updates);
    
    if (!alignment) {
      return NextResponse.json(
        { error: 'Failed to update alignment' },
        { status: 500 }
      );
    }

    // Also fetch the summary to return complete state
    const { summary } = await getFullAlignmentState(userId, organizationId);

    return NextResponse.json({
      success: true,
      alignment,
      summary,
    });
  } catch (error) {
    console.error('[ALIGNMENT_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to update alignment';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

