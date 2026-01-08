import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import type { Squad, OrgSettings } from '@/types';
import Stripe from 'stripe';

// Initialize Stripe
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

/**
 * POST /api/squad/join
 * Join a public squad by ID.
 * 
 * MULTI-SQUAD SUPPORT:
 * - Users can be in multiple squads (e.g., program squad + standalone squad)
 * - No tier-based restrictions - access controlled by squad/program pricing
 * 
 * Body:
 * - squadId: string (required)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { squadId } = body as { squadId: string };

    if (!squadId) {
      return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }

    // Get the squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;
    const squadHasCoach = !!squad.coachId;

    // Verify squad is public
    if (squad.visibility !== 'public') {
      return NextResponse.json({ 
        error: 'This squad is private. Use an invite code to join.' 
      }, { status: 403 });
    }

    // Check user's existing squad memberships
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    
    // Get current squad IDs (support new squadIds array, legacy fields)
    const currentSquadIds: string[] = userData?.squadIds || [];
    
    // Fallback for legacy fields
    if (currentSquadIds.length === 0) {
      if (userData?.standardSquadId) currentSquadIds.push(userData.standardSquadId);
      if (userData?.premiumSquadId && userData.premiumSquadId !== userData.standardSquadId) {
        currentSquadIds.push(userData.premiumSquadId);
      }
      if (userData?.squadId && !currentSquadIds.includes(userData.squadId)) {
        currentSquadIds.push(userData.squadId);
      }
    }

    // Check if already in the target squad
    if (currentSquadIds.includes(squadId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Check if already a member in memberIds array
    if (memberIds.includes(userId)) {
      return NextResponse.json({ error: 'You are already a member of this squad' }, { status: 400 });
    }

    // Check if squad requires subscription payment
    if (squad.subscriptionEnabled && squad.stripePriceId && squad.priceInCents && squad.priceInCents > 0) {
      // Get org settings for Stripe Connect
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(squad.organizationId!).get();
      const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;

      if (!orgSettings?.stripeConnectAccountId) {
        return NextResponse.json({ 
          error: 'Payment is not configured for this squad' 
        }, { status: 400 });
      }

      const stripe = getStripe();
      const stripeAccount = orgSettings.stripeConnectAccountId;

      // Get or create Stripe customer for this user
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined;

      // Get or create Stripe customer on the Connected account
      let customerId: string | undefined;
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const connectedCustomerIds = userData?.stripeConnectedCustomerIds || {};

      if (connectedCustomerIds[stripeAccount]) {
        customerId = connectedCustomerIds[stripeAccount];
      } else {
        const customer = await stripe.customers.create(
          {
            email,
            name,
            metadata: {
              userId,
              platformUserId: userId,
            },
          },
          { stripeAccount }
        );
        customerId = customer.id;

        // Save customer ID for this connected account
        await adminDb.collection('users').doc(userId).set(
          {
            stripeConnectedCustomerIds: {
              ...connectedCustomerIds,
              [stripeAccount]: customerId,
            },
          },
          { merge: true }
        );
      }

      // Create Stripe checkout session for subscription
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const successUrl = `${baseUrl}/squad?joined=${squadId}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/discover/squads/${squadId}?checkout=canceled`;

      const session = await stripe.checkout.sessions.create(
        {
          mode: 'subscription',
          payment_method_types: ['card'],
          line_items: [
            {
              price: squad.stripePriceId,
              quantity: 1,
            },
          ],
          subscription_data: {
            metadata: {
              squadId,
              userId,
              organizationId: squad.organizationId || '',
              type: 'squad_subscription',
            },
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
          customer: customerId,
          metadata: {
            squadId,
            userId,
            organizationId: squad.organizationId || '',
            type: 'squad_subscription',
          },
        },
        { stripeAccount }
      );

      console.log(`[SQUAD_JOIN] Created subscription checkout session ${session.id} for squad ${squadId}`);

      return NextResponse.json({ 
        requiresPayment: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        priceInCents: squad.priceInCents,
        billingInterval: squad.billingInterval || 'monthly',
      });
    }

    // Add user to squad (free squad or no subscription)
    const now = new Date().toISOString();

    // Update squad memberIds
    await squadRef.update({
      memberIds: [...memberIds, userId],
      updatedAt: now,
    });

    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Create squadMember document
    await adminDb.collection('squadMembers').add({
      squadId,
      userId,
      roleInSquad: 'member',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      createdAt: now,
      updatedAt: now,
    });

    // Update user's squad membership - add to squadIds array
    const updatedSquadIds = [...currentSquadIds, squadId];
    const userUpdate: Record<string, unknown> = { 
      squadIds: updatedSquadIds,
      updatedAt: now,
      // Keep legacy field in sync for backward compatibility
      squadId: squadId,
    };
    
    await adminDb.collection('users').doc(userId).update(userUpdate);

    // Add user to Stream Chat channel
    if (squad.chatChannelId) {
      try {
        const streamClient = await getStreamServerClient();
        
        // Upsert user in Stream
        await streamClient.upsertUser({
          id: userId,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          image: clerkUser.imageUrl,
        });

        // Add to channel
        const channel = streamClient.channel('messaging', squad.chatChannelId);
        await channel.addMembers([userId]);

        // Send join message
        await channel.sendMessage({
          text: `${clerkUser.firstName || 'Someone'} has joined the squad!`,
          user_id: userId,
          type: 'system',
        });
      } catch (streamError) {
        console.error('[STREAM_ADD_MEMBER_ERROR]', streamError);
        // Don't fail the join if Stream fails
      }
    }

    // Auto-assign user to squad's organization (if squad has one)
    // This makes them an actual Clerk Organization member for multi-tenancy
    if (squad.organizationId) {
      try {
        await addUserToOrganization(userId, squad.organizationId, 'org:member');
        console.log(`[SQUAD_JOIN] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_JOIN_ORG_ERROR]', orgError);
        // Don't fail the join if org assignment fails
      }
    }

    return NextResponse.json({ 
      success: true,
      hasCoach: squadHasCoach,
    });
  } catch (error) {
    console.error('[SQUAD_JOIN_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
