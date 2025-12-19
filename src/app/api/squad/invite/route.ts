import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  generateShortCode,
  createInviteLinkData,
  getInviteBaseUrl, 
  determineSquadType 
} from '@/lib/invite-tokens';
import type { Squad } from '@/types';

/**
 * POST /api/squad/invite
 * Generate an invite link for the user's current squad.
 * 
 * Now uses short 8-character codes stored in Firestore instead of long JWTs.
 * 
 * Response:
 * - code: string - The 8-char invite code
 * - inviteUrl: string - Full invite URL
 * - squadType: 'private' | 'public' | 'premium'
 * - joinCode?: string - For private squads only
 */
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get user's current squad
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const squadId = userData?.squadId;
    
    if (!squadId) {
      return NextResponse.json({ error: 'You are not in a squad' }, { status: 400 });
    }

    // Get squad details
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    const squadType = determineSquadType(squad);

    // Generate a unique short code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;
    
    do {
      code = generateShortCode();
      const existing = await adminDb.collection('inviteLinks').doc(code).get();
      if (!existing.exists) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      console.error('[SQUAD_INVITE] Failed to generate unique code after max attempts');
      return NextResponse.json({ error: 'Failed to generate invite link' }, { status: 500 });
    }

    // Create invite link data
    const inviteLinkData = createInviteLinkData({
      inviterUserId: userId,
      inviterSquadId: squadId,
      squadName: squad.name,
      squadType,
      joinCode: squadType === 'private' ? squad.inviteCode : undefined,
      requiresPremium: squadType === 'premium',
    });

    // Store in Firestore
    await adminDb.collection('inviteLinks').doc(code).set({
      ...inviteLinkData,
      code,
    });

    const baseUrl = getInviteBaseUrl();
    const inviteUrl = `${baseUrl}/invite/${code}`;

    return NextResponse.json({
      code,
      inviteUrl,
      squadType,
      squadName: squad.name,
      joinCode: squadType === 'private' ? squad.inviteCode : undefined,
    });
  } catch (error) {
    console.error('[SQUAD_INVITE_GENERATE_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
