import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { InvoiceSettings, InvoiceBusinessAddress } from '@/types';

/**
 * GET /api/coach/invoice-settings
 * Get the organization's invoice settings
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const doc = await adminDb.collection('invoice_settings').doc(organizationId).get();

    if (!doc.exists) {
      // Return default settings if none exist
      const defaultSettings: InvoiceSettings = {
        id: organizationId,
        organizationId,
        businessName: '',
        invoicePrefix: organizationId.slice(0, 5).toUpperCase(),
        lastInvoiceSequence: 0,
        taxEnabled: false,
        autoSendInvoices: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('[INVOICE_SETTINGS_GET] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch invoice settings' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/invoice-settings
 * Update the organization's invoice settings
 *
 * Body: Partial<InvoiceSettings>
 */
export async function PUT(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    // Validate and sanitize input
    const updates: Partial<InvoiceSettings> = {};

    if (typeof body.businessName === 'string') {
      updates.businessName = body.businessName.trim();
    }

    if (body.businessAddress !== undefined) {
      if (body.businessAddress === null) {
        updates.businessAddress = undefined;
      } else if (typeof body.businessAddress === 'object') {
        const addr = body.businessAddress as InvoiceBusinessAddress;
        updates.businessAddress = {
          line1: addr.line1?.trim() || '',
          line2: addr.line2?.trim(),
          city: addr.city?.trim() || '',
          state: addr.state?.trim(),
          postalCode: addr.postalCode?.trim() || '',
          country: addr.country?.trim() || '',
        };
      }
    }

    if (typeof body.taxId === 'string') {
      updates.taxId = body.taxId.trim() || undefined;
    }

    if (typeof body.businessEmail === 'string') {
      updates.businessEmail = body.businessEmail.trim() || undefined;
    }

    if (typeof body.businessPhone === 'string') {
      updates.businessPhone = body.businessPhone.trim() || undefined;
    }

    if (typeof body.logoUrl === 'string') {
      updates.logoUrl = body.logoUrl.trim() || undefined;
    }

    if (typeof body.invoicePrefix === 'string') {
      // Sanitize prefix: uppercase, alphanumeric only, max 10 chars
      updates.invoicePrefix = body.invoicePrefix
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 10);
    }

    if (typeof body.taxEnabled === 'boolean') {
      updates.taxEnabled = body.taxEnabled;
    }

    if (typeof body.defaultTaxRate === 'number') {
      // Clamp between 0 and 100
      updates.defaultTaxRate = Math.max(0, Math.min(100, body.defaultTaxRate));
    }

    if (typeof body.taxLabel === 'string') {
      updates.taxLabel = body.taxLabel.trim() || undefined;
    }

    if (typeof body.autoSendInvoices === 'boolean') {
      updates.autoSendInvoices = body.autoSendInvoices;
    }

    if (typeof body.invoiceEmailSubject === 'string') {
      updates.invoiceEmailSubject = body.invoiceEmailSubject.trim() || undefined;
    }

    if (typeof body.invoiceEmailBody === 'string') {
      updates.invoiceEmailBody = body.invoiceEmailBody.trim() || undefined;
    }

    if (typeof body.invoiceFooter === 'string') {
      updates.invoiceFooter = body.invoiceFooter.trim() || undefined;
    }

    updates.updatedAt = new Date().toISOString();

    // Check if document exists
    const docRef = adminDb.collection('invoice_settings').doc(organizationId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // Create new settings
      const newSettings: InvoiceSettings = {
        id: organizationId,
        organizationId,
        businessName: updates.businessName || '',
        businessAddress: updates.businessAddress,
        taxId: updates.taxId,
        businessEmail: updates.businessEmail,
        businessPhone: updates.businessPhone,
        logoUrl: updates.logoUrl,
        invoicePrefix: updates.invoicePrefix || organizationId.slice(0, 5).toUpperCase(),
        lastInvoiceSequence: 0,
        taxEnabled: updates.taxEnabled ?? false,
        defaultTaxRate: updates.defaultTaxRate,
        taxLabel: updates.taxLabel,
        autoSendInvoices: updates.autoSendInvoices ?? true,
        invoiceEmailSubject: updates.invoiceEmailSubject,
        invoiceEmailBody: updates.invoiceEmailBody,
        invoiceFooter: updates.invoiceFooter,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await docRef.set(newSettings);
      return NextResponse.json(newSettings);
    }

    // Update existing settings
    await docRef.update(updates);

    const updatedDoc = await docRef.get();
    return NextResponse.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error('[INVOICE_SETTINGS_PUT] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to update invoice settings' }, { status: 500 });
  }
}
