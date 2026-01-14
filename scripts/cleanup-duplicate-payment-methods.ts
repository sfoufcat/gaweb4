/**
 * Cleanup Duplicate Payment Methods from Stripe
 *
 * This script finds and removes duplicate payment methods for customers
 * on connected Stripe accounts. It keeps the most recently created card
 * for each unique fingerprint.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-duplicate-payment-methods.ts --dry-run
 *   npx ts-node scripts/cleanup-duplicate-payment-methods.ts
 *   npx ts-node scripts/cleanup-duplicate-payment-methods.ts --account=acct_xxxxx
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 *   --account    Only process a specific connected account ID
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin
if (!process.env.FIREBASE_PROJECT_ID) {
  console.error('❌ Missing Firebase environment variables');
  console.error('   Make sure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set');
  process.exit(1);
}

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ Missing STRIPE_SECRET_KEY');
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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

interface DuplicateInfo {
  customerId: string;
  accountId: string;
  fingerprint: string;
  keep: string;
  remove: string[];
}

async function findDuplicatesForCustomer(
  customerId: string,
  stripeAccountId: string
): Promise<DuplicateInfo[]> {
  const duplicates: DuplicateInfo[] = [];

  try {
    // List all payment methods for this customer
    const paymentMethods = await stripe.paymentMethods.list(
      {
        customer: customerId,
        type: 'card',
      },
      { stripeAccount: stripeAccountId }
    );

    // Group by fingerprint
    const byFingerprint = new Map<string, Stripe.PaymentMethod[]>();

    for (const pm of paymentMethods.data) {
      const fingerprint = pm.card?.fingerprint;
      if (!fingerprint) continue;

      const existing = byFingerprint.get(fingerprint) || [];
      existing.push(pm);
      byFingerprint.set(fingerprint, existing);
    }

    // Find duplicates (more than one card per fingerprint)
    for (const [fingerprint, methods] of byFingerprint) {
      if (methods.length > 1) {
        // Sort by created desc - keep the most recent
        methods.sort((a, b) => b.created - a.created);
        const [keep, ...remove] = methods;

        duplicates.push({
          customerId,
          accountId: stripeAccountId,
          fingerprint,
          keep: keep.id,
          remove: remove.map((m) => m.id),
        });
      }
    }
  } catch (error) {
    console.error(`Error processing customer ${customerId} on account ${stripeAccountId}:`, error);
  }

  return duplicates;
}

async function getConnectedAccounts(): Promise<string[]> {
  const accounts: string[] = [];

  // Get all org_settings with stripeConnectAccountId
  const orgSettingsSnapshot = await db
    .collection('org_settings')
    .where('stripeConnectAccountId', '!=', null)
    .get();

  for (const doc of orgSettingsSnapshot.docs) {
    const accountId = doc.data().stripeConnectAccountId;
    if (accountId && !accounts.includes(accountId)) {
      accounts.push(accountId);
    }
  }

  return accounts;
}

async function getCustomersForAccount(stripeAccountId: string): Promise<string[]> {
  const customers: string[] = [];

  // Get all users with this connected account customer ID
  const usersSnapshot = await db.collection('users').get();

  for (const doc of usersSnapshot.docs) {
    const connectedCustomerIds = doc.data().stripeConnectedCustomerIds || {};
    const customerId = connectedCustomerIds[stripeAccountId];
    if (customerId && !customers.includes(customerId)) {
      customers.push(customerId);
    }
  }

  return customers;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const accountArg = args.find((a) => a.startsWith('--account='));
  const specificAccount = accountArg?.split('=')[1];

  console.log('🔍 Cleanup Duplicate Payment Methods');
  console.log('====================================');
  if (dryRun) {
    console.log('🏃 DRY RUN MODE - No changes will be made\n');
  }

  // Get connected accounts to process
  let accounts: string[];
  if (specificAccount) {
    accounts = [specificAccount];
    console.log(`Processing specific account: ${specificAccount}\n`);
  } else {
    accounts = await getConnectedAccounts();
    console.log(`Found ${accounts.length} connected accounts to process\n`);
  }

  let totalDuplicates = 0;
  let totalRemoved = 0;

  for (const accountId of accounts) {
    console.log(`\n📦 Processing account: ${accountId}`);

    // Get customers for this account
    const customers = await getCustomersForAccount(accountId);
    console.log(`   Found ${customers.length} customers`);

    for (const customerId of customers) {
      const duplicates = await findDuplicatesForCustomer(customerId, accountId);

      for (const dup of duplicates) {
        totalDuplicates += dup.remove.length;
        console.log(`\n   Customer ${customerId}:`);
        console.log(`   Card fingerprint: ${dup.fingerprint.slice(0, 8)}...`);
        console.log(`   Keeping: ${dup.keep}`);
        console.log(`   Removing ${dup.remove.length} duplicate(s): ${dup.remove.join(', ')}`);

        if (!dryRun) {
          for (const pmId of dup.remove) {
            try {
              await stripe.paymentMethods.detach(pmId, { stripeAccount: accountId });
              totalRemoved++;
              console.log(`   ✅ Detached ${pmId}`);
            } catch (error) {
              console.error(`   ❌ Failed to detach ${pmId}:`, error);
            }
          }
        }
      }
    }
  }

  console.log('\n====================================');
  console.log(`📊 Summary:`);
  console.log(`   Total duplicates found: ${totalDuplicates}`);
  if (dryRun) {
    console.log(`   Would remove: ${totalDuplicates} payment methods`);
    console.log('\n   Run without --dry-run to actually remove duplicates');
  } else {
    console.log(`   Successfully removed: ${totalRemoved}`);
  }
}

main().catch(console.error);
