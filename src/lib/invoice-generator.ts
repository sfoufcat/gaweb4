/**
 * Invoice Generator
 *
 * Creates invoice records from payment events.
 * Used by Stripe webhooks to automatically generate invoices.
 */

import { adminDb } from './firebase-admin';
import { sendInvoiceEmail } from './invoice-email';
import type { Invoice, InvoiceSettings, InvoicePaymentType, InvoiceLineItem } from '@/types';

interface CreateInvoiceParams {
  userId: string;
  organizationId: string;
  paymentType: InvoicePaymentType;
  referenceId: string;
  referenceName: string;
  amountPaid: number; // In cents
  currency: string;
  stripePaymentIntentId?: string;
  stripeInvoiceId?: string;
  paymentMethod?: string;
  lineItems?: InvoiceLineItem[];
}

interface CreateInvoiceResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  error?: string;
}

/**
 * Create an invoice from a payment event
 * This is called from Stripe webhooks
 */
export async function createInvoiceFromPayment(
  params: CreateInvoiceParams
): Promise<CreateInvoiceResult> {
  try {
    const {
      userId,
      organizationId,
      paymentType,
      referenceId,
      referenceName,
      amountPaid,
      currency,
      stripePaymentIntentId,
      stripeInvoiceId,
      paymentMethod,
      lineItems: providedLineItems,
    } = params;

    // Skip if no organization (e.g., platform payments)
    if (!organizationId) {
      console.log('[INVOICE_GENERATOR] Skipping invoice - no organizationId');
      return { success: true }; // Not an error, just skip
    }

    // Check for existing invoice with same payment intent (idempotency)
    if (stripePaymentIntentId) {
      const existing = await adminDb
        .collection('invoices')
        .where('stripePaymentIntentId', '==', stripePaymentIntentId)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(
          `[INVOICE_GENERATOR] Invoice already exists for payment ${stripePaymentIntentId}`
        );
        const doc = existing.docs[0];
        return {
          success: true,
          invoiceId: doc.id,
          invoiceNumber: doc.data().invoiceNumber,
        };
      }
    }

    // Idempotency for non-Stripe payments (e.g., prepaid enrollments)
    // Check by referenceId + paymentType combination
    if (!stripePaymentIntentId && referenceId) {
      const existing = await adminDb
        .collection('invoices')
        .where('referenceId', '==', referenceId)
        .where('paymentType', '==', paymentType)
        .limit(1)
        .get();

      if (!existing.empty) {
        console.log(
          `[INVOICE_GENERATOR] Invoice already exists for ${paymentType} ${referenceId}`
        );
        const doc = existing.docs[0];
        return {
          success: true,
          invoiceId: doc.id,
          invoiceNumber: doc.data().invoiceNumber,
        };
      }
    }

    // Get or create invoice settings
    const settingsDoc = await adminDb.collection('invoice_settings').doc(organizationId).get();
    let settings = settingsDoc.data() as InvoiceSettings | undefined;

    if (!settings) {
      // Create default settings
      const now = new Date().toISOString();
      settings = {
        id: organizationId,
        organizationId,
        businessName: '',
        invoicePrefix: organizationId.slice(0, 5).toUpperCase(),
        lastInvoiceSequence: 0,
        taxEnabled: false,
        autoSendInvoices: true,
        createdAt: now,
        updatedAt: now,
      };
      await adminDb.collection('invoice_settings').doc(organizationId).set(settings);
    }

    // Generate invoice number atomically
    const invoiceNumber = await generateInvoiceNumber(organizationId, settings);

    // Calculate tax if enabled
    let taxAmount = 0;
    let taxRate: number | undefined;
    if (settings.taxEnabled && settings.defaultTaxRate) {
      taxRate = settings.defaultTaxRate;
      taxAmount = Math.round(amountPaid * (taxRate / 100));
    }

    // Build line items
    const lineItems: InvoiceLineItem[] = providedLineItems || [
      {
        description: referenceName,
        quantity: 1,
        unitPrice: amountPaid,
        total: amountPaid,
      },
    ];

    const now = new Date().toISOString();
    const invoice: Omit<Invoice, 'id'> = {
      invoiceNumber,
      organizationId,
      userId,
      paymentType,
      referenceId,
      referenceName,
      lineItems,
      subtotal: amountPaid,
      taxAmount,
      taxRate,
      total: amountPaid + taxAmount,
      currency: currency || 'usd',
      stripePaymentIntentId,
      stripeInvoiceId,
      paidAt: now,
      paymentMethod,
      status: 'paid',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('invoices').add(invoice);

    console.log(
      `[INVOICE_GENERATOR] Created invoice ${invoiceNumber} for ${paymentType} ${referenceId}`
    );

    // Send email async if auto-send is enabled (don't block webhook)
    if (settings.autoSendInvoices) {
      sendInvoiceEmail(docRef.id).catch((err) => {
        console.error('[INVOICE_GENERATOR] Failed to send invoice email:', err);
      });
    }

    return {
      success: true,
      invoiceId: docRef.id,
      invoiceNumber,
    };
  } catch (error) {
    console.error('[INVOICE_GENERATOR] Error creating invoice:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invoice',
    };
  }
}

/**
 * Generate a unique invoice number atomically
 * Format: {PREFIX}-{YYYYMM}-{SEQUENCE}
 */
async function generateInvoiceNumber(
  organizationId: string,
  settings: InvoiceSettings
): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Atomic increment of sequence
  const settingsRef = adminDb.collection('invoice_settings').doc(organizationId);
  const result = await adminDb.runTransaction(async (t) => {
    const doc = await t.get(settingsRef);
    const data = doc.data();
    const lastSequence = data?.lastInvoiceSequence || 0;
    const newSequence = lastSequence + 1;
    t.update(settingsRef, {
      lastInvoiceSequence: newSequence,
      updatedAt: new Date().toISOString(),
    });
    return newSequence;
  });

  const prefix = settings.invoicePrefix || organizationId.slice(0, 5).toUpperCase();
  return `${prefix}-${yearMonth}-${String(result).padStart(4, '0')}`;
}

/**
 * Mark an invoice as refunded (called from charge.refunded webhook)
 */
export async function markInvoiceRefunded(
  stripePaymentIntentId: string,
  refundedAmount: number,
  isFullRefund: boolean
): Promise<void> {
  try {
    const snapshot = await adminDb
      .collection('invoices')
      .where('stripePaymentIntentId', '==', stripePaymentIntentId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      console.log(`[INVOICE_GENERATOR] No invoice found for payment ${stripePaymentIntentId}`);
      return;
    }

    const doc = snapshot.docs[0];
    await doc.ref.update({
      status: isFullRefund ? 'refunded' : 'partial_refund',
      refundedAmount,
      updatedAt: new Date().toISOString(),
    });

    console.log(
      `[INVOICE_GENERATOR] Marked invoice ${doc.id} as ${isFullRefund ? 'refunded' : 'partial_refund'}`
    );
  } catch (error) {
    console.error('[INVOICE_GENERATOR] Error marking invoice as refunded:', error);
  }
}
