/**
 * Webhook Dispatcher
 * 
 * Handles dispatching webhook events to connected automation platforms
 * like Zapier and Make (Integromat).
 */

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  getIntegration, 
  getWebhookSecret,
  createWebhookSignature,
  updateSyncStatus,
} from './token-manager';
import type { 
  WebhookEventType, 
  WebhookPayload, 
  WebhookDeliveryLog,
  WebhookSettings,
} from './types';
import { randomUUID } from 'crypto';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2min
const WEBHOOK_TIMEOUT = 10000; // 10 seconds

// =============================================================================
// WEBHOOK DISPATCH
// =============================================================================

/**
 * Dispatch a webhook event to all connected automation integrations
 * 
 * @param orgId - Organization ID
 * @param event - Event type
 * @param data - Event data payload
 */
export async function dispatchWebhookEvent<T = unknown>(
  orgId: string,
  event: WebhookEventType,
  data: T
): Promise<void> {
  try {
    // Get Zapier integration
    const zapierIntegration = await getIntegration(orgId, 'zapier');
    if (zapierIntegration && zapierIntegration.status === 'connected') {
      const settings = zapierIntegration.settings as WebhookSettings;
      if (settings.events?.includes(event)) {
        await sendWebhook(orgId, zapierIntegration.id, event, data);
      }
    }

    // Get Make integration
    const makeIntegration = await getIntegration(orgId, 'make');
    if (makeIntegration && makeIntegration.status === 'connected') {
      const settings = makeIntegration.settings as WebhookSettings;
      if (settings.events?.includes(event)) {
        await sendWebhook(orgId, makeIntegration.id, event, data);
      }
    }
  } catch (error) {
    console.error(`[WEBHOOK_DISPATCH] Error dispatching event ${event} for org ${orgId}:`, error);
    // Don't throw - webhook failures shouldn't break the main flow
  }
}

/**
 * Send a webhook to a specific integration
 */
