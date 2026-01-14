import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { syncProgramTasksForToday, syncProgramV2TasksForToday } from '@/lib/program-engine';
import { getEffectiveOrgId } from '@/lib/tenant/context';

/**
 * POST /api/programs/sync
 *
 * Sync program tasks for today.
 * This is called:
 * - On Plan Day page load
 * - On Home page first load
 *
 * It creates tasks from the user's active program if:
 * - User has an active enrollment
 * - It's a new day that hasn't been processed yet
 *
 * IMPORTANT: Uses organization filtering for multi-tenant isolation.
 * Only syncs enrollments from the current tenant's organization.
 *
 * Supports both:
 * - Programs V2 (program_enrollments + program_days collections)
 * - Legacy Starter Programs (starter_program_enrollments + starter_program_days)
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CRITICAL: Get organization ID for multi-tenant isolation
    const organizationId = await getEffectiveOrgId();

    // Try Programs V2 sync first (program_enrollments collection)
    // Pass organizationId to filter enrollments to current tenant
    let result = await syncProgramV2TasksForToday(userId, undefined, organizationId);

    // If no V2 enrollment found, try legacy Starter Programs
    // IMPORTANT: Only fall back to legacy if NOT in tenant mode
    // Legacy starter programs don't support multi-tenancy and would sync
    // tasks from ANY org, breaking tenant isolation
    if (!result.enrollmentId && !organizationId) {
      result = await syncProgramTasksForToday(userId);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API_PROGRAMS_SYNC_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

