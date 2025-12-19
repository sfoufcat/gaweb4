/**
 * Reset User Tier Script
 * 
 * This script checks a user's actual Stripe subscription and invoice status,
 * then resets their tier in Firebase and Clerk to match reality.
 * 
 * Use this when:
 * - A user is marked as premium but their payment failed
 * - Webhook processing failed and user tier is out of sync
 * - Manual intervention is needed to fix billing status
 * 
 * Usage:
 *   doppler run -- npx tsx scripts/reset-user-tier.ts <email>
 */

import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing Firebase environment variables');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Clerk
const clerk = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY! 
});

// Premium price IDs
const PREMIUM_PRICE_IDS = [
  process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
  process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID,
].filter(Boolean);

type BillingStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
type UserTier = 'free' | 'standard' | 'premium';

interface ResetResult {
  success: boolean;
  userId?: string;
  stripeStatus?: string;
  hasUnpaidInvoices: boolean;
  determinedTier: UserTier;
  determinedBillingStatus: BillingStatus;
  previousTier?: string;
  previousBillingStatus?: string;
}

async function resetUserTier(targetEmail: string): Promise<ResetResult> {
  console.log(`\n🔍 Checking payment status for: ${targetEmail}\n`);

  // Step 1: Find Stripe customer
  console.log('--- Step 1: Finding Stripe Customer ---');
  const customers = await stripe.customers.list({
    email: targetEmail,
    expand: ['data.subscriptions'],
  });

  if (customers.data.length === 0) {
    console.log('❌ No Stripe customer found with this email.');
    return {
      success: false,
      hasUnpaidInvoices: false,
      determinedTier: 'free',
      determinedBillingStatus: 'none',
    };
  }

  const customer = customers.data[0];
  console.log(`✅ Found Stripe customer: ${customer.id}`);

  // Step 2: Check for unpaid invoices
  console.log('\n--- Step 2: Checking for Unpaid Invoices ---');
  const openInvoices = await stripe.invoices.list({
    customer: customer.id,
    status: 'open',
    limit: 10,
  });

  const uncollectibleInvoices = await stripe.invoices.list({
    customer: customer.id,
    status: 'uncollectible',
    limit: 10,
  });

  const hasUnpaidInvoices = openInvoices.data.length > 0 || uncollectibleInvoices.data.length > 0;
  
  if (openInvoices.data.length > 0) {
    console.log(`⚠️  Found ${openInvoices.data.length} OPEN invoice(s):`);
    for (const inv of openInvoices.data) {
      console.log(`   - ${inv.id}: $${(inv.amount_due / 100).toFixed(2)} (due: ${inv.due_date ? new Date(inv.due_date * 1000).toISOString() : 'N/A'})`);
    }
  }

  if (uncollectibleInvoices.data.length > 0) {
    console.log(`⚠️  Found ${uncollectibleInvoices.data.length} UNCOLLECTIBLE invoice(s):`);
    for (const inv of uncollectibleInvoices.data) {
      console.log(`   - ${inv.id}: $${(inv.amount_due / 100).toFixed(2)}`);
    }
  }

  if (!hasUnpaidInvoices) {
    console.log('✅ No unpaid invoices found.');
  }

  // Step 3: Check subscription status
  console.log('\n--- Step 3: Checking Subscription Status ---');
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    limit: 5,
  });

  let activeSubscription: Stripe.Subscription | null = null;
  let determinedTier: UserTier = 'free';
  let determinedBillingStatus: BillingStatus = 'none';
  let currentPeriodEnd: string | undefined;

  if (subscriptions.data.length === 0) {
    console.log('❌ No subscriptions found.');
  } else {
    console.log(`✅ Found ${subscriptions.data.length} subscription(s):`);
    
    for (const sub of subscriptions.data) {
      const priceId = sub.items.data[0]?.price?.id;
      const isPremium = PREMIUM_PRICE_IDS.includes(priceId);
      const planType = isPremium ? 'premium' : 'standard';
      
      console.log(`   - ${sub.id}: status=${sub.status}, plan=${planType}, priceId=${priceId}`);
      console.log(`     cancel_at_period_end=${sub.cancel_at_period_end}, period_end=${new Date(sub.current_period_end * 1000).toISOString()}`);
      
      // Find the most relevant subscription
      if (sub.status === 'active' || sub.status === 'trialing') {
        activeSubscription = sub;
      }
    }
  }

  // Step 4: Determine the correct tier and billing status
  console.log('\n--- Step 4: Determining Correct Tier ---');
  
  if (activeSubscription) {
    const priceId = activeSubscription.items.data[0]?.price?.id;
    const isPremium = PREMIUM_PRICE_IDS.includes(priceId);
    
    // If there are unpaid invoices, the user should NOT have premium access
    if (hasUnpaidInvoices) {
      console.log('⚠️  Has unpaid invoices - downgrading tier regardless of subscription status');
      determinedTier = 'free';
      determinedBillingStatus = 'past_due';
    } else if (activeSubscription.status === 'active') {
      determinedTier = isPremium ? 'premium' : 'standard';
      determinedBillingStatus = 'active';
    } else if (activeSubscription.status === 'trialing') {
      determinedTier = isPremium ? 'premium' : 'standard';
      determinedBillingStatus = 'trialing';
    } else if (activeSubscription.status === 'past_due') {
      determinedTier = 'free';
      determinedBillingStatus = 'past_due';
    } else {
      determinedTier = 'free';
      determinedBillingStatus = 'canceled';
    }
    
    currentPeriodEnd = new Date(activeSubscription.current_period_end * 1000).toISOString();
  } else {
    console.log('No active subscription - user should be free tier');
    determinedTier = 'free';
    determinedBillingStatus = 'none';
  }

  console.log(`\n📊 Determined: tier=${determinedTier}, billingStatus=${determinedBillingStatus}`);

  // Step 5: Find user in Clerk
  console.log('\n--- Step 5: Finding User in Clerk ---');
  let userId: string | undefined;
  
  // First check subscription metadata
  if (activeSubscription?.metadata?.userId) {
    userId = activeSubscription.metadata.userId;
    console.log(`✅ Found userId from subscription metadata: ${userId}`);
  } else if (customer.metadata?.userId) {
    userId = customer.metadata.userId;
    console.log(`✅ Found userId from customer metadata: ${userId}`);
  } else {
    // Search Clerk by email
    const clerkUsers = await clerk.users.getUserList({
      emailAddress: [targetEmail],
    });
    
    if (clerkUsers.data.length === 0) {
      console.log('❌ No Clerk user found with this email.');
      return {
        success: false,
        hasUnpaidInvoices,
        determinedTier,
        determinedBillingStatus,
      };
    }
    
    userId = clerkUsers.data[0].id;
    console.log(`✅ Found userId from Clerk email search: ${userId}`);
  }

  // Step 6: Get current state from Firebase
  console.log('\n--- Step 6: Checking Current Firebase State ---');
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  const previousTier = userData?.tier;
  const previousBillingStatus = userData?.billing?.status;
  
  console.log(`   Current Firebase tier: ${previousTier}`);
  console.log(`   Current Firebase billing.status: ${previousBillingStatus}`);

  // Step 7: Get current Clerk state
  console.log('\n--- Step 7: Checking Current Clerk State ---');
  const clerkUser = await clerk.users.getUser(userId);
  const clerkMetadata = clerkUser.publicMetadata as Record<string, unknown>;
  
  console.log(`   Current Clerk tier: ${clerkMetadata?.tier}`);
  console.log(`   Current Clerk billingStatus: ${clerkMetadata?.billingStatus}`);

  // Step 8: Update Firebase
  console.log('\n--- Step 8: Updating Firebase ---');
  const firebaseUpdate: Record<string, unknown> = {
    tier: determinedTier,
    billing: {
      status: determinedBillingStatus,
      ...(currentPeriodEnd && { currentPeriodEnd }),
      ...(activeSubscription && { 
        stripeSubscriptionId: activeSubscription.id,
        stripeCustomerId: customer.id,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
      }),
    },
    updatedAt: new Date().toISOString(),
    tierResetAt: new Date().toISOString(),
    tierResetReason: hasUnpaidInvoices ? 'unpaid_invoices' : 'manual_sync',
  };

  await db.collection('users').doc(userId).set(firebaseUpdate, { merge: true });
  console.log(`✅ Updated Firebase: tier=${determinedTier}, billing.status=${determinedBillingStatus}`);

  // Step 9: Update Clerk
  console.log('\n--- Step 9: Updating Clerk ---');
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...clerkMetadata,
      tier: determinedTier,
      billingStatus: determinedBillingStatus,
      billingPeriodEnd: currentPeriodEnd,
    },
  });
  console.log(`✅ Updated Clerk: tier=${determinedTier}, billingStatus=${determinedBillingStatus}`);

  // Final summary
  console.log('\n========================================');
  console.log('✅ RESET COMPLETE');
  console.log('========================================');
  console.log(`   User ID: ${userId}`);
  console.log(`   Previous tier: ${previousTier} → New tier: ${determinedTier}`);
  console.log(`   Previous billing status: ${previousBillingStatus} → New status: ${determinedBillingStatus}`);
  console.log(`   Has unpaid invoices: ${hasUnpaidInvoices}`);
  if (currentPeriodEnd) {
    console.log(`   Period end: ${currentPeriodEnd}`);
  }
  console.log('\n   The user should refresh their app to see the updated access level.\n');

  return {
    success: true,
    userId,
    stripeStatus: activeSubscription?.status,
    hasUnpaidInvoices,
    determinedTier,
    determinedBillingStatus,
    previousTier,
    previousBillingStatus,
  };
}

// Get email from command line args
const email = process.argv[2];

if (!email) {
  console.error('Usage: doppler run -- npx tsx scripts/reset-user-tier.ts <email>');
  process.exit(1);
}

resetUserTier(email)
  .then((result) => {
    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });









