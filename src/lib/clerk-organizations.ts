import { auth, clerkClient } from '@clerk/nextjs/server';
import type { UserRole, OrgRole, OrgSettings, DEFAULT_ORG_SETTINGS, CoachTier, CoachSubscriptionStatus, CoachSubscription } from '@/types';
import { setupDefaultOrgChannels } from '@/lib/org-channels';
import { adminDb } from '@/lib/firebase-admin';
import { syncTenantToEdgeConfig, syncSubscriptionToEdgeConfig, DEFAULT_TENANT_BRANDING } from '@/lib/tenant-edge-config';
import type { TenantSubscriptionData, TenantBrandingData } from '@/lib/tenant-edge-config';
import { DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER, DEFAULT_APP_TITLE, DEFAULT_BRANDING_COLORS } from '@/types';
import { isSubdomainAvailable, updateOrgSubdomain, getOrgDomain } from '@/lib/tenant/resolveTenant';

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
 * Called when a user is assigned the 'coach' role or creates additional organizations
 * 
 * Supports multi-org: coaches can create multiple organizations.
 * The new organization becomes the primaryOrganizationId (active org).
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
  const user = await client.users.getUser(coachUserId);
  const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg & { primaryOrganizationId?: string };
  
  // Check if this is their first organization (for backward compat field)
  const isFirstOrg = !metadata?.organizationId;
  
  // Create new organization
  const orgName = `${coachName}'s Organization`;
  // Generate a unique slug: use timestamp suffix to ensure uniqueness for multi-org
  const slugBase = coachUserId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toLowerCase();
  const timestamp = Date.now().toString(36); // Base36 timestamp for shorter slug
  const orgSlug = isFirstOrg ? `coach-${slugBase}` : `coach-${slugBase}-${timestamp}`;
  
  console.log(`[CLERK_ORGS] Creating organization for coach ${coachUserId}:`);
  console.log(`[CLERK_ORGS]   - Name: ${orgName}`);
  console.log(`[CLERK_ORGS]   - Slug: ${orgSlug}`);
  console.log(`[CLERK_ORGS]   - Is first org: ${isFirstOrg}`);
  
  try {
    const organization = await client.organizations.createOrganization({
      name: orgName,
      slug: orgSlug,
      createdBy: coachUserId,
    });
    
    console.log(`[CLERK_ORGS] Created organization ${organization.id} for coach ${coachUserId}`);
    
    // Update user's publicMetadata
    // - primaryOrganizationId: always set to new org (makes it active)
    // - organizationId: only set if this is their first org (backward compat)
    const updatedMetadata: Record<string, unknown> = {
      ...user.publicMetadata,
      primaryOrganizationId: organization.id, // New org becomes active
      orgRole: 'super_coach', // Organization creator is always the super coach
    };
    
    // Only set legacy organizationId field for first org (backward compat)
    if (isFirstOrg) {
      updatedMetadata.organizationId = organization.id;
    }
    
    await client.users.updateUserMetadata(coachUserId, {
      publicMetadata: updatedMetadata,
    });
    
    console.log(`[CLERK_ORGS] Updated coach ${coachUserId} metadata with primaryOrganizationId ${organization.id} and orgRole: super_coach`);
    
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
    publicSignupEnabled: true,
    createdAt: now,
    updatedAt: now,
  };
  
  await adminDb.collection('org_settings').doc(organizationId).set(defaultSettings);
}

// ============================================================================
// MANUAL COACH SUBSCRIPTION MANAGEMENT (ADMIN ONLY)
// ============================================================================

export interface ManualSubscriptionOptions {
  tier: CoachTier;
  manualBilling?: boolean;
  manualExpiresAt?: string | null; // ISO date string - null means unlimited
  userId?: string; // User who owns this subscription
}

/**
 * Create or update a manual coach subscription for an organization
 * Used by admins to grant plan access without requiring Stripe payment
 * 
 * This function:
 * 1. Creates/updates the coach_subscriptions document in Firestore
 * 2. Syncs billing state to Clerk Organization publicMetadata
 * 
 * @param organizationId - The Clerk Organization ID
 * @param options - Subscription options (tier, manualBilling, expiration)
 */
