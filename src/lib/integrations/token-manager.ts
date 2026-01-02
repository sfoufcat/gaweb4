/**
 * Integration Token Manager
 * 
 * Handles secure storage, retrieval, encryption, and refresh of OAuth tokens
 * for third-party integrations.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'crypto';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  CoachIntegration, 
  IntegrationProvider, 
  IntegrationSettings,
  IntegrationStatus 
} from './types';

// =============================================================================
// ENCRYPTION CONFIGURATION
// =============================================================================

/**
 * Get encryption key from environment
 * Should be a 32-byte (256-bit) key for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY environment variable is required');
  }
  // If key is base64 encoded
  if (key.length === 44) {
    return Buffer.from(key, 'base64');
  }
  // If key is hex encoded (64 chars for 32 bytes)
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise treat as raw string and hash to 32 bytes
  return createHmac('sha256', key).digest();
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data (tokens, API keys)
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Combine IV + auth tag + encrypted data
  const combined = Buffer.concat([
    iv,
    authTag,
    Buffer.from(encrypted, 'base64'),
  ]);
  
  return combined.toString('base64');
}

/**
 * Decrypt sensitive data
 */
export function decryptToken(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  // Extract IV, auth tag, and encrypted content
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

// =============================================================================
// TOKEN STORAGE OPERATIONS
// =============================================================================

/**
 * Get the integrations collection reference for an organization
 */
function getIntegrationsRef(orgId: string) {
  return adminDb.collection('organizations').doc(orgId).collection('integrations');
}

/**
 * Store a new integration with encrypted tokens
 */
export async function storeIntegration(
  orgId: string,
  provider: IntegrationProvider,
  data: {
    accessToken: string;
    refreshToken?: string;
    tokenType?: string;
    expiresAt?: Date;
    scopes?: string[];
    accountId?: string;
    accountEmail?: string;
    accountName?: string;
    settings: IntegrationSettings;
  },
  connectedBy: string
): Promise<CoachIntegration> {
  const ref = getIntegrationsRef(orgId);
  
  // Check if integration already exists
  const existing = await ref.where('provider', '==', provider).limit(1).get();
  
  const now = FieldValue.serverTimestamp();
  
  const integrationData = {
    provider,
    status: 'connected' as IntegrationStatus,
    accessToken: encryptToken(data.accessToken),
    refreshToken: data.refreshToken ? encryptToken(data.refreshToken) : null,
    tokenType: data.tokenType || 'Bearer',
    expiresAt: data.expiresAt || null,
    scopes: data.scopes || [],
    accountId: data.accountId || null,
    accountEmail: data.accountEmail || null,
    accountName: data.accountName || null,
    settings: data.settings,
    syncEnabled: true,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    connectedAt: now,
    updatedAt: now,
    connectedBy,
  };
  
  let docRef;
  if (!existing.empty) {
    // Update existing integration
    docRef = existing.docs[0].ref;
    await docRef.update({
      ...integrationData,
      connectedAt: existing.docs[0].data().connectedAt, // Preserve original connect time
    });
  } else {
    // Create new integration
    docRef = await ref.add(integrationData);
  }
  
  const doc = await docRef.get();
  const result = doc.data() as CoachIntegration;
  
  return {
    ...result,
    id: docRef.id,
    // Don't return encrypted tokens in the response
    accessToken: '[ENCRYPTED]',
    refreshToken: result.refreshToken ? '[ENCRYPTED]' : undefined,
  };
}

/**
 * Get an integration by provider (with decrypted tokens)
 */
export async function getIntegration(
  orgId: string,
  provider: IntegrationProvider,
  decryptTokens = false
): Promise<CoachIntegration | null> {
  const ref = getIntegrationsRef(orgId);
  const snapshot = await ref.where('provider', '==', provider).limit(1).get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  const data = doc.data() as CoachIntegration;
  
  if (decryptTokens) {
    return {
      ...data,
      id: doc.id,
      accessToken: decryptToken(data.accessToken),
      refreshToken: data.refreshToken ? decryptToken(data.refreshToken) : undefined,
    };
  }
  
  return {
    ...data,
    id: doc.id,
    accessToken: '[ENCRYPTED]',
    refreshToken: data.refreshToken ? '[ENCRYPTED]' : undefined,
  };
}

/**
 * Get an integration by ID (with decrypted tokens)
 */
export async function getIntegrationById(
  orgId: string,
  integrationId: string,
  decryptTokens = false
): Promise<CoachIntegration | null> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  const doc = await ref.get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data() as CoachIntegration;
  
  if (decryptTokens) {
    return {
      ...data,
      id: doc.id,
      accessToken: decryptToken(data.accessToken),
      refreshToken: data.refreshToken ? decryptToken(data.refreshToken) : undefined,
    };
  }
  
  return {
    ...data,
    id: doc.id,
    accessToken: '[ENCRYPTED]',
    refreshToken: data.refreshToken ? '[ENCRYPTED]' : undefined,
  };
}

