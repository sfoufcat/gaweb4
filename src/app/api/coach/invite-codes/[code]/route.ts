/**
 * Coach Invite Code Management API
 * 
 * GET /api/coach/invite-codes/[code] - Get code details
 * PATCH /api/coach/invite-codes/[code] - Update code settings
 * DELETE /api/coach/invite-codes/[code] - Deactivate code
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { OrgInviteCode, UserTier, UserTrack } from '@/types';

/**
 * GET /api/coach/invite-codes/[code]
 * Get invite code details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    const codeDoc = await adminDb.collection('org_invite_codes').doc(code).get();
    
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    const codeData = codeDoc.data() as OrgInviteCode;
    
    // Verify the code belongs to this organization
    if (codeData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    // Get redemption history
    const redemptionsSnapshot = await adminDb
      .collection('org_invite_code_redemptions')
      .where('codeId', '==', code)
      .orderBy('redeemedAt', 'desc')
      .limit(50)
      .get();
    
    const redemptions = redemptionsSnapshot.docs.map(doc => doc.data());
    
    return NextResponse.json({
      code: codeData,
      redemptions,
    });
  } catch (error) {
    console.error('[INVITE_CODE_GET_ERROR]', error);
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
 * PATCH /api/coach/invite-codes/[code]
 * Update invite code settings
 * 
 * Body (all optional):
 * - name: string
 * - tier: 'standard' | 'premium'
 * - track: UserTrack | null
 * - squadId: string | null
 * - maxUses: number | null
 * - expiresAt: string | null
 * - accessDurationDays: number | null
 * - isActive: boolean
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    const codeDoc = await adminDb.collection('org_invite_codes').doc(code).get();
    
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    const codeData = codeDoc.data() as OrgInviteCode;
    
    // Verify the code belongs to this organization
    if (codeData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    const body = await request.json();
    const { name, tier, track, squadId, maxUses, expiresAt, accessDurationDays, isActive } = body;
    
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    
    if (name !== undefined) updates.name = name;
    
    if (tier !== undefined) {
      const validTiers: UserTier[] = ['standard', 'premium'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
      }
      updates.tier = tier;
    }
    
    if (track !== undefined) updates.track = track as UserTrack | null;
    if (squadId !== undefined) updates.squadId = squadId;
    if (maxUses !== undefined) updates.maxUses = maxUses;
    if (accessDurationDays !== undefined) updates.accessDurationDays = accessDurationDays;
    
    if (expiresAt !== undefined) {
      if (expiresAt !== null && isNaN(Date.parse(expiresAt))) {
        return NextResponse.json({ error: 'Invalid expiresAt date' }, { status: 400 });
      }
      updates.expiresAt = expiresAt;
    }
    
    if (isActive !== undefined) {
      updates.isActive = isActive === true;
    }
    
    await codeDoc.ref.update(updates);
    
    console.log(`[INVITE_CODES] Updated code ${code}`);
    
    return NextResponse.json({
      success: true,
      code: { ...codeData, ...updates },
    });
  } catch (error) {
    console.error('[INVITE_CODE_PATCH_ERROR]', error);
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
 * DELETE /api/coach/invite-codes/[code]
 * Deactivate an invite code (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    const codeDoc = await adminDb.collection('org_invite_codes').doc(code).get();
    
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    const codeData = codeDoc.data() as OrgInviteCode;
    
    // Verify the code belongs to this organization
    if (codeData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }
    
    // Soft delete by setting isActive to false
    await codeDoc.ref.update({
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    
    console.log(`[INVITE_CODES] Deactivated code ${code}`);
    
    return NextResponse.json({
      success: true,
      message: 'Invite code deactivated',
    });
  } catch (error) {
    console.error('[INVITE_CODE_DELETE_ERROR]', error);
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









