import { auth, clerkClient } from '@clerk/nextjs/server';
import type { UserRole, OrgRole, OrgSettings, DEFAULT_ORG_SETTINGS } from '@/types';
import { setupDefaultOrgChannels } from '@/lib/org-channels';
import { adminDb } from '@/lib/firebase-admin';
import { syncTenantToEdgeConfig, DEFAULT_TENANT_BRANDING } from '@/lib/tenant-edge-config';

/**
 * Clerk Organizations Utilities
 * 
 * These utilities manage Clerk Organizations for the multi-tenant architecture.
 * Each coach gets their own organization, which serves as the tenant identifier
 * for branding, content, and future subdomain/custom domain support.
 * 
 * Key concept: organizationId is the stable tenant identifier that:
 * - Survives coach changes (if org transfers ownership)
 * - Can have multiple admins
 * - Is the key for all tenant-scoped data (branding, content, etc.)
 */

// Extended metadata interface to include organizationId and orgRole
export interface ClerkPublicMetadataWithOrg {
  role?: UserRole;
  orgRole?: OrgRole;         // Organization-level role (super_coach, coach, member)
  organizationId?: string;   // Clerk Organization ID this user belongs to (as admin)
  [key: string]: unknown;
}

/**
 * Create a Clerk Organization for a coach
 * Called when a user is assigned the 'coach' role
 * 
 * @param coachUserId - The Clerk user ID of the coach
 * @param coachName - Display name for the organization
 * @returns The created organization ID
 */
export async function createOrganizationForCoach(
  coachUserId: string,
  coachName: string
): Promise<string> {
  const client = await clerkClient();
  
  // Check if user already has an organization
  const user = await client.users.getUser(coachUserId);
  const existingOrgId = (user.publicMetadata as ClerkPublicMetadataWithOrg)?.organizationId;
  
  if (existingOrgId) {
    console.log(`[CLERK_ORGS] Coach ${coachUserId} already has organization ${existingOrgId}`);
    return existingOrgId;
  }
  
  // Create new organization
  const orgName = `${coachName}'s Organization`;
  // Generate a valid slug: alphanumeric and hyphens only
  // Remove 'user_' prefix and any non-alphanumeric characters
  const slugBase = coachUserId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toLowerCase();
  const orgSlug = `coach-${slugBase}`;
  
  console.log(`[CLERK_ORGS] Creating organization for coach ${coachUserId}:`);
  console.log(`[CLERK_ORGS]   - Name: ${orgName}`);
  console.log(`[CLERK_ORGS]   - Slug: ${orgSlug}`);
  
  try {
    const organization = await client.organizations.createOrganization({
      name: orgName,
      slug: orgSlug,
      createdBy: coachUserId,
    });
    
    console.log(`[CLERK_ORGS] Created organization ${organization.id} for coach ${coachUserId}`);
    
    // Store organization ID and set orgRole to super_coach in user's publicMetadata
    await client.users.updateUserMetadata(coachUserId, {
      publicMetadata: {
        ...user.publicMetadata,
        organizationId: organization.id,
        orgRole: 'super_coach', // Organization creator is always the super coach
      },
    });
    
    console.log(`[CLERK_ORGS] Updated coach ${coachUserId} metadata with organizationId ${organization.id} and orgRole: super_coach`);
    
    // Setup default org channels (Announcements, Social Corner, Share Wins)
    try {
      await setupDefaultOrgChannels(organization.id);
      console.log(`[CLERK_ORGS] Set up default channels for organization ${organization.id}`);
    } catch (channelError) {
      // Log but don't fail - channels can be set up later
      console.error(`[CLERK_ORGS] Failed to setup default channels for ${organization.id}:`, channelError);
    }
    
    // Auto-create subdomain in org_domains (for multi-tenant routing)
    try {
      await createOrgDomainEntry(organization.id, orgSlug);
      console.log(`[CLERK_ORGS] Created subdomain ${orgSlug}.growthaddicts.com for organization ${organization.id}`);
    } catch (domainError) {
      // Log but don't fail - subdomain can be set up later via coach dashboard
      console.error(`[CLERK_ORGS] Failed to create subdomain for ${organization.id}:`, domainError);
    }
    
    // Create org_settings with defaults
    try {
      await createDefaultOrgSettings(organization.id);
      console.log(`[CLERK_ORGS] Created default settings for organization ${organization.id}`);
    } catch (settingsError) {
      // Log but don't fail - settings can be created later
      console.error(`[CLERK_ORGS] Failed to create settings for ${organization.id}:`, settingsError);
    }
    
    return organization.id;
  } catch (error: unknown) {
    // Log detailed error information
    const clerkError = error as { 
      errors?: Array<{ code?: string; message?: string; longMessage?: string }>;
      status?: number;
      message?: string;
    };
    
    console.error(`[CLERK_ORGS] Failed to create organization for coach ${coachUserId}`);
    console.error(`[CLERK_ORGS]   - Error status: ${clerkError.status || 'unknown'}`);
    console.error(`[CLERK_ORGS]   - Error message: ${clerkError.message || 'unknown'}`);
    
    if (clerkError.errors && clerkError.errors.length > 0) {
      clerkError.errors.forEach((err, i) => {
        console.error(`[CLERK_ORGS]   - Error ${i + 1}: ${err.code} - ${err.message}`);
        if (err.longMessage) {
          console.error(`[CLERK_ORGS]     Long message: ${err.longMessage}`);
        }
      });
    }
    
    throw error;
  }
}