/**
 * List all integrations for an organization
 */
export async function listIntegrations(orgId: string): Promise<CoachIntegration[]> {
  const ref = getIntegrationsRef(orgId);
  const snapshot = await ref.get();
  
  return snapshot.docs.map((doc) => {
    const data = doc.data() as CoachIntegration;
    return {
      ...data,
      id: doc.id,
      accessToken: '[ENCRYPTED]',
      refreshToken: data.refreshToken ? '[ENCRYPTED]' : undefined,
    };
  });
}

/**
 * Update integration tokens (e.g., after refresh)
 */
export async function updateTokens(
  orgId: string,
  integrationId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }
): Promise<void> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  
  const updateData: Record<string, unknown> = {
    accessToken: encryptToken(tokens.accessToken),
    status: 'connected',
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  if (tokens.refreshToken) {
    updateData.refreshToken = encryptToken(tokens.refreshToken);
  }
  
  if (tokens.expiresAt) {
    updateData.expiresAt = tokens.expiresAt;
  }
  
  await ref.update(updateData);
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(
  orgId: string,
  integrationId: string,
  settings: Partial<IntegrationSettings>
): Promise<void> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  
  await ref.update({
    settings,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Update integration status
 */
export async function updateIntegrationStatus(
  orgId: string,
  integrationId: string,
  status: IntegrationStatus,
  error?: string
): Promise<void> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  if (error) {
    updateData.lastSyncError = error;
    updateData.lastSyncStatus = 'error';
  }
  
  await ref.update(updateData);
}

/**
 * Update sync status
 */
export async function updateSyncStatus(
  orgId: string,
  integrationId: string,
  status: 'success' | 'error',
  error?: string
): Promise<void> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  
  const updateData: Record<string, unknown> = {
    lastSyncAt: FieldValue.serverTimestamp(),
    lastSyncStatus: status,
    updatedAt: FieldValue.serverTimestamp(),
  };
  
  if (error) {
    updateData.lastSyncError = error;
  } else {
    updateData.lastSyncError = null;
  }
  
  await ref.update(updateData);
}

/**
 * Disconnect (delete) an integration
 */
export async function disconnectIntegration(
  orgId: string,
  integrationId: string
): Promise<void> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  await ref.delete();
}

/**
 * Store a webhook-based integration (Zapier/Make)
 */
export async function storeWebhookIntegration(
  orgId: string,
  provider: 'zapier' | 'make',
  webhookUrl: string,
  settings: IntegrationSettings,
  connectedBy: string
): Promise<CoachIntegration> {
  const ref = getIntegrationsRef(orgId);
  
  // Generate a webhook secret for signature verification
  const webhookSecret = randomBytes(32).toString('hex');
  
  // Check if integration already exists
  const existing = await ref.where('provider', '==', provider).limit(1).get();
  
  const now = FieldValue.serverTimestamp();
  
  const integrationData = {
    provider,
    status: 'connected' as IntegrationStatus,
    accessToken: '', // Not used for webhooks
    webhookUrl,
    webhookSecret: encryptToken(webhookSecret),
    settings,
    syncEnabled: true,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    connectedAt: now,
    updatedAt: now,
    connectedBy,
  };
  
  let docRef;
  if (!existing.empty) {
    docRef = existing.docs[0].ref;
    await docRef.update({
      ...integrationData,
      connectedAt: existing.docs[0].data().connectedAt,
    });
  } else {
    docRef = await ref.add(integrationData);
  }
  
  return {
    id: docRef.id,
    provider,
    status: 'connected',
    accessToken: '',
    webhookUrl,
    webhookSecret: '[ENCRYPTED]',
    settings,
    syncEnabled: true,
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connectedBy,
  } as CoachIntegration;
}

