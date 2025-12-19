import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { 
  verifyInviteToken, 
  isShortCode, 
  inviteLinkToPayload,
  isInviteLinkExpired,
  type InviteLinkData 
} from '@/lib/invite-tokens';
import { adminDb } from '@/lib/firebase-admin';
import type { Squad } from '@/types';

/**
 * POST /api/squad/validate-invite
 * Validate an invite token/code without joining.
 * Returns the token payload and inviter information.
 * 
 * Supports both:
 * - Short codes (8 alphanumeric chars) - stored in Firestore
 * - JWT tokens - for backward compatibility with existing links
 * 
 * Body:
 * - token: string (required) - The invite code or JWT token to validate
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body as { token: string };

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    let payload;
    let squadId: string;

    // Check if it's a short code or JWT
    if (isShortCode(token)) {
      // Lookup in Firestore
      const inviteLinkDoc = await adminDb.collection('inviteLinks').doc(token.toUpperCase()).get();
      
      if (!inviteLinkDoc.exists) {
        return NextResponse.json({ 
          error: 'Invalid invite link' 
        }, { status: 400 });
      }

      const inviteLink = inviteLinkDoc.data() as InviteLinkData;
      
      // Check expiration
      if (isInviteLinkExpired(inviteLink)) {
        return NextResponse.json({ 
          error: 'This invite link has expired' 
        }, { status: 400 });
      }

      payload = inviteLinkToPayload(inviteLink);
      squadId = inviteLink.inviterSquadId;
    } else {
      // Verify as JWT (backward compatibility)
      const decoded = await verifyInviteToken(token);
      if (!decoded.valid || !decoded.payload) {
        return NextResponse.json({ 
          error: decoded.error || 'Invalid invite link' 
        }, { status: 400 });
      }
      payload = decoded.payload;
      squadId = payload.inviterSquadId;
    }

    // Verify the squad still exists
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ 
        error: 'This squad no longer exists' 
      }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;

    // Get inviter's name
    let inviterName = 'Your friend';
    try {
      const clerk = await clerkClient();
      const inviter = await clerk.users.getUser(payload.inviterUserId);
      inviterName = inviter.firstName || inviter.username || 'Your friend';
    } catch (err) {
      console.warn('Could not fetch inviter info:', err);
    }

    return NextResponse.json({
      valid: true,
      payload: {
        ...payload,
        // Update squad name from current data in case it changed
        squadName: squad.name,
      },
      inviterName,
      squadAvatarUrl: squad.avatarUrl,
    });
  } catch (error) {
    console.error('[VALIDATE_INVITE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