/**
 * Get the organization ID for a user
 * Returns the organizationId from their publicMetadata
 * 
 * @param userId - The Clerk user ID
 * @returns The organization ID or null if not found
 */
export async function getUserOrganizationId(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
  return metadata?.organizationId || null;
}

/**
 * Get the current user's organization ID from the session
 * 
 * Priority order:
 * 1. Clerk's native org session (auth().orgId) - preferred for full Clerk Orgs
 * 2. publicMetadata.organizationId from JWT - backward compatibility
 * 3. API call to fetch user's org - fallback
 * 
 * @returns The organization ID or null if not found
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  const { orgId, sessionClaims, userId } = await auth();
  
  // Preferred: Clerk's native organization session
  // This is set when user is an actual org member and has active org context
  if (orgId) {
    return orgId;
  }
  
  // Fallback 1: Get from session claims publicMetadata (backward compatibility)
  const metadata = sessionClaims?.publicMetadata as ClerkPublicMetadataWithOrg | undefined;
  if (metadata?.organizationId) {
    return metadata.organizationId;
  }
  
  // Fallback 2: Fetch from Clerk API
  if (userId) {
    return getUserOrganizationId(userId);
  }
  
  return null;
}

/**
 * Check if a user is an admin of a specific organization
 * 
 * @param userId - The Clerk user ID
 * @param organizationId - The organization ID to check
 * @returns True if user is an admin of the organization
 */
export async function isUserOrgAdmin(userId: string, organizationId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    const userMembership = memberships.data.find(m => m.publicUserData?.userId === userId);
    return userMembership?.role === 'org:admin';
  } catch (error) {
    console.error(`[CLERK_ORGS] Error checking org admin status:`, error);
    return false;
  }
}

/**
 * Ensure a coach has an organization
 * Creates one if they don't have one yet
 * 
 * This should be called:
 * 1. When a user is assigned the 'coach' role
 * 2. When a coach accesses organization-scoped features (like branding)
 * 
 * @param coachUserId - The Clerk user ID of the coach
 * @returns The organization ID (existing or newly created)
 */
export async function ensureCoachHasOrganization(coachUserId: string): Promise<string> {
  const client = await clerkClient();
  const user = await client.users.getUser(coachUserId);
  
  // Check for existing organization
  const existingOrgId = (user.publicMetadata as ClerkPublicMetadataWithOrg)?.organizationId;
  if (existingOrgId) {
    return existingOrgId;
  }
  
  // Create new organization with user's name
  const coachName = user.firstName 
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
  
  return createOrganizationForCoach(coachUserId, coachName);
}

/**
 * Get organization details by ID
 * 
 * @param organizationId - The Clerk organization ID
 * @returns The organization object or null if not found
 */
