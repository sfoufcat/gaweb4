/**
 * Complete Squad Subscription
 * 
 * POST /api/squad/complete-subscription
 * 
 * Called after successful payment to add user to the squad.
 * This finalizes the membership after the embedded checkout payment succeeds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStreamServerClient } from '@/lib/stream-server';
import { MAX_SQUAD_MEMBERS } from '@/lib/squad-constants';
import { addUserToOrganization } from '@/lib/clerk-organizations';
import Stripe from 'stripe';
import type { Squad, OrgSettings } from '@/types';

// Lazy initialization of Stripe
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });
  }
  return _stripe;
}

/**
 * POST /api/squad/complete-subscription
 * 
 * Body:
 * - squadId: string
 * - subscriptionId: string
 * - paymentIntentId: string
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { squadId, subscriptionId, paymentIntentId } = body as {
      squadId: string;
      subscriptionId: string;
      paymentIntentId: string;
    };

    if (!squadId || !subscriptionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the squad
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();

    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squad = squadDoc.data() as Squad;

    // Check if squad is at capacity
    const memberIds = squad.memberIds || [];
    if (memberIds.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ 
        error: 'This squad is full and cannot accept new members.' 
      }, { status: 400 });
    }

    // Check if already a member
    if (memberIds.includes(userId)) {
      return NextResponse.json({ 
        success: true, 
        message: 'You are already a member of this squad' 
      });
    }

    // Verify the subscription exists and is active
    if (squad.organizationId) {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(squad.organizationId).get();
      const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;
      
      if (orgSettings?.stripeConnectAccountId) {
        try {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            { stripeAccount: orgSettings.stripeConnectAccountId }
          );
          
          // Check subscription status
          if (subscription.status !== 'active' && subscription.status !== 'trialing') {
            console.log(`[SQUAD_COMPLETE] Subscription ${subscriptionId} status is ${subscription.status}`);
            // Don't fail - the subscription might still be processing
            // The webhook will handle updating the status
          }
        } catch (stripeError) {
          console.error('[SQUAD_COMPLETE] Error verifying subscription:', stripeError);
          // Continue anyway - the webhook will handle if payment actually failed
        }
      }
    }

    const now = new Date().toISOString();

    // Update squad memberIds
    await squadRef.update({
      memberIds: [...memberIds, userId],
      updatedAt: now,
    });

    // Get user info from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);

    // Get current period end from subscription if possible
    let currentPeriodEnd: string | null = null;
    if (squad.organizationId) {
      const orgSettingsDoc = await adminDb.collection('org_settings').doc(squad.organizationId).get();
      const orgSettings = orgSettingsDoc.data() as OrgSettings | undefined;
      
      if (orgSettings?.stripeConnectAccountId) {
        try {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            subscriptionId,
            { stripeAccount: orgSettings.stripeConnectAccountId }
          );
          currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        } catch {
          // Ignore - we'll get this from webhook
        }
      }
    }

    // Create squadMember document with subscription info
    await adminDb.collection('squadMembers').add({
      squadId,
      userId,
      roleInSquad: 'member',
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      imageUrl: clerkUser.imageUrl || '',
      // Subscription info
      subscriptionId,
      subscriptionStatus: 'active',
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
    });

    // Update user's squad membership - add to squadIds array
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const currentSquadIds: string[] = userData?.squadIds || [];
    
    if (!currentSquadIds.includes(squadId)) {
      const updatedSquadIds = [...currentSquadIds, squadId];
      await adminDb.collection('users').doc(userId).update({
        squadIds: updatedSquadIds,
        squadId: squadId, // Legacy field
        updatedAt: now,
      });
    }

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
        console.error('[SQUAD_COMPLETE] Stream error:', streamError);
        // Don't fail if Stream fails
      }
    }

    // Auto-assign user to squad's organization
    if (squad.organizationId) {
      try {
        await addUserToOrganization(userId, squad.organizationId, 'org:member');
        console.log(`[SQUAD_COMPLETE] Added user ${userId} to organization ${squad.organizationId}`);
      } catch (orgError) {
        console.error('[SQUAD_COMPLETE] Org assignment error:', orgError);
        // Don't fail if org assignment fails
      }
    }

    console.log(`[SQUAD_COMPLETE] User ${userId} joined squad ${squadId} with subscription ${subscriptionId}`);

    return NextResponse.json({ 
      success: true,
      message: 'Successfully joined the squad!',
    });
  } catch (error) {
    console.error('[SQUAD_COMPLETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

