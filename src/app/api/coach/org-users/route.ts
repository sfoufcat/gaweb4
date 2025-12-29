import { clerkClient, auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, ClerkPublicMetadata } from '@/lib/admin-utils-clerk';
import type { UserRole, UserTier, UserTrack, CoachingStatus, OrgRole, OrgMembership, ProgramType } from '@/types';

interface FirebaseUserData {
  tier?: UserTier;
  track?: UserTrack | null;
  squadIds?: string[];
  standardSquadId?: string | null;
  premiumSquadId?: string | null;
  coaching?: {
    status?: CoachingStatus;
  };
  invitedBy?: string;
  inviteCode?: string;
  invitedAt?: string;
}

interface OrgMembershipData {
  tier?: UserTier;
  track?: UserTrack | null;
  squadIds?: string[];
  squadId?: string | null;
  premiumSquadId?: string | null;
  orgRole?: OrgRole;
}

interface ClerkUserMetadata {
  role?: UserRole;
  orgRole?: OrgRole;
  organizationId?: string;
  coaching?: boolean;
  coachingStatus?: CoachingStatus;
}

// Program enrollment info to return with each user
interface UserProgramEnrollment {
  programId: string;
  programName: string;
  programType: ProgramType;
  status: 'active' | 'upcoming' | 'completed';
}

/**
 * GET /api/coach/org-users
 * Fetches all users belonging to the coach's organization
 * 
 * Uses Clerk's Organization Membership API for proper multi-tenancy.
 * Falls back to publicMetadata filtering for backward compatibility.
 * 
 * Returns squadIds[] array for each user (proper multi-squad support)
 */
