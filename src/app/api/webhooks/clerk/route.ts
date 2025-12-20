/**
 * Clerk Webhook Handler
 * 
 * Handles Clerk events for user management and multi-tenant auto-enrollment.
 * 
 * Key functionality:
 * - Creates Firebase user documents on user.created
 * - Auto-enrolls users to organizations based on signup domain
 * - Creates org_memberships entries for multi-org support
 * - Syncs user data on user.updated
 * - Cleans up on user.deleted
 */

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgMembership, OrgSettings, DEFAULT_ORG_SETTINGS } from '@/types';
import { parseHost } from '@/lib/tenant/parseHost';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Resolve organization ID from a hostname/domain
 * Checks both subdomains and custom domains
 */
async function resolveOrgFromDomain(domain: string): Promise<string | null> {
  if (!domain) return null;
  
  const parsed = parseHost(domain);
  
  if (parsed.type === 'platform') {
    // Platform domain - no auto-enrollment
    return null;
  }
  
  if (parsed.type === 'subdomain' && parsed.subdomain) {
    // Look up subdomain in org_domains
    const snapshot = await adminDb
      .collection('org_domains')
      .where('subdomain', '==', parsed.subdomain.toLowerCase())
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data().organizationId;
    }
  }
  
  if (parsed.type === 'custom_domain') {
    // Look up custom domain in org_custom_domains
    const snapshot = await adminDb
      .collection('org_custom_domains')
      .where('domain', '==', parsed.hostname.toLowerCase())
      .where('status', '==', 'verified')
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].data().organizationId;
    }
  }
  
  return null;
}

/**
 * Get organization settings, with defaults if not found
 */
async function getOrgSettings(organizationId: string): Promise<OrgSettings> {
  const doc = await adminDb.collection('org_settings').doc(organizationId).get();
  
  if (doc.exists) {
    return doc.data() as OrgSettings;
  }
  
  // Return default settings
  const now = new Date().toISOString();
  return {
    id: organizationId,
    organizationId,
    billingMode: 'platform',
    allowExternalBilling: true,
    defaultTier: 'standard',
    defaultTrack: null,
    stripeConnectAccountId: null,
    stripeConnectStatus: 'not_connected',
    platformFeePercent: 10,
    requireApproval: false,
    autoJoinSquadId: null,
    welcomeMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create an org_membership for a user
 */
async function createOrgMembership(
  userId: string,
  organizationId: string,
  settings: OrgSettings
): Promise<OrgMembership> {
  const now = new Date().toISOString();
  
  const membership: OrgMembership = {
    id: '', // Will be set after creation
    userId,
    organizationId,
    orgRole: 'member',
    tier: settings.defaultTier,
    track: settings.defaultTrack,
    squadId: settings.autoJoinSquadId,
    premiumSquadId: null,
    accessSource: 'platform_billing',
    accessExpiresAt: null,
    inviteCodeUsed: null,
    isActive: true,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await adminDb.collection('org_memberships').add(membership);
  membership.id = docRef.id;
  
  // Update with ID
  await docRef.update({ id: docRef.id });
  
  console.log(`[CLERK_WEBHOOK] Created org_membership ${docRef.id} for user ${userId} in org ${organizationId}`);
  
  return membership;
}

/**
 * Add user to Clerk organization and update metadata
 */
async function enrollUserInOrganization(
  userId: string,
  organizationId: string
): Promise<void> {
  const client = await clerkClient();
  
  try {
    // Check if already a member
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
    });
    const existing = memberships.data.find(m => m.publicUserData?.userId === userId);
    
    if (!existing) {
      // Add as organization member
      await client.organizations.createOrganizationMembership({
        organizationId,
        userId,
        role: 'org:member',
      });
      console.log(`[CLERK_WEBHOOK] Added user ${userId} to Clerk org ${organizationId}`);
    }
    
    // Update publicMetadata with primaryOrganizationId
    const user = await client.users.getUser(userId);
    const currentMetadata = user.publicMetadata as Record<string, unknown>;
    
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...currentMetadata,
        primaryOrganizationId: organizationId,
        // Legacy fields for backward compatibility
        organizationId: organizationId,
        orgRole: 'member',
      },
    });
    
    console.log(`[CLERK_WEBHOOK] Updated user ${userId} metadata with primaryOrganizationId`);
  } catch (error) {
    console.error(`[CLERK_WEBHOOK] Error enrolling user ${userId} in org ${organizationId}:`, error);
    // Don't throw - we still want to complete the user creation
  }
}

