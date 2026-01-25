import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { UnifiedEvent } from '@/types';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/coach/intake-events/[eventId]
 * Get a single intake event by ID
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { eventId } = await params;

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data() as UnifiedEvent;

    // Verify org ownership
    if (eventData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify it's an intake call
    if (eventData.eventType !== 'intake_call') {
      return NextResponse.json({ error: 'Not an intake call event' }, { status: 400 });
    }

    return NextResponse.json({ event: { ...eventData, id: eventDoc.id } });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_EVENT_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/coach/intake-events/[eventId]
 * Update an intake event - primarily for marking conversion or status changes
 *
 * Body:
 * - convertedToUserId?: string (mark as converted to this user)
 * - status?: 'no_show' | 'cancelled' (update event status)
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const { eventId } = await params;
    const body = await req.json();

    const eventDoc = await adminDb.collection('events').doc(eventId).get();

    if (!eventDoc.exists) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventData = eventDoc.data() as UnifiedEvent;

    // Verify org ownership
    if (eventData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify it's an intake call
    if (eventData.eventType !== 'intake_call') {
      return NextResponse.json({ error: 'Not an intake call event' }, { status: 400 });
    }

    // Build update object
    const updates: Partial<UnifiedEvent> = {
      updatedAt: new Date().toISOString(),
    };

    // Handle conversion
    if (body.convertedToUserId !== undefined) {
      if (body.convertedToUserId) {
        // Verify the user exists and belongs to the org
        const userDoc = await adminDb.collection('users').doc(body.convertedToUserId).get();
        if (!userDoc.exists) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        const userData = userDoc.data();
        if (userData?.organizationId !== organizationId && !userData?.organizationIds?.includes(organizationId)) {
          return NextResponse.json({ error: 'User not in this organization' }, { status: 400 });
        }

        updates.convertedToUserId = body.convertedToUserId;
        updates.convertedAt = new Date().toISOString();
      } else {
        // Clear conversion (set to null/undefined)
        updates.convertedToUserId = null as unknown as string;
        updates.convertedAt = null as unknown as string;
      }
    }

    // Handle status update
    if (body.status) {
      if (!['no_show', 'cancelled', 'confirmed'].includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.status = body.status;
    }

    // Apply updates
    await adminDb.collection('events').doc(eventId).update(updates);

    console.log(`[INTAKE_EVENT_PATCH] Updated event ${eventId}:`, updates);

    return NextResponse.json({
      success: true,
      event: { ...eventData, ...updates, id: eventId },
    });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_EVENT_PATCH]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
