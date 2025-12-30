/**
 * Email Utilities for Onboarding Flows
 * 
 * This module provides email helpers for:
 * - Welcome email (sent when user becomes a member)
 * - Abandoned quiz/payment email (sent 15 min after quiz start if no payment)
 */

import { adminDb } from './firebase-admin';
import { sendTenantEmail, APP_BASE_URL, getLogoUrlForEmail, getAppTitleForEmail, isEmailTypeEnabled } from './email-sender';
import { renderEmailTemplate, type TemplateVariables } from './email-templates';
import type { FirebaseUser, OrgBranding, OrgEmailTemplates } from '@/types';

const APP_URL = APP_BASE_URL;

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
    console.error('[EMAIL] Error getting org email templates:', error);
    return null;
  }
}

/**
 * Send welcome email when a user successfully pays and becomes a member
 */
export async function sendWelcomeEmail({
  email,
  firstName,
  userId,
  organizationId,
}: {
  email: string;
  firstName?: string;
  userId: string;
  organizationId?: string | null;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!email) {
    console.log('[WELCOME_EMAIL] Skipping - No email provided');
    return { success: false, error: 'No email provided' };
  }

  // Check if welcome emails are enabled for this organization
  const isEnabled = await isEmailTypeEnabled(organizationId || null, 'welcome');
  if (!isEnabled) {
    console.log('[WELCOME_EMAIL] Skipping - Welcome emails disabled for org:', organizationId);
    return { success: false, error: 'Welcome emails disabled for this organization' };
  }

  // Get tenant branding for customization
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  const dashboardUrl = `${APP_URL}/`;
  const name = firstName || 'there';

  // Check for custom template
  const customTemplates = await getOrgEmailTemplates(organizationId || null);
  
  // Build template variables
  const templateVars: TemplateVariables = {
    firstName: name,
    appTitle,
    teamName,
    logoUrl,
    ctaUrl: dashboardUrl,
    year: new Date().getFullYear().toString(),
  };

  // Render template (custom or default)
  const { subject, html: htmlBody } = renderEmailTemplate('welcome', templateVars, customTemplates);

  const textBody = `
Hey ${name},

Welcome to ${teamName}. We're genuinely excited you're here.

You've just taken the first step into a system built to help you grow consistently, without burning out or losing momentum.

Here's what's waiting for you inside:

🔥 Daily structure that keeps you moving forward
🤝 Your accountability squad (no more doing this alone)
📅 Weekly reviews to lock in your progress
🧠 Expert strategies that protect your long-term results
📚 A full resource hub with templates, prompts & tools

This isn't just another program.

It's a commitment. A commitment from us to guide you, and a commitment from you to show up.

Your login details are the same as the ones you used to sign up.

You can jump into your dashboard here:

👉 Start your ${teamName} journey
${dashboardUrl}

If you ever need support, we're always here for you.

Let's make the next 12 months the most transformative of your life.

Welcome to the family. ❤️

The ${teamName} Team
  `.trim();

  const result = await sendTenantEmail({
    to: email,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
    userId,
    headers: {
      'X-Entity-Ref-ID': `welcome-${userId}`,
    },
  });

  if (result.success) {
    console.log('[WELCOME_EMAIL] Sent successfully:', {
      userId,
      to: email,
      messageId: result.messageId,
      isWhitelabel: result.sender.isWhitelabel,
    });
  } else {
    console.error('[WELCOME_EMAIL] Failed to send:', { userId, error: result.error });
  }

  return { success: result.success, messageId: result.messageId, error: result.error };
}

/**
 * Send abandoned quiz/payment email when user starts quiz but doesn't pay within 15 minutes
 * @param resumeUrl - Optional custom URL for the resume button (defaults to /onboarding/plan for authenticated users)
 */
