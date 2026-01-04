/**
 * Email Automation Library
 * 
 * Core functions for the automated email system.
 * Uses Resend for sending and Firestore for storage.
 */

import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import type { 
  AutomatedEmailTemplate, 
  EmailFlow, 
  EmailSend, 
  EmailQueueItem,
  EmailFlowTrigger,
  EmailSendStatus,
  EmailFlowStats 
} from '@/types';

// =============================================================================
// DEFAULT EMAIL TEMPLATES
// =============================================================================

const DEFAULT_TEMPLATES: Omit<AutomatedEmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Abandoned Cart Flow - Personalized with Quiz Data
  {
    flowId: 'abandoned_cart',
    name: 'Abandoned Cart - 2 Hours',
    subject: '{{firstName}}, about those {{quizClientCount}} clients...',
    htmlContent: `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <img src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af" alt="Coachful" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 24px;">
  
  <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Hey {{firstName}},</h1>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    You mentioned you're coaching <strong>{{quizClientCount}} clients</strong> and dealing with <strong>{{quizFrustrations}}</strong>.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    That's exactly why we built Coachful. You wanted help with <strong>{{quizImpactFeatures}}</strong> – and that's all set up and waiting for you.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    Your platform is 90% ready. Just pick a plan and you're live in 10 minutes.
  </p>
  
  <a href="{{ctaUrl}}" style="display: inline-block; background: #a68b5b; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
    Finish Setup →
  </a>
  
  <p style="font-size: 14px; color: #8a8580; margin-top: 32px;">
    Questions? Just reply to this email.
  </p>
</div>
    `,
    enabled: true,
    delayMinutes: 120, // 2 hours
    order: 1,
  },
  {
    flowId: 'abandoned_cart',
    name: 'Abandoned Cart - 24 Hours',
    subject: 'Still struggling with {{quizFrustrations}}?',
    htmlContent: `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <img src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af" alt="Coachful" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 24px;">
  
  <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">{{firstName}}, let me be direct:</h1>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    You said <strong>{{quizFrustrations}}</strong> was holding you back. Every day you wait is another day your {{quizClientCount}} clients aren't getting the accountability they need.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    Here's what coaches like you are doing with Coachful:
  </p>
  
  <ul style="font-size: 16px; color: #5f5a55; line-height: 1.8; margin-bottom: 24px; padding-left: 20px;">
    <li><strong>Alignment scores</strong> show exactly who's engaged (no more guessing)</li>
    <li><strong>Squad groups</strong> create peer accountability that sticks</li>
    <li><strong>Automated check-ins</strong> replace manual follow-ups</li>
  </ul>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    You wanted <strong>{{quizImpactFeatures}}</strong>. It's all there, ready to go.
  </p>
  
  <a href="{{ctaUrl}}" style="display: inline-block; background: #a68b5b; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
    Start Free Trial →
  </a>
  
  <p style="font-size: 14px; color: #8a8580; margin-top: 32px;">
    Reply to this email with any questions – I read every one.
  </p>
</div>
    `,
    enabled: true,
    delayMinutes: 1440, // 24 hours
    order: 2,
  },
  {
    flowId: 'abandoned_cart',
    name: 'Abandoned Cart - 72 Hours',
    subject: 'Last email about your {{quizClientCount}} clients',
    htmlContent: `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <img src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af" alt="Coachful" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 24px;">
  
  <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">{{firstName}}, this is my last email</h1>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    I won't bug you again after this. But I wanted to leave you with one thought:
  </p>
  
  <p style="font-size: 18px; color: #1a1a1a; line-height: 1.6; margin-bottom: 24px; font-style: italic; border-left: 4px solid #a68b5b; padding-left: 16px;">
    "The difference between coaches who scale and coaches who burn out isn't talent. It's systems."
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    You're managing <strong>{{quizClientCount}} clients</strong>. You told me you struggle with <strong>{{quizFrustrations}}</strong>. That's not sustainable.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    Coaches who use Coachful see <strong>40% higher client retention</strong> because they can finally track who's doing the work – and who needs attention before they drop off.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    The platform you started setting up is still there. 7-day free trial, cancel anytime.
  </p>
  
  <a href="{{ctaUrl}}" style="display: inline-block; background: #a68b5b; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 16px;">
    Complete Your Setup →
  </a>
  
  <p style="font-size: 14px; color: #8a8580; margin-top: 32px;">
    All the best,<br>
    The Coachful Team
  </p>
</div>
    `,
    enabled: true,
    delayMinutes: 4320, // 72 hours
    order: 3,
  },
  // Testimonial Request Flow
  {
    flowId: 'testimonial_request',
    name: 'Testimonial Request - Day 14',
    subject: 'How\'s Coachful working for your {{quizClientCount}} clients?',
    htmlContent: `
<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
  <img src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af" alt="Coachful" style="width: 48px; height: 48px; border-radius: 12px; margin-bottom: 24px;">
  
  <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Hey {{firstName}}!</h1>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    Two weeks ago, you told me you were struggling with <strong>{{quizFrustrations}}</strong>. How's that going now?
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    If Coachful has made a difference for you and your {{quizClientCount}} clients, I'd be incredibly grateful if you could share a quick testimonial. It helps other coaches discover us.
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    Just reply to this email with 2-3 sentences about your experience. That's it!
  </p>
  
  <p style="font-size: 16px; color: #5f5a55; line-height: 1.6; margin-bottom: 24px;">
    <strong>Not loving it?</strong> Reply and tell me why. I personally read every response and want to make Coachful better for coaches like you.
  </p>
  
  <p style="font-size: 14px; color: #8a8580; margin-top: 32px;">
    Thanks for being part of the community! 🙏
  </p>
</div>
    `,
    enabled: true,
    delayMinutes: 20160, // 14 days
    order: 1,
  },
];

