import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ClerkPublicMetadata, OrgMembership } from '@/types';

/**
 * Profile fields that can be updated per-organization
 */
const ALLOWED_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'imageUrl',
  'bio',
  'goal',
  'goalTargetDate',
  'goalSummary',
  'goalCompleted',
  'goalProgress',
  'identity',
  'workdayStyle',
  'businessStage',
  'obstacles',
  'goalImpact',
  'supportNeeds',
  'timezone',
  'weeklyFocus',
  'publicFocus',
  'publicFocusSummary',
] as const;

/**
 * GET /api/org/profile
 * Fetches the current user's profile for the current organization
 * 
 * MULTI-TENANCY: Profile data is stored per-organization in org_memberships
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Fetch org membership (contains org-scoped profile data)
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      // No membership found - return empty profile
      return NextResponse.json({
        profile: null,
        organizationId,
      });
    }

    const memberData = membershipSnapshot.docs[0].data() as OrgMembership;
    const memberId = membershipSnapshot.docs[0].id;

    // Extract profile fields from membership
    const profile = {
      id: memberId,
      userId,
      organizationId,
      firstName: memberData.firstName,
      lastName: memberData.lastName,
      imageUrl: memberData.imageUrl,
      bio: memberData.bio,
      goal: memberData.goal,
      goalTargetDate: memberData.goalTargetDate,
      goalSummary: memberData.goalSummary,
      goalCompleted: memberData.goalCompleted,
      goalProgress: memberData.goalProgress,
      identity: memberData.identity,
      workdayStyle: memberData.workdayStyle,
      businessStage: memberData.businessStage,
      obstacles: memberData.obstacles,
      goalImpact: memberData.goalImpact,
      supportNeeds: memberData.supportNeeds,
      timezone: memberData.timezone,
      weeklyFocus: memberData.weeklyFocus,
      onboardingStatus: memberData.onboardingStatus,
      hasCompletedOnboarding: memberData.hasCompletedOnboarding,
      // Membership-specific fields
      tier: memberData.tier,
      track: memberData.track,
      squadId: memberData.squadId,
      premiumSquadId: memberData.premiumSquadId,
      orgRole: memberData.orgRole,
    };

    return NextResponse.json({
      profile,
      organizationId,
    });
  } catch (error) {
    console.error('[ORG_PROFILE_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/org/profile
 * Updates the current user's profile for the current organization
 * 
 * MULTI-TENANCY: Profile data is stored per-organization in org_memberships
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Filter to only allowed profile fields
    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    for (const field of ALLOWED_PROFILE_FIELDS) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Fetch org membership
    const membershipSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (membershipSnapshot.empty) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    const memberRef = membershipSnapshot.docs[0].ref;

    // Update membership with profile data
    await memberRef.update(updateData);

    // Fetch updated data
    const updatedDoc = await memberRef.get();
    const updatedData = updatedDoc.data() as OrgMembership;

    return NextResponse.json({
      success: true,
      profile: {
        ...updatedData,
        id: updatedDoc.id, // Override any id in updatedData with the doc id
      },
    });
  } catch (error) {
    console.error('[ORG_PROFILE_PATCH_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/profile
 * Initializes a profile for the current organization (creates org_membership if needed)
 * 
 * This is called during onboarding to set up the initial org-scoped profile
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get effective org ID
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const userSessionOrgId = publicMetadata?.organizationId || null;
    const organizationId = await getEffectiveOrgId(userSessionOrgId);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    const body = await request.json();
    const now = new Date().toISOString();

    // Check if membership already exists
    const existingSnapshot = await adminDb.collection('org_memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      // Update existing membership
      const memberRef = existingSnapshot.docs[0].ref;
      const updateData: Record<string, unknown> = { updatedAt: now };
      
      for (const field of ALLOWED_PROFILE_FIELDS) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }
      
      await memberRef.update(updateData);
      const updatedDoc = await memberRef.get();
      
      return NextResponse.json({
        success: true,
        profile: { id: updatedDoc.id, ...updatedDoc.data() },
        created: false,
      });
    }

    // Create new org membership with profile data
    const membershipData: Partial<OrgMembership> & { userId: string; organizationId: string } = {
      userId,
      organizationId,
      orgRole: 'member',
      tier: 'free',
      track: null,
      squadId: null,
      accessSource: 'invite_code',
      accessExpiresAt: null,
      inviteCodeUsed: null,
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    // Add profile fields from body
    for (const field of ALLOWED_PROFILE_FIELDS) {
      if (body[field] !== undefined) {
        (membershipData as Record<string, unknown>)[field] = body[field];
      }
    }

    const docRef = await adminDb.collection('org_memberships').add(membershipData);

    return NextResponse.json({
      success: true,
      profile: { id: docRef.id, ...membershipData },
      created: true,
    }, { status: 201 });
  } catch (error) {
    console.error('[ORG_PROFILE_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

