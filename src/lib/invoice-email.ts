/**
 * Invoice Email Sender
 *
 * Sends invoice emails with PDF attachments using the tenant email system.
 */

import { adminDb } from './firebase-admin';
import { sendTenantEmail } from './email-sender';
import { generateInvoicePDF } from './invoice-pdf';
import type { Invoice, InvoiceSettings, FirebaseUser } from '@/types';

interface SendInvoiceEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an invoice email with PDF attachment
 */
export async function sendInvoiceEmail(invoiceId: string): Promise<SendInvoiceEmailResult> {
  try {
    // Get invoice
    const invoiceDoc = await adminDb.collection('invoices').doc(invoiceId).get();
    if (!invoiceDoc.exists) {
      return { success: false, error: 'Invoice not found' };
    }
    const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as Invoice;

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

    // Get user email
    const userDoc = await adminDb.collection('users').doc(invoice.userId).get();
    if (!userDoc.exists) {
      return { success: false, error: 'User not found' };
    }
    const user = userDoc.data() as FirebaseUser;
    const userEmail = user.email;

    if (!userEmail) {
      return { success: false, error: 'User has no email address' };
    }

    // Get org branding for PDF
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

    // Build email subject
    const subject =
      settings.invoiceEmailSubject ||
      `Invoice ${invoice.invoiceNumber} from ${settings.businessName || branding.appTitle || 'your coach'}`;

    // Build email body
    const html = buildInvoiceEmailHtml(invoice, settings, branding);

    // Send email with PDF attachment
    await sendTenantEmail({
      to: userEmail,
      subject,
      html,
      organizationId: invoice.organizationId,
      attachments: [
        {
          filename: `invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    // Update invoice with email sent info
    await adminDb.collection('invoices').doc(invoiceId).update({
      emailSentAt: new Date().toISOString(),
      emailTo: userEmail,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    console.error('[INVOICE_EMAIL] Error sending invoice email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Build HTML email body for invoice
 */
function buildInvoiceEmailHtml(
  invoice: Invoice,
  settings: InvoiceSettings,
  branding: { logoUrl?: string | null; accentColor?: string | null; appTitle?: string | null }
): string {
  const accentColor = branding.accentColor || '#8B7355';
  const businessName = settings.businessName || branding.appTitle || 'Your Coach';

  const formattedTotal = formatCurrency(invoice.total, invoice.currency);
  const formattedDate = formatDate(invoice.paidAt);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${accentColor}; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                Invoice from ${escapeHtml(businessName)}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.5;">
                Thank you for your payment! Please find your invoice attached to this email.
              </p>

              <!-- Invoice Summary Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888888; font-size: 14px;">Invoice Number</span><br>
                          <span style="color: #333333; font-size: 16px; font-weight: 600;">${escapeHtml(invoice.invoiceNumber)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888888; font-size: 14px;">Date</span><br>
                          <span style="color: #333333; font-size: 16px;">${escapeHtml(formattedDate)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #888888; font-size: 14px;">Description</span><br>
                          <span style="color: #333333; font-size: 16px;">${escapeHtml(invoice.referenceName)}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0 0;">
                          <span style="color: #888888; font-size: 14px;">Total Paid</span><br>
                          <span style="color: ${accentColor}; font-size: 28px; font-weight: 700;">${escapeHtml(formattedTotal)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                The PDF invoice is attached to this email for your records.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #fafafa; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #888888; font-size: 14px;">
                Questions? Reply to this email or contact us.
              </p>
              <p style="margin: 10px 0 0; color: #aaaaaa; font-size: 12px;">
                © ${new Date().getFullYear()} ${escapeHtml(businessName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Format currency amount (cents to dollars)
 */
function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  });
  return formatter.format(amount);
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
