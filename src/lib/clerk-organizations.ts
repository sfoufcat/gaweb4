import { auth, clerkClient } from '@clerk/nextjs/server';
import type { UserRole } from '@/types';

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

// Extended metadata interface to include organizationId
export interface ClerkPublicMetadataWithOrg {
  role?: UserRole;
  organizationId?: string;  // Clerk Organization ID this user belongs to (as admin)
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
  const orgSlug = `coach-${coachUserId.substring(0, 8).toLowerCase()}`;
  
  try {
    const organization = await client.organizations.createOrganization({
      name: orgName,
      slug: orgSlug,
      createdBy: coachUserId,
    });
    
    console.log(`[CLERK_ORGS] Created organization ${organization.id} for coach ${coachUserId}`);
    
    // Store organization ID in user's publicMetadata
    await client.users.updateUserMetadata(coachUserId, {
      publicMetadata: {
        ...user.publicMetadata,
        organizationId: organization.id,
      },
    });
    
    console.log(`[CLERK_ORGS] Updated coach ${coachUserId} metadata with organizationId ${organization.id}`);
    
    return organization.id;
  } catch (error) {
    console.error(`[CLERK_ORGS] Failed to create organization for coach ${coachUserId}:`, error);
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
 * This reads from the JWT token (no additional API call if already in session)
 * 
 * @returns The organization ID or null if not found
 */
export async function getCurrentUserOrganizationId(): Promise<string | null> {
  const { sessionClaims, userId } = await auth();
  
  // First try to get from session claims (faster, no API call)
  const metadata = sessionClaims?.publicMetadata as ClerkPublicMetadataWithOrg | undefined;
  if (metadata?.organizationId) {
    return metadata.organizationId;
  }
  
  // Fall back to fetching from Clerk API
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
