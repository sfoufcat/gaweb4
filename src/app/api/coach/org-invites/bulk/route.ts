import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { sendTenantEmail, getLogoUrlForEmail, getAppTitleForEmail, APP_BASE_URL } from '@/lib/email-sender';
import { nanoid } from 'nanoid';
import type { ProgramInvite, Funnel, Program } from '@/types';

interface BulkInviteEntry {
  email: string;
  name?: string;
}

/**
 * POST /api/coach/org-invites/bulk
 * Create multiple invites at once (bulk import)
 * 
 * Body:
 * - funnelId: string (required)
 * - entries: Array<{ email: string, name?: string }>
 * - paymentStatus?: 'required' | 'pre_paid' | 'free'
 * - prePaidNote?: string
 * - sendEmails?: boolean (default: false)
 */
export async function POST(req: Request) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      funnelId, 
      entries,
      paymentStatus = 'required',
      prePaidNote,
      sendEmails = false,
    } = body;

    if (!funnelId) {
      return NextResponse.json({ error: 'Funnel ID is required' }, { status: 400 });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Entries array is required' }, { status: 400 });
    }

    if (entries.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 entries per request' }, { status: 400 });
    }

    // Verify funnel belongs to org and get programId
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    // Get program for email
    const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
    const program = programDoc.exists ? (programDoc.data() as Program) : null;

    // Validate and dedupe entries
    const validEntries: BulkInviteEntry[] = [];
    const seenEmails = new Set<string>();
    const errors: Array<{ index: number; error: string }> = [];

    entries.forEach((entry: BulkInviteEntry, index: number) => {
      const email = entry.email?.trim().toLowerCase();
      
      if (!email) {
        errors.push({ index, error: 'Email is required' });
        return;
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ index, error: 'Invalid email format' });
        return;
      }

      if (seenEmails.has(email)) {
        errors.push({ index, error: 'Duplicate email in this batch' });
        return;
      }

      seenEmails.add(email);
      validEntries.push({
        email,
        name: entry.name?.trim() || undefined,
      });
    });

    if (validEntries.length === 0) {
      return NextResponse.json({
        success: false,
        created: 0,
        errors,
      }, { status: 400 });
    }

    // Check for existing invites with these emails
    const existingInvites = await adminDb
      .collection('program_invites')
      .where('organizationId', '==', organizationId)
      .where('funnelId', '==', funnelId)
      .get();

    const existingEmails = new Set(
      existingInvites.docs
        .map(doc => (doc.data() as ProgramInvite).email)
        .filter(Boolean)
    );

    // Create invites
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    const createdInvites: ProgramInvite[] = [];

    validEntries.forEach(entry => {
      if (existingEmails.has(entry.email)) {
        // Skip if already invited
        return;
      }

      const inviteCode = nanoid(8).toUpperCase();
      const inviteRef = adminDb.collection('program_invites').doc(inviteCode);

      const inviteData: ProgramInvite = {
        id: inviteCode,
        funnelId,
        programId: funnel.programId,
        organizationId,
        createdBy: userId,
        email: entry.email,
        name: entry.name,
        paymentStatus,
        prePaidNote: prePaidNote?.trim() || undefined,
        useCount: 0,
        createdAt: now,
      };

      batch.set(inviteRef, inviteData);
      createdInvites.push(inviteData);
    });

    await batch.commit();

    // Send emails if requested
    let emailsSent = 0;
    if (sendEmails && createdInvites.length > 0 && program) {
      console.log(`[BULK_INVITE] Sending ${createdInvites.length} invite emails...`);
      
      // Send emails in parallel (with rate limiting)
      const emailPromises = createdInvites.map(async (invite) => {
        try {
          const result = await sendInviteEmail({
            email: invite.email!,
            name: invite.name,
            inviteCode: invite.id,
            programSlug: program.slug,
            funnelSlug: funnel.slug,
            programName: program.name,
            organizationId,
          });
          if (result.success) {
            return true;
          }
          return false;
        } catch (e) {
          console.error(`[BULK_INVITE] Failed to send email to ${invite.email}:`, e);
          return false;
        }
      });

      const results = await Promise.all(emailPromises);
      emailsSent = results.filter(Boolean).length;
      console.log(`[BULK_INVITE] Sent ${emailsSent}/${createdInvites.length} emails`);
    }

    console.log(`[COACH_ORG_INVITES_BULK] Created ${createdInvites.length} invites for funnel ${funnelId}`);

    return NextResponse.json({
      success: true,
      created: createdInvites.length,
      skipped: validEntries.length - createdInvites.length,
      emailsSent,
      errors,
      invites: createdInvites,
    });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_BULK]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Send an invite email to a prospective client
 */
async function sendInviteEmail({
  email,
  name,
  inviteCode,
  programSlug,
  funnelSlug,
  programName,
  organizationId,
}: {
  email: string;
  name?: string;
  inviteCode: string;
  programSlug: string;
  funnelSlug: string;
  programName: string;
  organizationId: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const appTitle = await getAppTitleForEmail(organizationId);
  const logoUrl = await getLogoUrlForEmail(organizationId);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  const inviteUrl = `${APP_BASE_URL}/join/${programSlug}/${funnelSlug}?invite=${inviteCode}`;
  const recipientName = name || 'there';

  const subject = `You're Invited to Join ${programName} 🎉`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #faf8f6;">
  <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="${logoUrl}" alt="${teamName}" style="width: 60px; height: 60px; border-radius: 12px;">
    </div>
    
    <p style="font-size: 18px; margin-bottom: 20px;">Hey ${recipientName},</p>
    
    <p style="margin-bottom: 20px;">You've been personally invited to join <strong>${programName}</strong>.</p>
    
    <p style="margin-bottom: 25px;">Click the button below to get started:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #a07855 0%, #8c6245 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
        Accept Your Invitation →
      </a>
    </div>
    
    <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
      Or copy this link: <a href="${inviteUrl}" style="color: #a07855;">${inviteUrl}</a>
    </p>
    
    <p style="margin-bottom: 30px;">We can't wait to have you on board!</p>
    
    <p style="color: #666;">— The ${teamName} Team</p>
  </div>
  
  <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
    © ${new Date().getFullYear()} ${teamName}. All rights reserved.
  </p>
</body>
</html>
`;

  const textBody = `
Hey ${recipientName},

You've been personally invited to join ${programName}.

Click here to get started: ${inviteUrl}

We can't wait to have you on board!

— The ${teamName} Team
`;

  return sendTenantEmail({
    to: email,
    subject,
    html: htmlBody,
    text: textBody,
    organizationId,
  });
}
