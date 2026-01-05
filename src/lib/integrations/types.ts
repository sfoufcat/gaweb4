/**
 * Coach Integrations Type Definitions
 * 
 * Type definitions for third-party service integrations available to coaches.
 * Integrations allow coaches to connect external tools like calendars, 
 * task managers, and automation platforms.
 */

import type { Timestamp } from 'firebase-admin/firestore';

// =============================================================================
// INTEGRATION PROVIDERS
// =============================================================================

/**
 * Supported integration providers
 */
export type IntegrationProvider =
  | 'google_calendar'   // Google Calendar for event sync + Meet links
  | 'google_sheets'     // Google Sheets for data export
  | 'outlook_calendar'  // Microsoft Outlook/365 Calendar
  | 'notion'            // Notion for knowledge export
  | 'airtable'          // Airtable for flexible data export
  | 'todoist'           // Todoist task management
  | 'asana'             // Asana task management
  | 'slack'             // Slack notifications
  | 'discord'           // Discord notifications
  | 'zapier'            // Zapier webhook automation
  | 'make'              // Make (Integromat) webhook automation
  | 'calcom'            // Cal.com external scheduling
  | 'zoom';             // Zoom video meetings

/**
 * Integration category for UI grouping
 */
export type IntegrationCategory =
  | 'calendar'      // Calendar sync + video meeting integrations
  | 'data'          // Data export integrations
  | 'tasks'         // Task management integrations
  | 'notifications' // Notification integrations
  | 'automation'    // Webhook/automation integrations
  | 'scheduling'    // External scheduling links
  | 'knowledge';    // Knowledge base export

/**
 * Provider metadata for display and configuration
 */
export interface IntegrationProviderMeta {
  id: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon: string;  // Lucide icon name or URL
  authType: 'oauth2' | 'api_key' | 'webhook';
  scopes?: string[];
  requiredTier?: 'starter' | 'pro' | 'scale';
  docsUrl?: string;
}

/**
 * All available integration providers with metadata
 */
export const INTEGRATION_PROVIDERS: Record<IntegrationProvider, IntegrationProviderMeta> = {
  google_calendar: {
    id: 'google_calendar',
    name: 'Google',
    description: 'Sync events to Google Calendar and create Google Meet links',
    category: 'calendar',
    icon: 'Calendar',
    authType: 'oauth2',
    scopes: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    requiredTier: 'starter',
    docsUrl: 'https://developers.google.com/calendar',
  },
  google_sheets: {
    id: 'google_sheets',
    name: 'Google Sheets',
    description: 'Export client data and reports to Google Sheets',
    category: 'data',
    icon: 'Table',
    authType: 'oauth2',
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
    requiredTier: 'pro',
    docsUrl: 'https://developers.google.com/sheets',
  },
  outlook_calendar: {
    id: 'outlook_calendar',
    name: 'Outlook Calendar',
    description: 'Sync coaching sessions and events to Microsoft Outlook',
    category: 'calendar',
    icon: 'Calendar',
    authType: 'oauth2',
    scopes: ['Calendars.ReadWrite', 'offline_access'],
    requiredTier: 'starter',
    docsUrl: 'https://docs.microsoft.com/en-us/graph/api/resources/calendar',
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    description: 'Export client progress and session notes to Notion',
    category: 'knowledge',
    icon: 'FileText',
    authType: 'oauth2',
    requiredTier: 'pro',
    docsUrl: 'https://developers.notion.com',
  },
  airtable: {
    id: 'airtable',
    name: 'Airtable',
    description: 'Export data to Airtable bases for flexible reporting',
    category: 'data',
    icon: 'Database',
    authType: 'oauth2',
    scopes: ['data.records:read', 'data.records:write', 'schema.bases:read'],
    requiredTier: 'pro',
    docsUrl: 'https://airtable.com/developers/web/api',
  },
  todoist: {
    id: 'todoist',
    name: 'Todoist',
    description: 'Sync client tasks and assignments with Todoist',
    category: 'tasks',
    icon: 'CheckSquare',
    authType: 'oauth2',
    scopes: ['data:read_write'],
    requiredTier: 'pro',
    docsUrl: 'https://developer.todoist.com',
  },
  asana: {
    id: 'asana',
    name: 'Asana',
    description: 'Sync client tasks and assignments with Asana',
    category: 'tasks',
    icon: 'CheckSquare',
    authType: 'oauth2',
    requiredTier: 'pro',
    docsUrl: 'https://developers.asana.com',
  },
  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Get notified of client activity in Slack channels',
    category: 'notifications',
    icon: 'MessageSquare',
    authType: 'oauth2',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    requiredTier: 'pro',
    docsUrl: 'https://api.slack.com/docs',
  },
  discord: {
    id: 'discord',
    name: 'Discord',
    description: 'Send notifications to your Discord community',
    category: 'notifications',
    icon: 'MessageCircle',
    authType: 'webhook',
    requiredTier: 'pro',
    docsUrl: 'https://discord.com/developers/docs/resources/webhook',
  },
  zapier: {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect to 5000+ apps via Zapier webhooks',
    category: 'automation',
    icon: 'Zap',
    authType: 'webhook',
    requiredTier: 'pro',
    docsUrl: 'https://zapier.com/apps/webhooks',
  },
  make: {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Powerful workflow automation with Make',
    category: 'automation',
    icon: 'Workflow',
    authType: 'webhook',
    requiredTier: 'pro',
    docsUrl: 'https://www.make.com/en/integrations/webhooks',
  },
  calcom: {
    id: 'calcom',
    name: 'Cal.com',
    description: 'Embed external scheduling links for clients',
    category: 'scheduling',
    icon: 'CalendarPlus',
    authType: 'api_key',
    requiredTier: 'pro',
    docsUrl: 'https://cal.com/docs/api',
  },
  zoom: {
    id: 'zoom',
    name: 'Zoom',
    description: 'Auto-create Zoom meetings for coaching calls and squad sessions',
    category: 'calendar',
    icon: 'Video',
    authType: 'oauth2',
    scopes: ['meeting:write:admin', 'meeting:read:admin', 'user:read'],
    requiredTier: 'starter',
    docsUrl: 'https://developers.zoom.us/docs',
  },
};

