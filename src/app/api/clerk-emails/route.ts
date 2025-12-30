/**
 * Clerk Email Webhook Handler
 * 
 * Handles email.created events from Clerk to send verification emails
 * via Resend with tenant-specific branding.
 * 
 * When "Delivered by Clerk" is disabled for email templates, Clerk sends
 * a webhook instead. This handler sends the email via Resend.
 */

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import type { OrgBranding } from '@/types';

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
  slug: string;
  data: Record<string, unknown>;
  delivered_by_clerk: boolean;
}

interface ClerkWebhookEvent {
  type: 'email.created';
  data: ClerkEmailPayload;
}

// =============================================================================
// HELPERS
// =============================================================================

async function getUserOrganization(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  
  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return null;
    
    const userData = userDoc.data();
    return userData?.primaryOrganizationId || null;
  } catch (error) {
    console.error('[CLERK_EMAILS] Error getting user org:', error);
    return null;
  }
}

async function getOrgBranding(organizationId: string): Promise<OrgBranding | null> {
  try {
    const doc = await adminDb.collection('org_branding').doc(organizationId).get();
    if (!doc.exists) return null;
    return doc.data() as OrgBranding;
  } catch (error) {
    console.error('[CLERK_EMAILS] Error getting org branding:', error);
    return null;
  }
}

async function getTenantSender(organizationId: string | null): Promise<string> {
  if (!organizationId) return PLATFORM_DEFAULT_SENDER;
  
  const branding = await getOrgBranding(organizationId);
  const settings = branding?.emailSettings;
  
  if (settings?.status === 'verified' && settings.domain) {
    const fromName = settings.fromName || branding?.appTitle || 'Notifications';
    return `${fromName} <auth@${settings.domain}>`;
  }
  
  // Use org's app title with platform sender
  if (branding?.appTitle && branding.appTitle !== 'GrowthAddicts') {
    return `${branding.appTitle} <notifications@growthaddicts.com>`;
  }
  
  return PLATFORM_DEFAULT_SENDER;
}

function customizeEmailContent(
  subject: string,
  htmlBody: string,
  branding: OrgBranding | null
): { subject: string; html: string } {
  let customSubject = subject;
  let customHtml = htmlBody;
  
  if (branding?.appTitle && branding.appTitle !== 'GrowthAddicts') {
    customSubject = customSubject.replace(/GrowthAddicts/g, branding.appTitle);
    customHtml = customHtml.replace(/GrowthAddicts/g, branding.appTitle);
  }
  
  return { subject: customSubject, html: customHtml };
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function POST(req: Request) {
  console.log('[CLERK_EMAILS] Webhook received');
  
  if (!WEBHOOK_SECRET) {
    console.error('[CLERK_EMAILS] CLERK_WEBHOOK_SECRET not set');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  if (!isResendConfigured() || !resend) {
    console.error('[CLERK_EMAILS] Resend not configured');
    return new Response('Email service not configured', { status: 503 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error('[CLERK_EMAILS] Missing svix headers');
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[CLERK_EMAILS] Signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (evt.type !== 'email.created') {
    console.log(`[CLERK_EMAILS] Ignoring event type: ${evt.type}`);
    return new Response('OK', { status: 200 });
  }

  const emailData = evt.data;

  if (emailData.delivered_by_clerk) {
    console.log(`[CLERK_EMAILS] Email ${emailData.id} already delivered by Clerk`);
    return new Response('OK', { status: 200 });
  }

  console.log(`[CLERK_EMAILS] Processing ${emailData.slug} email for ${emailData.to_email_address}`);

  try {
    const organizationId = await getUserOrganization(emailData.user_id);
    const branding = organizationId ? await getOrgBranding(organizationId) : null;
    const fromAddress = await getTenantSender(organizationId);
    const { subject, html } = customizeEmailContent(
      emailData.subject,
      emailData.body,
      branding
    );

    console.log(`[CLERK_EMAILS] Sending from: ${fromAddress}`);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: emailData.to_email_address,
      subject,
      html,
      text: emailData.body_plain || undefined,
      replyTo: branding?.emailSettings?.replyTo || undefined,
    });

    if (error) {
      console.error(`[CLERK_EMAILS] Failed to send:`, error);
      
      // Try fallback sender
      console.log('[CLERK_EMAILS] Retrying with fallback sender...');
      const { error: fallbackError } = await resend.emails.send({
        from: PLATFORM_FALLBACK_SENDER,
        to: emailData.to_email_address,
        subject,
        html,
        text: emailData.body_plain || undefined,
      });
      
      if (fallbackError) {
        console.error('[CLERK_EMAILS] Fallback also failed:', fallbackError);
        return new Response('Email sending failed', { status: 500 });
      }
    }

    console.log(`[CLERK_EMAILS] Sent ${emailData.slug} to ${emailData.to_email_address} (ID: ${data?.id})`);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('[CLERK_EMAILS] Unexpected error:', error);
    return new Response('Internal error', { status: 500 });
  }
}