async function sendWebhook<T = unknown>(
  orgId: string,
  integrationId: string,
  event: WebhookEventType,
  data: T
): Promise<void> {
  // Get the integration with decrypted tokens
  const integration = await getIntegration(orgId, integrationId as never, true);
  if (!integration || !integration.webhookUrl) {
    console.warn(`[WEBHOOK_DISPATCH] No webhook URL for integration ${integrationId}`);
    return;
  }

  const webhookUrl = integration.webhookUrl;
  const webhookSecret = await getWebhookSecret(orgId, integrationId);

  // Build the payload
  const eventId = randomUUID();
  const timestamp = new Date().toISOString();
  
  const payloadData: Omit<WebhookPayload<T>, 'signature'> = {
    id: eventId,
    event,
    timestamp,
    organizationId: orgId,
    data,
  };

  // Sign the payload
  const payloadString = JSON.stringify(payloadData);
  const signature = webhookSecret 
    ? createWebhookSignature(payloadString, webhookSecret)
    : '';

  const payload: WebhookPayload<T> = {
    ...payloadData,
    signature,
  };

  // Create delivery log
  const logRef = await createDeliveryLog(orgId, integrationId, event, webhookUrl, payload);

  // Send the webhook
  try {
    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Id': eventId,
      },
      body: JSON.stringify(payload),
    }, WEBHOOK_TIMEOUT);

    // Log success
    await updateDeliveryLog(logRef, {
      status: 'delivered',
      httpStatus: response.status,
      deliveredAt: FieldValue.serverTimestamp(),
    });

    await updateSyncStatus(orgId, integrationId, 'success');

    console.log(`[WEBHOOK_DISPATCH] Successfully delivered ${event} to ${webhookUrl}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failure
    await updateDeliveryLog(logRef, {
      status: 'failed',
      error: errorMessage,
    });

    // Check if we should retry
    const settings = integration.settings as WebhookSettings;
    if (settings.retryOnFailure) {
      await scheduleRetry(orgId, integrationId, logRef.id, 1);
    }

    await updateSyncStatus(orgId, integrationId, 'error', errorMessage);

    console.error(`[WEBHOOK_DISPATCH] Failed to deliver ${event} to ${webhookUrl}:`, error);
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

// =============================================================================
// DELIVERY LOGGING
// =============================================================================

/**
 * Create a webhook delivery log entry
 */
async function createDeliveryLog<T>(
  orgId: string,
  integrationId: string,
  event: WebhookEventType,
  webhookUrl: string,
  payload: WebhookPayload<T>
): Promise<FirebaseFirestore.DocumentReference> {
  const logsRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('webhookLogs');

  const logData: Omit<WebhookDeliveryLog, 'id'> = {
    integrationId,
    event,
    webhookUrl,
    payload: payload as WebhookPayload,
    status: 'pending',
    attemptNumber: 1,
    maxAttempts: MAX_RETRIES + 1,
    createdAt: FieldValue.serverTimestamp() as unknown as string,
  };

  const docRef = await logsRef.add(logData);
  return docRef;
}

/**
 * Update a delivery log entry
 */
async function updateDeliveryLog(
  logRef: FirebaseFirestore.DocumentReference,
  updates: Partial<WebhookDeliveryLog>
): Promise<void> {
  await logRef.update(updates);
}

// =============================================================================
// RETRY MECHANISM
// =============================================================================

/**
 * Schedule a webhook retry
 */
async function scheduleRetry(
  orgId: string,
  integrationId: string,
  logId: string,
  attemptNumber: number
): Promise<void> {
  if (attemptNumber > MAX_RETRIES) {
    console.log(`[WEBHOOK_DISPATCH] Max retries reached for log ${logId}`);
    return;
  }

  const retryDelay = RETRY_DELAYS[attemptNumber - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  const nextRetryAt = new Date(Date.now() + retryDelay);

  const logRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('webhookLogs')
    .doc(logId);

  await logRef.update({
    status: 'retrying',
    attemptNumber: attemptNumber + 1,
    nextRetryAt,
  });

  console.log(`[WEBHOOK_DISPATCH] Scheduled retry ${attemptNumber + 1} for log ${logId} at ${nextRetryAt.toISOString()}`);
}

/**
 * Process pending webhook retries
 * Should be called by a cron job
 */
export async function processWebhookRetries(): Promise<void> {
  const now = new Date();

  // Get all organizations
  const orgsSnapshot = await adminDb.collection('organizations').get();

  for (const orgDoc of orgsSnapshot.docs) {
    const logsSnapshot = await orgDoc.ref
      .collection('webhookLogs')
      .where('status', '==', 'retrying')
      .where('nextRetryAt', '<=', now)
      .limit(50)
      .get();

    for (const logDoc of logsSnapshot.docs) {
      const log = logDoc.data() as WebhookDeliveryLog;
      
      try {
        await retryWebhook(orgDoc.id, log.integrationId, logDoc.id, log);
      } catch (error) {
        console.error(`[WEBHOOK_RETRY] Error retrying webhook ${logDoc.id}:`, error);
      }
    }
  }
}

/**
 * Retry a failed webhook
 */
async function retryWebhook(
  orgId: string,
  integrationId: string,
  logId: string,
  log: WebhookDeliveryLog
): Promise<void> {
  const integration = await getIntegration(orgId, integrationId as never, true);
  if (!integration || !integration.webhookUrl) {
    await updateDeliveryLog(
      adminDb.collection('organizations').doc(orgId).collection('webhookLogs').doc(logId),
      { status: 'failed', error: 'Integration not found or no webhook URL' }
    );
    return;
  }

  const webhookSecret = await getWebhookSecret(orgId, integrationId);
  const payloadString = JSON.stringify(log.payload);
  const newSignature = webhookSecret 
    ? createWebhookSignature(payloadString, webhookSecret)
    : '';

  const logRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('webhookLogs')
    .doc(logId);

  try {
    const response = await fetchWithTimeout(log.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': log.event,
        'X-Webhook-Signature': newSignature,
        'X-Webhook-Timestamp': log.payload.timestamp,
        'X-Webhook-Id': log.payload.id,
        'X-Webhook-Retry': String(log.attemptNumber),
      },
      body: JSON.stringify({
        ...log.payload,
        signature: newSignature,
      }),
    }, WEBHOOK_TIMEOUT);

    await updateDeliveryLog(logRef, {
      status: 'delivered',
      httpStatus: response.status,
      deliveredAt: FieldValue.serverTimestamp(),
    });

    await updateSyncStatus(orgId, integrationId, 'success');

    console.log(`[WEBHOOK_RETRY] Successfully delivered retry for log ${logId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (log.attemptNumber >= log.maxAttempts) {
      await updateDeliveryLog(logRef, {
        status: 'failed',
        error: errorMessage,
      });
      console.log(`[WEBHOOK_RETRY] Max retries reached for log ${logId}`);
    } else {
      await scheduleRetry(orgId, integrationId, logId, log.attemptNumber);
    }

    await updateSyncStatus(orgId, integrationId, 'error', errorMessage);
  }
}

