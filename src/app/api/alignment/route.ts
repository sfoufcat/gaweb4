import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  getFullAlignmentState, 
  updateAlignmentForToday, 
  initializeAlignmentForToday,
  getTodayDate 
} from '@/lib/alignment';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { AlignmentUpdatePayload, ClerkPublicMetadata } from '@/types';

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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || getTodayDate();

    // If requesting today's alignment, ensure it's initialized
    const today = getTodayDate();
    if (date === today) {
      await initializeAlignmentForToday(userId, organizationId);
    }

    const { alignment, summary } = await getFullAlignmentState(userId, organizationId, date);

    return NextResponse.json({
      success: true,
      alignment,
      summary,
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
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
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

