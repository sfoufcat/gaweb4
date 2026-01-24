/**
 * Notification System - Backend Utilities
 * 
 * This module provides the core notification functionality:
 * - notifyUser: Creates in-app notifications and sends emails via Resend
 * - Helper functions for checking existing notifications
 * - Email sending for all notification types
 */

import { adminDb } from './firebase-admin';
import type { NotificationType, Notification, FirebaseUser, OrgSystemNotifications, OrgBranding, OrgEmailTemplates, EmailTemplateType } from '@/types';
import { DEFAULT_SYSTEM_NOTIFICATIONS } from '@/types';
import { sendTenantEmail, APP_BASE_URL, getAppTitleForEmail, isEmailTypeEnabled, type EmailNotificationType, getLogoUrlForEmail } from './email-sender';
import { getTodayInTimezone, DEFAULT_TIMEZONE } from './timezone';
import { renderEmailTemplate, type TemplateVariables } from './email-templates';

/**
 * Map notification type to EmailNotificationType for org-level preference checking
 */
const NOTIFICATION_TYPE_TO_EMAIL_TYPE: Partial<Record<NotificationType, EmailNotificationType>> = {
  morning_checkin: 'morning_reminder',
  evening_checkin_complete_tasks: 'evening_reminder',
  evening_checkin_incomplete_tasks: 'evening_reminder',
  weekly_reflection: 'weekly_reminder',
};

/**
 * Map notification types to email template types for custom templates
 */
const NOTIFICATION_TYPE_TO_TEMPLATE_TYPE: Partial<Record<NotificationType, EmailTemplateType>> = {
  morning_checkin: 'morningReminder',
  evening_checkin_complete_tasks: 'eveningReminder',
  evening_checkin_incomplete_tasks: 'eveningReminder',
  weekly_reflection: 'weeklyReminder',
};

/**
 * Get custom email templates for an organization (if they have verified email domain)
 */
async function getOrgEmailTemplates(organizationId: string | null): Promise<OrgEmailTemplates | null> {
  if (!organizationId) return null;
  
  try {
    const doc = await adminDb.collection('org_branding').doc(organizationId).get();
    if (!doc.exists) return null;
    
    const branding = doc.data() as OrgBranding;
    
    // Only return templates if email domain is verified
    if (branding.emailSettings?.status !== 'verified') {
      return null;
    }
    
    return branding.emailTemplates || null;
  } catch (error) {
    console.error('[NOTIFICATIONS] Error getting org email templates:', error);
    return null;
  }
}

/**
 * Map notification types to their corresponding key in OrgSystemNotifications
 */
const NOTIFICATION_TYPE_TO_SYSTEM_KEY: Record<NotificationType, keyof OrgSystemNotifications | null> = {
  morning_checkin: 'morningCheckIn',
  evening_checkin_complete_tasks: 'eveningCheckIn',
  evening_checkin_incomplete_tasks: 'eveningCheckIn',
  weekly_reflection: 'weeklyReview',
  squad_call_24h: 'squadCall24h',
  squad_call_1h: 'squadCall1h',
  squad_call_live: 'squadCall1h', // Use same setting as 1h for live notifications
  event_reminder_24h: 'squadCall24h',
  event_reminder_1h: 'squadCall1h',
  event_live: 'squadCall1h',
  // Coaching call notifications - always sent (handled by coaching module)
  coaching_call_24h: null,
  coaching_call_1h: null,
  coaching_call_live: null,
  // Feed notifications - always sent
  feed_like: null,
  feed_comment: null,
  feed_repost: null,
  feed_mention: null,
  story_reaction: null,
  // Coach AI fill prompts - always sent
  call_summary_fill_week: null,
  // Intake call notifications - always sent
  intake_call_booked: null,
  intake_call_rescheduled: null,
  intake_call_cancelled: null,
};

/**
 * Get organization's system notification settings
 * Returns defaults if org has no custom settings
 */
async function getOrgSystemNotifications(organizationId?: string): Promise<OrgSystemNotifications> {
  if (!organizationId) {
    return DEFAULT_SYSTEM_NOTIFICATIONS;
  }

  try {
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    if (brandingDoc.exists && brandingDoc.data()?.systemNotifications) {
      return {
        ...DEFAULT_SYSTEM_NOTIFICATIONS,
        ...brandingDoc.data()?.systemNotifications,
      };
    }
  } catch (error) {
    console.error('[NOTIFICATIONS] Error fetching org system notifications:', error);
  }

  return DEFAULT_SYSTEM_NOTIFICATIONS;
}

