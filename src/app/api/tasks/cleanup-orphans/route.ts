/**
 * Admin API: Cleanup Orphan Program Tasks
 *
 * Identifies and removes program tasks that lack proper organizationId
 * or belong to a different organization than the current tenant.
 *
 * GET /api/admin/cleanup-orphan-tasks - List orphan tasks (dry run)
 * DELETE /api/admin/cleanup-orphan-tasks - Delete orphan tasks
 *
 * Query params:
 * - date: YYYY-MM-DD (optional, defaults to today)
 * - includePast: "true" to include tasks from past dates (default: false)
 * - orgId: Organization ID (optional override, useful for debugging)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId, getTenantOrgId } from '@/lib/tenant/context';

interface OrphanTask {
  id: string;
  title: string;
  date: string;
  sourceType: string;
  organizationId: string | null;
  reason: string;
  instanceId?: string;
  programEnrollmentId?: string;
}

/**
 * GET - Identify orphan tasks (dry run)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includePast = searchParams.get('includePast') === 'true';
    const orgIdOverride = searchParams.get('orgId');

    // Get org from various sources for debugging
    const tenantOrgId = await getTenantOrgId();
    const effectiveOrgId = await getEffectiveOrgId();
    const organizationId = orgIdOverride || effectiveOrgId;

    // Debug info
    console.log(`[CLEANUP_ORPHAN_TASKS] Debug: tenantOrgId=${tenantOrgId}, effectiveOrgId=${effectiveOrgId}, orgIdOverride=${orgIdOverride}`);

    if (!organizationId) {
      return NextResponse.json({
        error: 'Could not determine organization ID',
        debug: {
          tenantOrgId,
          effectiveOrgId,
          orgIdOverride,
        },
        hint: 'Add ?orgId=YOUR_ORG_ID to override, or ensure you are on a tenant domain',
      }, { status: 400 });
    }

    console.log(`[CLEANUP_ORPHAN_TASKS] Checking for userId=${userId}, orgId=${organizationId}, date=${date}, includePast=${includePast}`);

    // Query all program-sourced tasks for this user
    let query = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('sourceType', 'in', ['program', 'program_day', 'program_week']);

    if (!includePast) {
      query = query.where('date', '==', date);
    }

    const snapshot = await query.get();

    const orphanTasks: OrphanTask[] = [];
    const validTasks: { id: string; title: string; date: string }[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const taskOrgId = data.organizationId;

      // Check if task is orphan
      if (!taskOrgId) {
        // No organizationId at all
        orphanTasks.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          date: data.date,
          sourceType: data.sourceType,
          organizationId: null,
          reason: 'missing_org_id',
          instanceId: data.instanceId,
          programEnrollmentId: data.programEnrollmentId,
        });
      } else if (taskOrgId !== organizationId) {
        // Wrong organizationId
        orphanTasks.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          date: data.date,
          sourceType: data.sourceType,
          organizationId: taskOrgId,
          reason: 'wrong_org_id',
          instanceId: data.instanceId,
          programEnrollmentId: data.programEnrollmentId,
        });
      } else {
        // Valid task
        validTasks.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          date: data.date,
        });
      }
    });

    return NextResponse.json({
      success: true,
      currentOrganizationId: organizationId,
      debug: {
        tenantOrgId,
        effectiveOrgId,
        orgIdOverride,
      },
      date,
      includePast,
      summary: {
        totalProgramTasks: snapshot.size,
        orphanTasks: orphanTasks.length,
        validTasks: validTasks.length,
      },
      orphanTasks,
      validTasks: validTasks.slice(0, 10), // Only show first 10 valid tasks
      instructions: orphanTasks.length > 0
        ? 'Use DELETE method to remove orphan tasks'
        : 'No orphan tasks found',
    });
  } catch (error) {
    console.error('[CLEANUP_ORPHAN_TASKS] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * DELETE - Remove orphan tasks
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includePast = searchParams.get('includePast') === 'true';
    const orgIdOverride = searchParams.get('orgId');

    const effectiveOrgId = await getEffectiveOrgId();
    const organizationId = orgIdOverride || effectiveOrgId;

    if (!organizationId) {
      return NextResponse.json({
        error: 'Could not determine organization ID',
        hint: 'Add ?orgId=YOUR_ORG_ID to override',
      }, { status: 400 });
    }

    console.log(`[CLEANUP_ORPHAN_TASKS] Deleting orphans for userId=${userId}, orgId=${organizationId}, date=${date}, includePast=${includePast}`);

    // Query all program-sourced tasks for this user
    let query = adminDb
      .collection('tasks')
      .where('userId', '==', userId)
      .where('sourceType', 'in', ['program', 'program_day', 'program_week']);

    if (!includePast) {
      query = query.where('date', '==', date);
    }

    const snapshot = await query.get();

    const deletedTasks: { id: string; title: string; reason: string }[] = [];
    const batch = adminDb.batch();
    let batchCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const taskOrgId = data.organizationId;

      // Delete if orphan
      if (!taskOrgId || taskOrgId !== organizationId) {
        batch.delete(doc.ref);
        batchCount++;
        deletedTasks.push({
          id: doc.id,
          title: data.title || data.label || 'Untitled',
          reason: !taskOrgId ? 'missing_org_id' : 'wrong_org_id',
        });
      }
    });

    if (batchCount > 0) {
      await batch.commit();
      console.log(`[CLEANUP_ORPHAN_TASKS] Deleted ${batchCount} orphan tasks`);
    }

    return NextResponse.json({
      success: true,
      currentOrganizationId: organizationId,
      date,
      includePast,
      deletedCount: deletedTasks.length,
      deletedTasks,
      message: deletedTasks.length > 0
        ? `Deleted ${deletedTasks.length} orphan task(s). Refresh the page to see the updated task list.`
        : 'No orphan tasks found to delete.',
    });
  } catch (error) {
    console.error('[CLEANUP_ORPHAN_TASKS] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
