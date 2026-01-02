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

// Integration configuration check
export function getConfiguredIntegrations(): Record<string, boolean> {
  return {
    google_calendar: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    google_sheets: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    outlook_calendar: !!(process.env.MICROSOFT_OAUTH_CLIENT_ID && process.env.MICROSOFT_OAUTH_CLIENT_SECRET),
    notion: !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET),
    airtable: !!(process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_CLIENT_SECRET),
    todoist: !!(process.env.TODOIST_CLIENT_ID && process.env.TODOIST_CLIENT_SECRET),
    asana: !!(process.env.ASANA_CLIENT_ID && process.env.ASANA_CLIENT_SECRET),
    slack: !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET),
    discord: true, // Uses webhook URLs, always available
    zapier: true,  // Uses webhook URLs, always available
    make: true,    // Uses webhook URLs, always available
    calcom: true,  // Uses user API keys, always available
    deepgram: !!process.env.DEEPGRAM_API_KEY,
    assemblyai: !!process.env.ASSEMBLYAI_API_KEY,
  };
}
