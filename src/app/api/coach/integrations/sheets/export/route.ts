/**
 * Google Sheets Export API
 * 
 * Allows coaches to export client data, check-ins, and goals
 * to Google Sheets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getIntegration, updateTokens, updateSyncStatus, updateIntegrationSettings, updateIntegrationStatus } from '@/lib/integrations/token-manager';
import {
  refreshGoogleSheetsToken,
  createSpreadsheet,
  exportClientsToSheet,
  exportCheckinsToSheet,
  exportGoalsToSheet,
} from '@/lib/integrations/google-sheets';
import { type GoogleSheetsSettings } from '@/lib/integrations/types';

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
      exportType = 'all', // 'all' | 'clients' | 'checkins' | 'goals'
      spreadsheetId,
      clients,
      checkins,
      goals,
    } = body;

    // Get the Google Sheets integration
    const integration = await getIntegration(orgId, 'google_sheets');
    
    if (!integration || integration.status !== 'connected') {
      return NextResponse.json(
        { error: 'Google Sheets not connected' },
        { status: 400 }
      );
    }

    let accessToken = integration.accessToken;

    // Check if token needs refresh
    const expiresAt = new Date(integration.expiresAt as string);
    if (expiresAt < new Date()) {
      if (!integration.refreshToken) {
        // Token expired and no refresh token - need to reconnect
        await updateIntegrationStatus(orgId, integration.id, 'expired');
        return NextResponse.json(
          { error: 'Token expired, please reconnect' },
          { status: 401 }
        );
      }

      // Refresh the token
      const newTokens = await refreshGoogleSheetsToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      // Update stored token
      await updateTokens(orgId, integration.id, {
        accessToken: newTokens.access_token,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    const settings = integration.settings as GoogleSheetsSettings;
    
    // Create new spreadsheet or use existing
    let targetSpreadsheetId = spreadsheetId || settings.spreadsheetId;
    let spreadsheetUrl: string | undefined;

    if (!targetSpreadsheetId) {
      // Create new spreadsheet
      const timestamp = new Date().toISOString().split('T')[0];
      const result = await createSpreadsheet(
        accessToken,
        `Coaching Export - ${timestamp}`
      );
      targetSpreadsheetId = result.spreadsheetId;
      spreadsheetUrl = result.spreadsheetUrl;

      // Save spreadsheet ID to settings
      await updateIntegrationSettings(orgId, integration.id, {
        ...settings,
        spreadsheetId: targetSpreadsheetId,
      });
    }

    const results: Record<string, number> = {};

    // Export clients
    if ((exportType === 'all' || exportType === 'clients') && clients?.length) {
      const result = await exportClientsToSheet(
        accessToken,
        targetSpreadsheetId,
        clients,
        settings
      );
      results.clients = result.exportedRows;
    }

    // Export check-ins
    if ((exportType === 'all' || exportType === 'checkins') && checkins?.length) {
      const result = await exportCheckinsToSheet(
        accessToken,
        targetSpreadsheetId,
        checkins,
        settings
      );
      results.checkins = result.exportedRows;
    }

    // Export goals
    if ((exportType === 'all' || exportType === 'goals') && goals?.length) {
      const result = await exportGoalsToSheet(
        accessToken,
        targetSpreadsheetId,
        goals,
        settings
      );
      results.goals = result.exportedRows;
    }

    // Update last sync time
    await updateSyncStatus(orgId, integration.id, 'success');

    return NextResponse.json({
      success: true,
      spreadsheetId: targetSpreadsheetId,
      spreadsheetUrl: spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetSpreadsheetId}`,
      exported: results,
    });
  } catch (error) {
    console.error('[Sheets Export] Error:', error);
    return NextResponse.json(
      { error: 'Failed to export to Google Sheets' },
      { status: 500 }
    );
  }
}

