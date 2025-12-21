/**
 * Email Utilities for Onboarding Flows
 * 
 * This module provides email helpers for:
 * - Welcome email (sent when user becomes a member)
 * - Abandoned quiz/payment email (sent 15 min after quiz start if no payment)
 */

import { adminDb } from './firebase-admin';
import { sendTenantEmail, APP_BASE_URL, getLogoUrlForEmail, getAppTitleForEmail } from './email-sender';
import type { FirebaseUser } from '@/types';

const APP_URL = APP_BASE_URL;

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

  // Get tenant branding for customization
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;

  const name = firstName || 'there';
  const dashboardUrl = `${APP_URL}/`;

  const subject = `Welcome to ${teamName}: Your Transformation Starts Today 🚀`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="${logoUrl}" alt="${teamName}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey ${name},</p>
  
  <p style="margin-bottom: 20px;"><strong>Welcome to ${teamName}</strong>. We're genuinely excited you're here.</p>
  
  <p style="margin-bottom: 20px;">You've just taken the first step into a system built to help you grow consistently, without burning out or losing momentum.</p>
  
  <p style="margin-bottom: 15px;"><strong>Here's what's waiting for you inside:</strong></p>
  
  <ul style="margin-bottom: 25px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">🔥 Daily structure that keeps you moving forward</li>
    <li style="margin-bottom: 8px;">🤝 Your accountability squad (no more doing this alone)</li>
    <li style="margin-bottom: 8px;">📅 Weekly reviews to lock in your progress</li>
    <li style="margin-bottom: 8px;">🧠 Expert strategies that protect your long-term results</li>
    <li style="margin-bottom: 8px;">📚 A full resource hub with templates, prompts & tools</li>
  </ul>
  
  <p style="margin-bottom: 20px;"><strong>This isn't just another program.</strong></p>
  
  <p style="margin-bottom: 25px;">It's a commitment. A commitment from us to guide you, and a commitment from you to show up.</p>
  
  <p style="margin-bottom: 15px;">Your login details are the same as the ones you used to sign up.</p>
  
  <p style="margin-bottom: 20px;">You can jump into your dashboard here:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      👉 Start your ${teamName} journey
    </a>
  </div>
  
  <p style="margin-bottom: 20px;">If you ever need support, we're always here for you.</p>
  
  <p style="margin-bottom: 20px;"><strong>Let's make the next 12 months the most transformative of your life.</strong></p>
  
  <p style="margin-bottom: 30px;">Welcome to the family. ❤️</p>
  
  <p style="color: #666;">The ${teamName} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © ${new Date().getFullYear()} ${teamName}. All rights reserved.
  </p>
</body>
</html>
  `.trim();

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

  // Get tenant branding for customization
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;

  const name = firstName || 'there';
  const planUrl = resumeUrl || `${APP_URL}/onboarding/plan`;

  const subject = `Your ${teamName} plan is ready: complete your signup ⚡`;
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="${logoUrl}" alt="${teamName}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey ${name},</p>
  
  <p style="margin-bottom: 20px;">You started building your plan inside ${teamName}, and you were so close to unlocking everything.</p>
  
  <p style="margin-bottom: 20px;"><strong>Your personalized setup is saved and ready.</strong></p>
  
  <p style="margin-bottom: 25px;">All that's left is to complete your membership.</p>
  
  <p style="margin-bottom: 20px;">Here's the link to finish your signup:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${planUrl}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      👉 Resume your ${teamName} plan
    </a>
  </div>
  
  <p style="margin-bottom: 15px;"><strong>Why it's worth coming back (right now):</strong></p>
  
  <ul style="margin-bottom: 25px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">• Your daily structure is already prepared</li>
    <li style="margin-bottom: 8px;">• Your accountability squad activates once you join</li>
    <li style="margin-bottom: 8px;">• Your first weekly review begins the moment you're inside</li>
    <li style="margin-bottom: 8px;">• Your long-term success system is waiting for you</li>
  </ul>
  
  <p style="margin-bottom: 20px;"><strong>You already did the hard part: you showed up.</strong></p>
  
  <p style="margin-bottom: 25px;">Now take the final step so we can guide you through the rest.</p>
  
  <p style="margin-bottom: 30px;">If you run into anything while joining, reply directly to this email. We're here to help.</p>
  
  <p style="margin-bottom: 10px;">See you inside,</p>
  <p style="color: #666;">The ${teamName} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © ${new Date().getFullYear()} ${teamName}. All rights reserved.
  </p>
</body>
</html>
  `.trim();

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
        const result = await sendAbandonedEmail({
          email: userData.email,
          firstName: userData.firstName || userData.name?.split(' ')[0],
          userId,
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
      
      try {
        const userDoc = await adminDb.collection('users').doc(sessionData.userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data() as FirebaseUser;
          userEmail = userData.email?.toLowerCase().trim();
          firstName = userData.firstName || userData.name?.split(' ')[0];
          
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

        // Send the abandoned email
        const result = await sendAbandonedEmail({
          email: userEmail,
          firstName,
          userId: sessionData.userId,
          resumeUrl,
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

