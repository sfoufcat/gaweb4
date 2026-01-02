/**
 * Google Sheets Integration
 * 
 * Allows coaches to export client data, check-ins, goals, and reports
 * to Google Sheets for analysis and reporting.
 */

import { type GoogleSheetsSettings } from './types';

// =============================================================================
// OAUTH CONFIGURATION
// =============================================================================

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// =============================================================================
// OAUTH HELPERS
// =============================================================================

/**
 * Get Google OAuth URL for Sheets authorization
 */
export function getGoogleSheetsAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SHEETS_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleSheetsCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID || '',
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET || '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshGoogleSheetsToken(
  refreshToken: string
): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID || '',
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

// =============================================================================
// SHEETS API HELPERS
// =============================================================================

interface SheetData {
  range: string;
  values: (string | number | boolean)[][];
}

/**
 * Create a new Google Spreadsheet
 */
export async function createSpreadsheet(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create spreadsheet: ${error}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

/**
 * Get spreadsheet metadata
 */
export async function getSpreadsheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  spreadsheetId: string;
  properties: { title: string };
  sheets: Array<{ properties: { sheetId: number; title: string } }>;
}> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get spreadsheet: ${error}`);
  }

  return response.json();
}

/**
 * Add a new sheet (tab) to a spreadsheet
 */
export async function addSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string
): Promise<{ sheetId: number }> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: sheetTitle },
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add sheet: ${error}`);
  }

  const data = await response.json();
  return { sheetId: data.replies[0].addSheet.properties.sheetId };
}

/**
 * Write data to a range in a spreadsheet
 */
export async function writeToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
): Promise<{ updatedCells: number }> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to write to sheet: ${error}`);
  }

  const data = await response.json();
  return { updatedCells: data.updatedCells };
}

/**
 * Append data to a sheet (adds new rows)
 */
export async function appendToSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean)[][]
): Promise<{ updatedRows: number }> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append to sheet: ${error}`);
  }

  const data = await response.json();
  return { updatedRows: data.updates?.updatedRows || values.length };
}

/**
 * Read data from a range in a spreadsheet
 */
export async function readFromSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<(string | number | boolean)[][]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read from sheet: ${error}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Clear a range in a spreadsheet
 */
export async function clearSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to clear sheet: ${error}`);
  }
}

// =============================================================================
// EXPORT HELPERS
// =============================================================================

interface ClientExportData {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  tier?: string;
  totalCheckins?: number;
  currentStreak?: number;
  goalsCompleted?: number;
}

interface CheckinExportData {
  id: string;
  clientName: string;
  date: string;
  type: string;
  mood?: string;
  notes?: string;
}

interface GoalExportData {
  id: string;
  clientName: string;
  title: string;
  status: string;
  createdAt: string;
  targetDate?: string;
  completedAt?: string;
}

/**
 * Export clients to a sheet
 */
export async function exportClientsToSheet(
  accessToken: string,
  spreadsheetId: string,
  clients: ClientExportData[],
  settings: GoogleSheetsSettings
): Promise<{ exportedRows: number }> {
  const sheetName = 'Clients';
  
  // Headers
  const headers = [
    'ID', 'Name', 'Email', 'Joined', 'Tier', 
    'Total Check-ins', 'Current Streak', 'Goals Completed'
  ];
  
  // Data rows
  const rows = clients.map(client => [
    client.id,
    client.name,
    client.email,
    client.joinedAt,
    client.tier || '',
    client.totalCheckins || 0,
    client.currentStreak || 0,
    client.goalsCompleted || 0,
  ]);
  
  // Write headers + data
  const values = [headers, ...rows];
  
  try {
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  } catch {
    // Sheet might not exist, try creating it
    await addSheet(accessToken, spreadsheetId, sheetName);
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  }
  
  return { exportedRows: rows.length };
}

/**
 * Export check-ins to a sheet
 */
export async function exportCheckinsToSheet(
  accessToken: string,
  spreadsheetId: string,
  checkins: CheckinExportData[],
  settings: GoogleSheetsSettings
): Promise<{ exportedRows: number }> {
  const sheetName = 'Check-ins';
  
  const headers = ['ID', 'Client', 'Date', 'Type', 'Mood', 'Notes'];
  
  const rows = checkins.map(checkin => [
    checkin.id,
    checkin.clientName,
    checkin.date,
    checkin.type,
    checkin.mood || '',
    checkin.notes || '',
  ]);
  
  const values = [headers, ...rows];
  
  try {
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  } catch {
    await addSheet(accessToken, spreadsheetId, sheetName);
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  }
  
  return { exportedRows: rows.length };
}

/**
 * Export goals to a sheet
 */
export async function exportGoalsToSheet(
  accessToken: string,
  spreadsheetId: string,
  goals: GoalExportData[],
  settings: GoogleSheetsSettings
): Promise<{ exportedRows: number }> {
  const sheetName = 'Goals';
  
  const headers = ['ID', 'Client', 'Title', 'Status', 'Created', 'Target Date', 'Completed'];
  
  const rows = goals.map(goal => [
    goal.id,
    goal.clientName,
    goal.title,
    goal.status,
    goal.createdAt,
    goal.targetDate || '',
    goal.completedAt || '',
  ]);
  
  const values = [headers, ...rows];
  
  try {
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  } catch {
    await addSheet(accessToken, spreadsheetId, sheetName);
    await writeToSheet(accessToken, spreadsheetId, `${sheetName}!A1`, values);
  }
  
  return { exportedRows: rows.length };
}

/**
 * Check if Google Sheets integration is configured
 */
export function isGoogleSheetsConfigured(): boolean {
  return !!(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET);
}