export async function createManualCoachSubscription(
  organizationId: string,
  options: ManualSubscriptionOptions
): Promise<void> {
  const { tier, manualBilling = true, manualExpiresAt = null, userId } = options;
  const now = new Date().toISOString();
  
  console.log(`[CLERK_ORGS] Creating manual subscription for org ${organizationId}:`, {
    tier,
    manualBilling,
    manualExpiresAt,
  });
  
  // Check if subscription already exists
  const existingDoc = await adminDb.collection('coach_subscriptions').doc(organizationId).get();
  
  // Determine status based on manual billing and expiration
  let status: CoachSubscriptionStatus = 'none';
  if (manualBilling) {
    if (manualExpiresAt) {
      // Check if expiration date has passed
      const expirationDate = new Date(manualExpiresAt);
      status = expirationDate > new Date() ? 'active' : 'canceled';
    } else {
      // No expiration = permanently active (until manually changed)
      status = 'active';
    }
  }
  
  const subscriptionData: Partial<CoachSubscription> = {
    id: organizationId,
    organizationId,
    tier,
    status,
    stripeSubscriptionId: null, // No Stripe subscription for manual billing
    stripeCustomerId: null,
    stripePriceId: null,
    currentPeriodStart: now,
    currentPeriodEnd: manualExpiresAt || null, // Use expiration as period end
    trialEnd: null,
    cancelAtPeriodEnd: false,
    manualBilling: manualBilling,
    manualExpiresAt: manualExpiresAt || null,
    updatedAt: now,
  };
  
  if (userId) {
    subscriptionData.userId = userId;
  }
  
  if (existingDoc.exists) {
    // Update existing subscription
    await adminDb.collection('coach_subscriptions').doc(organizationId).update(subscriptionData);
    console.log(`[CLERK_ORGS] Updated manual subscription for org ${organizationId}`);
  } else {
    // Create new subscription
    await adminDb.collection('coach_subscriptions').doc(organizationId).set({
      ...subscriptionData,
      createdAt: now,
    });
    console.log(`[CLERK_ORGS] Created manual subscription for org ${organizationId}`);
  }
  
  // Sync to Clerk Organization publicMetadata
  await syncBillingToClerkOrg(organizationId, {
    plan: tier,
    subscriptionStatus: status,
    currentPeriodEnd: manualExpiresAt || undefined,
    onboardingState: status === 'active' ? 'active' : 'needs_plan',
  });
  
  console.log(`[CLERK_ORGS] Synced manual subscription to Clerk for org ${organizationId}`);
  
  // Sync to Edge Config for middleware access checks
  try {
    // Get the organization's subdomain from org_domains
    const domainSnapshot = await adminDb
      .collection('org_domains')
      .where('organizationId', '==', organizationId)
      .limit(1)
      .get();
    
    if (!domainSnapshot.empty) {
      const domainData = domainSnapshot.docs[0].data();
      const subdomain = domainData.subdomain;
      const customDomain = domainData.verifiedCustomDomain || undefined;
      
      const subscriptionData: TenantSubscriptionData = {
        plan: tier,
        subscriptionStatus: status,
        currentPeriodEnd: manualExpiresAt || undefined,
        cancelAtPeriodEnd: false,
      };
      
      // Fetch branding from Firestore to prevent reset to defaults when Edge Config is empty
      let fallbackBranding: TenantBrandingData | undefined;
      try {
        const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
        if (brandingDoc.exists) {
          const brandingData = brandingDoc.data();
          fallbackBranding = {
            logoUrl: brandingData?.logoUrl ?? null,
            horizontalLogoUrl: brandingData?.horizontalLogoUrl ?? null,
            appTitle: brandingData?.appTitle ?? DEFAULT_APP_TITLE,
            colors: brandingData?.colors ?? DEFAULT_BRANDING_COLORS,
            menuTitles: brandingData?.menuTitles ?? DEFAULT_MENU_TITLES,
            menuIcons: brandingData?.menuIcons ?? DEFAULT_MENU_ICONS,
            menuOrder: brandingData?.menuOrder ?? DEFAULT_MENU_ORDER,
          };
          console.log(`[CLERK_ORGS] Fetched branding from Firestore for org ${organizationId}`);
        }
      } catch (brandingError) {
        console.warn(`[CLERK_ORGS] Could not fetch branding from Firestore:`, brandingError);
        // Continue without fallback - Edge Config may have existing data
      }
      
      await syncSubscriptionToEdgeConfig(organizationId, subdomain, subscriptionData, customDomain, fallbackBranding);
      console.log(`[CLERK_ORGS] Synced manual subscription to Edge Config for subdomain ${subdomain}`);
    } else {
      console.warn(`[CLERK_ORGS] No subdomain found for org ${organizationId} - Edge Config not updated`);
    }
  } catch (edgeError) {
    // Log but don't fail - Edge Config is an optimization, not critical path
    console.error(`[CLERK_ORGS] Failed to sync subscription to Edge Config:`, edgeError);
  }
}

/**
 * Update an existing organization's tier (admin only)
 * 
 * @param organizationId - The Clerk Organization ID
 * @param options - New subscription options
 */
export async function updateOrgTier(
  organizationId: string,
  options: ManualSubscriptionOptions
): Promise<void> {
  // Reuse createManualCoachSubscription which handles both create and update
  return createManualCoachSubscription(organizationId, options);
}

/**
 * Sync billing state to Clerk Organization publicMetadata
 * This mirrors the function in the Stripe webhook but is exported for reuse
 */