/**
 * Check if a notification type is enabled for an organization
 */
async function isNotificationTypeEnabled(
  type: NotificationType,
  organizationId?: string
): Promise<boolean> {
  const systemKey = NOTIFICATION_TYPE_TO_SYSTEM_KEY[type];
  
  // Types without a system key mapping are always enabled
  if (systemKey === null) {
    return true;
  }

  const systemNotifications = await getOrgSystemNotifications(organizationId);
  return systemNotifications[systemKey] !== false;
}

export interface NotifyUserInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionRoute?: string;
  organizationId?: string;
  metadata?: {
    summaryId?: string;
    programId?: string;
    weekId?: string;
    clientName?: string;
  };
}

export interface SendNotificationEmailParams {
  user: FirebaseUser;
  type: NotificationType;
  title: string;
  body: string;
  actionRoute?: string;
}

/**
 * Get a friendly name for the user (first name or "there" as fallback)
 */
function friendlyName(user: FirebaseUser): string {
  return user.firstName || 'there';
}

/**
 * Send notification email via Resend
 * 
 * Sends a customized email based on the notification type.
 * Respects user's email preferences stored in user.emailPreferences.
 */
async function sendNotificationEmail({
  user,
  type,
  title,
  body,
  actionRoute,
}: SendNotificationEmailParams): Promise<void> {
  // Skip if user has no email
  if (!user.email) {
    console.log('[NOTIFICATION_EMAIL] Skipping - user has no email:', user.id);
    return;
  }

  // Check organization-level email preferences
  const emailNotificationType = NOTIFICATION_TYPE_TO_EMAIL_TYPE[type];
  if (emailNotificationType) {
    const orgEnabled = await isEmailTypeEnabled(user.primaryOrganizationId || null, emailNotificationType);
    if (!orgEnabled) {
      console.log(`[NOTIFICATION_EMAIL] Skipping ${type} - org ${user.primaryOrganizationId} has disabled this email type`);
      return;
    }
  }

  // Check user's email preferences
  const emailPrefs = user.emailPreferences;
  if (emailPrefs) {
    // Map notification type to preference key
    let preferenceEnabled = true;
    
    switch (type) {
      case 'morning_checkin':
        preferenceEnabled = emailPrefs.morningCheckIn !== false;
        break;
      case 'evening_checkin_complete_tasks':
      case 'evening_checkin_incomplete_tasks':
        preferenceEnabled = emailPrefs.eveningCheckIn !== false;
        break;
      case 'weekly_reflection':
        preferenceEnabled = emailPrefs.weeklyReview !== false;
        break;
      // squad_call types are handled in squad-call-notifications.ts
    }

    if (!preferenceEnabled) {
      console.log(`[NOTIFICATION_EMAIL] Skipping ${type} - user ${user.id} has disabled this email type`);
      return;
    }
  }

  const name = friendlyName(user);
  const url = actionRoute ? `${APP_BASE_URL}${actionRoute}` : APP_BASE_URL;
  
  // Get tenant branding for customization
  const organizationId = user.primaryOrganizationId || null;
  const appTitle = await getAppTitleForEmail(organizationId);
  const logoUrl = await getLogoUrlForEmail(organizationId);
  const teamName = appTitle === 'Coachful' ? 'Coachful' : appTitle;

  // Check for custom template
  const templateType = NOTIFICATION_TYPE_TO_TEMPLATE_TYPE[type];
  const customTemplates = templateType ? await getOrgEmailTemplates(organizationId) : null;

  let subject: string;
  let textBody: string;
  let htmlBody: string | undefined;

  // If there's a custom template, use it
  if (templateType && customTemplates) {
    const templateVars: TemplateVariables = {
      firstName: name,
      appTitle,
      teamName,
      logoUrl,
      ctaUrl: url,
      year: new Date().getFullYear().toString(),
    };
    
    const rendered = renderEmailTemplate(templateType, templateVars, customTemplates);
    subject = rendered.subject;
    htmlBody = rendered.html;
    textBody = `Hi ${name}, ${body} Visit: ${url}`;
  } else {
    // Use default inline templates
    switch (type) {
      case 'morning_checkin':
        subject = 'Your morning check-in is ready 🌅';
        textBody = `Hi ${name},

Your ${teamName} morning check-in is ready.

Take 2–3 minutes to check in and set your focus for today.

Start your morning check-in:
${url}

Keep going,
The ${teamName} Team`.trim();
        break;

      case 'evening_checkin_complete_tasks':
        subject = 'Nice work! Close your day with a quick check-in ✨';
        textBody = `Hi ${name},

Great job! You've completed today's focus tasks.

Take a moment to close your day with a quick reflection.

Complete your evening check-in:
${url}

Proud of your consistency,
The ${teamName} Team`.trim();
        break;

      case 'evening_checkin_incomplete_tasks':
        subject = 'Close your day with a quick reflection 🌙';
        textBody = `Hi ${name},

Not every day is a hit, and that's okay.

Take a moment to check in, reflect on today, and reset for tomorrow.

Complete your evening check-in:
${url}

One step at a time,
The ${teamName} Team`.trim();
      break;

    case 'weekly_reflection':
      subject = 'Reflect on your week and set up the next one 🔁';
      textBody = `Hi ${name},

You've made progress this week. Now is the perfect time to capture it.

Take a few minutes to complete your weekly reflection, review your wins,
and set clear intentions for next week.

Start your weekly reflection:
${url}

On your side,
The ${teamName} Team`.trim();
      break;

    case 'squad_call_24h':
    case 'squad_call_1h':
    case 'squad_call_live':
      // Squad call notifications - emails handled by squad-call-notifications.ts
      // This case is for in-app notifications only, skip email here
      return;

    default:
      // Fallback: generic notification email using title/body
      subject = title || `You have a new update in ${teamName}`;
      textBody = `Hi ${name},

${body || `You have a new notification in ${teamName}.`}

Open ${teamName}:
${url}

The ${teamName} Team`.trim();
    }
  }

  // Send via tenant-aware email sender
  const result = await sendTenantEmail({
    to: user.email,
    subject,
    html: htmlBody || `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${textBody}</pre>`,
    text: textBody,
    organizationId,
    userId: user.id,
  });

  console.log('[NOTIFICATION_EMAIL] Sent:', {
    userId: user.id,
    type,
    to: user.email,
    messageId: result.messageId,
    isWhitelabel: result.sender.isWhitelabel,
  });
}

