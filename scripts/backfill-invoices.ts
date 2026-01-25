/**
 * Migration Script: Backfill Invoices
 *
 * This script creates invoices for historical payments that occurred before
 * the invoicing system was implemented.
 *
 * Sources of payments:
 * - program_enrollments (with paidAt and amountPaid)
 * - user_content_purchases (with purchasedAt and amountPaid)
 * - squadMembers (with subscription and payment records)
 *
 * Usage:
 *   npx ts-node scripts/backfill-invoices.ts [--dry-run] [--org=<orgId>]
 *
 * Flags:
 *   --dry-run: Don't write any changes, just log what would happen
 *   --org=<orgId>: Only backfill for a specific organization
 *
 * Notes:
 *   - Invoices are created with status 'paid'
 *   - Emails are NOT sent for historical invoices
 *   - Existing invoices are skipped (idempotent)
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type {
  Invoice,
  InvoiceSettings,
  InvoicePaymentType,
  InvoiceLineItem,
  ProgramEnrollment,
  ContentPurchase,
  SquadMember,
  Program,
} from '../src/types';

// Initialize Firebase Admin
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase credentials in environment variables');
    console.error('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore();

// Parse command line args
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const orgArg = args.find((a) => a.startsWith('--org='));
const targetOrgId = orgArg ? orgArg.split('=')[1] : null;

// Stats tracking
const stats = {
  enrollmentsProcessed: 0,
  contentPurchasesProcessed: 0,
  squadMembersProcessed: 0,
  invoicesCreated: 0,
  invoicesSkipped: 0,
  errors: 0,
};

// Invoice numbering cache per org
const invoiceNumberCache: Map<string, { prefix: string; sequence: number }> = new Map();

/**
 * Generate invoice number for an org
 */
async function generateInvoiceNumber(organizationId: string, paidAt: string): Promise<string> {
  const date = new Date(paidAt);
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Get or initialize cache for this org
  if (!invoiceNumberCache.has(organizationId)) {
    // Get settings or create default
    const settingsDoc = await db.collection('invoice_settings').doc(organizationId).get();
    const settings = settingsDoc.data() as InvoiceSettings | undefined;

    invoiceNumberCache.set(organizationId, {
      prefix: settings?.invoicePrefix || organizationId.slice(0, 5).toUpperCase(),
      sequence: settings?.lastInvoiceSequence || 0,
    });
  }

  const cache = invoiceNumberCache.get(organizationId)!;
  cache.sequence += 1;

  return `${cache.prefix}-${yearMonth}-${String(cache.sequence).padStart(4, '0')}`;
}

/**
 * Check if invoice already exists for a payment
 */