export async function sendAbandonedEmail({
  email,
  firstName,
  userId,
  resumeUrl,
  organizationId,
}: {
  email: string;
  firstName?: string;
  userId: string;
  resumeUrl?: string;
  organizationId?: string | null;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!email) {
    console.log('[ABANDONED_EMAIL] Skipping - No email provided');
    return { success: false, error: 'No email provided' };
  }

  // Check if abandoned cart emails are enabled for this organization
  const isEnabled = await isEmailTypeEnabled(organizationId || null, 'abandoned_cart');
  if (!isEnabled) {
    console.log('[ABANDONED_EMAIL] Skipping - Abandoned cart emails disabled for org:', organizationId);
    return { success: false, error: 'Abandoned cart emails disabled for this organization' };
  }

  // Get tenant branding for customization
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  const planUrl = resumeUrl || `${APP_URL}/onboarding/plan`;
  const name = firstName || 'there';

  // Check for custom template
  const customTemplates = await getOrgEmailTemplates(organizationId || null);
  
  // Build template variables
  const templateVars: TemplateVariables = {
    firstName: name,
    appTitle,
    teamName,
    logoUrl,
    ctaUrl: planUrl,
    year: new Date().getFullYear().toString(),
  };

  // Render template (custom or default)
  const { subject, html: htmlBody } = renderEmailTemplate('abandonedCart', templateVars, customTemplates);

  const textBody = `
Hey ${name},

You started building your plan inside ${teamName}, and you were so close to unlocking everything.

Your personalized setup is saved and ready.

All that's left is to complete your membership.

Here's the link to finish your signup:

👉 Resume your ${teamName} plan
${planUrl}

Why it's worth coming back (right now):

• Your daily structure is already prepared
• Your accountability squad activates once you join
• Your first weekly review begins the moment you're inside
• Your long-term success system is waiting for you

You already did the hard part: you showed up.

Now take the final step so we can guide you through the rest.

If you run into anything while joining, reply directly to this email. We're here to help.

See you inside,
The ${teamName} Team
  `.trim();

  const result = await sendTenantEmail({
    to: email,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
    userId,
    headers: {
      'X-Entity-Ref-ID': `abandoned-${userId}`,
    },
  });

  if (result.success) {
    console.log('[ABANDONED_EMAIL] Sent successfully:', {
      userId,
      to: email,
      messageId: result.messageId,
      isWhitelabel: result.sender.isWhitelabel,
    });
  } else {
    console.error('[ABANDONED_EMAIL] Failed to send:', { userId, error: result.error });
  }

  return { success: result.success, messageId: result.messageId, error: result.error };
}

/**
 * Helper to check if billing status indicates an active subscription
 */
function hasActiveSubscription(billingStatus?: string | null): boolean {
  return billingStatus === 'active' || billingStatus === 'trialing';
}

/**
 * Process abandoned cart emails for users who started onboarding but didn't complete within 15 minutes
 * This function is meant to be called by a cron job
 * 
 * Processes both:
 * 1. Authenticated users in the `users` collection (from /onboarding flow)
 * 2. Flow sessions in the `flow_sessions` collection (from /join funnel flow)
 * 
 * Includes deduplication to ensure each email only receives one abandoned email.
 */
