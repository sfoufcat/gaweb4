/**
 * Coach Integrations Module
 * 
 * Central export for all integration-related functionality.
 */

// Types
export * from './types';

// Token management
export {
  encryptToken,
  decryptToken,
  storeIntegration,
  getIntegration,
  getIntegrationById,
  listIntegrations,
  updateTokens,
  updateIntegrationSettings,
  updateIntegrationStatus,
  updateSyncStatus,
  disconnectIntegration,
  storeWebhookIntegration,
  storeApiKeyIntegration,
  getWebhookSecret,
  getApiKey,
  needsTokenRefresh,
  getIntegrationsNeedingRefresh,
  createWebhookSignature,
  verifyWebhookSignature,
} from './token-manager';

// OAuth providers (will be added)
// export * from './oauth/google';
// export * from './oauth/microsoft';
// export * from './oauth/notion';
// export * from './oauth/todoist';
// export * from './oauth/asana';

// Webhook dispatcher
export {
  dispatchWebhookEvent,
  dispatchCheckinCompleted,
  dispatchGoalAchieved,
  dispatchSessionCompleted,
  dispatchProgramPurchased,
  dispatchSquadMemberJoined,
  dispatchPaymentReceived,
  processWebhookRetries,
  getWebhookLogs,
  cleanupOldWebhookLogs,
} from './webhook-dispatcher';

// Calendar sync
export {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  syncCoachingSessionToCalendar,
  syncSquadCallToCalendar,
} from './google-calendar';

export {
  createOutlookCalendarEvent,
  updateOutlookCalendarEvent,
  deleteOutlookCalendarEvent,
  syncCoachingSessionToOutlookCalendar,
  syncSquadCallToOutlookCalendar,
} from './outlook-calendar';

// Transcription
export {
  transcribeCall,
  getTranscription,
  getTranscriptionById,
  listTranscriptions,
  deleteTranscription,
} from './transcription';

// Task sync
export {
  createTodoistTask,
  completeTodoistTask,
  deleteTodoistTask,
  createAsanaTask,
  completeAsanaTask,
  deleteAsanaTask,
  syncTaskToExternalManagers,
  completeTaskInExternalManagers,
} from './task-sync';

// Notion export
export {
  ensureClientsDatabase,
  exportClientToNotion,
  exportSessionNotesToNotion,
  exportCheckinToNotion,
  exportGoalToNotion,
  listNotionExports,
} from './notion';

// Google Sheets
export {
  getGoogleSheetsAuthUrl,
  exchangeGoogleSheetsCodeForTokens,
  refreshGoogleSheetsToken,
  createSpreadsheet,
  writeToSheet,
  appendToSheet,
  readFromSheet,
  exportClientsToSheet,
  exportCheckinsToSheet,
  exportGoalsToSheet,
  isGoogleSheetsConfigured,
} from './google-sheets';

// Slack
export {
  getSlackAuthUrl,
  exchangeSlackCodeForTokens,
  listSlackChannels,
  sendSlackMessage,
  sendSlackNotification,
  isSlackConfigured,
} from './slack';

// Discord
export {
  getDiscordAuthUrl,
  exchangeDiscordCodeForTokens,
  sendDiscordWebhook,
  sendDiscordNotification,
  validateDiscordWebhook,
  isDiscordConfigured,
} from './discord';

// Airtable
export {
  getAirtableAuthUrl,
  exchangeAirtableCodeForTokens,
  refreshAirtableToken,
  listAirtableBases,
  getAirtableBaseSchema,
  createAirtableRecords,
  updateAirtableRecords,
  listAirtableRecords,
  deleteAirtableRecords,
  exportClientsToAirtable,
  exportCheckinsToAirtable,
  isAirtableConfigured,
} from './airtable';

// Cal.com
export {
  getCalcomEventTypes,
  getCalcomBookings,
  createCalcomEventType,
  updateCalcomEventType,
  deleteCalcomEventType,
  buildCalcomBookingUrl,
  generateCalcomEmbedCode,
  validateCalcomApiKey,
  createClientBookingLink,
  isCalcomConfigured,
} from './calcom';

// Integration configuration check - server-side only
// This function checks which integrations have their OAuth credentials configured
export { getConfiguredIntegrations } from './config';
