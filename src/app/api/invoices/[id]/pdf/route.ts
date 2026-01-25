import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { generateInvoicePDF } from '@/lib/invoice-pdf';
import type { Invoice, InvoiceSettings } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/invoices/[id]/pdf
 * Download or generate PDF for an invoice
 *
 * Query params:
 * - regenerate: Force regenerate the PDF
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const regenerate = request.nextUrl.searchParams.get('regenerate') === 'true';

    // Get invoice
    const invoiceDoc = await adminDb.collection('invoices').doc(id).get();
    if (!invoiceDoc.exists) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

    // Authorization check
    if (invoice.userId !== userId) {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      const userData = userDoc.data();
      const isCoachInOrg =
        userData?.organizationId === invoice.organizationId ||
        userData?.coachingOrganizationId === invoice.organizationId;

      if (!isCoachInOrg) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Check if PDF already exists and we don't need to regenerate
    if (invoice.pdfUrl && !regenerate) {
      // Redirect to existing PDF
      return NextResponse.redirect(invoice.pdfUrl);
    }

    // Get invoice settings
    const settingsDoc = await adminDb
      .collection('invoice_settings')
      .doc(invoice.organizationId)
      .get();
    const settings = (settingsDoc.data() as InvoiceSettings) || {
      id: invoice.organizationId,
      organizationId: invoice.organizationId,
      businessName: '',
      lastInvoiceSequence: 0,
      taxEnabled: false,
      autoSendInvoices: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Get org branding
    const orgSettingsDoc = await adminDb
      .collection('org_settings')
      .doc(invoice.organizationId)
      .get();
    const orgSettings = orgSettingsDoc.data();

    const branding = {
      logoUrl: orgSettings?.logoUrl || null,
      accentColor: orgSettings?.accentColor || null,
      appTitle: orgSettings?.appTitle || null,
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, settings, branding);

    // Upload to Firebase Storage
    const bucket = getStorage().bucket();
    const filePath = `invoices/${invoice.organizationId}/${invoice.id}.pdf`;
    const file = bucket.file(filePath);

    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          organizationId: invoice.organizationId,
        },
      },
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Get the public URL
    const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Update invoice with PDF URL
    await adminDb.collection('invoices').doc(id).update({
      pdfUrl,
      pdfGeneratedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Return the PDF directly
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[INVOICE_PDF] Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
