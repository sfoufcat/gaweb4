/**
 * Airtable Integration
 * 
 * Allows coaches to export client data, sessions, and check-ins
 * to Airtable bases for flexible reporting and analysis.
 */

import { type AirtableSettings } from './types';

// =============================================================================
// OAUTH CONFIGURATION
// =============================================================================

const AIRTABLE_CLIENT_ID = process.env.AIRTABLE_CLIENT_ID;
const AIRTABLE_CLIENT_SECRET = process.env.AIRTABLE_CLIENT_SECRET;

const AIRTABLE_SCOPES = [
  'data.records:read',
  'data.records:write',
  'schema.bases:read',
];

// =============================================================================
// OAUTH HELPERS
// =============================================================================

/**
 * Get Airtable OAuth URL for authorization
 */
export function getAirtableAuthUrl(redirectUri: string, state: string): string {
  // Airtable uses PKCE - for simplicity, we'll use a basic flow
  const params = new URLSearchParams({
    client_id: AIRTABLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: AIRTABLE_SCOPES.join(' '),
    state,
  });

  return `https://airtable.com/oauth2/v1/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeAirtableCodeForTokens(
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const body: Record<string, string> = {
    client_id: AIRTABLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    code,
    grant_type: 'authorization_code',
  };

  if (AIRTABLE_CLIENT_SECRET) {
    body.client_secret = AIRTABLE_CLIENT_SECRET;
  }

  if (codeVerifier) {
    body.code_verifier = codeVerifier;
  }

  const response = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token
 */
export async function refreshAirtableToken(
  refreshToken: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: AIRTABLE_CLIENT_ID || '',
      client_secret: AIRTABLE_CLIENT_SECRET || '',
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
// AIRTABLE API HELPERS
// =============================================================================

interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

interface AirtableTable {
  id: string;
  name: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

interface AirtableRecord {
  id?: string;
  fields: Record<string, unknown>;
}

/**
 * List accessible bases
 */
export async function listAirtableBases(
  accessToken: string
): Promise<AirtableBase[]> {
  const response = await fetch('https://api.airtable.com/v0/meta/bases', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list bases: ${error}`);
  }

  const data = await response.json();
  return data.bases || [];
}

/**
 * Get base schema (tables and fields)
 */
export async function getAirtableBaseSchema(
  accessToken: string,
  baseId: string
): Promise<AirtableTable[]> {
  const response = await fetch(
    `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get base schema: ${error}`);
  }

  const data = await response.json();
  return data.tables || [];
}

/**
 * Create records in a table
 */
export async function createAirtableRecords(
  accessToken: string,
  baseId: string,
  tableId: string,
  records: AirtableRecord[]
): Promise<AirtableRecord[]> {
  // Airtable limits to 10 records per request
  const chunks: AirtableRecord[][] = [];
  for (let i = 0; i < records.length; i += 10) {
    chunks.push(records.slice(i, i + 10));
  }

  const allCreated: AirtableRecord[] = [];

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: chunk.map(r => ({ fields: r.fields })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create records: ${error}`);
    }

    const data = await response.json();
    allCreated.push(...data.records);
  }

  return allCreated;
}

/**
 * Update records in a table
 */
export async function updateAirtableRecords(
  accessToken: string,
  baseId: string,
  tableId: string,
  records: AirtableRecord[]
): Promise<AirtableRecord[]> {
  const chunks: AirtableRecord[][] = [];
  for (let i = 0; i < records.length; i += 10) {
    chunks.push(records.slice(i, i + 10));
  }

  const allUpdated: AirtableRecord[] = [];

  for (const chunk of chunks) {
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: chunk.map(r => ({ id: r.id, fields: r.fields })),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update records: ${error}`);
    }

    const data = await response.json();
    allUpdated.push(...data.records);
  }

  return allUpdated;
}

/**
 * List records from a table
 */
export async function listAirtableRecords(
  accessToken: string,
  baseId: string,
  tableId: string,
  options?: {
    maxRecords?: number;
    filterByFormula?: string;
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  }
): Promise<AirtableRecord[]> {
  const params = new URLSearchParams();
  
  if (options?.maxRecords) {
    params.set('maxRecords', options.maxRecords.toString());
  }
  
  if (options?.filterByFormula) {
    params.set('filterByFormula', options.filterByFormula);
  }
  
  if (options?.sort) {
    options.sort.forEach((s, i) => {
      params.set(`sort[${i}][field]`, s.field);
      params.set(`sort[${i}][direction]`, s.direction);
    });
  }

  const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list records: ${error}`);
  }

  const data = await response.json();
  return data.records || [];
}

/**
 * Delete records from a table
 */
export async function deleteAirtableRecords(
  accessToken: string,
  baseId: string,
  tableId: string,
  recordIds: string[]
): Promise<void> {
  // Airtable limits to 10 records per request
  const chunks: string[][] = [];
  for (let i = 0; i < recordIds.length; i += 10) {
    chunks.push(recordIds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const params = chunk.map(id => `records[]=${id}`).join('&');
    
    const response = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete records: ${error}`);
    }
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
}

interface CheckinExportData {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  type: string;
  mood?: string;
  notes?: string;
}

/**
 * Export clients to Airtable
 */
export async function exportClientsToAirtable(
  accessToken: string,
  settings: AirtableSettings,
  clients: ClientExportData[]
): Promise<{ created: number }> {
  if (!settings.baseId || !settings.clientsTableId) {
    throw new Error('Base ID and Clients Table ID are required');
  }

  const records = clients.map(client => ({
    fields: {
      'ID': client.id,
      'Name': client.name,
      'Email': client.email,
      'Joined': client.joinedAt,
      'Tier': client.tier || 'free',
      'Total Check-ins': client.totalCheckins || 0,
      'Current Streak': client.currentStreak || 0,
    },
  }));

  const created = await createAirtableRecords(
    accessToken,
    settings.baseId,
    settings.clientsTableId,
    records
  );

  return { created: created.length };
}

/**
 * Export check-ins to Airtable
 */
export async function exportCheckinsToAirtable(
  accessToken: string,
  settings: AirtableSettings,
  checkins: CheckinExportData[]
): Promise<{ created: number }> {
  if (!settings.baseId || !settings.checkinsTableId) {
    throw new Error('Base ID and Check-ins Table ID are required');
  }

  const records = checkins.map(checkin => ({
    fields: {
      'ID': checkin.id,
      'Client ID': checkin.clientId,
      'Client Name': checkin.clientName,
      'Date': checkin.date,
      'Type': checkin.type,
      'Mood': checkin.mood || '',
      'Notes': checkin.notes || '',
    },
  }));

  const created = await createAirtableRecords(
    accessToken,
    settings.baseId,
    settings.checkinsTableId,
    records
  );

  return { created: created.length };
}

/**
 * Check if Airtable integration is configured
 */
export function isAirtableConfigured(): boolean {
  return !!(AIRTABLE_CLIENT_ID && AIRTABLE_CLIENT_SECRET);
}