const DEFAULT_FLOWS: Omit<EmailFlow, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Abandoned Cart',
    description: 'Emails sent when a coach signs up but doesn\'t select a plan',
    trigger: 'signup_no_plan',
    enabled: true,
    templateIds: [], // Will be populated when templates are created
  },
  {
    name: 'Testimonial Request',
    description: 'Request testimonial 14 days after signup',
    trigger: 'day_14',
    enabled: true,
    templateIds: [],
  },
];

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize default email flows and templates if they don't exist
 */
export async function initializeEmailFlows(): Promise<void> {
  const flowsRef = adminDb.collection('email_flows');
  const templatesRef = adminDb.collection('email_templates');
  
  // Check if flows exist
  const existingFlows = await flowsRef.get();
  if (!existingFlows.empty) {
    console.log('[EMAIL_AUTOMATION] Flows already initialized');
    return;
  }
  
  console.log('[EMAIL_AUTOMATION] Initializing default email flows...');
  
  const now = new Date().toISOString();
  const flowIdMap: Record<string, string> = {};
  
  // Create flows
  for (const flowData of DEFAULT_FLOWS) {
    const flowRef = flowsRef.doc();
    flowIdMap[flowData.trigger] = flowRef.id;
    
    await flowRef.set({
      ...flowData,
      id: flowRef.id,
      createdAt: now,
      updatedAt: now,
    });
  }
  
  // Create templates
  const templateIdsByFlow: Record<string, string[]> = {};
  
  for (const templateData of DEFAULT_TEMPLATES) {
    const templateRef = templatesRef.doc();
    
    // Map template's flowId to actual flow ID
    const flowId = templateData.flowId === 'abandoned_cart' 
      ? flowIdMap['signup_no_plan']
      : flowIdMap['day_14'];
    
    await templateRef.set({
      ...templateData,
      id: templateRef.id,
      flowId,
      createdAt: now,
      updatedAt: now,
    });
    
    // Track template IDs by flow
    if (!templateIdsByFlow[flowId]) {
      templateIdsByFlow[flowId] = [];
    }
    templateIdsByFlow[flowId].push(templateRef.id);
  }
  
  // Update flows with template IDs
  for (const [flowId, templateIds] of Object.entries(templateIdsByFlow)) {
    await flowsRef.doc(flowId).update({ templateIds });
  }
  
  console.log('[EMAIL_AUTOMATION] Default flows and templates initialized');
}