// =============================================================================
// INTEGRATION STORAGE TYPES
// =============================================================================

/**
 * Connection status for an integration
 */
export type IntegrationStatus = 
  | 'connected'     // Successfully connected and active
  | 'disconnected'  // User disconnected
  | 'expired'       // Token expired, needs refresh
  | 'error';        // Connection error

/**
 * Coach Integration stored in Firestore
 * Path: organizations/{orgId}/integrations/{integrationId}
 */
export interface CoachIntegration {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  
  // OAuth tokens (encrypted)
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: Timestamp | string;
  
  // API key (encrypted, for api_key auth type)
  apiKey?: string;
  
  // Webhook URL (for webhook auth type)
  webhookUrl?: string;
  webhookSecret?: string;
  
  // OAuth metadata
  scopes?: string[];
  accountId?: string;      // External account ID
  accountEmail?: string;   // External account email
  accountName?: string;    // External account display name
  
  // Sync state
  lastSyncAt?: Timestamp | string;
  lastSyncStatus?: 'success' | 'error';
  lastSyncError?: string;
  syncEnabled: boolean;
  
  // Provider-specific settings
  settings: IntegrationSettings;
  
  // Timestamps
  connectedAt: Timestamp | string;
  updatedAt: Timestamp | string;
  connectedBy: string; // userId who connected
}

/**
 * Provider-specific settings union type
 */
export type IntegrationSettings =
  | GoogleCalendarSettings
  | GoogleSheetsSettings
  | OutlookCalendarSettings
  | NotionSettings
  | AirtableSettings
  | TodoistSettings
  | AsanaSettings
  | SlackSettings
  | DiscordSettings
  | WebhookSettings
  | CalcomSettings
  | ZoomSettings;

/**
 * Google Calendar specific settings
 */
export interface GoogleCalendarSettings {
  provider: 'google_calendar';
  calendarId: string;           // Which calendar to sync to
  syncDirection: 'one_way' | 'two_way';
  autoCreateEvents: boolean;
  eventPrefix?: string;         // Prefix for created events
  reminderMinutes?: number;
  // Feature toggles
  enableCalendarSync: boolean;  // Sync events to Google Calendar
  enableMeetLinks: boolean;     // Auto-create Google Meet links
}

/**
 * Google Sheets specific settings
 */
export interface GoogleSheetsSettings {
  provider: 'google_sheets';
  spreadsheetId?: string;       // Default spreadsheet ID
  autoExport: boolean;
  exportClients: boolean;
  exportCheckins: boolean;
  exportGoals: boolean;
  exportPayments: boolean;
}

/**
 * Outlook Calendar specific settings
 */
export interface OutlookCalendarSettings {
  provider: 'outlook_calendar';
  calendarId: string;
  syncDirection: 'one_way' | 'two_way';
  autoCreateEvents: boolean;
  eventPrefix?: string;
  reminderMinutes?: number;
}

/**
 * Notion specific settings
 */
