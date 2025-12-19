/**
 * Diagnose User Tier Script
 * 
 * This script fetches a user's Stripe subscription and compares the Price ID
 * against the configured environment variables to diagnose why a user might
 * be getting the wrong tier (e.g., Premium user showing as Standard).
 * 
 * Usage:
 *   doppler run -- npx tsx scripts/diagnose-user-tier.ts <email_or_username>
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

async function diagnoseUserTier(identifier: string) {
  console.log(`\n🔍 Diagnosing tier for: ${identifier}\n`);

  // Step 1: Show configured environment variables (masked)
  console.log('=== Environment Variables ===');
  const premiumMonthlyId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
  const premiumHalfYearId = process.env.STRIPE_PREMIUM_HALF_YEAR_PRICE_ID;
  const standardMonthlyId = process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID;
  const standardHalfYearId = process.env.STRIPE_STANDARD_HALF_YEAR_PRICE_ID;
  
  console.log(`STRIPE_PREMIUM_MONTHLY_PRICE_ID:   ${premiumMonthlyId || '❌ NOT SET'}`);
  console.log(`STRIPE_PREMIUM_HALF_YEAR_PRICE_ID: ${premiumHalfYearId || '❌ NOT SET'}`);
  console.log(`STRIPE_STANDARD_MONTHLY_PRICE_ID:  ${standardMonthlyId || '(not set)'}`);
  console.log(`STRIPE_STANDARD_HALF_YEAR_PRICE_ID: ${standardHalfYearId || '(not set)'}`);

  // Step 2: Find user - try email first, then username search
  console.log('\n=== Finding User ===');
  let userEmail: string | undefined;
  let clerkUserId: string | undefined;
  
  // Check if identifier looks like an email
  if (identifier.includes('@')) {
    userEmail = identifier;
    console.log(`Searching by email: ${userEmail}`);
  } else {
    // Search Clerk by username
    console.log(`Searching Clerk for username: ${identifier}`);
    const clerkUsers = await clerk.users.getUserList({
      username: [identifier],
    });
    
    if (clerkUsers.data.length === 0) {
      // Try searching by email pattern
      console.log('Username not found, trying email search...');
      const emailUsers = await clerk.users.getUserList({
        query: identifier,
      });
      
      if (emailUsers.data.length > 0) {
        const user = emailUsers.data[0];
        userEmail = user.emailAddresses[0]?.emailAddress;
        clerkUserId = user.id;
        console.log(`Found user via query: ${user.username || user.firstName} (${userEmail})`);
      }
    } else {
      const user = clerkUsers.data[0];
      userEmail = user.emailAddresses[0]?.emailAddress;
      clerkUserId = user.id;
      console.log(`Found Clerk user: ${user.username} (${userEmail})`);
    }
  }

  if (!userEmail) {
    console.log('❌ Could not find user email. Please provide a valid email or username.');
    process.exit(1);
  }

  // Step 3: Get Clerk user details
  if (!clerkUserId) {
    const clerkUsers = await clerk.users.getUserList({
      emailAddress: [userEmail],
    });
    if (clerkUsers.data.length > 0) {
      clerkUserId = clerkUsers.data[0].id;
    }
  }

  if (clerkUserId) {
    const clerkUser = await clerk.users.getUser(clerkUserId);
    console.log('\n=== Clerk User Metadata ===');
    console.log(`User ID: ${clerkUserId}`);
    console.log(`Username: ${clerkUser.username}`);
    console.log(`Public Metadata:`, JSON.stringify(clerkUser.publicMetadata, null, 2));
  }

  // Step 4: Find Stripe customer
  console.log('\n=== Stripe Customer ===');
  const customers = await stripe.customers.list({
    email: userEmail,
  });

  if (customers.data.length === 0) {
    console.log('❌ No Stripe customer found with this email.');
    process.exit(1);
  }

  const customer = customers.data[0];
  console.log(`Customer ID: ${customer.id}`);
  console.log(`Email: ${customer.email}`);
  console.log(`Metadata:`, JSON.stringify(customer.metadata, null, 2));

  // Step 5: Get subscriptions
  console.log('\n=== Stripe Subscriptions ===');
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    expand: ['data.items.data.price'],
  });

  if (subscriptions.data.length === 0) {
    console.log('❌ No subscriptions found for this customer.');
    process.exit(1);
  }

  for (const sub of subscriptions.data) {
    console.log(`\nSubscription: ${sub.id}`);
    console.log(`  Status: ${sub.status}`);
    console.log(`  Created: ${new Date(sub.created * 1000).toISOString()}`);
    console.log(`  Current Period End: ${new Date(sub.current_period_end * 1000).toISOString()}`);
    console.log(`  Cancel at Period End: ${sub.cancel_at_period_end}`);
    console.log(`  Metadata:`, JSON.stringify(sub.metadata, null, 2));
    
    console.log(`\n  Items:`);
    for (const item of sub.items.data) {
      const price = item.price;
      console.log(`    - Price ID: ${price.id}`);
      console.log(`      Product: ${price.product}`);
      console.log(`      Amount: ${(price.unit_amount || 0) / 100} ${price.currency?.toUpperCase()}`);
      console.log(`      Interval: ${price.recurring?.interval}`);
      console.log(`      Nickname: ${price.nickname || '(none)'}`);
      
      // Determine what tier this SHOULD be
      let expectedTier = 'standard';
      if (price.id === premiumMonthlyId || price.id === premiumHalfYearId) {
        expectedTier = 'premium';
      }
      
      // Check by amount as backup
      const amount = (price.unit_amount || 0) / 100;
      let tierByAmount = 'unknown';
      if (amount === 99 || amount === 499) {
        tierByAmount = 'premium (by price)';
      } else if (amount === 9 || amount === 49) {
        tierByAmount = 'standard (by price)';
      }
      
      console.log(`\n      🔍 TIER ANALYSIS:`);
      console.log(`         By Price ID match: ${expectedTier}`);
      console.log(`         By Amount ($${amount}): ${tierByAmount}`);
      
      if (expectedTier === 'standard' && tierByAmount.includes('premium')) {
        console.log(`\n      ⚠️  MISMATCH DETECTED!`);
        console.log(`         The Price ID (${price.id}) is NOT in the Premium env vars,`);
        console.log(`         but the amount ($${amount}) suggests this IS a Premium subscription.`);
        console.log(`\n      🔧 FIX: Update STRIPE_PREMIUM_MONTHLY_PRICE_ID or STRIPE_PREMIUM_HALF_YEAR_PRICE_ID`);
        console.log(`         to include: ${price.id}`);
      }
    }
  }

  console.log('\n=== Diagnosis Complete ===\n');
  process.exit(0);
}

// Get identifier from command line args
const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: doppler run -- npx tsx scripts/diagnose-user-tier.ts <email_or_username>');
  process.exit(1);
}

diagnoseUserTier(identifier).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});









