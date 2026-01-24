import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { withDemoMode, demoNotAvailable } from '@/lib/demo-api';
import type { IntakeCallConfig, IntakeCallMeetingProvider, IntakeFormField } from '@/types';

/**
 * GET /api/coach/intake-configs
 * Get all intake call configs for the coach's organization
 */
export async function GET(req: Request) {
  try {
    // Demo mode: return demo data
    const demoData = await withDemoMode('intake-configs');
    if (demoData) return demoData;

    const { organizationId } = await requireCoachWithOrg();

    console.log(`[INTAKE_CONFIGS_GET] Fetching configs for org: ${organizationId}`);

    const snapshot = await adminDb
      .collection('intake_call_configs')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc')
      .get();

    console.log(`[INTAKE_CONFIGS_GET] Found ${snapshot.docs.length} configs`);

    const configs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as IntakeCallConfig[];

    return NextResponse.json({ configs });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_CONFIGS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/intake-configs
 * Create a new intake call config
 *
 * Body:
 * - name: string (required)
 * - description?: string
 * - duration: number (15, 30, 45, 60)
 * - meetingProvider: 'zoom' | 'google_meet' | 'in_app' | 'manual'
 * - manualMeetingUrl?: string
 * - coverImageUrl?: string
 * - confirmationMessage?: string
 * - requirePhone?: boolean
 * - customFields?: IntakeFormField[]
 * - allowCancellation?: boolean
 * - allowReschedule?: boolean
 * - cancelDeadlineHours?: number
 *
 * Note: slug is auto-generated from name + random suffix (not user-facing)
 */
export async function POST(req: Request) {
  try {
    // Demo mode: block write operations
    const demoData = await withDemoMode('intake-configs');
    if (demoData) return demoNotAvailable('Creating intake configs');

    const { organizationId } = await requireCoachWithOrg();

    console.log(`[INTAKE_CONFIGS_POST] Creating config for org: ${organizationId}`);

    const body = await req.json();
    const {
      name,
      description,
      duration = 30,
      meetingProvider = 'zoom',
      manualMeetingUrl,
      coverImageUrl,
      confirmationMessage,
      requirePhone = false,
      customFields = [],
      allowCancellation = true,
      allowReschedule = true,
      cancelDeadlineHours = 24,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Auto-generate slug from name + random suffix
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Validate duration
    const validDurations = [15, 30, 45, 60, 90];
    if (!validDurations.includes(duration)) {
      return NextResponse.json({
        error: 'Duration must be 15, 30, 45, 60, or 90 minutes'
      }, { status: 400 });
    }

    // Validate meeting provider
    const validProviders: IntakeCallMeetingProvider[] = ['zoom', 'google_meet', 'in_app', 'manual'];
    if (!validProviders.includes(meetingProvider)) {
      return NextResponse.json({
        error: 'Invalid meeting provider'
      }, { status: 400 });
    }

    // If manual provider, require URL
    if (meetingProvider === 'manual' && !manualMeetingUrl) {
      return NextResponse.json({
        error: 'Meeting URL is required for manual provider'
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    const configData: Omit<IntakeCallConfig, 'id'> = {
      organizationId,
      name: name.trim(),
      slug: slug.toLowerCase().trim(),
      description: description?.trim() || undefined,
      duration,
      useOrgAvailability: true, // Default to org availability
      meetingProvider,
      manualMeetingUrl: meetingProvider === 'manual' ? manualMeetingUrl : undefined,
      coverImageUrl: coverImageUrl || undefined,
      confirmationMessage: confirmationMessage || undefined,
      requireEmail: true, // Always true
      requireName: true, // Always true
      requirePhone,
      customFields: customFields as IntakeFormField[],
      isActive: true,
      allowCancellation,
      allowReschedule,
      cancelDeadlineHours,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('intake_call_configs').add(configData);

    return NextResponse.json({
      config: { id: docRef.id, ...configData }
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_CONFIGS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