export interface NotionSettings {
  provider: 'notion';
  workspaceId: string;
  databaseId?: string;          // Client database ID
  templatePageId?: string;      // Template for new pages
  autoExport: boolean;
  exportCheckins: boolean;
  exportSessionNotes: boolean;
}

/**
 * Airtable specific settings
 */
export interface AirtableSettings {
  provider: 'airtable';
  baseId?: string;              // Default Airtable base ID
  clientsTableId?: string;      // Table for clients
  sessionsTableId?: string;     // Table for sessions
  checkinsTableId?: string;     // Table for check-ins
  autoExport: boolean;
}

/**
 * Todoist specific settings
 */
export interface TodoistSettings {
  provider: 'todoist';
  projectId?: string;           // Default project for tasks
  syncCompleted: boolean;       // Sync completion status back
  labelId?: string;             // Label to apply to synced tasks
}

/**
 * Asana specific settings
 */
export interface AsanaSettings {
  provider: 'asana';
  workspaceId: string;
  projectId?: string;
  syncCompleted: boolean;
  sectionId?: string;           // Section for new tasks
}

/**
 * Slack specific settings
 */
export interface SlackSettings {
  provider: 'slack';
  teamId: string;               // Slack workspace ID
  defaultChannelId?: string;    // Default channel for notifications
  notifyCheckins: boolean;
  notifyGoals: boolean;
  notifyPayments: boolean;
  notifyNewClients: boolean;
}

/**
 * Discord specific settings
 */
export interface DiscordSettings {
  provider: 'discord';
  guildId?: string;             // Discord server ID
  notifyCheckins: boolean;
  notifyGoals: boolean;
  notifyPayments: boolean;
  notifyNewClients: boolean;
}

/**
 * Webhook (Zapier/Make) settings
 */
export interface WebhookSettings {
  provider: 'zapier' | 'make';
  events: WebhookEventType[];   // Which events to send
  includeClientData: boolean;   // Include client PII
  retryOnFailure: boolean;
  maxRetries?: number;
}

/**
 * Cal.com specific settings
 */
export interface CalcomSettings {
  provider: 'calcom';
  username?: string;            // Cal.com username
  eventTypeSlug?: string;       // Default event type
  embedEnabled: boolean;        // Show embedded booking widget
  autoCreateLinks: boolean;     // Auto-create booking links for clients
}

/**
 * Zoom meeting settings
 */
export interface ZoomSettings {
  provider: 'zoom';
  autoCreateMeetings: boolean;  // Auto-create meetings when scheduling calls
  defaultDurationMinutes: number;
  enableWaitingRoom: boolean;
  enableRecording: boolean;
}

// =============================================================================
// WEBHOOK EVENTS
// =============================================================================

/**
 * Events that can trigger outbound webhooks
 */
export type WebhookEventType =
  | 'client.checkin.completed'
  | 'client.checkin.missed'
  | 'client.goal.created'
  | 'client.goal.achieved'
  | 'client.goal.updated'
  | 'client.habit.completed'
  | 'coaching.session.scheduled'
  | 'coaching.session.completed'
  | 'coaching.session.cancelled'
  | 'coaching.note.created'
  | 'program.purchased'
  | 'program.completed'
  | 'squad.member.joined'
  | 'squad.member.left'
  | 'squad.call.scheduled'
  | 'squad.call.completed'
  | 'payment.received'
  | 'payment.failed';

/**
 * Webhook event metadata
 */
