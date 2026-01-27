/**
 * Program Instance Module API
 *
 * Manage individual module content within a program instance
 *
 * GET /api/instances/[instanceId]/modules/[moduleId] - Get module content
 * PATCH /api/instances/[instanceId]/modules/[moduleId] - Update module content
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { ProgramInstance, ProgramInstanceModule, ProgramHabitTemplate } from '@/types';

type RouteParams = { params: Promise<{ instanceId: string; moduleId: string }> };

/**
 * GET /api/instances/[instanceId]/modules/[moduleId]
 *
 * Returns the module data from the instance
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, moduleId } = await params;

    // Fetch the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const instance = { id: instanceDoc.id, ...instanceDoc.data() } as ProgramInstance;

    // Verify ownership
    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the module
    const module = (instance.modules || []).find(m => m.id === moduleId);
    if (!module) {
      return NextResponse.json({ error: 'Module not found in instance' }, { status: 404 });
    }

    return NextResponse.json({ module });
  } catch (error) {
    console.error('[INSTANCE_MODULE_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch module' }, { status: 500 });
  }
}

/**
 * PATCH /api/instances/[instanceId]/modules/[moduleId]
 *
 * Updates module content (name, description, habits)
 * Sets hasLocalChanges: true to protect customizations during future syncs
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { instanceId, moduleId } = await params;
    const body = await request.json();

    // Fetch the instance
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    if (!instanceDoc.exists) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const instance = { id: instanceDoc.id, ...instanceDoc.data() } as ProgramInstance;

    // Verify ownership
    if (instance.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find the module index
    const modules = instance.modules || [];
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) {
      return NextResponse.json({ error: 'Module not found in instance' }, { status: 404 });
    }

    const existingModule = modules[moduleIndex];
    const now = new Date().toISOString();

    // Build updated module - only allow updating specific fields
    const updatedModule: ProgramInstanceModule = {
      ...existingModule,
      // Updateable fields
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.habits !== undefined && { habits: body.habits as ProgramHabitTemplate[] }),
      // Mark as customized
      hasLocalChanges: true,
      updatedAt: now,
    };

    // Update the modules array
    const updatedModules = [...modules];
    updatedModules[moduleIndex] = updatedModule;

    // Update the instance
    await adminDb.collection('program_instances').doc(instanceId).update({
      modules: updatedModules,
      updatedAt: now,
    });

    console.log(`[INSTANCE_MODULE_PATCH] Updated module ${moduleId} in instance ${instanceId}`);

    return NextResponse.json({
      success: true,
      module: updatedModule,
    });
  } catch (error) {
    console.error('[INSTANCE_MODULE_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}
