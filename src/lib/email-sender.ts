/**
 * Tenant-Aware Email Sender
 * 
 * This module provides centralized email sending with multi-tenant support.
 * When an organization has a verified email domain, emails are sent from
 * their custom domain. Otherwise, falls back to the platform default.
 * 
 * Usage:
 * ```ts
 * await sendTenantEmail({
 *   to: 'user@example.com',
 *   subject: 'Hello',
 *   html: '<p>Hello World</p>',
 *   organizationId: 'org_123', // or userId to auto-resolve
 * });
 * ```
 */

import { resend, isResendConfigured } from './resend';
import { adminDb } from './firebase-admin';
import type { OrgBranding, FirebaseUser, CoachEmailPreferences, OrgSettings } from '@/types';
import { DEFAULT_COACH_EMAIL_PREFERENCES } from '@/types';

// Platform default senders
export const PLATFORM_DEFAULT_SENDER = 'Growth Addicts <hi@updates.growthaddicts.com>';
export const PLATFORM_AUTH_SENDER = 'Growth Addicts <notifications@growthaddicts.com>';

// App URL for links in emails
export const APP_BASE_URL = process.env.APP_BASE_URL || 'https://pro.growthaddicts.com';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Email notification types that can be enabled/disabled by coaches
 */
export type EmailNotificationType = 
  | 'verification'      // Always enabled
  | 'welcome'           // After successful payment
  | 'abandoned_cart'    // Quiz started but not completed
  | 'morning_reminder'  // Daily morning check-in
  | 'evening_reminder'  // Daily evening reflection
  | 'weekly_reminder'   // Weekend weekly reflection
  | 'payment_failed';   // Always enabled

/**
 * Map from EmailNotificationType to CoachEmailPreferences key
 */
const EMAIL_TYPE_TO_PREFERENCE_KEY: Record<EmailNotificationType, keyof CoachEmailPreferences> = {
  verification: 'verificationEnabled',
  welcome: 'welcomeEnabled',
  abandoned_cart: 'abandonedCartEnabled',
  morning_reminder: 'morningReminderEnabled',
  evening_reminder: 'eveningReminderEnabled',
  weekly_reminder: 'weeklyReminderEnabled',
  payment_failed: 'paymentFailedEnabled',
};

export interface SendTenantEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  organizationId?: string | null;
  userId?: string | null;        // Will lookup org from user if orgId not provided
  replyTo?: string;
  headers?: Record<string, string>;
  emailType?: 'transactional' | 'auth';  // Auth emails use different default sender
}

export interface TenantSender {
  fromAddress: string;
  replyTo?: string;
  organizationId?: string;
  isWhitelabel: boolean;  // True if using tenant's custom domain
}

export interface SendTenantEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sender: TenantSender;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get user by ID from Firestore
 */
async function getUserById(userId: string): Promise<FirebaseUser | null> {
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    return { id: userDoc.id, ...userDoc.data() } as FirebaseUser;
  } catch (error) {
    console.error('[EMAIL_SENDER] Error getting user:', error);
    return null;
  }
}

/**
 * Get organization branding with email settings
 */
async function getOrgBranding(organizationId: string): Promise<OrgBranding | null> {
  try {
    const doc = await adminDb.collection('org_branding').doc(organizationId).get();
    if (!doc.exists) return null;
    return doc.data() as OrgBranding;
  } catch (error) {
    console.error('[EMAIL_SENDER] Error getting org branding:', error);
    return null;
  }
}

/**
 * Get organization settings (including email preferences)
 */
async function getOrgSettings(organizationId: string): Promise<OrgSettings | null> {
  try {
    const doc = await adminDb.collection('org_settings').doc(organizationId).get();
    if (!doc.exists) return null;
    return doc.data() as OrgSettings;
  } catch (error) {
    console.error('[EMAIL_SENDER] Error getting org settings:', error);
    return null;
  }
}

/**
 * Get email preferences for an organization
 * Returns default preferences if not set
 */