export const WEBHOOK_EVENTS: Record<WebhookEventType, { name: string; description: string; category: string }> = {
  'client.checkin.completed': {
    name: 'Check-in Completed',
    description: 'Triggered when a client completes their daily check-in',
    category: 'Check-ins',
  },
  'client.checkin.missed': {
    name: 'Check-in Missed',
    description: 'Triggered when a client misses their check-in window',
    category: 'Check-ins',
  },
  'client.goal.created': {
    name: 'Goal Created',
    description: 'Triggered when a client creates a new goal',
    category: 'Goals',
  },
  'client.goal.achieved': {
    name: 'Goal Achieved',
    description: 'Triggered when a client marks a goal as achieved',
    category: 'Goals',
  },
  'client.goal.updated': {
    name: 'Goal Updated',
    description: 'Triggered when a client updates their goal',
    category: 'Goals',
  },
  'client.habit.completed': {
    name: 'Habit Completed',
    description: 'Triggered when a client completes a habit for the day',
    category: 'Habits',
  },
  'coaching.session.scheduled': {
    name: 'Session Scheduled',
    description: 'Triggered when a coaching session is scheduled',
    category: 'Coaching',
  },
  'coaching.session.completed': {
    name: 'Session Completed',
    description: 'Triggered when a coaching session ends',
    category: 'Coaching',
  },
  'coaching.session.cancelled': {
    name: 'Session Cancelled',
    description: 'Triggered when a coaching session is cancelled',
    category: 'Coaching',
  },
  'coaching.note.created': {
    name: 'Note Created',
    description: 'Triggered when a coach creates a session note',
    category: 'Coaching',
  },
  'program.purchased': {
    name: 'Program Purchased',
    description: 'Triggered when a client purchases a program',
    category: 'Programs',
  },
  'program.completed': {
    name: 'Program Completed',
    description: 'Triggered when a client completes a program',
    category: 'Programs',
  },
  'squad.member.joined': {
    name: 'Squad Member Joined',
    description: 'Triggered when someone joins a squad',
    category: 'Squads',
  },
  'squad.member.left': {
    name: 'Squad Member Left',
    description: 'Triggered when someone leaves a squad',
    category: 'Squads',
  },
  'squad.call.scheduled': {
    name: 'Squad Call Scheduled',
    description: 'Triggered when a squad call is scheduled',
    category: 'Squads',
  },
  'squad.call.completed': {
    name: 'Squad Call Completed',
    description: 'Triggered when a squad call ends',
    category: 'Squads',
  },
  'payment.received': {
    name: 'Payment Received',
    description: 'Triggered when a payment is successfully processed',
    category: 'Payments',
  },
  'payment.failed': {
    name: 'Payment Failed',
    description: 'Triggered when a payment fails',
    category: 'Payments',
  },
};

// =============================================================================
// WEBHOOK PAYLOAD TYPES
// =============================================================================

/**
 * Base webhook payload structure
 */
export interface WebhookPayload<T = unknown> {
  id: string;                   // Unique event ID
  event: WebhookEventType;
  timestamp: string;            // ISO timestamp
  organizationId: string;
  data: T;
  signature: string;            // HMAC signature for verification
}

/**
 * Webhook delivery log
 * Path: organizations/{orgId}/webhookLogs/{logId}
 */
export interface WebhookDeliveryLog {
  id: string;
  integrationId: string;
  event: WebhookEventType;
  webhookUrl: string;
  payload: WebhookPayload;
  
  // Delivery status
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  httpStatus?: number;
  responseBody?: string;
  error?: string;
  
  // Retry tracking
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt?: Timestamp | string;
  
  // Timestamps
  createdAt: Timestamp | string;
  deliveredAt?: Timestamp | string;
}

// =============================================================================
// CALENDAR SYNC TYPES
// =============================================================================

/**
 * Calendar event sync record
 * Tracks mapping between internal events and external calendar events
 */
export interface CalendarSyncRecord {
  id: string;
  integrationId: string;
  provider: 'google_calendar' | 'outlook_calendar';
  
  // Internal event reference
  internalEventType: 'coaching_session' | 'squad_call' | 'workshop' | 'event';
  internalEventId: string;
  
  // External calendar reference
  externalEventId: string;
  externalCalendarId: string;
  
  // Sync metadata
  lastSyncedAt: Timestamp | string;
  syncDirection: 'pushed' | 'pulled';
  syncHash: string;             // Hash of event data for change detection
}

// =============================================================================
// NOTION EXPORT TYPES
// =============================================================================

/**
 * Notion export record
 */
export interface NotionExportRecord {
  id: string;
  integrationId: string;
  
  // Internal reference
  exportType: 'client' | 'session' | 'checkin' | 'goal';
  internalId: string;
  
  // Notion reference
  notionPageId: string;
  notionUrl: string;
  
  // Sync state
  lastExportedAt: Timestamp | string;
  exportHash: string;
}

// =============================================================================
// TASK SYNC TYPES
// =============================================================================

/**
 * Task sync record
 * Tracks mapping between internal tasks and external task manager
 */
export interface TaskSyncRecord {
  id: string;
  integrationId: string;
  provider: 'todoist' | 'asana';
  
  // Internal task reference
  internalTaskType: 'daily_focus' | 'program_task' | 'coach_assigned';
  internalTaskId: string;
  clientUserId: string;
  
  // External task reference
  externalTaskId: string;
  externalProjectId?: string;
  
  // Sync state
  lastSyncedAt: Timestamp | string;
  syncDirection: 'pushed' | 'pulled';
  isCompleted: boolean;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Integration list response
 */
export interface IntegrationListResponse {
  integrations: CoachIntegration[];
  available: IntegrationProviderMeta[];
}

/**
 * OAuth initiation response
 */
export interface OAuthInitResponse {
  authUrl: string;
  state: string;
}

/**
 * Integration connect response
 */
export interface IntegrationConnectResponse {
  success: boolean;
  integration?: CoachIntegration;
  error?: string;
}

