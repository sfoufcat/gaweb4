import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { FlowSession, OrgMembership, OrgSettings } from '@/types';

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
    platformFeePercent: 1,
    requireApproval: false,
    autoJoinSquadId: null,
    welcomeMessage: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create an org_membership for a user if it doesn't exist
 */
async function ensureOrgMembership(
  userId: string,
  organizationId: string,
  settings: OrgSettings
): Promise<OrgMembership | null> {
  // Check if membership already exists
  const existingSnapshot = await adminDb
    .collection('org_memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  
  if (!existingSnapshot.empty) {
    return existingSnapshot.docs[0].data() as OrgMembership;
  }
  
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
    accessSource: 'funnel',
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
  
  console.log(`[FUNNEL_LINK_SESSION] Created org_membership ${docRef.id} for user ${userId} in org ${organizationId}`);
  
  return membership;
}

/**
 * POST /api/funnel/link-session
 * Link a userId to a flow session after signup/signin
 * 
 * This is called after signup or signin (especially from iframe on custom domains)
 * to associate the user with their ongoing flow session.
 * 
 * IMPORTANT: This also enrolls the user in the organization associated with the funnel.
 * This is critical for existing users who sign in (instead of sign up) during a funnel flow,
 * as they need org membership to access the tenant domain.
 * 
 * Body:
 * - flowSessionId: string (required)
 * 
 * The userId is taken from the authenticated session (Clerk)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - must be authenticated to link session' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { flowSessionId } = body;

    if (!flowSessionId) {
      return NextResponse.json(
        { error: 'Flow session ID is required' },
        { status: 400 }
      );
    }

    // Validate session ID format
    if (!flowSessionId.startsWith('flow_')) {
      return NextResponse.json(
        { error: 'Invalid flow session ID format' },
        { status: 400 }
      );
    }

    // Get the flow session
    const sessionRef = adminDb.collection('flow_sessions').doc(flowSessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Flow session not found' },
        { status: 404 }
      );
    }

    const session = sessionDoc.data() as FlowSession;

    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Flow session has expired' },
        { status: 410 }
      );
    }

    // Check if already linked to a different user
    if (session.userId && session.userId !== userId) {
      return NextResponse.json(
        { error: 'This flow session is already linked to a different user' },
        { status: 400 }
      );
    }

    // ==========================================================================
    // VALIDATE INVITE EMAIL (For invite-only funnels with emailRequired)
    // ==========================================================================
    // If the session has an inviteId, check if it has a locked email.
    // If so, verify the user's email matches the invite email.
    const inviteId = session.inviteId;

    if (inviteId) {
      const inviteDoc = await adminDb.collection('program_invites').doc(inviteId).get();

      if (inviteDoc.exists) {
        const invite = inviteDoc.data();

        // If invite has email and emailRequired, validate
        if (invite?.email && invite?.emailRequired) {
          // Get user's email from Clerk
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          const userEmail = clerkUser.emailAddresses[0]?.emailAddress?.toLowerCase();
          const inviteEmail = invite.email.toLowerCase();

          if (userEmail !== inviteEmail) {
            console.log(`[FUNNEL_LINK_SESSION] Email mismatch: invite for ${inviteEmail}, user has ${userEmail}`);
            return NextResponse.json(
              { error: `This invite is for ${invite.email}. Please sign up with that email address.` },
              { status: 403 }
            );
          }

          console.log(`[FUNNEL_LINK_SESSION] Email validated: ${userEmail} matches invite`);
        }
      }
    }

    // Check if already linked to this user (idempotent)
    const alreadyLinked = session.userId === userId;
    
    if (!alreadyLinked) {
      // Link the session to the user
      const now = new Date().toISOString();
      await sessionRef.update({
        userId,
        linkedAt: now,
        updatedAt: now,
      });
      console.log(`[FUNNEL_LINK_SESSION] Linked flow session ${flowSessionId} to user ${userId}`);
    }

    // ==========================================================================
    // LINK STRIPE CUSTOMER TO USER (Transfer guest checkout payment method)
    // ==========================================================================
    //
    // When a guest completed checkout, a Stripe customer was created on the connected
    // account with the payment method saved. Now link that customer to the user's account.
    //
    let stripeCustomerLinked = false;
    const sessionData = session.data || {};
    const stripeConnectAccountId = sessionData.stripeConnectAccountId as string | undefined;
    
    if (stripeConnectAccountId) {
      const guestCustomerId = sessionData[`stripeCustomerId_${stripeConnectAccountId}`] as string | undefined;
      
      if (guestCustomerId) {
        try {
          // Get user's current connected customer IDs
          const userDoc = await adminDb.collection('users').doc(userId).get();
          const userData = userDoc.data();
          const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};
          
          // Only link if user doesn't already have a customer on this account
          if (!connectedCustomerIds[stripeConnectAccountId]) {
            // Save the guest customer ID to the user's account
            await adminDb.collection('users').doc(userId).set(
              {
                stripeConnectedCustomerIds: {
                  ...connectedCustomerIds,
                  [stripeConnectAccountId]: guestCustomerId,
                },
              },
              { merge: true }
            );
            
            // Update the Stripe customer with the user's info
            const client = await clerkClient();
            const clerkUser = await client.users.getUser(userId);
            const email = clerkUser.emailAddresses[0]?.emailAddress;
            const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;
            
            // Import Stripe and update customer
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
              apiVersion: '2025-02-24.acacia',
            });
            
            await stripe.customers.update(
              guestCustomerId,
              {
                email,
                name,
                metadata: {
                  userId,
                  platformUserId: userId,
                  linkedFromGuestCheckout: 'true',
                },
              },
              { stripeAccount: stripeConnectAccountId }
            );
            
            stripeCustomerLinked = true;
            console.log(`[FUNNEL_LINK_SESSION] Linked guest Stripe customer ${guestCustomerId} to user ${userId} on account ${stripeConnectAccountId}`);
          }
        } catch (stripeError) {
          // Log but don't fail - the main session linking succeeded
          console.error(`[FUNNEL_LINK_SESSION] Failed to link Stripe customer (non-fatal):`, stripeError);
        }
      }
    }

    // ==========================================================================
    // ENROLL USER IN ORGANIZATION (Critical for existing users signing in)
    // ==========================================================================
    // 
    // When an existing user signs in during a funnel flow (instead of signing up),
    // they need to be added to the organization to pass middleware access checks.
    // Without this, the middleware blocks them with "Access Denied".
    //
    let enrolledInOrg = false;
    let membershipCreated = false;
    
    if (session.organizationId) {
      try {
        // 1. Add user to Clerk organization (also updates publicMetadata)
        await addUserToOrganization(userId, session.organizationId, 'org:member');
        enrolledInOrg = true;
        console.log(`[FUNNEL_LINK_SESSION] Added user ${userId} to Clerk org ${session.organizationId}`);
        
        // 2. Also update primaryOrganizationId in user metadata for multi-org support
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        const currentMetadata = user.publicMetadata as Record<string, unknown>;
        
        // Only update if not already set to this org
        if (currentMetadata?.primaryOrganizationId !== session.organizationId) {
          await client.users.updateUserMetadata(userId, {
            publicMetadata: {
              ...currentMetadata,
              primaryOrganizationId: session.organizationId,
            },
          });
          console.log(`[FUNNEL_LINK_SESSION] Updated user ${userId} primaryOrganizationId to ${session.organizationId}`);
        }
        
        // 3. Create org_membership entry in Firebase (if not exists)
        const settings = await getOrgSettings(session.organizationId);
        const membership = await ensureOrgMembership(userId, session.organizationId, settings);
        membershipCreated = !!membership;
        
      } catch (orgError) {
        // Log but don't fail the link-session - the funnel can still continue
        // The /api/funnel/complete will also try to add them to the org
        console.error(`[FUNNEL_LINK_SESSION] Failed to enroll user in org (non-fatal):`, orgError);
      }
    }

    // Return updated session
    const updatedDoc = await sessionRef.get();
    const updatedSession = updatedDoc.data() as FlowSession;

    return NextResponse.json({
      success: true,
      alreadyLinked,
      enrolledInOrg,
      membershipCreated,
      stripeCustomerLinked,
      organizationId: session.organizationId,
      session: updatedSession,
    });
  } catch (error) {
    console.error('[FUNNEL_LINK_SESSION]', error);
    return NextResponse.json(
      { error: 'Failed to link flow session' },
      { status: 500 }
    );
  }
}











