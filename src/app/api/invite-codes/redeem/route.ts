/**
 * Invite Code Redemption API
 * 
 * POST /api/invite-codes/redeem
 * Redeem an invite code to join an organization
 * 
 * Requires authentication - creates org_membership for the current user
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgInviteCode, OrgMembership, OrgInviteCodeRedemption } from '@/types';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const { code } = body;
    
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }
    
    // Normalize code (uppercase, trim)
    const normalizedCode = code.toUpperCase().trim();
    
    // Get the invite code
    const codeDoc = await adminDb.collection('org_invite_codes').doc(normalizedCode).get();
    
    if (!codeDoc.exists) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 });
    }
    
    const inviteCode = codeDoc.data() as OrgInviteCode;
    
    // Validate code is active
    if (!inviteCode.isActive) {
      return NextResponse.json({ error: 'This invite code is no longer active' }, { status: 400 });
    }
    
    // Validate code hasn't expired
    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This invite code has expired' }, { status: 400 });
    }
    
    // Validate max uses
    if (inviteCode.maxUses !== null && inviteCode.usedCount >= inviteCode.maxUses) {
      return NextResponse.json({ error: 'This invite code has reached its maximum uses' }, { status: 400 });
    }
    
    // Check if user already has a membership in this org
    const existingMembership = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', inviteCode.organizationId)
      .limit(1)
      .get();
    
    if (!existingMembership.empty) {
      return NextResponse.json({ error: 'You are already a member of this organization' }, { status: 400 });
    }
    
    const now = new Date().toISOString();
    
    // Calculate access expiry if specified in the invite code
    let accessExpiresAt: string | null = null;
    if (inviteCode.accessDurationDays && inviteCode.accessDurationDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + inviteCode.accessDurationDays);
      accessExpiresAt = expiryDate.toISOString();
    }
    
    // Create org_membership
    const membership: Omit<OrgMembership, 'id'> = {
      userId,
      organizationId: inviteCode.organizationId,
      orgRole: 'member',
      tier: inviteCode.tier,
      track: inviteCode.track,
      squadId: inviteCode.squadId,
      premiumSquadId: null,
      accessSource: 'invite_code',
      accessExpiresAt,
      inviteCodeUsed: normalizedCode,
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    
    const membershipRef = await adminDb.collection('org_memberships').add(membership);
    await membershipRef.update({ id: membershipRef.id });
    
    // Create redemption record
    const redemption: OrgInviteCodeRedemption = {
      id: membershipRef.id,
      codeId: normalizedCode,
      userId,
      organizationId: inviteCode.organizationId,
      membershipId: membershipRef.id,
      redeemedAt: now,
    };
    
    await adminDb.collection('org_invite_code_redemptions').add(redemption);
    
    // Increment used count
    await codeDoc.ref.update({
      usedCount: inviteCode.usedCount + 1,
      updatedAt: now,
    });
    
    // Add to Clerk organization
    const client = await clerkClient();
    try {
      await client.organizations.createOrganizationMembership({
        organizationId: inviteCode.organizationId,
        userId,
        role: 'org:member',
      });
    } catch (clerkError: unknown) {
      const errorMessage = clerkError instanceof Error ? clerkError.message : String(clerkError);
      if (!errorMessage.includes('already')) {
        console.warn('[INVITE_REDEEM] Clerk org membership error:', clerkError);
      }
    }
    
    // Update user's publicMetadata with primaryOrganizationId if not set
    try {
      const user = await client.users.getUser(userId);
      const metadata = user.publicMetadata as Record<string, unknown>;
      
      if (!metadata?.primaryOrganizationId) {
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...metadata,
            primaryOrganizationId: inviteCode.organizationId,
            organizationId: inviteCode.organizationId,
          },
        });
      }
    } catch (error) {
      console.warn('[INVITE_REDEEM] Could not update user metadata:', error);
    }
    
    // Update Firebase user
    try {
      await adminDb.collection('users').doc(userId).update({
        tier: inviteCode.tier,
        track: inviteCode.track,
        standardSquadId: inviteCode.squadId,
        primaryOrganizationId: inviteCode.organizationId,
        updatedAt: now,
      });
    } catch (error) {
      console.warn('[INVITE_REDEEM] Could not update user doc:', error);
    }
    
    console.log(`[INVITE_REDEEM] User ${userId} redeemed code ${normalizedCode} for org ${inviteCode.organizationId}`);
    
    // Get organization name for response
    let organizationName = 'the organization';
    try {
      const org = await client.organizations.getOrganization({ organizationId: inviteCode.organizationId });
      organizationName = org.name;
    } catch {
      // Ignore
    }
    
    return NextResponse.json({
      success: true,
      message: `Welcome to ${organizationName}!`,
      membership: {
        id: membershipRef.id,
        organizationId: inviteCode.organizationId,
        tier: inviteCode.tier,
        track: inviteCode.track,
        squadId: inviteCode.squadId,
      },
    });
  } catch (error) {
    console.error('[INVITE_REDEEM_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

