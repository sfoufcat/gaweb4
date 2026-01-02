/**
 * Invite Email Functionality
 * 
 * This module handles sending invite emails for:
 * - Squad invitations
 * - Community invitations
 * - Organization invitations
 * 
 * All emails use the tenant-aware sender for whitelabeling.
 */

import { sendTenantEmail, APP_BASE_URL, getLogoUrlForEmail, getAppTitleForEmail } from './email-sender';
import { adminDb } from './firebase-admin';
import type { FirebaseUser } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface SendInviteEmailOptions {
  /** Email address to send the invite to */
  toEmail: string;
  /** Name of the person being invited (if known) */
  toName?: string;
  /** User ID of the person sending the invite */
  inviterId: string;
  /** Name of the inviter */
  inviterName: string;
  /** Organization ID for whitelabeling */
  organizationId?: string | null;
  /** Custom message from the inviter */
  customMessage?: string;
}

export interface SendSquadInviteEmailOptions extends SendInviteEmailOptions {
  /** Squad ID */
  squadId: string;
  /** Squad name */
  squadName: string;
  /** Invite code for joining */
  inviteCode: string;
}

export interface SendCommunityInviteEmailOptions extends SendInviteEmailOptions {
  /** Community/chat channel ID */
  channelId: string;
  /** Community name */
  communityName: string;
  /** Invite link */
  inviteLink: string;
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
    console.error('[INVITE_EMAIL] Error getting user:', error);
    return null;
  }
}

// =============================================================================
// SQUAD INVITE EMAIL
// =============================================================================

/**
 * Send a squad invite email
 */
export async function sendSquadInviteEmail(
  options: SendSquadInviteEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    toEmail,
    toName,
    inviterId,
    inviterName,
    organizationId,
    squadId,
    squadName,
    inviteCode,
    customMessage,
  } = options;

  if (!toEmail) {
    return { success: false, error: 'No email address provided' };
  }

  // Get tenant branding
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  const recipientName = toName || 'there';
  const inviteUrl = `${APP_BASE_URL}/invite/${inviteCode}`;

  const subject = `${inviterName} invited you to join ${squadName}`;

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
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey ${recipientName},</p>
  
  <p style="margin-bottom: 20px;"><strong>${inviterName}</strong> has invited you to join <strong>${squadName}</strong> on ${teamName}.</p>
  
  ${customMessage ? `
  <div style="background-color: #f8f7f5; border-left: 4px solid #a07855; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; font-style: italic; color: #5f5a55;">"${customMessage}"</p>
    <p style="margin: 8px 0 0; font-size: 14px; color: #8c8c8c;">— ${inviterName}</p>
  </div>
  ` : ''}
  
  <p style="margin-bottom: 25px;">Join the squad to connect with the team, participate in discussions, and achieve your goals together.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      👋 Accept Invitation
    </a>
  </div>
  
  <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
    Or copy this link: <a href="${inviteUrl}" style="color: #a07855;">${inviteUrl}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    You received this email because ${inviterName} invited you to ${teamName}.<br>
    If you don't want to join, you can ignore this email.
  </p>
</body>
</html>
  `.trim();

  const textBody = `
Hey ${recipientName},

${inviterName} has invited you to join ${squadName} on ${teamName}.

${customMessage ? `"${customMessage}" — ${inviterName}\n\n` : ''}Join the squad to connect with the team, participate in discussions, and achieve your goals together.

Accept your invitation:
${inviteUrl}

