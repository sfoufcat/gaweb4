/**
 * Airtable Export API
 * 
 * Allows coaches to export client data and check-ins to Airtable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIntegration, updateTokens, updateSyncStatus, updateIntegrationSettings, updateIntegrationStatus } from '@/lib/integrations/token-manager';
import {
  refreshAirtableToken,
  listAirtableBases,
  getAirtableBaseSchema,
  exportClientsToAirtable,
  exportCheckinsToAirtable,
} from '@/lib/integrations/airtable';
import { type AirtableSettings } from '@/lib/integrations/types';

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
    const { 
      exportType = 'clients', // 'clients' | 'checkins' | 'sessions'
      clients,
      checkins,
    } = body;

    // Get the Airtable integration
    const integration = await getIntegration(orgId, 'airtable');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Airtable not connected' },
        { status: 400 }
      );
    }

    let accessToken = integration.accessToken;

    // Check if token needs refresh
    const expiresAt = new Date(integration.expiresAt as string);
    if (expiresAt < new Date()) {
      if (!integration.refreshToken) {
        await updateIntegrationStatus(orgId, integration.id, 'expired');
        return NextResponse.json(
          { error: 'Token expired, please reconnect' },
          { status: 401 }
        );
      }

      const newTokens = await refreshAirtableToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      await updateTokens(orgId, integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    const settings = integration.settings as AirtableSettings;
    
    if (!settings.baseId) {
      return NextResponse.json(
        { error: 'No Airtable base configured. Please configure in settings.' },
        { status: 400 }
      );
    }

    const results: Record<string, number> = {};

    // Export clients
    if (exportType === 'clients' && clients?.length) {
      const result = await exportClientsToAirtable(accessToken, settings, clients);
      results.clients = result.created;
    }

    // Export check-ins
    if (exportType === 'checkins' && checkins?.length) {
      const result = await exportCheckinsToAirtable(accessToken, settings, checkins);
      results.checkins = result.created;
    }

    // Update last sync time
    await updateSyncStatus(orgId, integration.id, 'success');

    return NextResponse.json({
      success: true,
      exported: results,
    });
  } catch (error) {
    console.error('[Airtable Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export to Airtable' },
      { status: 500 }
    );
  }
}

/**
 * GET - List available bases and tables for configuration
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

    // Get the Airtable integration
    const integration = await getIntegration(orgId, 'airtable');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Airtable not connected' },
        { status: 400 }
      );
    }

    let accessToken = integration.accessToken;

    // Check if token needs refresh
    const expiresAt = new Date(integration.expiresAt as string);
    if (expiresAt < new Date() && integration.refreshToken) {
      const newTokens = await refreshAirtableToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      await updateTokens(orgId, integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    const bases = await listAirtableBases(accessToken);
    
    // If a base is selected, also get its tables
    const settings = integration.settings as AirtableSettings;
    let tables = null;
    
    if (settings.baseId) {
      tables = await getAirtableBaseSchema(accessToken, settings.baseId);
    }

    return NextResponse.json({
      bases: bases.map(b => ({ id: b.id, name: b.name })),
      tables: tables?.map(t => ({ id: t.id, name: t.name })),
      currentBase: settings.baseId,
    });
  } catch (error) {
    console.error('[Airtable Bases] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list Airtable bases' },
      { status: 500 }
    );
  }
}