async function invoiceExists(stripePaymentIntentId: string): Promise<boolean> {
  if (!stripePaymentIntentId) return false;

  const snapshot = await db
    .collection('invoices')
    .where('stripePaymentIntentId', '==', stripePaymentIntentId)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Create an invoice record
 */
async function createInvoice(data: {
  organizationId: string;
  userId: string;
  paymentType: InvoicePaymentType;
  referenceId: string;
  referenceName: string;
  amountPaid: number;
  currency: string;
  stripePaymentIntentId?: string;
  paidAt: string;
}): Promise<void> {
  const invoiceNumber = await generateInvoiceNumber(data.organizationId, data.paidAt);

  const lineItems: InvoiceLineItem[] = [
    {
      description: data.referenceName,
      quantity: 1,
      unitPrice: data.amountPaid,
      total: data.amountPaid,
    },
  ];

  const now = new Date().toISOString();
  const invoice: Omit<Invoice, 'id'> = {
    invoiceNumber,
    organizationId: data.organizationId,
    userId: data.userId,
    paymentType: data.paymentType,
    referenceId: data.referenceId,
    referenceName: data.referenceName,
    lineItems,
    subtotal: data.amountPaid,
    taxAmount: 0,
    total: data.amountPaid,
    currency: data.currency || 'usd',
    stripePaymentIntentId: data.stripePaymentIntentId,
    paidAt: data.paidAt,
    status: 'paid',
    createdAt: now,
    updatedAt: now,
  };

  if (!isDryRun) {
    await db.collection('invoices').add(invoice);
  }

  console.log(`  Created invoice ${invoiceNumber} for ${data.paymentType}: ${data.referenceName}`);
  stats.invoicesCreated++;
}

/**
 * Process program enrollments
 */
async function processEnrollments(): Promise<void> {
  console.log('\n📋 Processing program enrollments...');

  let query = db.collection('program_enrollments').where('paidAt', '!=', null);

  if (targetOrgId) {
    query = query.where('organizationId', '==', targetOrgId);
  }

  const snapshot = await query.get();
  console.log(`  Found ${snapshot.size} enrollments with payments`);

  for (const doc of snapshot.docs) {
    try {
      const enrollment = { id: doc.id, ...doc.data() } as ProgramEnrollment;
      stats.enrollmentsProcessed++;

      // Skip if no payment
      if (!enrollment.paidAt || !enrollment.amountPaid) {
        continue;
      }

      // Skip if invoice already exists
      if (enrollment.stripePaymentIntentId) {
        const exists = await invoiceExists(enrollment.stripePaymentIntentId);
        if (exists) {
          stats.invoicesSkipped++;
          continue;
        }
      }

      // Get program name
      let programName = 'Program enrollment';
      if (enrollment.programId) {
        const programDoc = await db.collection('programs').doc(enrollment.programId).get();
        if (programDoc.exists) {
          programName = (programDoc.data() as Program).name || programName;
        }
      }

      await createInvoice({
        organizationId: enrollment.organizationId,
        userId: enrollment.userId,
        paymentType: 'program_enrollment',
        referenceId: doc.id,
        referenceName: programName,
        amountPaid: enrollment.amountPaid,
        currency: 'usd',
        stripePaymentIntentId: enrollment.stripePaymentIntentId,
        paidAt: enrollment.paidAt,
      });
    } catch (err) {
      console.error(`  Error processing enrollment ${doc.id}:`, err);
      stats.errors++;
    }
  }
}

/**
 * Process content purchases
 */
async function processContentPurchases(): Promise<void> {
  console.log('\n🛒 Processing content purchases...');

  let query = db.collection('user_content_purchases').orderBy('purchasedAt', 'desc');

  if (targetOrgId) {
    query = query.where('organizationId', '==', targetOrgId);
  }

  const snapshot = await query.get();
  console.log(`  Found ${snapshot.size} content purchases`);

  for (const doc of snapshot.docs) {
    try {
      const purchase = { id: doc.id, ...doc.data() } as ContentPurchase;
      stats.contentPurchasesProcessed++;

      // Skip free purchases
      if (!purchase.amountPaid || purchase.amountPaid === 0) {
        continue;
      }

      // Skip if invoice already exists
      if (purchase.stripePaymentIntentId) {
        const exists = await invoiceExists(purchase.stripePaymentIntentId);
        if (exists) {
          stats.invoicesSkipped++;
          continue;
        }
      }

      // Get content name
      let contentName = `${purchase.contentType} purchase`;
      if (purchase.contentId) {
        const contentDoc = await db.collection('content').doc(purchase.contentId).get();
        if (contentDoc.exists) {
          contentName = contentDoc.data()?.title || contentName;
        }
      }

      await createInvoice({
        organizationId: purchase.organizationId,
        userId: purchase.userId,
        paymentType: 'content_purchase',
        referenceId: doc.id,
        referenceName: contentName,
        amountPaid: purchase.amountPaid,
        currency: purchase.currency || 'usd',
        stripePaymentIntentId: purchase.stripePaymentIntentId,
        paidAt: purchase.purchasedAt,
      });
    } catch (err) {
      console.error(`  Error processing content purchase ${doc.id}:`, err);
      stats.errors++;
    }
  }
}

/**
 * Update invoice settings with final sequence numbers
 */
async function updateInvoiceSettings(): Promise<void> {
  if (isDryRun) {
    console.log('\n⏭️  Skipping invoice settings update (dry run)');
    return;
  }

  console.log('\n📝 Updating invoice settings...');

  for (const [orgId, cache] of invoiceNumberCache.entries()) {
    try {
      const settingsRef = db.collection('invoice_settings').doc(orgId);
      const settingsDoc = await settingsRef.get();

      if (settingsDoc.exists) {
        await settingsRef.update({
          lastInvoiceSequence: cache.sequence,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await settingsRef.set({
          id: orgId,
          organizationId: orgId,
          businessName: '',
          invoicePrefix: cache.prefix,
          lastInvoiceSequence: cache.sequence,
          taxEnabled: false,
          autoSendInvoices: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      console.log(`  Updated ${orgId}: sequence = ${cache.sequence}`);
    } catch (err) {
      console.error(`  Error updating settings for ${orgId}:`, err);
    }
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('🧾 Invoice Backfill Script');
  console.log('==========================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  if (targetOrgId) {
    console.log(`Target org: ${targetOrgId}`);
  }

  await processEnrollments();
  await processContentPurchases();
  await updateInvoiceSettings();

  console.log('\n📊 Summary');
  console.log('==========');
  console.log(`Enrollments processed: ${stats.enrollmentsProcessed}`);
  console.log(`Content purchases processed: ${stats.contentPurchasesProcessed}`);
  console.log(`Invoices created: ${stats.invoicesCreated}`);
  console.log(`Invoices skipped (already exist): ${stats.invoicesSkipped}`);
  console.log(`Errors: ${stats.errors}`);

  if (isDryRun) {
    console.log('\n⚠️  This was a dry run. No changes were made.');
    console.log('   Run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