export async function getEmailPreferences(organizationId: string | null): Promise<CoachEmailPreferences> {
  if (!organizationId) {
    return DEFAULT_COACH_EMAIL_PREFERENCES;
  }
  
  const settings = await getOrgSettings(organizationId);
  
  return {
    ...DEFAULT_COACH_EMAIL_PREFERENCES,
    ...settings?.emailPreferences,
    // Always force these to true
    verificationEnabled: true,
    paymentFailedEnabled: true,
  };
}

/**
 * Check if a specific email type is enabled for an organization
 * 
 * @param organizationId - The organization ID (null = platform emails, always enabled)
 * @param emailNotificationType - The type of email notification
 * @returns True if the email type is enabled
 */
export async function isEmailTypeEnabled(
  organizationId: string | null,
  emailNotificationType: EmailNotificationType
): Promise<boolean> {
  // Verification and payment_failed emails are always enabled
  if (emailNotificationType === 'verification' || emailNotificationType === 'payment_failed') {
    return true;
  }
  
  // Platform emails (no org) are always enabled
  if (!organizationId) {
    return true;
  }
  
  const preferences = await getEmailPreferences(organizationId);
  const preferenceKey = EMAIL_TYPE_TO_PREFERENCE_KEY[emailNotificationType];
  
  return preferences[preferenceKey] === true;
}

/**
 * Resolve the organization ID from either direct orgId or userId
 */
async function resolveOrganizationId(
  organizationId?: string | null,
  userId?: string | null
): Promise<string | null> {
  if (organizationId) {
    return organizationId;
  }
  
  if (userId) {
    const user = await getUserById(userId);
    return user?.primaryOrganizationId || null;
  }
  
  return null;
}

/**
 * Get the sender configuration for an organization
 * Returns the tenant's custom domain sender if verified, otherwise platform default
 */
export async function getTenantSender(
  organizationId: string | null,
  emailType: 'transactional' | 'auth' = 'transactional'
): Promise<TenantSender> {
  const defaultSender = emailType === 'auth' ? PLATFORM_AUTH_SENDER : PLATFORM_DEFAULT_SENDER;
  
  if (!organizationId) {
    return { 
      fromAddress: defaultSender, 
      isWhitelabel: false 
    };
  }
  
  const branding = await getOrgBranding(organizationId);
  const settings = branding?.emailSettings;
  
  // Check if domain is verified and configured
  if (settings?.status === 'verified' && settings.domain) {
    const fromName = settings.fromName || branding?.appTitle || 'Notifications';
    // Use 'notifications@' for transactional and 'auth@' for authentication emails
    const emailPrefix = emailType === 'auth' ? 'auth' : 'notifications';
    
    return {
      fromAddress: `${fromName} <${emailPrefix}@${settings.domain}>`,
      replyTo: settings.replyTo || undefined,
      organizationId,
      isWhitelabel: true,
    };
  }
  
  return { 
    fromAddress: defaultSender,
    organizationId,
    isWhitelabel: false 
  };
}

/**
 * Get organization branding for template customization
 */
