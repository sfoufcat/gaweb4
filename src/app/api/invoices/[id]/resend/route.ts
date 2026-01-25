import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendInvoiceEmail } from '@/lib/invoice-email';
import type { Invoice } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/resend
 * Resend invoice email
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Get invoice
    const invoiceDoc = await adminDb.collection('invoices').doc(id).get();
    if (!invoiceDoc.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

    // Only coaches in the org can resend invoices
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const isCoachInOrg =
      userData?.organizationId === invoice.organizationId ||
      userData?.coachingOrganizationId === invoice.organizationId;

    if (!isCoachInOrg) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Send invoice email
    const result = await sendInvoiceEmail(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice email sent successfully',
    });
  } catch (error) {
    console.error('[INVOICE_RESEND] Error:', error);
    return NextResponse.json({ error: 'Failed to resend invoice' }, { status: 500 });
  }
}