/**
 * Get user by ID from Firestore
 */
async function getUserById(userId: string): Promise<FirebaseUser | null> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    return null;
  }
  return { id: userDoc.id, ...userDoc.data() } as FirebaseUser;
}

/**
 * Main notification function - creates in-app notification and sends email
 * 
 * All notification triggers should call this function to ensure consistent behavior.
 * This is the single source of truth for creating notifications.
 * 
 * IMPORTANT: Checks org-level system notifications settings first.
 * If disabled, neither in-app notification nor email is sent.
 * 
 * Email is sent automatically for all users whenever a notification is created.
 * The upstream business rules (one evening notification per day, one weekly per week, etc.)
 * are enforced BEFORE calling this function, so email sending respects those rules.
 */
export async function notifyUser(input: NotifyUserInput): Promise<string | null> {
  const { userId, type, title, body, actionRoute, organizationId, metadata } = input;

  // Check if this notification type is enabled at org level
  const isEnabled = await isNotificationTypeEnabled(type, organizationId);
  if (!isEnabled) {
    console.log(`[NOTIFY_USER] Skipping ${type} - disabled at org level for org ${organizationId}`);
    return null;
  }

  // 1) Create in-app notification document
  // Note: organizationId is required for multi-tenancy, but we support legacy notifications without it
  const notificationData = {
    userId,
    type,
    title,
    body,
    actionRoute: actionRoute ?? undefined,
    createdAt: new Date().toISOString(),
    read: false,
    ...(organizationId && { organizationId }),
    ...(metadata && { metadata }),
  } as Omit<Notification, 'id'>;

  const notificationRef = await adminDb.collection('notifications').add(notificationData);

  // 2) Fetch user and send email via Resend
  try {
    const user = await getUserById(userId);
    if (user) {
      // Send email immediately when the notification is created.
      // This ensures "only one evening notification per day" etc. rules
      // are automatically respected, because we already enforce that
      // BEFORE calling notifyUser.
      await sendNotificationEmail({
        user,
        type,
        title,
        body,
        actionRoute,
      });
    }
  } catch (emailError) {
    // Don't fail the notification creation if email fails
    console.error('[NOTIFY_USER] Email sending failed:', { userId, type, error: emailError });
  }

  return notificationRef.id;
}

