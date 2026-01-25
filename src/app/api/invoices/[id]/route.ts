import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Invoice } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]
 * Get a single invoice by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const doc = await adminDb.collection('invoices').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = { id: doc.id, ...doc.data() } as Invoice;

    // Authorization: user must own the invoice or be part of the org
    // TODO: Add proper org membership check
    // For now, allow if user is the invoice owner
    if (invoice.userId !== userId) {
      // Check if user is coach in the org
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const isCoachInOrg = userData?.organizationId === invoice.organizationId ||
        userData?.coachingOrganizationId === invoice.organizationId;

      if (!isCoachInOrg) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('[INVOICE_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

/**
 * PATCH /api/invoices/[id]
 * Update invoice (e.g., mark as refunded)
 *
 * Body:
 * - status?: 'refunded' | 'partial_refund'
 * - refundedAmount?: number
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    const doc = await adminDb.collection('invoices').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = { id: doc.id, ...doc.data() } as Invoice;

    // Only coaches in the org can update invoices
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isCoachInOrg = userData?.organizationId === invoice.organizationId ||
      userData?.coachingOrganizationId === invoice.organizationId;

    if (!isCoachInOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build update
    const updates: Partial<Invoice> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.status) {
      updates.status = body.status;
    }
    if (typeof body.refundedAmount === 'number') {
      updates.refundedAmount = body.refundedAmount;
    }

    await adminDb.collection('invoices').doc(id).update(updates);

    return NextResponse.json({
      ...invoice,
      ...updates,
    });
  } catch (error) {
    console.error('[INVOICE_PATCH] Error:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}
