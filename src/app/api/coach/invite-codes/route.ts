/**
 * Coach Invite Codes Management API
 * 
 * POST /api/coach/invite-codes - Create a new invite code
 * GET /api/coach/invite-codes - List all org invite codes
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgInviteCode, UserTier, UserTrack } from '@/types';

/**
 * Generate a unique invite code
 * Format: GA-XXXXXX (8 chars total)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0,O,1,I)
  let code = 'GA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/coach/invite-codes
 * Create a new invite code with tier/track/squad settings
 * 
 * Body:
 * - name: string (optional) - Friendly name for the code
 * - tier: 'standard' | 'premium' (default: 'standard')
 * - track: UserTrack | null (optional)
 * - squadId: string | null (optional)
 * - maxUses: number | null (optional) - null = unlimited
 * - expiresAt: string | null (optional) - ISO date, null = never expires
 * - accessDurationDays: number | null (optional) - Days of access after redemption
 */
export async function POST(request: Request) {
  try {
    const { organizationId, userId: coachUserId } = await requireCoachWithOrg();
    const body = await request.json();
    
    const {
      name,
      tier = 'standard',
      track = null,
      squadId = null,
      maxUses = null,
      expiresAt = null,
      accessDurationDays = null,
    } = body;
    
    // Validate tier
    const validTiers: UserTier[] = ['standard', 'premium'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier. Must be "standard" or "premium"' }, { status: 400 });
    }
    
    // Validate expiresAt if provided
    if (expiresAt !== null && isNaN(Date.parse(expiresAt))) {
      return NextResponse.json({ error: 'Invalid expiresAt date' }, { status: 400 });
    }
    
    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    const maxAttempts = 10;
    
    // Ensure code is unique
    while (attempts < maxAttempts) {
      const existingCode = await adminDb.collection('org_invite_codes').doc(code).get();
      if (!existingCode.exists) break;
      code = generateInviteCode();
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }
    
    const now = new Date().toISOString();
    
    const inviteCode: OrgInviteCode = {
      id: code,
      organizationId,
      createdByUserId: coachUserId,
      name: name || null,
      tier: tier as UserTier,
      track: track as UserTrack | null,
      squadId,
      accessDurationDays,
      maxUses,
      usedCount: 0,
      expiresAt,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    
    await adminDb.collection('org_invite_codes').doc(code).set(inviteCode);
    
    console.log(`[INVITE_CODES] Created code ${code} for org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      code: inviteCode,
    });
  } catch (error) {
    console.error('[INVITE_CODES_POST_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * GET /api/coach/invite-codes
 * List all invite codes for the organization
 * 
 * Query params:
 * - includeInactive: boolean (default: false)
 */
export async function GET(request: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    let query = adminDb
      .collection('org_invite_codes')
      .where('organizationId', '==', organizationId)
      .orderBy('createdAt', 'desc');
    
    if (!includeInactive) {
      query = query.where('isActive', '==', true);
    }
    
    const snapshot = await query.get();
    
    const codes: OrgInviteCode[] = snapshot.docs.map(doc => doc.data() as OrgInviteCode);
    
    return NextResponse.json({
      codes,
      totalCount: codes.length,
    });
  } catch (error) {
    console.error('[INVITE_CODES_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}