// =============================================================================
// WEBHOOK HANDLER
// =============================================================================

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  // ==========================================================================
  // USER CREATED - Auto-enrollment based on signup domain
  // ==========================================================================
  if (eventType === 'user.created') {
    const { id, email_addresses, first_name, last_name, image_url, unsafe_metadata } = evt.data;
    const now = new Date().toISOString();

    // Extract signup domain from unsafe_metadata (set during signup)
    const signupDomain = (unsafe_metadata as Record<string, unknown>)?.signupDomain as string | undefined;
    
    console.log(`[CLERK_WEBHOOK] User created: ${id}, signupDomain: ${signupDomain || 'none'}`);

    // Create basic user data
    const userData = {
      id,
      email: email_addresses[0]?.email_address || '',
      firstName: first_name || '',
      lastName: last_name || '',
      imageUrl: image_url || '',
      createdAt: now,
      updatedAt: now,
    };

    // Create user document in Firebase
    await adminDb.collection('users').doc(id).set(userData);
    console.log(`[CLERK_WEBHOOK] Created Firebase user document for ${id}`);

    // Auto-enroll if signup domain is provided
    if (signupDomain) {
      const organizationId = await resolveOrgFromDomain(signupDomain);
      
      if (organizationId) {
        console.log(`[CLERK_WEBHOOK] Auto-enrolling user ${id} to org ${organizationId} (from domain: ${signupDomain})`);
        
        // Get org settings for defaults
        const settings = await getOrgSettings(organizationId);
        
        // Create org_membership
        await createOrgMembership(id, organizationId, settings);
        
        // Add to Clerk org and update metadata
        await enrollUserInOrganization(id, organizationId);
        
        // Update Firebase user with org info
        await adminDb.collection('users').doc(id).update({
          primaryOrganizationId: organizationId,
          tier: settings.defaultTier,
          track: settings.defaultTrack,
          updatedAt: now,
        });
        
        console.log(`[CLERK_WEBHOOK] User ${id} auto-enrolled to org ${organizationId}`);
      } else {
        console.log(`[CLERK_WEBHOOK] No organization found for domain: ${signupDomain}`);
      }
    }
  }

  // ==========================================================================
  // USER UPDATED - Sync user data
  // ==========================================================================
  if (eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;

    const userData = {
      email: email_addresses[0]?.email_address || '',
      firstName: first_name || '',
      lastName: last_name || '',
      imageUrl: image_url || '',
      updatedAt: new Date().toISOString(),
    };

    await adminDb.collection('users').doc(id).update(userData);
    console.log(`[CLERK_WEBHOOK] Updated Firebase user document for ${id}`);
  }

  // ==========================================================================
  // USER DELETED - Cleanup
  // ==========================================================================
  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    if (id) {
      // Delete user document
      await adminDb.collection('users').doc(id).delete();
      
      // Delete all org_memberships for this user
      const membershipsSnapshot = await adminDb
        .collection('org_memberships')
        .where('userId', '==', id)
        .get();
      
      const batch = adminDb.batch();
      membershipsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      console.log(`[CLERK_WEBHOOK] Deleted user ${id} and ${membershipsSnapshot.size} memberships`);
    }
  }

  return new Response('', { status: 200 });
}
