/**
 * Fix Billing in Clerk Script
 * 
 * This script finds a user's active Stripe subscription and updates their
 * Clerk publicMetadata.billingStatus to 'active'.
 * 
 * Usage:
 *   doppler run -- npx tsx scripts/fix-billing-clerk.ts youmna1995h@gmail.com
 */

import Stripe from 'stripe';
import { createClerkClient } from '@clerk/backend';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const clerk = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY! 
});

async function fixBilling(targetEmail: string) {
  console.log(`\n🔍 Looking for subscription for: ${targetEmail}\n`);

  // Step 1: Find Stripe customer by email
  console.log('--- Step 1: Finding Stripe Customer ---');
  const customers = await stripe.customers.list({
    email: targetEmail,
    expand: ['data.subscriptions'],
  });

  if (customers.data.length === 0) {
    console.log('❌ No Stripe customer found with this email.');
    process.exit(1);
  }

  const customer = customers.data[0];
  console.log(`✅ Found Stripe customer: ${customer.id}`);

  // Step 2: Check for active subscriptions
  console.log('\n--- Step 2: Checking Subscriptions ---');
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'active',
  });

  if (subscriptions.data.length === 0) {
    // Also check trialing
    const trialingSubs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'trialing',
    });
    
    if (trialingSubs.data.length === 0) {
      console.log('❌ No active or trialing subscriptions found.');
      process.exit(1);
    }
    
    subscriptions.data.push(...trialingSubs.data);
  }

  const subscription = subscriptions.data[0];
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  console.log(`✅ Found active subscription: ${subscription.id}`);
  console.log(`   Status: ${subscription.status}`);
  console.log(`   Period End: ${periodEnd}`);

  // Step 3: Get userId from subscription metadata
  console.log('\n--- Step 3: Finding User ID ---');
  let userId = subscription.metadata?.userId;
  
  if (!userId) {
    // Try to find from customer metadata
    userId = customer.metadata?.userId;
  }

  if (!userId) {
    console.log('⚠️  No userId in Stripe metadata. Searching Clerk by email...');
    
    // Search Clerk users by email
    const clerkUsers = await clerk.users.getUserList({
      emailAddress: [targetEmail],
    });
    
    if (clerkUsers.data.length === 0) {
      console.log('❌ No Clerk user found with this email.');
      process.exit(1);
    }
    
    userId = clerkUsers.data[0].id;
  }

  console.log(`✅ Found user ID: ${userId}`);

  // Step 4: Update Clerk publicMetadata
  console.log('\n--- Step 4: Updating Clerk Metadata ---');
  const user = await clerk.users.getUser(userId);
  
  console.log('   Current metadata:', JSON.stringify(user.publicMetadata, null, 2));
  
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: {
      ...user.publicMetadata,
      billingStatus: 'active',
      billingPeriodEnd: periodEnd,
    },
  });

  console.log('✅ Updated Clerk publicMetadata:');
  console.log('   billingStatus: active');
  console.log(`   billingPeriodEnd: ${periodEnd}`);

  // Verify the update
  const updatedUser = await clerk.users.getUser(userId);
  console.log('\n--- Verification ---');
  console.log('   New metadata:', JSON.stringify(updatedUser.publicMetadata, null, 2));

  console.log('\n✅ SUCCESS! User now has active billing in Clerk.');
  console.log('   They should refresh the app to get access.\n');
  
  process.exit(0);
}

// Get email from command line args
const email = process.argv[2];

if (!email) {
  console.error('Usage: doppler run -- npx tsx scripts/fix-billing-clerk.ts <email>');
  process.exit(1);
}

fixBilling(email).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