/**
 * Check if a notification of a specific type exists for today
 * Used to prevent duplicate notifications (e.g., multiple morning reminders)
 * 
 * @param userId The user's ID
 * @param type The notification type to check
 * @param timezone Optional: User's timezone for accurate "today" calculation
 * @param organizationId Optional: Organization ID for multi-tenancy
 */
export async function hasNotificationForToday(
  userId: string,
  type: NotificationType,
  timezone?: string,
  organizationId?: string
): Promise<boolean> {
  // Get today's date in the user's timezone
  const todayStr = getTodayInTimezone(timezone || DEFAULT_TIMEZONE);
  const todayStart = new Date(todayStr + 'T00:00:00.000Z').toISOString();

  let query = adminDb
    .collection('notifications')
    .where('userId', '==', userId)
    .where('type', '==', type)
    .where('createdAt', '>=', todayStart);

  // Filter by organization if provided (for multi-tenancy)
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }

  const snapshot = await query.limit(1).get();

  return !snapshot.empty;
}

/**
 * Check if any evening notification type exists for today
 * Used to ensure only one evening notification (complete OR incomplete) per day
 * 
 * @param userId The user's ID
 * @param timezone Optional: User's timezone for accurate "today" calculation
 * @param organizationId Optional: Organization ID for multi-tenancy
 */
export async function hasAnyEveningNotificationForToday(
  userId: string,
  timezone?: string,
  organizationId?: string
): Promise<boolean> {
  // Get today's date in the user's timezone
  const todayStr = getTodayInTimezone(timezone || DEFAULT_TIMEZONE);
  const todayStart = new Date(todayStr + 'T00:00:00.000Z').toISOString();

  // Check for either type of evening notification
  const eveningTypes: NotificationType[] = [
    'evening_checkin_complete_tasks',
    'evening_checkin_incomplete_tasks',
  ];

  for (const type of eveningTypes) {
    let query = adminDb
      .collection('notifications')
      .where('userId', '==', userId)
      .where('type', '==', type)
      .where('createdAt', '>=', todayStart);

    // Filter by organization if provided (for multi-tenancy)
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    const snapshot = await query.limit(1).get();

    if (!snapshot.empty) {
      return true;
    }
  }

  return false;
}

/**
 * Get week identifier for weekly reflection notifications
 * Returns year-weekNumber format (e.g., "2024-48")
 */
export function getWeekIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Check if a weekly reflection notification exists for the current week
 * 
 * @param userId The user's ID
 * @param organizationId Optional: Organization ID for multi-tenancy
 */
export async function hasWeeklyReflectionNotificationForThisWeek(
  userId: string,
  organizationId?: string
): Promise<boolean> {
  
  // Get start and end of current week
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  let query = adminDb
    .collection('notifications')
    .where('userId', '==', userId)
    .where('type', '==', 'weekly_reflection')
    .where('createdAt', '>=', monday.toISOString())
    .where('createdAt', '<=', sunday.toISOString());

  // Filter by organization if provided (for multi-tenancy)
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }

  const snapshot = await query.limit(1).get();

  return !snapshot.empty;
}

/**
 * Mark all unread notifications as read for a user within an organization
 * Called when user opens the notification panel
 */
export async function markAllNotificationsAsRead(userId: string, organizationId?: string): Promise<number> {
  let query = adminDb
    .collection('notifications')
    .where('userId', '==', userId)
    .where('read', '==', false);

  // Filter by organization if provided (for multi-tenancy)
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
  return snapshot.size;
}

/**
 * Mark a single notification as read
 * Optionally verify it belongs to the given organization
 */
export async function markNotificationAsRead(notificationId: string, organizationId?: string): Promise<void> {
  if (organizationId) {
    // Verify the notification belongs to this organization before updating
    const doc = await adminDb.collection('notifications').doc(notificationId).get();
    if (doc.exists && doc.data()?.organizationId !== organizationId) {
      throw new Error('Notification does not belong to this organization');
    }
  }
  
  await adminDb.collection('notifications').doc(notificationId).update({
    read: true,
  });
}

/**
 * Get user's unread notification count within an organization
 */
