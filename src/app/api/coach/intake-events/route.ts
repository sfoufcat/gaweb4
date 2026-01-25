import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import type { UnifiedEvent, IntakeCallConfig } from '@/types';

/**
 * GET /api/coach/intake-events
 * Get all intake call events for the coach's organization
 *
 * Query params:
 * - status?: 'upcoming' | 'completed' | 'cancelled' (filter by event status)
 * - limit?: number (default 50, max 100)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

    console.log(`[INTAKE_EVENTS_GET] Fetching intake events for org: ${organizationId}`);

    // Build query for intake call events
    let query = adminDb
      .collection('events')
      .where('organizationId', '==', organizationId)
      .where('eventType', '==', 'intake_call')
      .orderBy('startTime', 'desc')
      .limit(limit);

    const snapshot = await query.get();

    // Get all unique intake config IDs to fetch config names
    const configIds = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.intakeCallConfigId) {
        configIds.add(data.intakeCallConfigId);
      }
    });

    // Fetch intake configs for names
    const configMap = new Map<string, IntakeCallConfig>();
    if (configIds.size > 0) {
      const configsSnapshot = await adminDb
        .collection('intake_call_configs')
        .where('__name__', 'in', Array.from(configIds))
        .get();

      configsSnapshot.docs.forEach(doc => {
        configMap.set(doc.id, { id: doc.id, ...doc.data() } as IntakeCallConfig);
      });
    }

    // Map events with config info
    const events = snapshot.docs.map(doc => {
      const data = doc.data() as UnifiedEvent;
      const config = data.intakeCallConfigId ? configMap.get(data.intakeCallConfigId) : null;

      // Derive status from event data
      let derivedStatus: 'upcoming' | 'completed' | 'cancelled' | 'no-show' | 'converted' = 'upcoming';
      const now = new Date();
      const startTime = data.startTime ? new Date(data.startTime) : null;

      if (data.convertedToUserId) {
        derivedStatus = 'converted';
      } else if ((data.status as string) === 'cancelled') {
        derivedStatus = 'cancelled';
      } else if (startTime && startTime < now) {
        // Past event - check if it was marked as no-show or completed
        derivedStatus = (data.status as string) === 'no_show' ? 'no-show' : 'completed';
      }

      return {
        ...data,
        id: doc.id,
        intakeConfigName: config?.name || 'Unknown',
        intakeConfigDuration: config?.duration || 30,
        derivedStatus,
      };
    });

    // Filter by status if specified
    let filteredEvents = events;
    if (status) {
      filteredEvents = events.filter(e => {
        if (status === 'upcoming') return e.derivedStatus === 'upcoming';
        if (status === 'completed') return e.derivedStatus === 'completed' || e.derivedStatus === 'converted';
        if (status === 'cancelled') return e.derivedStatus === 'cancelled';
        return true;
      });
    }

    console.log(`[INTAKE_EVENTS_GET] Found ${filteredEvents.length} intake events`);

    return NextResponse.json({ events: filteredEvents });
  } catch (error) {
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }
    console.error('[COACH_INTAKE_EVENTS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
