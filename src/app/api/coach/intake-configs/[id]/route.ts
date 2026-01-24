import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import type { IntakeCallConfig, IntakeCallMeetingProvider, IntakeFormField } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/coach/intake-configs/[id]
 * Get a single intake call config
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Demo mode: return demo data
    const demoData = await withDemoMode('intake-configs');
    if (demoData) return demoData;

    const { organizationId } = await requireCoachWithOrg();

    const doc = await adminDb.collection('intake_call_configs').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const config = { id: doc.id, ...doc.data() } as IntakeCallConfig;

    // Verify ownership
    if (config.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_CONFIG_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/intake-configs/[id]
 * Update an intake call config
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Demo mode: block write operations
    const demoData = await withDemoMode('intake-configs');
    if (demoData) return demoNotAvailable('Updating intake configs');

    const { organizationId } = await requireCoachWithOrg();

    const doc = await adminDb.collection('intake_call_configs').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const existingConfig = { id: doc.id, ...doc.data() } as IntakeCallConfig;

    // Verify ownership
    if (existingConfig.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const body = await req.json();
    const updates: Partial<IntakeCallConfig> = {};

    // Handle each field that can be updated
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(body.slug)) {
        return NextResponse.json({
          error: 'Slug must contain only lowercase letters, numbers, and hyphens'
        }, { status: 400 });
      }

      // Check for duplicate slug (if changed)
      if (body.slug !== existingConfig.slug) {
        const existingSlug = await adminDb
          .collection('intake_call_configs')
          .where('organizationId', '==', organizationId)
          .where('slug', '==', body.slug)
          .get();

        if (!existingSlug.empty) {
          return NextResponse.json({
            error: 'An intake call config with this slug already exists'
          }, { status: 400 });
        }
      }
      updates.slug = body.slug.toLowerCase().trim();
    }

    if (body.description !== undefined) {
      updates.description = body.description?.trim() || undefined;
    }

    if (body.duration !== undefined) {
      const validDurations = [15, 30, 45, 60, 90];
      if (!validDurations.includes(body.duration)) {
        return NextResponse.json({
          error: 'Duration must be 15, 30, 45, 60, or 90 minutes'
        }, { status: 400 });
      }
      updates.duration = body.duration;
    }

    if (body.meetingProvider !== undefined) {
      const validProviders: IntakeCallMeetingProvider[] = ['zoom', 'google_meet', 'in_app', 'manual'];
      if (!validProviders.includes(body.meetingProvider)) {
        return NextResponse.json({
          error: 'Invalid meeting provider'
        }, { status: 400 });
      }
      updates.meetingProvider = body.meetingProvider;

      // If switching to manual, require URL
      if (body.meetingProvider === 'manual' && !body.manualMeetingUrl && !existingConfig.manualMeetingUrl) {
        return NextResponse.json({
          error: 'Meeting URL is required for manual provider'
        }, { status: 400 });
      }
    }

    if (body.manualMeetingUrl !== undefined) {
      updates.manualMeetingUrl = body.manualMeetingUrl || undefined;
    }

    if (body.coverImageUrl !== undefined) {
      updates.coverImageUrl = body.coverImageUrl || undefined;
    }

    if (body.confirmationMessage !== undefined) {
      updates.confirmationMessage = body.confirmationMessage || undefined;
    }

    if (body.requirePhone !== undefined) {
      updates.requirePhone = Boolean(body.requirePhone);
    }

    if (body.customFields !== undefined) {
      updates.customFields = body.customFields as IntakeFormField[];
    }

    if (body.isActive !== undefined) {
      updates.isActive = Boolean(body.isActive);
    }

    if (body.allowCancellation !== undefined) {
      updates.allowCancellation = Boolean(body.allowCancellation);
    }

    if (body.allowReschedule !== undefined) {
      updates.allowReschedule = Boolean(body.allowReschedule);
    }

    if (body.cancelDeadlineHours !== undefined) {
      updates.cancelDeadlineHours = Number(body.cancelDeadlineHours) || 24;
    }

    if (body.useOrgAvailability !== undefined) {
      updates.useOrgAvailability = Boolean(body.useOrgAvailability);
    }

    if (body.customAvailability !== undefined) {
      updates.customAvailability = body.customAvailability;
    }

    updates.updatedAt = new Date().toISOString();

    await adminDb.collection('intake_call_configs').doc(id).update(updates);

    const updatedConfig = { ...existingConfig, ...updates };

    return NextResponse.json({ config: updatedConfig });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_CONFIG_PATCH]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/coach/intake-configs/[id]
 * Delete an intake call config
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Demo mode: block write operations
    const demoData = await withDemoMode('intake-configs');
    if (demoData) return demoNotAvailable('Deleting intake configs');

    const { organizationId } = await requireCoachWithOrg();

    const doc = await adminDb.collection('intake_call_configs').doc(id).get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    const config = doc.data() as IntakeCallConfig;

    // Verify ownership
    if (config.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Check if config is used in any funnel steps
    const funnelStepsSnapshot = await adminDb
      .collectionGroup('funnel_steps')
      .where('config.intakeCallConfigId', '==', id)
      .limit(1)
      .get();

    if (!funnelStepsSnapshot.empty) {
      return NextResponse.json({
        error: 'Cannot delete: This config is used in one or more funnel steps'
      }, { status: 400 });
    }

    await adminDb.collection('intake_call_configs').doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_CONFIG_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