/**
 * Store an API key integration (Deepgram/AssemblyAI)
 */
export async function storeApiKeyIntegration(
  orgId: string,
  provider: 'deepgram' | 'assemblyai',
  apiKey: string,
  settings: IntegrationSettings,
  connectedBy: string
): Promise<CoachIntegration> {
  const ref = getIntegrationsRef(orgId);
  
  // Check if integration already exists
  const existing = await ref.where('provider', '==', provider).limit(1).get();
  
  const now = FieldValue.serverTimestamp();
  
  const integrationData = {
    provider,
    status: 'connected' as IntegrationStatus,
    accessToken: '', // Not used for API keys
    apiKey: encryptToken(apiKey),
    settings,
    syncEnabled: true,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    connectedAt: now,
    updatedAt: now,
    connectedBy,
  };
  
  let docRef;
  if (!existing.empty) {
    docRef = existing.docs[0].ref;
    await docRef.update({
      ...integrationData,
      connectedAt: existing.docs[0].data().connectedAt,
    });
  } else {
    docRef = await ref.add(integrationData);
  }
  
  return {
    id: docRef.id,
    provider,
    status: 'connected',
    accessToken: '',
    apiKey: '[ENCRYPTED]',
    settings,
    syncEnabled: true,
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    connectedBy,
  } as CoachIntegration;
}

/**
 * Get decrypted webhook secret
 */
export async function getWebhookSecret(
  orgId: string,
  integrationId: string
): Promise<string | null> {
  const integration = await getIntegrationById(orgId, integrationId, false);
  
  if (!integration || !integration.webhookSecret) {
    return null;
  }
  
  // Get the raw encrypted secret from Firestore
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  const doc = await ref.get();
  const data = doc.data();
  
  if (!data?.webhookSecret) {
    return null;
  }
  
  return decryptToken(data.webhookSecret);
}

/**
 * Get decrypted API key
 */
export async function getApiKey(
  orgId: string,
  integrationId: string
): Promise<string | null> {
  const ref = getIntegrationsRef(orgId).doc(integrationId);
  const doc = await ref.get();
  const data = doc.data();
  
  if (!data?.apiKey) {
    return null;
  }
  
  return decryptToken(data.apiKey);
}

// =============================================================================
// TOKEN REFRESH UTILITIES
// =============================================================================

/**
 * Check if a token needs refresh (expires within 5 minutes)
 */
export function needsTokenRefresh(expiresAt: Date | string | null | undefined): boolean {
  if (!expiresAt) {
    return false;
  }
  
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;
  
  return expiry.getTime() - now.getTime() < fiveMinutes;
}

/**
 * Get integrations that need token refresh
 */
export async function getIntegrationsNeedingRefresh(): Promise<Array<{
  orgId: string;
  integration: CoachIntegration;
}>> {
  const results: Array<{ orgId: string; integration: CoachIntegration }> = [];
  
  // Get all organizations
  const orgsSnapshot = await adminDb.collection('organizations').get();
  
  for (const orgDoc of orgsSnapshot.docs) {
    const integrationsSnapshot = await orgDoc.ref.collection('integrations')
      .where('status', '==', 'connected')
      .get();
    
    for (const intDoc of integrationsSnapshot.docs) {
      const data = intDoc.data() as CoachIntegration;
      
      if (data.expiresAt && needsTokenRefresh(data.expiresAt as string)) {
        results.push({
          orgId: orgDoc.id,
          integration: {
            ...data,
            id: intDoc.id,
            accessToken: '[ENCRYPTED]',
            refreshToken: data.refreshToken ? '[ENCRYPTED]' : undefined,
          },
        });
      }
    }
  }
  
  return results;
}

// =============================================================================
// SIGNATURE UTILITIES
// =============================================================================

/**
 * Create HMAC signature for webhook payloads
 */
export function createWebhookSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createWebhookSignature(payload, secret);
  return signature === expectedSignature;
}