export async function GET() {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_USERS] Fetching users for organization: ${organizationId}`);

    const client = await clerkClient();
    
    // Primary method: Use Clerk's Organization Membership API
    // This gets actual org members (the proper way)
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 500,
    });

    // Build a map of user ID -> native Clerk org role (org:admin, org:member)
    // This is used to detect super_coach users who may not have orgRole in metadata
    const nativeOrgRoles = new Map<string, string>();
    memberships.data.forEach(m => {
      const userId = m.publicUserData?.userId;
      if (userId && m.role) {
        nativeOrgRoles.set(userId, m.role);
      }
    });

    // Get user IDs from memberships
    const memberUserIds = memberships.data
      .map(m => m.publicUserData?.userId)
      .filter((id): id is string => !!id);

    // Fetch full user data for members
    let orgUsers: Awaited<ReturnType<typeof client.users.getUserList>>['data'] = [];
    
    if (memberUserIds.length > 0) {
      // Fetch users in batches (Clerk may have limits)
      const { data: users } = await client.users.getUserList({
        userId: memberUserIds,
        limit: 500,
      });
      orgUsers = users;
    }

    // Fallback: Also include users with publicMetadata.organizationId for backward compatibility
    // This catches users who were assigned before the migration
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
      orderBy: '-created_at',
    });
    
    const metadataOrgUsers = allUsers.filter((user) => {
      const metadata = user.publicMetadata as ClerkUserMetadata;
      return metadata?.organizationId === organizationId && !memberUserIds.includes(user.id);
    });
    
    // Combine both sets (members + metadata-based, deduplicated)
    const combinedUsers = [...orgUsers, ...metadataOrgUsers];

    console.log(`[COACH_ORG_USERS] Found ${combinedUsers.length} users in organization ${organizationId} (${orgUsers.length} members + ${metadataOrgUsers.length} metadata-based)`);

    // Fetch tier, coaching, and referral data from Firebase for org users
    const userIds = combinedUsers.map(u => u.id);
    const firebaseUserData = new Map<string, FirebaseUserData>();
    const orgMembershipData = new Map<string, OrgMembershipData>();
    const userSquadIds = new Map<string, string[]>(); // userId -> squadIds from squadMembers
    const userProgramEnrollments = new Map<string, UserProgramEnrollment[]>(); // userId -> program enrollments
    
    if (userIds.length > 0) {
      // Batch fetch user data in chunks of 10 (Firestore 'in' query limit)
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const snapshot = await adminDb
          .collection('users')
          .where('__name__', 'in', chunk)
          .get();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          firebaseUserData.set(doc.id, {
            tier: data.tier as UserTier | undefined,
            track: data.track as UserTrack | null | undefined,
            squadIds: data.squadIds as string[] | undefined,
            standardSquadId: data.standardSquadId as string | null | undefined,
            premiumSquadId: data.premiumSquadId as string | null | undefined,
            coaching: data.coaching,
            invitedBy: data.invitedBy,
            inviteCode: data.inviteCode,
            invitedAt: data.invitedAt,
          });
        });
      }
      
      // Fetch org_memberships for track/squad data (authoritative for multi-tenant)
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const membershipSnapshot = await adminDb
          .collection('org_memberships')
          .where('userId', 'in', chunk)
          .where('organizationId', '==', organizationId)
          .get();
        
        membershipSnapshot.forEach((doc) => {
          const data = doc.data();
          orgMembershipData.set(data.userId, {
            tier: data.tier as UserTier | undefined,
            track: data.track as UserTrack | null | undefined,
            squadIds: data.squadIds as string[] | undefined,
            squadId: data.squadId as string | null | undefined,
            premiumSquadId: data.premiumSquadId as string | null | undefined,
            orgRole: data.orgRole as OrgRole | undefined,
          });
        });
      }
      
      // Fetch actual squad memberships from squadMembers collection
      // This is the authoritative source for multi-squad membership
      for (let i = 0; i < userIds.length; i += 10) {
        const chunk = userIds.slice(i, i + 10);
        const squadMembersSnapshot = await adminDb
          .collection('squadMembers')
          .where('userId', 'in', chunk)
          .get();
        
        squadMembersSnapshot.forEach((doc) => {
          const data = doc.data();
          const userId = data.userId as string;
          const squadId = data.squadId as string;
          
          const existing = userSquadIds.get(userId) || [];
          if (!existing.includes(squadId)) {
            existing.push(squadId);
            userSquadIds.set(userId, existing);
          }
        });
      }
      
      // Fetch program enrollments for all users in this organization
      // Get active and upcoming enrollments
      const enrollmentsSnapshot = await adminDb
        .collection('program_enrollments')
        .where('organizationId', '==', organizationId)
        .where('status', 'in', ['active', 'upcoming'])
        .get();
      
      // Build a map of programId -> program data for efficient lookup
      const programIds = new Set<string>();
      enrollmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        programIds.add(data.programId as string);
      });
      
      const programDataMap = new Map<string, { name: string; type: ProgramType }>();
      
      // Fetch program data in chunks
      const programIdsArray = Array.from(programIds);
      for (let i = 0; i < programIdsArray.length; i += 10) {
        const chunk = programIdsArray.slice(i, i + 10);
        const programsSnapshot = await adminDb
          .collection('programs')
          .where('__name__', 'in', chunk)
          .get();
        
        programsSnapshot.forEach((doc) => {
          const data = doc.data();
          programDataMap.set(doc.id, {
            name: data.name as string,
            type: data.type as ProgramType,
          });
        });
      }
      
      // Map enrollments to users
      enrollmentsSnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId as string;
        const programId = data.programId as string;
        const program = programDataMap.get(programId);
        
        if (program) {
          const enrollment: UserProgramEnrollment = {
            programId,
            programName: program.name,
            programType: program.type,
            status: data.status as 'active' | 'upcoming' | 'completed',
          };
          
          const existing = userProgramEnrollments.get(userId) || [];
          existing.push(enrollment);
          userProgramEnrollments.set(userId, existing);
        }
      });
    }

    // Build a map of user IDs to names for inviter lookup
    const userIdToName = new Map<string, string>();
    combinedUsers.forEach((user) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User';
      userIdToName.set(user.id, name);
    });

    // Transform to our format
    const transformedUsers = combinedUsers.map((user) => {
      const fbData = firebaseUserData.get(user.id);
      const membershipData = orgMembershipData.get(user.id);
      const clerkMetadata = user.publicMetadata as ClerkUserMetadata;
      
      const invitedByName = fbData?.invitedBy 
        ? userIdToName.get(fbData.invitedBy) || 'Unknown User'
        : null;
      
      // Get squad IDs from squadMembers (authoritative), fall back to other sources
      let squadIds = userSquadIds.get(user.id) || [];
      
      // If no squadMembers records, fall back to org_membership squadIds or user squadIds
      if (squadIds.length === 0) {
        squadIds = membershipData?.squadIds || fbData?.squadIds || [];
      }
      
      // If still empty, check legacy single-value fields
      if (squadIds.length === 0) {
        const legacySquadId = membershipData?.squadId ?? fbData?.standardSquadId;
        if (legacySquadId) {
          squadIds = [legacySquadId];
        }
      }
      
      // Org role resolution with native Clerk role detection:
      // 1. If user is org:admin in Clerk, they are super_coach
      // 2. Fall back to Clerk metadata orgRole
      // 3. Fall back to org_memberships collection
      // 4. Default to 'member'
      const nativeRole = nativeOrgRoles.get(user.id);
      let resolvedOrgRole: OrgRole;
      
      if (nativeRole === 'org:admin') {
        // User is org admin in Clerk = super_coach
        resolvedOrgRole = 'super_coach';
      } else {
        resolvedOrgRole = (clerkMetadata?.orgRole as OrgRole) || membershipData?.orgRole || 'member';
      }
      
      // Get program enrollments for this user
      const programs = userProgramEnrollments.get(user.id) || [];
      
      // Org membership data takes precedence (multi-tenant), fallback to Firebase user data
      return {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
        imageUrl: user.imageUrl || '',
        role: (clerkMetadata?.role as UserRole) || 'user',
        orgRole: resolvedOrgRole,
        tier: membershipData?.tier || fbData?.tier || 'free',
        track: membershipData?.track ?? fbData?.track ?? null,
        // Multi-squad support - return array of squad IDs
        squadIds,
        // Legacy single-value field for backward compatibility
        squadId: squadIds.length > 0 ? squadIds[0] : (membershipData?.squadId ?? fbData?.standardSquadId ?? null),
        premiumSquadId: membershipData?.premiumSquadId ?? fbData?.premiumSquadId ?? null,
        coachingStatus: clerkMetadata?.coachingStatus || fbData?.coaching?.status || 'none',
        coaching: clerkMetadata?.coaching,
        // Program enrollments with type and name
        programs,
        invitedBy: fbData?.invitedBy || null,
        invitedByName,
        inviteCode: fbData?.inviteCode || null,
        invitedAt: fbData?.invitedAt || null,
        createdAt: new Date(user.createdAt).toISOString(),
        updatedAt: new Date(user.updatedAt).toISOString(),
      };
    });

    // Auto-sync: Fix orgRole metadata for org:admin users who are missing it
    // This ensures super_coaches have correct metadata for frontend detection
    const usersToSync: string[] = [];
    for (const user of combinedUsers) {
      const nativeRole = nativeOrgRoles.get(user.id);
      const clerkMetadata = user.publicMetadata as ClerkUserMetadata;
      
      // If user is org:admin but doesn't have orgRole: super_coach in metadata, sync it
      if (nativeRole === 'org:admin' && clerkMetadata?.orgRole !== 'super_coach') {
        usersToSync.push(user.id);
      }
    }
    
    // Perform auto-sync in background (don't block response)
    if (usersToSync.length > 0) {
      console.log(`[COACH_ORG_USERS] Auto-syncing orgRole for ${usersToSync.length} org:admin users`);
      
      // Run sync asynchronously - don't await
      Promise.all(usersToSync.map(async (userId) => {
        try {
          const user = combinedUsers.find(u => u.id === userId);
          if (user) {
            await client.users.updateUserMetadata(userId, {
              publicMetadata: {
                ...user.publicMetadata,
                orgRole: 'super_coach',
                organizationId,
              },
            });
            console.log(`[COACH_ORG_USERS] Synced orgRole=super_coach for user ${userId}`);
          }
        } catch (syncError) {
          console.error(`[COACH_ORG_USERS] Failed to sync orgRole for user ${userId}:`, syncError);
        }
      })).catch(err => console.error('[COACH_ORG_USERS] Sync batch error:', err));
    }

    // Also return current user's effective orgRole for frontend permission checks
    // Get current user from auth session
    const { userId: currentUserId } = await auth();
    let currentUserOrgRole: OrgRole | undefined;
    if (currentUserId) {
      const currentNativeRole = nativeOrgRoles.get(currentUserId);
      if (currentNativeRole === 'org:admin') {
        currentUserOrgRole = 'super_coach';
      }
    }

    return NextResponse.json({ 
      users: transformedUsers,
      totalCount: transformedUsers.length,
      organizationId,
      currentUserOrgRole, // Help frontend know current user's effective org role
    });
  } catch (error) {
    console.error('[COACH_ORG_USERS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-users
 * Add a user to the organization by email with tier/track/squad settings
 * 
 * Body:
 * - email: string (required) - User's email
 * - tier: 'free' | 'standard' | 'premium' (optional, default: 'standard')
 * - track: UserTrack | null (optional)
 * - squadId: string | null (optional)
 * - accessDurationDays: number | null (optional) - Days of access, null = indefinite
 * 
 * If user exists in Clerk, they're added to the org.
 * If not, an invite is created (they can claim access when they sign up).
 */
export async function POST(request: Request) {
  try {
    const { organizationId, userId: coachUserId } = await requireCoachWithOrg();
    const body = await request.json();
    
    const { 
      email, 
      tier = 'standard', 
      track = null, 
      squadId = null,
      accessDurationDays = null,
    } = body;
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    
    // Validate tier
    const validTiers: UserTier[] = ['free', 'standard', 'premium'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }
    
    const client = await clerkClient();
    const now = new Date().toISOString();
    
    // Check if user exists in Clerk by email
    const { data: existingUsers } = await client.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    
    if (existingUsers.length > 0) {
      // User exists - add to organization
      const user = existingUsers[0];
      
      // Check if already a member of this org
      const existingMembership = await adminDb
        .collection('org_memberships')
        .where('userId', '==', user.id)
        .where('organizationId', '==', organizationId)
        .limit(1)
        .get();
      
      if (!existingMembership.empty) {
        return NextResponse.json({ 
          error: 'User is already a member of this organization' 
        }, { status: 400 });
      }
      
      // Calculate access expiry if specified
      let accessExpiresAt: string | null = null;
      if (accessDurationDays && accessDurationDays > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + accessDurationDays);
        accessExpiresAt = expiryDate.toISOString();
      }
      
      // Create org_membership with squadIds array
      const membership: Omit<OrgMembership, 'id'> = {
        userId: user.id,
        organizationId,
        orgRole: 'member',
        tier: tier as UserTier,
        track: track as UserTrack | null,
        squadId,
        premiumSquadId: null,
        accessSource: 'manual',
        accessExpiresAt,
        inviteCodeUsed: null,
        isActive: true,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      
      const membershipRef = await adminDb.collection('org_memberships').add(membership);
      await membershipRef.update({ id: membershipRef.id });
      
      // Add to Clerk organization
      try {
        await client.organizations.createOrganizationMembership({
          organizationId,
          userId: user.id,
          role: 'org:member',
        });
      } catch (clerkError: unknown) {
        // Might already be a Clerk org member
        const errorMessage = clerkError instanceof Error ? clerkError.message : String(clerkError);
        if (!errorMessage.includes('already')) {
          console.warn('[COACH_ORG_USERS] Clerk org membership error:', clerkError);
        }
      }
      
      // Update user's publicMetadata
      const currentMetadata = user.publicMetadata as Record<string, unknown>;
      if (!currentMetadata.primaryOrganizationId) {
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: {
            ...currentMetadata,
            primaryOrganizationId: organizationId,
          },
        });
      }
      
      // Update Firebase user
      await adminDb.collection('users').doc(user.id).update({
        tier,
        track,
        updatedAt: now,
      });
      
      console.log(`[COACH_ORG_USERS] Added existing user ${user.id} to org ${organizationId}`);
      
      return NextResponse.json({
        success: true,
        message: 'User added to organization',
        user: {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || email,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          tier,
          track,
          squadId,
        },
        membershipId: membershipRef.id,
      });
    } else {
      // User doesn't exist - create a pending invitation
      // They'll be auto-added when they sign up with this email
      
      // Check if there's already a pending invite for this email
      const existingInvite = await adminDb
        .collection('org_pending_invites')
        .where('email', '==', email.toLowerCase())
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      
      if (!existingInvite.empty) {
        return NextResponse.json({ 
          error: 'A pending invitation already exists for this email' 
        }, { status: 400 });
      }
      
      // Calculate access expiry if specified
      let accessExpiresAt: string | null = null;
      if (accessDurationDays && accessDurationDays > 0) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + accessDurationDays);
        accessExpiresAt = expiryDate.toISOString();
      }
      
      // Create pending invite
      const inviteRef = await adminDb.collection('org_pending_invites').add({
        email: email.toLowerCase(),
        organizationId,
        invitedByUserId: coachUserId,
        tier,
        track,
        squadId,
        accessExpiresAt,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
      
      console.log(`[COACH_ORG_USERS] Created pending invite ${inviteRef.id} for ${email}`);
      
      // TODO: Send invitation email to the user
      
      return NextResponse.json({
        success: true,
        message: 'Invitation created. User will be added when they sign up.',
        inviteId: inviteRef.id,
        email,
        tier,
        track,
        squadId,
        isPending: true,
      });
    }
  } catch (error) {
    console.error('[COACH_ORG_USERS_POST_ERROR]', error);
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