export async function processAbandonedEmails(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
  };

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  // Track emails we've already processed/sent to (for deduplication across collections)
  const processedEmails = new Set<string>();

  // ==========================================
  // PART 1: Process authenticated users
  // ==========================================
  try {
    // Find users who:
    // - Started the quiz (quizStarted = true)
    // - Are NOT members (convertedToMember != true)
    // - Haven't received abandoned email yet (abandonedEmailSent != true)
    // - Started quiz at least 15 minutes ago (quizStartedAt <= 15 min ago)
    const usersSnapshot = await adminDb
      .collection('users')
      .where('quizStarted', '==', true)
      .limit(100) // Process in batches
      .get();

    for (const userDoc of usersSnapshot.docs) {
      stats.processed++;
      const userId = userDoc.id;
      const userData = userDoc.data() as FirebaseUser;
      const normalizedEmail = userData.email?.toLowerCase().trim();

      // Skip if no email
      if (!normalizedEmail) {
        stats.skipped++;
        console.log('[ABANDONED_EMAIL_CRON] Skipped user - no email:', userId);
        continue;
      }

      // Track this email as processed (even if we skip, prevents guest duplicate)
      processedEmails.add(normalizedEmail);

      // Skip if already a member (convertedToMember flag)
      if (userData.convertedToMember === true) {
        stats.skipped++;
        continue;
      }

      // Skip if user has active billing subscription
      if (hasActiveSubscription(userData.billing?.status)) {
        stats.skipped++;
        console.log('[ABANDONED_EMAIL_CRON] Skipped user - has active subscription:', userId);
        continue;
      }

      // Skip if already sent abandoned email
      if (userData.abandonedEmailSent === true) {
        stats.skipped++;
        continue;
      }

      // Skip if quiz started less than 15 minutes ago
      if (!userData.quizStartedAt || userData.quizStartedAt > fifteenMinutesAgo) {
        stats.skipped++;
        continue;
      }

      try {
        // Send the abandoned email (uses default /onboarding/plan URL)
        // Pass organizationId for preference checking and branding
        const result = await sendAbandonedEmail({
          email: userData.email,
          firstName: userData.firstName || userData.name?.split(' ')[0],
          userId,
          organizationId: userData.primaryOrganizationId,
        });

        if (result.success) {
          // Mark as sent
          await adminDb.collection('users').doc(userId).set(
            {
              abandonedEmailSent: true,
              abandonedEmailSentAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          stats.sent++;
          console.log('[ABANDONED_EMAIL_CRON] Sent to user:', userId);
        } else {
          stats.errors++;
          console.error('[ABANDONED_EMAIL_CRON] Failed to send to user:', userId, result.error);
        }
      } catch (error) {
        stats.errors++;
        console.error('[ABANDONED_EMAIL_CRON] Error processing user:', userId, error);
      }
    }
  } catch (error) {
    console.error('[ABANDONED_EMAIL_CRON] Error querying users:', error);
    stats.errors++;
  }

  // ==========================================
  // PART 2: Process flow sessions (from /join funnel flow)
  // ==========================================
  try {
    // Find flow sessions that have a userId but are not completed
    // Only process sessions updated more than 15 minutes ago
    const flowSessionsSnapshot = await adminDb
      .collection('flow_sessions')
      .where('completedAt', '==', null)
      .limit(200) // Process in batches
      .get();

    for (const sessionDoc of flowSessionsSnapshot.docs) {
      stats.processed++;
      const sessionId = sessionDoc.id;
      const sessionData = sessionDoc.data();
      
      // Skip if no userId (they haven't signed up yet)
      if (!sessionData.userId) {
        stats.skipped++;
        continue;
      }

      // Skip if already completed
      if (sessionData.completedAt) {
        stats.skipped++;
        continue;
      }

      // Skip if already sent abandoned email
      if (sessionData.abandonedEmailSent === true) {
        stats.skipped++;
        continue;
      }

      // Skip if session was updated less than 15 minutes ago
      if (!sessionData.updatedAt || sessionData.updatedAt > fifteenMinutesAgo) {
        stats.skipped++;
        continue;
      }

      // Get user email from users collection
      let userEmail: string | undefined;
      let firstName: string | undefined;
      let userOrganizationId: string | null = null;
      
      try {
        const userDoc = await adminDb.collection('users').doc(sessionData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data() as FirebaseUser;
          userEmail = userData.email?.toLowerCase().trim();
          firstName = userData.firstName || userData.name?.split(' ')[0];
          userOrganizationId = userData.primaryOrganizationId || null;
          
          // Skip if user has active subscription
          if (hasActiveSubscription(userData.billing?.status)) {
            stats.skipped++;
            console.log('[ABANDONED_EMAIL_CRON] Skipped flow session - user has active subscription:', sessionId);
            await adminDb.collection('flow_sessions').doc(sessionId).update({
              abandonedEmailSent: true,
              updatedAt: new Date().toISOString(),
            });
            continue;
          }
        }
      } catch (userLookupError) {
        console.error('[ABANDONED_EMAIL_CRON] Error looking up user for flow session:', sessionId, userLookupError);
      }

      // Skip if no email found
      if (!userEmail) {
        stats.skipped++;
        continue;
      }

      // Skip if we already processed this email (from users collection in Part 1)
      if (processedEmails.has(userEmail)) {
        stats.skipped++;
        console.log('[ABANDONED_EMAIL_CRON] Skipped flow session - email already processed:', userEmail);
        continue;
      }

      // Track this email as processed
      processedEmails.add(userEmail);

      try {
        // Build resume URL for the specific funnel
        const resumeUrl = sessionData.programSlug && sessionData.funnelSlug
          ? `${APP_URL}/join/${sessionData.programSlug}/${sessionData.funnelSlug}`
          : `${APP_URL}/join`;

        // Send the abandoned email with organizationId for preference checking and branding
        // Use session's organizationId if available, fall back to user's org
        const orgId = sessionData.organizationId || userOrganizationId;
        const result = await sendAbandonedEmail({
          email: userEmail,
          firstName,
          userId: sessionData.userId,
          resumeUrl,
          organizationId: orgId,
        });

        if (result.success) {
          // Mark as sent on the flow session
          await adminDb.collection('flow_sessions').doc(sessionId).update({
            abandonedEmailSent: true,
            abandonedEmailSentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          stats.sent++;
          console.log('[ABANDONED_EMAIL_CRON] Sent to flow session user:', sessionId, userEmail);
        } else {
          stats.errors++;
          console.error('[ABANDONED_EMAIL_CRON] Failed to send to flow session:', sessionId, result.error);
        }
      } catch (error) {
        stats.errors++;
        console.error('[ABANDONED_EMAIL_CRON] Error processing flow session:', sessionId, error);
      }
    }
  } catch (error) {
    console.error('[ABANDONED_EMAIL_CRON] Error querying flow sessions:', error);
    stats.errors++;
  }

  console.log('[ABANDONED_EMAIL_CRON] Completed:', stats);
  return stats;
}

/**
 * Send payment failed email to coach when their subscription payment fails
 * Includes information about the 3-day grace period and buttons to update payment
 */
export async function sendPaymentFailedEmail({
  organizationId,
  graceEndsAt,
}: {
  organizationId: string;
  graceEndsAt: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Get coach email from organization membership (organization owner)
  let coachEmail: string | null = null;
  let coachFirstName: string | null = null;
  
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    
    // Get organization members to find the admin/coach
    const members = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 10,
    });
    
    // Find admin/owner
    const adminMember = members.data.find(
      m => m.role === 'org:admin' || m.role === 'org:coach'
    );
    
    if (adminMember?.publicUserData?.userId) {
      const user = await clerk.users.getUser(adminMember.publicUserData.userId);
      coachEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress || null;
      coachFirstName = user.firstName;
    }
  } catch (error) {
    console.error('[PAYMENT_FAILED_EMAIL] Error fetching coach from Clerk:', error);
  }
  
  if (!coachEmail) {
    console.log('[PAYMENT_FAILED_EMAIL] Skipping - No coach email found for org:', organizationId);
    return { success: false, error: 'No coach email found' };
  }
  
  // Get tenant branding
  const appTitle = await getAppTitleForEmail(organizationId);
  const logoUrl = await getLogoUrlForEmail(organizationId);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  // Calculate grace period details
  const graceEnd = new Date(graceEndsAt);
  const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const formattedDate = graceEnd.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  
  const name = coachFirstName || 'there';
  const updatePaymentUrl = `${APP_URL}/coach?action=update-payment`;
  
  const subject = `⚠️ Payment Failed - Update Your Payment Method (${daysRemaining} days remaining)`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px 40px; text-align: center;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${teamName}" style="max-height: 50px; max-width: 180px; margin-bottom: 15px;">` : ''}
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Payment Failed</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${name},
              </p>
              
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                We were unable to process your subscription payment for ${teamName}. This could be due to an expired card, insufficient funds, or an issue with your payment method.
              </p>
              
              <!-- Warning Box -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="font-size: 16px; color: #991b1b; font-weight: 600; margin: 0 0 8px 0;">
                  ⚠️ Grace Period: ${daysRemaining} Days Remaining
                </p>
                <p style="font-size: 14px; color: #7f1d1d; margin: 0;">
                  You and your members will continue to have access until <strong>${formattedDate}</strong>. After this date, access will be suspended until payment is successful.
                </p>
              </div>
              
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 30px 0;">
                Please update your payment method to avoid any interruption to your service and your members' access.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="${updatePaymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you have any questions, please reply to this email or contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                © ${new Date().getFullYear()} ${teamName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const result = await sendTenantEmail({
    to: coachEmail,
    subject,
    html: htmlBody,
    organizationId,
  });
  
  if (result.success) {
    console.log('[PAYMENT_FAILED_EMAIL] Sent to coach:', {
      organizationId,
      email: coachEmail,
      graceEndsAt,
      messageId: result.messageId,
    });
  } else {
    console.error('[PAYMENT_FAILED_EMAIL] Failed to send:', {
      organizationId,
      email: coachEmail,
      error: result.error,
    });
  }
  
  return { success: result.success, messageId: result.messageId, error: result.error };
}
