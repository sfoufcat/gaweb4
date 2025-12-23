/**
 * Clerk Emails Webhook Handler
 * 
 * When "Delivered by Clerk" is disabled for email templates, Clerk sends
 * a webhook instead. This handler intercepts those and sends via Resend
 * with the tenant's custom domain (if configured).
 * 
 * Supported email types:
 * - verification_code: Signup email verification
 * - password_reset: Password reset link
 * - magic_link: Passwordless login
 * - invitation: Organization invitations
 * 
 * For more info: https://clerk.com/docs/webhooks/email-webhooks
 */

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import type { OrgBranding } from '@/types';

// Environment variable for the separate email webhook secret
// Can use same secret or a different one
const WEBHOOK_SECRET = process.env.CLERK_EMAIL_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_SECRET;

const PLATFORM_DEFAULT_SENDER = 'Growth Addicts <notifications@growthaddicts.com>';
const PLATFORM_FALLBACK_SENDER = 'Growth Addicts <hi@updates.growthaddicts.com>';

// =============================================================================
// TYPES
// =============================================================================

interface ClerkEmailPayload {
  object: 'email';
  id: string;
  from_email_name: string;
  to_email_address: string;
  email_address_id: string;
  user_id: string | null;
  subject: string;
  body: string;
  body_plain: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  slug: string; // e.g., 'verification_code', 'password_reset'
  data: Record<string, unknown>; // Template variables like otp, link, etc.
  delivered_by_clerk: boolean;
}

interface ClerkWebhookEvent {
  type: 'email.created';
  data: ClerkEmailPayload;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get user's primary organization ID from Firestore
 */
async function getUserOrganization(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    
    const userData = userDoc.data();
    return userData?.primaryOrganizationId || null;
  } catch (error) {
    console.error('[CLERK_EMAIL_WEBHOOK] Error getting user org:', error);
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
    console.error('[CLERK_EMAIL_WEBHOOK] Error getting org branding:', error);
    return null;
  }
}

/**
 * Get sender address for an organization
 */
async function getTenantSender(organizationId: string | null): Promise<string> {
  if (!organizationId) return PLATFORM_DEFAULT_SENDER;
  
  const branding = await getOrgBranding(organizationId);
  const settings = branding?.emailSettings;
  
  if (settings?.status === 'verified' && settings.domain) {
    const fromName = settings.fromName || branding?.appTitle || 'Notifications';
    return `${fromName} <auth@${settings.domain}>`;
  }
  
  return PLATFORM_DEFAULT_SENDER;
}

/**
 * Customize email subject/body with tenant branding if needed
 */
function customizeEmailContent(
  subject: string,
  htmlBody: string,
  branding: OrgBranding | null
): { subject: string; html: string } {
  // For now, use Clerk's default content
  // Could be enhanced to add custom branding/logo wrapper
  
  // Replace "Clerk" branding with app title if available
  let customSubject = subject;
  let customHtml = htmlBody;
  
  if (branding?.appTitle && branding.appTitle !== 'GrowthAddicts') {
    // Replace generic references with tenant branding
    customSubject = customSubject.replace(/Clerk/g, branding.appTitle);
    customHtml = customHtml.replace(/Clerk/g, branding.appTitle);
  }
  
  return { subject: customSubject, html: customHtml };
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET) {
    console.error('[CLERK_EMAIL_WEBHOOK] CLERK_EMAIL_WEBHOOK_SECRET or CLERK_WEBHOOK_SECRET not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  // Check if Resend is configured
  if (!isResendConfigured() || !resend) {
    console.error('[CLERK_EMAIL_WEBHOOK] Resend not configured');
    return new Response('Email service not configured', { status: 503 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkWebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[CLERK_EMAIL_WEBHOOK] Verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Only handle email.created events
  if (evt.type !== 'email.created') {
    console.log(`[CLERK_EMAIL_WEBHOOK] Ignoring event type: ${evt.type}`);
    return new Response('OK', { status: 200 });
  }

  const emailData = evt.data;

  // Skip if Clerk already delivered this email
  if (emailData.delivered_by_clerk) {
    console.log(`[CLERK_EMAIL_WEBHOOK] Email ${emailData.id} already delivered by Clerk, skipping`);
    return new Response('OK', { status: 200 });
  }

  console.log(`[CLERK_EMAIL_WEBHOOK] Processing ${emailData.slug} email for ${emailData.to_email_address}`);

  try {
    // Get user's organization
    const organizationId = await getUserOrganization(emailData.user_id);
    
    // Get branding for customization
    const branding = organizationId ? await getOrgBranding(organizationId) : null;
    
    // Get tenant-specific sender
    const fromAddress = await getTenantSender(organizationId);
    
    // Customize content with branding
    const { subject, html } = customizeEmailContent(
      emailData.subject,
      emailData.body,
      branding
    );

    // Send via Resend
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: emailData.to_email_address,
      subject,
      html,
      text: emailData.body_plain || undefined,
      replyTo: branding?.emailSettings?.replyTo || undefined,
      headers: {
        'X-Clerk-Email-Id': emailData.id,
        'X-Clerk-Email-Slug': emailData.slug,
      },
    });

    if (error) {
      console.error(`[CLERK_EMAIL_WEBHOOK] Failed to send ${emailData.slug} email:`, error);
      
      // Try with fallback sender
      console.log('[CLERK_EMAIL_WEBHOOK] Retrying with fallback sender...');
      const { error: fallbackError } = await resend.emails.send({
        from: PLATFORM_FALLBACK_SENDER,
        to: emailData.to_email_address,
        subject,
        html,
        text: emailData.body_plain || undefined,
      });
      
      if (fallbackError) {
        console.error('[CLERK_EMAIL_WEBHOOK] Fallback also failed:', fallbackError);
        return new Response('Email sending failed', { status: 500 });
      }
    }

    console.log(`[CLERK_EMAIL_WEBHOOK] Sent ${emailData.slug} email to ${emailData.to_email_address} from ${fromAddress} (ID: ${data?.id})`);

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[CLERK_EMAIL_WEBHOOK] Unexpected error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