export async function getOrganization(organizationId: string) {
  try {
    const client = await clerkClient();
    return await client.organizations.getOrganization({ organizationId });
  } catch (error) {
    console.error(`[CLERK_ORGS] Error fetching organization ${organizationId}:`, error);
    return null;
  }
}

/**
 * Update organization metadata (name, etc.)
 * 
 * @param organizationId - The Clerk organization ID
 * @param updates - Fields to update
 */
export async function updateOrganization(
  organizationId: string,
  updates: { name?: string }
): Promise<void> {
  try {
    const client = await clerkClient();
    await client.organizations.updateOrganization(organizationId, updates);
    console.log(`[CLERK_ORGS] Updated organization ${organizationId}:`, updates);
  } catch (error) {
    console.error(`[CLERK_ORGS] Error updating organization ${organizationId}:`, error);
    throw error;
  }
}

// ============================================================================
// ORGANIZATION MEMBERSHIP MANAGEMENT
// ============================================================================

/**
 * Add a user to an organization as a member
 * This makes them an actual Clerk Organization member (not just metadata)
 * 
 * @param userId - The Clerk user ID to add
 * @param organizationId - The organization ID to add them to
 * @param role - The role to assign (default: 'org:member')
 */
export async function addUserToOrganization(
  userId: string,
  organizationId: string,
  role: 'org:member' | 'org:admin' = 'org:member'
): Promise<void> {
  const client = await clerkClient();
  
  try {
    // Check if already a member
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    const existing = memberships.data.find(m => m.publicUserData?.userId === userId);
    
    if (existing) {
      console.log(`[CLERK_ORGS] User ${userId} is already a member of org ${organizationId}`);
      return;
    }
    
    // Add as organization member
    await client.organizations.createOrganizationMembership({
      organizationId,
      userId,
      role,
    });
    
    console.log(`[CLERK_ORGS] Added user ${userId} to org ${organizationId} as ${role}`);

    // Also set in publicMetadata for backward compatibility
    // Set default orgRole to 'member' for new org members
    const user = await client.users.getUser(userId);
    const currentMetadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...currentMetadata,
        organizationId,
        // Only set orgRole if not already set (preserve existing role)
        orgRole: currentMetadata?.orgRole || 'member',
      },
    });

    console.log(`[CLERK_ORGS] Updated user ${userId} publicMetadata with organizationId and orgRole`);
  } catch (error) {
    console.error(`[CLERK_ORGS] Error adding user ${userId} to org ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Remove a user from an organization
 * 
 * @param userId - The Clerk user ID to remove
 * @param organizationId - The organization ID to remove them from
 */
export async function removeUserFromOrganization(
  userId: string,
  organizationId: string
): Promise<void> {
  const client = await clerkClient();
  
  try {
    // Find the membership
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    const membership = memberships.data.find(m => m.publicUserData?.userId === userId);
    
    if (!membership) {
      console.log(`[CLERK_ORGS] User ${userId} is not a member of org ${organizationId}`);
      return;
    }
    
    // Delete the membership
    await client.organizations.deleteOrganizationMembership({
      organizationId,
      userId,
    });
    
    console.log(`[CLERK_ORGS] Removed user ${userId} from org ${organizationId}`);
    
    // Also clear from publicMetadata
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    // Only clear if it matches the org being removed
    if (metadata?.organizationId === organizationId) {
      const { organizationId: _, ...restMetadata } = metadata;
      await client.users.updateUserMetadata(userId, {
        publicMetadata: restMetadata,
      });
      console.log(`[CLERK_ORGS] Cleared organizationId from user ${userId} publicMetadata`);
    }
  } catch (error) {
    console.error(`[CLERK_ORGS] Error removing user ${userId} from org ${organizationId}:`, error);
    throw error;
  }
}

/**
 * Get all members of an organization
 * 
 * @param organizationId - The organization ID
 * @returns Array of organization members with user data
 */
export async function getOrganizationMembers(organizationId: string) {
  const client = await clerkClient();
  
  try {
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      limit: 500, // Adjust as needed
    });
    
    return memberships.data;
  } catch (error) {
    console.error(`[CLERK_ORGS] Error fetching org members for ${organizationId}:`, error);
    return [];
  }
}

/**
 * Check if a user is a member of an organization (any role)
 * 
 * @param userId - The Clerk user ID
 * @param organizationId - The organization ID
 * @returns True if user is a member
 */
export async function isUserOrgMember(userId: string, organizationId: string): Promise<boolean> {
  try {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    return memberships.data.some(m => m.publicUserData?.userId === userId);
  } catch (error) {
    console.error(`[CLERK_ORGS] Error checking org membership:`, error);
    return false;
  }
}

// ============================================================================
// MULTI-TENANT DOMAIN & SETTINGS SETUP
// ============================================================================

/**
 * Create org_domains entry for subdomain-based routing
 * Called when a coach organization is created
 * Also syncs to Vercel Edge Config for fast tenant resolution
 * 
 * @param organizationId - The Clerk organization ID
 * @param subdomain - The subdomain to use (e.g., "coach-abc123")
 */
async function createOrgDomainEntry(organizationId: string, subdomain: string): Promise<void> {
  const normalizedSubdomain = subdomain.toLowerCase().trim();
  const now = new Date().toISOString();
  
  // Check if subdomain is already taken
  const existingSnapshot = await adminDb
    .collection('org_domains')
    .where('subdomain', '==', normalizedSubdomain)
    .limit(1)
    .get();
  
  if (!existingSnapshot.empty) {
    // Subdomain already exists - this shouldn't happen but handle gracefully
    const existingData = existingSnapshot.docs[0].data();
    if (existingData.organizationId === organizationId) {
      console.log(`[CLERK_ORGS] Subdomain ${normalizedSubdomain} already mapped to org ${organizationId}`);
      return;
    }
    // Generate a unique subdomain by appending random chars
    const uniqueSubdomain = `${normalizedSubdomain}-${Math.random().toString(36).substring(2, 6)}`;
    console.log(`[CLERK_ORGS] Subdomain ${normalizedSubdomain} taken, using ${uniqueSubdomain}`);
    await createOrgDomainEntry(organizationId, uniqueSubdomain);
    return;
  }
  
  // Check if org already has a subdomain
  const orgSnapshot = await adminDb
    .collection('org_domains')
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  
  if (!orgSnapshot.empty) {
    console.log(`[CLERK_ORGS] Organization ${organizationId} already has a subdomain`);
    return;
  }
  
  // Create the org_domains entry
  await adminDb.collection('org_domains').add({
    organizationId,
    subdomain: normalizedSubdomain,
    primaryDomain: `${normalizedSubdomain}.growthaddicts.com`,
    createdAt: now,
    updatedAt: now,
  });
  
  // Sync to Edge Config for fast tenant resolution
  try {
    await syncTenantToEdgeConfig(
      organizationId,
      normalizedSubdomain,
      DEFAULT_TENANT_BRANDING,  // New orgs start with default branding
      undefined  // No custom domain initially
    );
    console.log(`[CLERK_ORGS] Synced initial Edge Config entry for subdomain: ${normalizedSubdomain}`);
  } catch (edgeError) {
    // Log but don't fail - Edge Config is optimization, not critical
    console.error('[CLERK_ORGS] Edge Config sync error (non-fatal):', edgeError);
  }
}

/**
 * Create default org_settings for an organization
 * Called when a coach organization is created
 * 
 * @param organizationId - The Clerk organization ID
 */
async function createDefaultOrgSettings(organizationId: string): Promise<void> {
  const now = new Date().toISOString();
  
  // Check if settings already exist
  const existingDoc = await adminDb.collection('org_settings').doc(organizationId).get();
  if (existingDoc.exists) {
    console.log(`[CLERK_ORGS] Settings already exist for organization ${organizationId}`);
    return;
  }
  
  // Create default settings
  const defaultSettings: OrgSettings = {
    id: organizationId,
    organizationId,
    billingMode: 'platform',
    allowExternalBilling: true,
    defaultTier: 'standard',
    defaultTrack: null,
    stripeConnectAccountId: null,
    stripeConnectStatus: 'not_connected',
    platformFeePercent: 1,
    requireApproval: false,
    autoJoinSquadId: null,
    welcomeMessage: null,
    createdAt: now,
    updatedAt: now,
  };
  
  await adminDb.collection('org_settings').doc(organizationId).set(defaultSettings);
}