export async function getUnreadNotificationCount(userId: string, organizationId?: string): Promise<number> {
  let query = adminDb
    .collection('notifications')
    .where('userId', '==', userId)
    .where('read', '==', false);

  // Filter by organization if provided (for multi-tenancy)
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }

  const snapshot = await query.get();

  return snapshot.size;
}

/**
 * Get user's recent notifications (for display in panel) within an organization
 */
export async function getUserNotifications(
  userId: string,
  limit: number = 20,
  organizationId?: string
): Promise<Notification[]> {
  let query = adminDb
    .collection('notifications')
    .where('userId', '==', userId);

  // Filter by organization if provided (for multi-tenancy)
  if (organizationId) {
    query = query.where('organizationId', '==', organizationId);
  }

  const snapshot = await query
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Notification[];
}

// ===========================================
// Notification Trigger Functions
// ===========================================

/**
 * Send morning check-in reminder
 * Called by scheduled job or when conditions are met
 */
export async function sendMorningCheckInNotification(userId: string): Promise<string | null> {
  // Get user's timezone and organization for accurate "today" check
  const user = await getUserById(userId);
  const timezone = user?.timezone;
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user?.primaryOrganizationId || user?.organizationId;

  // Check if already sent today (scoped by organization for multi-tenancy)
  const alreadySent = await hasNotificationForToday(userId, 'morning_checkin', timezone, organizationId);
  if (alreadySent) {
    return null;
  }

  return notifyUser({
    userId,
    type: 'morning_checkin',
    title: 'Your morning check-in is ready',
    body: "Start your day strong by checking in and setting today's focus.",
    actionRoute: '/checkin/flow/morning',
    organizationId,
  });
}

/**
 * Send notification when all 3 daily focus tasks are completed
 */
export async function sendTasksCompletedNotification(userId: string): Promise<string | null> {
  // Get user's timezone and organization for accurate "today" check
  const user = await getUserById(userId);
  const timezone = user?.timezone;
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user?.primaryOrganizationId || user?.organizationId;

  // Check if ANY evening notification already exists for today (scoped by organization)
  const alreadySent = await hasAnyEveningNotificationForToday(userId, timezone, organizationId);
  if (alreadySent) {
    return null;
  }

  return notifyUser({
    userId,
    type: 'evening_checkin_complete_tasks',
    title: "Nice work! You completed today's focus",
    body: "You've finished your big three. Complete your evening check-in to close the day.",
    actionRoute: '/checkin/flow/evening',
    organizationId,
  });
}

/**
 * Send evening reminder when tasks not completed
 * Called by scheduled job around 5 PM local time
 */
export async function sendEveningReminderNotification(userId: string): Promise<string | null> {
  // Get user's timezone and organization for accurate "today" check
  const user = await getUserById(userId);
  const timezone = user?.timezone;
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user?.primaryOrganizationId || user?.organizationId;

  // Check if ANY evening notification already exists for today (scoped by organization)
  const alreadySent = await hasAnyEveningNotificationForToday(userId, timezone, organizationId);
  if (alreadySent) {
    return null;
  }

  return notifyUser({
    userId,
    type: 'evening_checkin_incomplete_tasks',
    title: 'Close your day with a quick check-in',
    body: "Not every day is a hit, and that's okay. Take a moment to reflect and close your day.",
    actionRoute: '/checkin/flow/evening',
    organizationId,
  });
}

/**
 * Send weekly reflection notification
 * Called after Friday evening check-in or on weekend
 */
export async function sendWeeklyReflectionNotification(
  userId: string,
  isAfterFridayEvening: boolean = false
): Promise<string | null> {
  // Get user's organization for multi-tenancy
  const user = await getUserById(userId);
  // Fallback to organizationId for users enrolled via funnel (which sets organizationId, not primaryOrganizationId)
  const organizationId = user?.primaryOrganizationId || user?.organizationId;

  // Check if already sent this week (scoped by organization)
  const alreadySent = await hasWeeklyReflectionNotificationForThisWeek(userId, organizationId);
  if (alreadySent) {
    return null;
  }

  const title = isAfterFridayEvening ? 'Great work this week' : 'Reflect on your week';
  const body = isAfterFridayEvening
    ? "You've closed out your week. Complete your weekly reflection to capture your wins and lessons."
    : 'Take a few minutes to reflect on your progress and set the tone for next week.';

  return notifyUser({
    userId,
    type: 'weekly_reflection',
    title,
    body,
    actionRoute: '/checkin/weekly/checkin',
    organizationId,
  });
}

