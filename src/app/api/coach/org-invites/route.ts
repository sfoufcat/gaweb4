import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { sendTenantEmail, getLogoUrlForEmail, getAppTitleForEmail, APP_BASE_URL } from '@/lib/email-sender';
import { nanoid } from 'nanoid';
import type { ProgramInvite, Funnel, Program, Squad } from '@/types';

/**
 * GET /api/coach/org-invites
 * Get all invites for the coach's organization
 * 
 * Query params:
 * - programId?: string (filter by program)
 * - funnelId?: string (filter by funnel)
 */
export async function GET(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get('programId');
    const funnelId = searchParams.get('funnelId');

    // Build query - fetch by organizationId and optionally filter client-side
    // (Firestore requires composite indexes for multiple where + orderBy)
    const snapshot = await adminDb
      .collection('program_invites')
      .where('organizationId', '==', organizationId)
      .get();

    let invites = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProgramInvite[];

    // Filter by programId or funnelId if provided
    if (programId) {
      invites = invites.filter(inv => inv.programId === programId);
    }
    if (funnelId) {
      invites = invites.filter(inv => inv.funnelId === funnelId);
    }

    // Sort by createdAt descending and limit
    invites = invites
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 100);

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-invites
 * Create a new invite code
 * 
 * Body:
 * - funnelId: string (required)
 * - email?: string (for email invite)
 * - name?: string (invitee name)
 * - paymentStatus?: 'required' | 'pre_paid' | 'free'
 * - prePaidNote?: string
 * - targetSquadId?: string
 * - targetCohortId?: string
 * - maxUses?: number
 * - expiresAt?: string (ISO date)
 * - sendEmail?: boolean (send invite email if email is provided)
 */
export async function POST(req: Request) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const { 
      funnelId, 
      email, 
      name,
      paymentStatus = 'required',
      prePaidNote,
      targetSquadId,
      targetCohortId,
      maxUses,
      expiresAt,
      sendEmail = false,
    } = body;

    if (!funnelId) {
      return NextResponse.json({ error: 'Funnel ID is required' }, { status: 400 });
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

    // Get program for the invite link (only if funnel targets a program)
    let program: Program | null = null;
    if (funnel.programId) {
      const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
      program = programDoc.exists ? (programDoc.data() as Program) : null;
    }

    // Get squad for the invite link (only if funnel targets a squad)
    let squad: (Squad & { slug?: string }) | null = null;
    if (funnel.squadId) {
      const squadDoc = await adminDb.collection('squads').doc(funnel.squadId).get();
      if (squadDoc.exists) {
        const squadData = squadDoc.data();
        squad = { id: squadDoc.id, ...squadData } as Squad & { slug?: string };
      }
    }

    // Generate invite code
    const inviteCode = nanoid(8).toUpperCase();

    const now = new Date().toISOString();
    const inviteData: ProgramInvite = {
      id: inviteCode,
      funnelId,
      programId: funnel.programId,
      organizationId,
      createdBy: userId,
      email: email?.trim().toLowerCase() || undefined,
      name: name?.trim() || undefined,
      paymentStatus,
      prePaidNote: prePaidNote?.trim() || undefined,
      targetSquadId: targetSquadId || undefined,
      targetCohortId: targetCohortId || undefined,
      maxUses: maxUses || undefined,
      useCount: 0,
      expiresAt: expiresAt || undefined,
      createdAt: now,
    };

    // Save invite
    await adminDb.collection('program_invites').doc(inviteCode).set(inviteData);

    console.log(`[COACH_ORG_INVITES] Created invite ${inviteCode} for funnel ${funnelId}`);

    // Send invite email if requested and email is provided
    let emailSent = false;
    if (sendEmail && inviteData.email && (program || squad)) {
      try {
        const emailResult = await sendInviteEmail({
          email: inviteData.email,
          name: inviteData.name,
          inviteCode,
          funnelSlug: funnel.slug,
          organizationId,
          // Program funnel params
          programSlug: program?.slug,
          programName: program?.name,
          // Squad funnel params
          squadSlug: squad?.slug,
          squadName: squad?.name,
        });
        emailSent = emailResult.success;
        if (emailResult.success) {
          console.log(`[COACH_ORG_INVITES] Sent invite email to ${inviteData.email}`);
        } else {
          console.error(`[COACH_ORG_INVITES] Failed to send invite email: ${emailResult.error}`);
        }
      } catch (emailError) {
        console.error('[COACH_ORG_INVITES] Error sending invite email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      invite: inviteData,
      emailSent,
    });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Send an invite email to a prospective client
 * Supports both program funnels and squad funnels
 */
async function sendInviteEmail({
  email,
  name,
  inviteCode,
  funnelSlug,
  organizationId,
  // Program funnel params (optional)
  programSlug,
  programName,
  // Squad funnel params (optional)
  squadSlug,
  squadName,
}: {
  email: string;
  name?: string;
  inviteCode: string;
  funnelSlug: string;
  organizationId: string;
  programSlug?: string;
  programName?: string;
  squadSlug?: string;
  squadName?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const appTitle = await getAppTitleForEmail(organizationId);
  const logoUrl = await getLogoUrlForEmail(organizationId);
  const teamName = appTitle === 'GrowthAddicts' ? 'Growth Addicts' : appTitle;
  
  // Generate the correct invite URL based on funnel type
  let inviteUrl: string;
  let targetName: string;
  
  if (programSlug && programName) {
    // Program funnel: /join/{programSlug}/{funnelSlug}?invite={code}
    inviteUrl = `${APP_BASE_URL}/join/${programSlug}/${funnelSlug}?invite=${inviteCode}`;
    targetName = programName;
  } else if (squadSlug && squadName) {
    // Squad funnel: /join/squad/{squadSlug}/{funnelSlug}?invite={code}
    inviteUrl = `${APP_BASE_URL}/join/squad/${squadSlug}/${funnelSlug}?invite=${inviteCode}`;
    targetName = squadName;
  } else {
    // Fallback - shouldn't happen but handle gracefully
    return { success: false, error: 'Missing program or squad information for invite email' };
  }
  
  const recipientName = name || 'there';

  const subject = `You're Invited to Join ${targetName} 🎉`;

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
    
    <p style="margin-bottom: 20px;">You've been personally invited to join <strong>${targetName}</strong>.</p>
    
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

You've been personally invited to join ${targetName}.

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
