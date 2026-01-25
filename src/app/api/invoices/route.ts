import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Invoice, InvoiceSettings, InvoicePaymentType, InvoiceLineItem } from '@/types';

/**
 * GET /api/invoices
 * List invoices with optional filters
 *
 * Query params:
 * - organizationId: Filter by org (required for coach view)
 * - userId: Filter by user (for client view)
 * - paymentType: Filter by payment type
 * - startDate: ISO date string
 * - endDate: ISO date string
 * - limit: Max results (default 50)
 * - cursor: Pagination cursor (invoice ID)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const filterUserId = searchParams.get('userId');
    const paymentType = searchParams.get('paymentType') as InvoicePaymentType | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor');

    // Build query
    let query = adminDb.collection('invoices').orderBy('createdAt', 'desc');

    // Filter by organization (for coach view)
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    // Filter by user (for client view or coach filtering by client)
    if (filterUserId) {
      query = query.where('userId', '==', filterUserId);
    }

    // Filter by payment type
    if (paymentType) {
      query = query.where('paymentType', '==', paymentType);
    }

    // Date range filters
    if (startDate) {
      query = query.where('createdAt', '>=', startDate);
    }
    if (endDate) {
      query = query.where('createdAt', '<=', endDate);
    }

    // Pagination
    if (cursor) {
      const cursorDoc = await adminDb.collection('invoices').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1); // Fetch one extra to check for more

    const snapshot = await query.get();
    const invoices: Invoice[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;

    snapshot.docs.forEach((doc, index) => {
      if (index < limit) {
        invoices.push({ id: doc.id, ...doc.data() } as Invoice);
      } else {
        hasMore = true;
        nextCursor = invoices[invoices.length - 1]?.id || null;
      }
    });

    return NextResponse.json({
      invoices,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('[INVOICES_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

/**
 * POST /api/invoices
 * Create a new invoice (internal use from webhooks)
 *
 * Body:
 * - userId: string
 * - organizationId: string
 * - paymentType: InvoicePaymentType
 * - referenceId: string
 * - referenceName: string
 * - amountPaid: number (cents)
 * - currency: string
 * - stripePaymentIntentId?: string
 * - paymentMethod?: string
 * - lineItems?: InvoiceLineItem[]
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint is called internally from webhooks
    // Verify internal call (check for internal header or use service account)
    const internalKey = request.headers.get('x-internal-key');
    if (internalKey !== process.env.INTERNAL_API_KEY) {
      // Allow authenticated users for testing
      const { userId } = await auth();
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const {
      userId: invoiceUserId,
      organizationId,
      paymentType,
      referenceId,
      referenceName,
      amountPaid,
      currency,
      stripePaymentIntentId,
      paymentMethod,
      lineItems: providedLineItems,
    } = body;

    // Validate required fields
    if (!invoiceUserId || !organizationId || !paymentType || !referenceId || !referenceName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
        businessName: '', // Will need to be filled in by coach
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
      userId: invoiceUserId,
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
      paidAt: now,
      paymentMethod,
      status: 'paid',
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection('invoices').add(invoice);

    return NextResponse.json({
      id: docRef.id,
      ...invoice,
    });
  } catch (error) {
    console.error('[INVOICES_POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
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