You received this email because ${inviterName} invited you to ${teamName}.
If you don't want to join, you can ignore this email.
  `.trim();

  const result = await sendTenantEmail({
    to: toEmail,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
    userId: inviterId,
    headers: {
      'X-Entity-Ref-ID': `squad-invite-${squadId}-${Date.now()}`,
    },
  });

  if (result.success) {
    console.log('[SQUAD_INVITE_EMAIL] Sent successfully:', {
      to: toEmail,
      squadId,
      messageId: result.messageId,
      isWhitelabel: result.sender.isWhitelabel,
    });
  } else {
    console.error('[SQUAD_INVITE_EMAIL] Failed:', result.error);
  }

  return { success: result.success, messageId: result.messageId, error: result.error };
}

// =============================================================================
// COMMUNITY INVITE EMAIL
// =============================================================================

/**
 * Send a community/chat channel invite email
 */
export async function sendCommunityInviteEmail(
  options: SendCommunityInviteEmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    toEmail,
    toName,
    inviterId,
    inviterName,
    organizationId,
    channelId,
    communityName,
    inviteLink,
    customMessage,
  } = options;

  if (!toEmail) {
    return { success: false, error: 'No email address provided' };
  }

  // Get tenant branding
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  const recipientName = toName || 'there';

  const subject = `${inviterName} invited you to join ${communityName}`;

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
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey ${recipientName},</p>
  
  <p style="margin-bottom: 20px;"><strong>${inviterName}</strong> has invited you to join the <strong>${communityName}</strong> community on ${teamName}.</p>
  
  ${customMessage ? `
  <div style="background-color: #f8f7f5; border-left: 4px solid #a07855; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; font-style: italic; color: #5f5a55;">"${customMessage}"</p>
    <p style="margin: 8px 0 0; font-size: 14px; color: #8c8c8c;">— ${inviterName}</p>
  </div>
  ` : ''}
  
  <p style="margin-bottom: 25px;">Join the community to connect with like-minded people, share experiences, and grow together.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      🚀 Join the Community
    </a>
  </div>
  
  <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
    Or copy this link: <a href="${inviteLink}" style="color: #a07855;">${inviteLink}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    You received this email because ${inviterName} invited you to ${teamName}.<br>
    If you don't want to join, you can ignore this email.
  </p>
</body>
</html>
  `.trim();

  const textBody = `
Hey ${recipientName},

${inviterName} has invited you to join the ${communityName} community on ${teamName}.

${customMessage ? `"${customMessage}" — ${inviterName}\n\n` : ''}Join the community to connect with like-minded people, share experiences, and grow together.

Join the community:
${inviteLink}

You received this email because ${inviterName} invited you to ${teamName}.
If you don't want to join, you can ignore this email.
  `.trim();

  const result = await sendTenantEmail({
    to: toEmail,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
    userId: inviterId,
    headers: {
      'X-Entity-Ref-ID': `community-invite-${channelId}-${Date.now()}`,
    },
  });

  if (result.success) {
    console.log('[COMMUNITY_INVITE_EMAIL] Sent successfully:', {
      to: toEmail,
      channelId,
      messageId: result.messageId,
      isWhitelabel: result.sender.isWhitelabel,
    });
  } else {
    console.error('[COMMUNITY_INVITE_EMAIL] Failed:', result.error);
  }

  return { success: result.success, messageId: result.messageId, error: result.error };
}

// =============================================================================
// ORGANIZATION INVITE EMAIL
// =============================================================================

/**
 * Send an organization invite email
 */
export async function sendOrganizationInviteEmail(
  options: SendInviteEmailOptions & { inviteLink: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const {
    toEmail,
    toName,
    inviterId,
    inviterName,
    organizationId,
    inviteLink,
    customMessage,
  } = options;

  if (!toEmail) {
    return { success: false, error: 'No email address provided' };
  }

  // Get tenant branding
  const appTitle = await getAppTitleForEmail(organizationId || null);
  const logoUrl = await getLogoUrlForEmail(organizationId || null);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  const recipientName = toName || 'there';

  const subject = `${inviterName} invited you to join ${teamName}`;

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
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey ${recipientName},</p>
  
  <p style="margin-bottom: 20px;"><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong>.</p>
  
  ${customMessage ? `
  <div style="background-color: #f8f7f5; border-left: 4px solid #a07855; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0; font-style: italic; color: #5f5a55;">"${customMessage}"</p>
    <p style="margin: 8px 0 0; font-size: 14px; color: #8c8c8c;">— ${inviterName}</p>
  </div>
  ` : ''}
  
  <p style="margin-bottom: 15px;"><strong>What you'll get access to:</strong></p>
  
  <ul style="margin-bottom: 25px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">📊 Daily structure to keep you moving forward</li>
    <li style="margin-bottom: 8px;">🤝 Accountability squad to achieve goals together</li>
    <li style="margin-bottom: 8px;">📚 Curated learning resources</li>
    <li style="margin-bottom: 8px;">💬 Community chat and support</li>
  </ul>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      ✨ Accept Invitation
    </a>
  </div>
  
  <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
    Or copy this link: <a href="${inviteLink}" style="color: #a07855;">${inviteLink}</a>
  </p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    You received this email because ${inviterName} invited you to ${teamName}.<br>
    If you don't want to join, you can ignore this email.
  </p>
</body>
</html>
  `.trim();

  const textBody = `
Hey ${recipientName},

${inviterName} has invited you to join ${teamName}.

${customMessage ? `"${customMessage}" — ${inviterName}\n\n` : ''}What you'll get access to:

📊 Daily structure to keep you moving forward
🤝 Accountability squad to achieve goals together
📚 Curated learning resources
💬 Community chat and support

Accept your invitation:
${inviteLink}

You received this email because ${inviterName} invited you to ${teamName}.
If you don't want to join, you can ignore this email.
  `.trim();

  const result = await sendTenantEmail({
    to: toEmail,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
    userId: inviterId,
    headers: {
      'X-Entity-Ref-ID': `org-invite-${organizationId}-${Date.now()}`,
    },
  });

  if (result.success) {
    console.log('[ORG_INVITE_EMAIL] Sent successfully:', {
      to: toEmail,
      organizationId,
      messageId: result.messageId,
      isWhitelabel: result.sender.isWhitelabel,
    });
  } else {
    console.error('[ORG_INVITE_EMAIL] Failed:', result.error);
  }

  return { success: result.success, messageId: result.messageId, error: result.error };
}










