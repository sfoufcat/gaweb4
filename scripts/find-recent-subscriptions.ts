/**
 * Find Recent Stripe Subscriptions
 * Lists all subscriptions created in the last 7 days to find the user
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

async function findRecentSubscriptions() {
  console.log('\n🔍 Finding recent subscriptions...\n');

  // Get subscriptions created in the last 7 days
  const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
  
  const subscriptions = await stripe.subscriptions.list({
    created: { gte: sevenDaysAgo },
    limit: 100,
    expand: ['data.customer'],
  });

  console.log(`Found ${subscriptions.data.length} recent subscriptions:\n`);

  for (const sub of subscriptions.data) {
    const customer = sub.customer as Stripe.Customer;
    console.log('---');
    console.log(`Subscription ID: ${sub.id}`);
    console.log(`Customer Email: ${customer.email}`);
    console.log(`Customer ID: ${customer.id}`);
    console.log(`Status: ${sub.status}`);
    console.log(`Created: ${new Date(sub.created * 1000).toISOString()}`);
    console.log(`Metadata userId: ${sub.metadata?.userId || 'NOT SET'}`);
  }

  console.log('\n---\nDone!\n');
}

findRecentSubscriptions().catch(console.error);