// =============================================================================
// EVENT HELPERS
// =============================================================================

/**
 * Helper to dispatch check-in completed event
 */
export async function dispatchCheckinCompleted(
  orgId: string,
  data: {
    userId: string;
    userName: string;
    checkinId: string;
    checkinType: 'morning' | 'evening';
    timestamp: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'client.checkin.completed', data);
}

/**
 * Helper to dispatch goal achieved event
 */
export async function dispatchGoalAchieved(
  orgId: string,
  data: {
    userId: string;
    userName: string;
    goalId: string;
    goalTitle: string;
    achievedAt: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'client.goal.achieved', data);
}

/**
 * Helper to dispatch session completed event
 */
export async function dispatchSessionCompleted(
  orgId: string,
  data: {
    sessionId: string;
    clientUserId: string;
    clientName: string;
    coachUserId: string;
    coachName: string;
    durationMinutes: number;
    completedAt: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'coaching.session.completed', data);
}

/**
 * Helper to dispatch program purchased event
 */
export async function dispatchProgramPurchased(
  orgId: string,
  data: {
    userId: string;
    userName: string;
    userEmail: string;
    programId: string;
    programName: string;
    amountPaid: number;
    currency: string;
    purchasedAt: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'program.purchased', data);
}

/**
 * Helper to dispatch squad member joined event
 */
export async function dispatchSquadMemberJoined(
  orgId: string,
  data: {
    userId: string;
    userName: string;
    userEmail: string;
    squadId: string;
    squadName: string;
    joinedAt: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'squad.member.joined', data);
}

/**
 * Helper to dispatch payment received event
 */
export async function dispatchPaymentReceived(
  orgId: string,
  data: {
    userId: string;
    userName: string;
    userEmail: string;
    amount: number;
    currency: string;
    productType: 'program' | 'squad' | 'coaching';
    productId: string;
    productName: string;
    stripePaymentId: string;
    receivedAt: string;
  }
): Promise<void> {
  await dispatchWebhookEvent(orgId, 'payment.received', data);
}

// =============================================================================
// WEBHOOK LOGS API
// =============================================================================

/**
 * Get recent webhook logs for an organization
 */
export async function getWebhookLogs(
  orgId: string,
  limit = 50
): Promise<WebhookDeliveryLog[]> {
  const logsSnapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('webhookLogs')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return logsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as WebhookDeliveryLog[];
}

/**
 * Delete old webhook logs (older than 30 days)
 */
export async function cleanupOldWebhookLogs(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const orgsSnapshot = await adminDb.collection('organizations').get();

  for (const orgDoc of orgsSnapshot.docs) {
    const oldLogsSnapshot = await orgDoc.ref
      .collection('webhookLogs')
      .where('createdAt', '<', cutoffDate)
      .limit(500)
      .get();

    const batch = adminDb.batch();
    oldLogsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    if (!oldLogsSnapshot.empty) {
      await batch.commit();
      console.log(`[WEBHOOK_CLEANUP] Deleted ${oldLogsSnapshot.size} old logs for org ${orgDoc.id}`);
    }
  }
}