// =============================================================================
// EMAIL SENDING
// =============================================================================

/**
 * Replace template variables with actual values
 */
function replaceVariables(content: string, variables: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

/**
 * Send an email using a template
 */
export async function sendTemplatedEmail(
  templateId: string,
  recipientEmail: string,
  variables: Record<string, string>,
  metadata?: {
    recipientUserId?: string;
    recipientOrgId?: string;
    flowId?: string;
  }
): Promise<{ success: boolean; sendId?: string; error?: string }> {
  if (!isResendConfigured() || !resend) {
    console.log('[EMAIL_AUTOMATION] Resend not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    // Get template
    const templateDoc = await adminDb.collection('email_templates').doc(templateId).get();
    if (!templateDoc.exists) {
      return { success: false, error: 'Template not found' };
    }
    
    const template = templateDoc.data() as AutomatedEmailTemplate;
    if (!template.enabled) {
      return { success: false, error: 'Template is disabled' };
    }
    
    // Replace variables in subject and content
    const subject = replaceVariables(template.subject, variables);
    const html = replaceVariables(template.htmlContent, variables);
    const text = template.textContent ? replaceVariables(template.textContent, variables) : undefined;
    
    // Send email
    const { data, error } = await resend.emails.send({
      from: 'Coachful <notifications@coachful.co>',
      to: recipientEmail,
      subject,
      html,
      text,
      headers: {
        'X-GA-Template-Id': templateId,
        'X-GA-Flow-Id': metadata?.flowId || template.flowId,
      },
    });
    
    if (error) {
      console.error('[EMAIL_AUTOMATION] Resend error:', error);
      return { success: false, error: error.message };
    }
    
    // Record the send
    const now = new Date().toISOString();
    const sendRef = adminDb.collection('email_sends').doc();
    const sendData: EmailSend = {
      id: sendRef.id,
      templateId,
      flowId: metadata?.flowId || template.flowId,
      recipientEmail,
      recipientUserId: metadata?.recipientUserId,
      recipientOrgId: metadata?.recipientOrgId,
      resendMessageId: data?.id,
      status: 'sent',
      sentAt: now,
    };
    
    await sendRef.set(sendData);
    
    console.log(`[EMAIL_AUTOMATION] Sent email ${sendRef.id} to ${recipientEmail} (template: ${template.name})`);
    
    return { success: true, sendId: sendRef.id };
    
  } catch (err) {
    console.error('[EMAIL_AUTOMATION] Error sending email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// EMAIL QUEUE
// =============================================================================

/**
 * Queue emails for a flow trigger
 */
export async function queueEmailsForTrigger(
  trigger: EmailFlowTrigger,
  recipientEmail: string,
  recipientUserId: string,
  recipientOrgId?: string,
  variables?: Record<string, string>
): Promise<{ success: boolean; queuedCount: number; error?: string }> {
  try {
    // Find enabled flow for this trigger
    const flowsSnapshot = await adminDb
      .collection('email_flows')
      .where('trigger', '==', trigger)
      .where('enabled', '==', true)
      .limit(1)
      .get();
    
    if (flowsSnapshot.empty) {
      console.log(`[EMAIL_AUTOMATION] No enabled flow for trigger: ${trigger}`);
      return { success: true, queuedCount: 0 };
    }
    
    const flow = flowsSnapshot.docs[0].data() as EmailFlow;
    
    // Get templates for this flow
    const templatesSnapshot = await adminDb
      .collection('email_templates')
      .where('flowId', '==', flow.id)
      .where('enabled', '==', true)
      .orderBy('order')
      .get();
    
    if (templatesSnapshot.empty) {
      console.log(`[EMAIL_AUTOMATION] No templates for flow: ${flow.name}`);
      return { success: true, queuedCount: 0 };
    }
    
    // Queue each template
    const now = new Date();
    const batch = adminDb.batch();
    let queuedCount = 0;
    
    for (const templateDoc of templatesSnapshot.docs) {
      const template = templateDoc.data() as AutomatedEmailTemplate;
      
      // Calculate scheduled time
      const scheduledFor = new Date(now.getTime() + template.delayMinutes * 60 * 1000);
      
      // Create queue item
      const queueRef = adminDb.collection('email_queue').doc();
      const queueItem: EmailQueueItem = {
        id: queueRef.id,
        flowId: flow.id,
        templateId: template.id,
        recipientEmail,
        recipientUserId,
        recipientOrgId,
        scheduledFor: scheduledFor.toISOString(),
        cancelled: false,
        variables,
        createdAt: now.toISOString(),
      };
      
      batch.set(queueRef, queueItem);
      queuedCount++;
    }
    
    await batch.commit();
    
    console.log(`[EMAIL_AUTOMATION] Queued ${queuedCount} emails for ${recipientEmail} (trigger: ${trigger})`);
    
    return { success: true, queuedCount };
    
  } catch (err) {
    console.error('[EMAIL_AUTOMATION] Error queuing emails:', err);
    return { success: false, queuedCount: 0, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Cancel all queued emails for a user (e.g., when they complete signup)
 */
export async function cancelQueuedEmails(
  recipientUserId: string,
  reason?: string
): Promise<{ success: boolean; cancelledCount: number }> {
  try {
    const queueSnapshot = await adminDb
      .collection('email_queue')
      .where('recipientUserId', '==', recipientUserId)
      .where('cancelled', '==', false)
      .get();
    
    if (queueSnapshot.empty) {
      return { success: true, cancelledCount: 0 };
    }
    
    const batch = adminDb.batch();
    
    for (const doc of queueSnapshot.docs) {
      batch.update(doc.ref, { 
        cancelled: true,
        cancelledReason: reason || 'User converted',
      });
    }
    
    await batch.commit();
    
    console.log(`[EMAIL_AUTOMATION] Cancelled ${queueSnapshot.size} queued emails for user ${recipientUserId}`);
    
    return { success: true, cancelledCount: queueSnapshot.size };
    
  } catch (err) {
    console.error('[EMAIL_AUTOMATION] Error cancelling emails:', err);
    return { success: false, cancelledCount: 0 };
  }
}

/**
 * Process the email queue (called by cron job)
 */
export async function processEmailQueue(): Promise<{ processed: number; sent: number; failed: number }> {
  const now = new Date().toISOString();
  
  try {
    // Get emails scheduled for now or earlier that aren't cancelled
    const queueSnapshot = await adminDb
      .collection('email_queue')
      .where('scheduledFor', '<=', now)
      .where('cancelled', '==', false)
      .limit(50) // Process in batches
      .get();
    
    if (queueSnapshot.empty) {
      return { processed: 0, sent: 0, failed: 0 };
    }
    
    let sent = 0;
    let failed = 0;
    
    for (const doc of queueSnapshot.docs) {
      const queueItem = doc.data() as EmailQueueItem;
      
      // Build default variables
      const variables: Record<string, string> = {
        ...queueItem.variables,
        ctaUrl: 'https://coachful.co/coach/plan',
        firstName: queueItem.variables?.firstName || 'there',
      };
      
      // Try to get user's name if not provided
      if (!variables.firstName || variables.firstName === 'there') {
        try {
          // Check if we have org membership with name
          if (queueItem.recipientOrgId) {
            const membershipSnapshot = await adminDb
              .collection('org_memberships')
              .where('userId', '==', queueItem.recipientUserId)
              .where('organizationId', '==', queueItem.recipientOrgId)
              .limit(1)
              .get();
            
            if (!membershipSnapshot.empty) {
              const membership = membershipSnapshot.docs[0].data();
              if (membership.firstName) {
                variables.firstName = membership.firstName;
              }
            }
          }
        } catch (e) {
          // Ignore errors fetching name
        }
      }
      
      // Send the email
      const result = await sendTemplatedEmail(
        queueItem.templateId,
        queueItem.recipientEmail,
        variables,
        {
          recipientUserId: queueItem.recipientUserId,
          recipientOrgId: queueItem.recipientOrgId,
          flowId: queueItem.flowId,
        }
      );
      
      if (result.success) {
        sent++;
        // Delete from queue
        await doc.ref.delete();
      } else {
        failed++;
        // Mark as failed but don't retry immediately
        await doc.ref.update({
          lastError: result.error,
          lastAttempt: now,
        });
      }
    }
    
    console.log(`[EMAIL_AUTOMATION] Processed queue: ${sent} sent, ${failed} failed`);
    
    return { processed: queueSnapshot.size, sent, failed };
    
  } catch (err) {
    console.error('[EMAIL_AUTOMATION] Error processing queue:', err);
    return { processed: 0, sent: 0, failed: 0 };
  }
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

/**
 * Update email status from Resend webhook
 */
export async function updateEmailStatus(
  resendMessageId: string,
  status: EmailSendStatus,
  timestamp?: string
): Promise<boolean> {
  try {
    // Find the email send record
    const sendsSnapshot = await adminDb
      .collection('email_sends')
      .where('resendMessageId', '==', resendMessageId)
      .limit(1)
      .get();
    
    if (sendsSnapshot.empty) {
      console.log(`[EMAIL_AUTOMATION] No send record found for message: ${resendMessageId}`);
      return false;
    }
    
    const doc = sendsSnapshot.docs[0];
    const updateData: Partial<EmailSend> = { status };
    
    // Set timestamp based on status
    const ts = timestamp || new Date().toISOString();
    switch (status) {
      case 'delivered':
        updateData.deliveredAt = ts;
        break;
      case 'opened':
        updateData.openedAt = ts;
        break;
      case 'clicked':
        updateData.clickedAt = ts;
        break;
      case 'bounced':
        updateData.bouncedAt = ts;
        break;
    }
    
    await doc.ref.update(updateData);
    
    console.log(`[EMAIL_AUTOMATION] Updated status for ${resendMessageId}: ${status}`);
    
    return true;
    
  } catch (err) {
    console.error('[EMAIL_AUTOMATION] Error updating email status:', err);
    return false;
  }
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Get stats for an email flow
 */
export async function getFlowStats(flowId: string): Promise<EmailFlowStats> {
  const sendsSnapshot = await adminDb
    .collection('email_sends')
    .where('flowId', '==', flowId)
    .get();
  
  let totalSent = 0;
  let totalDelivered = 0;
  let totalOpened = 0;
  let totalClicked = 0;
  let totalBounced = 0;
  
  for (const doc of sendsSnapshot.docs) {
    const send = doc.data() as EmailSend;
    totalSent++;
    
    if (send.deliveredAt) totalDelivered++;
    if (send.openedAt) totalOpened++;
    if (send.clickedAt) totalClicked++;
    if (send.bouncedAt) totalBounced++;
  }
  
  return {
    flowId,
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalBounced,
    openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0,
    clickRate: totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get all flows with their stats
 */
export async function getAllFlowsWithStats(): Promise<(EmailFlow & { stats: EmailFlowStats })[]> {
  const flowsSnapshot = await adminDb.collection('email_flows').get();
  
  const results: (EmailFlow & { stats: EmailFlowStats })[] = [];
  
  for (const doc of flowsSnapshot.docs) {
    const flow = { id: doc.id, ...doc.data() } as EmailFlow;
    const stats = await getFlowStats(flow.id);
    results.push({ ...flow, stats });
  }
  
  return results;
}