export async function getOrgBrandingForEmail(organizationId: string | null): Promise<{
  appTitle: string;
  logoUrl: string | null;
  colors: { accentLight: string; accentDark: string };
} | null> {
  if (!organizationId) return null;
  
  const branding = await getOrgBranding(organizationId);
  if (!branding) return null;
  
  return {
    appTitle: branding.appTitle,
    logoUrl: branding.logoUrl,
    colors: branding.colors,
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Send an email with tenant-aware sender resolution
 * 
 * This function:
 * 1. Resolves the organization from orgId or userId
 * 2. Gets the tenant's verified email domain (if any)
 * 3. Sends the email from the tenant's domain or falls back to platform
 * 
 * @returns Promise with success status, message ID, and sender info
 */
export async function sendTenantEmail(
  options: SendTenantEmailOptions
): Promise<SendTenantEmailResult> {
  const { 
    to, 
    subject, 
    html, 
    text, 
    organizationId, 
    userId, 
    replyTo, 
    headers,
    emailType = 'transactional' 
  } = options;

  // Check if Resend is configured
  if (!isResendConfigured() || !resend) {
    console.log('[EMAIL_SENDER] Skipping - Resend not configured');
    return {
      success: false,
      error: 'Email service not configured',
      sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
    };
  }

  // Validate required fields
  if (!to || !subject || !html) {
    return {
      success: false,
      error: 'Missing required fields: to, subject, html',
      sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
    };
  }

  try {
    // Resolve organization
    const orgId = await resolveOrganizationId(organizationId, userId);
    
    // Get tenant sender configuration
    const sender = await getTenantSender(orgId, emailType);
    
    // Send via Resend
    const result = await resend.emails.send({
      from: sender.fromAddress,
      to,
      subject,
      html,
      text,
      replyTo: replyTo || sender.replyTo,
      headers,
    });

    if (result.error) {
      console.error('[EMAIL_SENDER] Resend error:', result.error);
      
      // If whitelabel failed, try with platform fallback
      if (sender.isWhitelabel) {
        console.log('[EMAIL_SENDER] Retrying with platform sender...');
        const fallbackResult = await resend.emails.send({
          from: emailType === 'auth' ? PLATFORM_AUTH_SENDER : PLATFORM_DEFAULT_SENDER,
          to,
          subject,
          html,
          text,
          replyTo,
          headers,
        });
        
        if (fallbackResult.error) {
          return {
            success: false,
            error: fallbackResult.error.message,
            sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
          };
        }
        
        console.log('[EMAIL_SENDER] Sent with fallback:', {
          to,
          messageId: fallbackResult.data?.id,
        });
        
        return {
          success: true,
          messageId: fallbackResult.data?.id,
          sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
        };
      }
      
      return {
        success: false,
        error: result.error.message,
        sender,
      };
    }

    console.log('[EMAIL_SENDER] Sent successfully:', {
      to,
      from: sender.fromAddress,
      messageId: result.data?.id,
      isWhitelabel: sender.isWhitelabel,
    });

    return {
      success: true,
      messageId: result.data?.id,
      sender,
    };
  } catch (error) {
    console.error('[EMAIL_SENDER] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
    };
  }
}

/**
 * Convenience function to send email to a user by ID
 * Automatically resolves the user's organization for whitelabeling
 */
export async function sendEmailToUser(
  userId: string,
  options: Omit<SendTenantEmailOptions, 'userId' | 'organizationId'> & { to?: string }
): Promise<SendTenantEmailResult> {
  // Get user to find their email if not provided
  const user = await getUserById(userId);
  
  if (!user) {
    return {
      success: false,
      error: 'User not found',
      sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
    };
  }
  
  const to = options.to || user.email;
  
  if (!to) {
    return {
      success: false,
      error: 'User has no email address',
      sender: { fromAddress: PLATFORM_DEFAULT_SENDER, isWhitelabel: false },
    };
  }
  
  return sendTenantEmail({
    ...options,
    to,
    userId,
    organizationId: user.primaryOrganizationId,
  });
}

/**
 * Get the platform's logo URL, or tenant's logo if whitelabeled
 */
export async function getLogoUrlForEmail(organizationId: string | null): Promise<string> {
  const defaultLogo = `${APP_BASE_URL}/logo.jpg`;
  
  if (!organizationId) return defaultLogo;
  
  const branding = await getOrgBrandingForEmail(organizationId);
  return branding?.logoUrl || defaultLogo;
}

/**
 * Get the app title for email (tenant's title or "Growth Addicts")
 */
export async function getAppTitleForEmail(organizationId: string | null): Promise<string> {
  if (!organizationId) return 'Growth Addicts';
  
  const branding = await getOrgBrandingForEmail(organizationId);
  return branding?.appTitle || 'Growth Addicts';
}

