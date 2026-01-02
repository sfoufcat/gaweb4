/**
 * Cal.com Integration API
 * 
 * Manages Cal.com API key integration for coaches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIntegration, storeApiKeyIntegration, updateIntegrationSettings, disconnectIntegration } from '@/lib/integrations/token-manager';
import {
  validateCalcomApiKey,
  getCalcomEventTypes,
  getCalcomBookings,
  buildCalcomBookingUrl,
} from '@/lib/integrations/calcom';
import { type CalcomSettings } from '@/lib/integrations/types';

/**
 * GET - Get Cal.com integration status and data
 */
export async function GET() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const integration = await getIntegration(orgId, 'calcom');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json({
        connected: false,
      });
    }

    const settings = integration.settings as CalcomSettings;

    // Get event types and upcoming bookings
    const [eventTypes, bookings] = await Promise.all([
      getCalcomEventTypes(integration.apiKey!).catch(() => []),
      getCalcomBookings(integration.apiKey!, { status: 'upcoming' }).catch(() => []),
    ]);

    return NextResponse.json({
      connected: true,
      username: settings.username,
      eventTypes: eventTypes.map(et => ({
        id: et.id,
        title: et.title,
        slug: et.slug,
        length: et.length,
        bookingUrl: buildCalcomBookingUrl(settings.username!, et.slug),
      })),
      upcomingBookings: bookings.slice(0, 5).map(b => ({
        id: b.id,
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        attendees: b.attendees,
      })),
      settings: {
        eventTypeSlug: settings.eventTypeSlug,
        embedEnabled: settings.embedEnabled,
        autoCreateLinks: settings.autoCreateLinks,
      },
    });
  } catch (error) {
    console.error('[Cal.com] Error fetching integration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Cal.com integration' },
      { status: 500 }
    );
  }
}

/**
 * POST - Connect Cal.com with API key
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey, eventTypeSlug, embedEnabled = false, autoCreateLinks = true } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Validate the API key
    const validation = await validateCalcomApiKey(apiKey);
    
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid API key' },
        { status: 400 }
      );
    }

    const settings: CalcomSettings = {
      provider: 'calcom',
      username: validation.username,
      eventTypeSlug,
      embedEnabled,
      autoCreateLinks,
    };

    // Check if integration already exists
    const existing = await getIntegration(orgId, 'calcom');
    
    // Store as API key integration (handles both new and update)
    await storeApiKeyIntegration(
      orgId,
      'calcom' as 'deepgram', // Type workaround - function accepts calcom too
      apiKey,
      settings,
      userId
    );

    // Get event types to return
    const eventTypes = await getCalcomEventTypes(apiKey).catch(() => []);

    return NextResponse.json({
      success: true,
      username: validation.username,
      eventTypes: eventTypes.map(et => ({
        id: et.id,
        title: et.title,
        slug: et.slug,
        length: et.length,
        bookingUrl: buildCalcomBookingUrl(validation.username!, et.slug),
      })),
    });
  } catch (error) {
    console.error('[Cal.com] Error connecting:', error);
    return NextResponse.json(
      { error: 'Failed to connect Cal.com' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update Cal.com settings
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { eventTypeSlug, embedEnabled, autoCreateLinks } = body;

    const integration = await getIntegration(orgId, 'calcom');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Cal.com not connected' },
        { status: 400 }
      );
    }

    const currentSettings = integration.settings as CalcomSettings;

    await updateIntegrationSettings(orgId, integration.id, {
      ...currentSettings,
      eventTypeSlug: eventTypeSlug ?? currentSettings.eventTypeSlug,
      embedEnabled: embedEnabled ?? currentSettings.embedEnabled,
      autoCreateLinks: autoCreateLinks ?? currentSettings.autoCreateLinks,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Cal.com] Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update Cal.com settings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect Cal.com
 */
export async function DELETE() {
  try {
    const { userId, orgId } = await auth();
    
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const integration = await getIntegration(orgId, 'calcom');
    
    if (integration) {
      await disconnectIntegration(orgId, integration.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Cal.com] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Cal.com' },
      { status: 500 }
    );
  }
}