async function syncBillingToClerkOrg(
  organizationId: string,
  billingState: {
    plan: CoachTier;
    subscriptionStatus: CoachSubscriptionStatus;
    currentPeriodEnd?: string;
    trialEnd?: string;
    cancelAtPeriodEnd?: boolean;
    onboardingState?: 'needs_profile' | 'needs_plan' | 'active';
  }
): Promise<void> {
  try {
    const client = await clerkClient();
    
    // Get existing org metadata to preserve other fields
    const org = await client.organizations.getOrganization({ organizationId });
    const existingMetadata = org.publicMetadata || {};
    
    // Update with billing state
    await client.organizations.updateOrganization(organizationId, {
      publicMetadata: {
        ...existingMetadata,
        plan: billingState.plan,
        subscriptionStatus: billingState.subscriptionStatus,
        currentPeriodEnd: billingState.currentPeriodEnd,
        trialEnd: billingState.trialEnd,
        cancelAtPeriodEnd: billingState.cancelAtPeriodEnd,
        onboardingState: billingState.onboardingState,
      },
    });
    
    console.log(`[CLERK_ORGS] Synced billing to Clerk org ${organizationId}:`, billingState);
  } catch (error) {
    console.error(`[CLERK_ORGS] Failed to sync billing to Clerk org ${organizationId}:`, error);
    throw error;
  }
}

// ============================================================================
// SUBDOMAIN GENERATION FROM BUSINESS NAME
// ============================================================================

/**
 * Generate an available subdomain from a business name.
 * 
 * Tries variants in order:
 * 1. "omirdelil" (lowercase, spaces removed)
 * 2. "omir-delil" (lowercase, spaces to hyphens)
 * 3. "coachomirdelil" (prefixed with "coach")
 * 4. "coachomirdelil1", "coachomirdelil2", etc. (numbered fallback)
 * 
 * @param businessName - The business/coaching name (e.g., "Omir Delil")
 * @returns An available subdomain string
 * @throws Error if unable to generate an available subdomain after 100 attempts
 */
export async function generateSubdomainFromBusinessName(businessName: string): Promise<string> {
  // Normalize: lowercase, remove special chars except spaces and hyphens
  const base = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
  
  if (!base) {
    throw new Error('Business name must contain at least one alphanumeric character');
  }
  
  // Generate variant candidates
  const spacesRemoved = base.replace(/\s+/g, '');           // omirdelil
  const spacesToHyphens = base.replace(/\s+/g, '-');        // omir-delil
  const prefixedNoSpaces = 'coach' + spacesRemoved;         // coachomirdelil
  
  // Ensure valid subdomain format (no leading/trailing hyphens, no double hyphens)
  const cleanSubdomain = (s: string) => s
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
  
  const variants = [
    cleanSubdomain(spacesRemoved),
    cleanSubdomain(spacesToHyphens),
    cleanSubdomain(prefixedNoSpaces),
  ].filter(v => v.length >= 3); // Subdomains must be at least 3 chars
  
  // Try each variant
  for (const variant of variants) {
    if (await isSubdomainAvailable(variant)) {
      console.log(`[SUBDOMAIN_GEN] Generated subdomain "${variant}" from business name "${businessName}"`);
      return variant;
    }
    console.log(`[SUBDOMAIN_GEN] Subdomain "${variant}" is taken, trying next variant...`);
  }
  
  // Numbered fallback: coachomirdelil1, coachomirdelil2, etc.
  const prefixed = cleanSubdomain(prefixedNoSpaces) || 'coach';
  for (let i = 1; i <= 100; i++) {
    const numbered = `${prefixed}${i}`;
    if (await isSubdomainAvailable(numbered)) {
      console.log(`[SUBDOMAIN_GEN] Generated numbered subdomain "${numbered}" from business name "${businessName}"`);
      return numbered;
    }
  }
  
  // Last resort: throw error (extremely unlikely to hit with 100 numbered attempts)
  throw new Error(`Unable to generate available subdomain from business name "${businessName}"`);
}

/**
 * Update organization subdomain based on business name.
 * Called when coach completes their profile during onboarding.
 * 
 * @param organizationId - The Clerk Organization ID
 * @param businessName - The business/coaching name to derive subdomain from
 * @returns The new subdomain
 */
export async function updateSubdomainFromBusinessName(
  organizationId: string,
  businessName: string
): Promise<string> {
  // Generate new subdomain from business name
  const newSubdomain = await generateSubdomainFromBusinessName(businessName);
  
  // Get current subdomain (if any)
  const currentDomain = await getOrgDomain(organizationId);
  const currentSubdomain = currentDomain?.subdomain;
  
  // If different, update
  if (currentSubdomain !== newSubdomain) {
    await updateOrgSubdomain(organizationId, newSubdomain);
    console.log(`[SUBDOMAIN_GEN] Updated org ${organizationId} subdomain: "${currentSubdomain}" -> "${newSubdomain}"`);
  } else {
    console.log(`[SUBDOMAIN_GEN] Org ${organizationId} subdomain unchanged: "${newSubdomain}"`);
  }
  
  return newSubdomain;
}
