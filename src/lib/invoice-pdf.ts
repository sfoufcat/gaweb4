import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Invoice, InvoiceSettings } from '@/types';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: AutoTableOptions) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

interface AutoTableOptions {
  startY?: number;
  head?: string[][];
  body?: (string | number)[][];
  theme?: 'striped' | 'grid' | 'plain';
  headStyles?: Record<string, unknown>;
  bodyStyles?: Record<string, unknown>;
  alternateRowStyles?: Record<string, unknown>;
  columnStyles?: Record<number, Record<string, unknown>>;
  margin?: { left?: number; right?: number };
  tableWidth?: number | 'auto' | 'wrap';
}

interface OrgBranding {
  logoUrl?: string | null;
  accentColor?: string | null;
  appTitle?: string | null;
}

/**
 * Generate a beautiful branded PDF invoice
 */
export async function generateInvoicePDF(
  invoice: Invoice,
  settings: InvoiceSettings,
  branding?: OrgBranding
): Promise<Buffer> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const accentColor = branding?.accentColor || '#8B7355'; // Default earth tone
  const textColor = '#333333';
  const lightGray = '#F5F5F5';
  const mediumGray = '#888888';

  // Parse accent color to RGB
  const accentRGB = hexToRgb(accentColor);

  let yPos = margin;

  // ============================================
  // HEADER SECTION
  // ============================================

  // Accent color bar at top
  doc.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.rect(0, 0, pageWidth, 8, 'F');

  yPos = 20;

  // Logo (if available) - left side
  // Note: Logo loading would need to be async with fetch
  // For now, we'll use text if no logo

  // Business name - large and prominent
  doc.setFontSize(24);
  doc.setTextColor(textColor);
  doc.setFont('helvetica', 'bold');
  const businessName = settings.businessName || branding?.appTitle || 'Invoice';
  doc.text(businessName, margin, yPos);

  // INVOICE label - right side
  doc.setFontSize(32);
  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.text('INVOICE', pageWidth - margin, yPos, { align: 'right' });

  yPos += 15;

  // Business address (if set)
  doc.setFontSize(10);
  doc.setTextColor(mediumGray);
  doc.setFont('helvetica', 'normal');

  if (settings.businessAddress) {
    const addr = settings.businessAddress;
    const addressLines = [
      addr.line1,
      addr.line2,
      `${addr.city}${addr.state ? `, ${addr.state}` : ''} ${addr.postalCode}`,
      addr.country,
    ].filter(Boolean);

    addressLines.forEach((line) => {
      if (line) {
        doc.text(line, margin, yPos);
        yPos += 5;
      }
    });
  }

  if (settings.businessEmail) {
    doc.text(settings.businessEmail, margin, yPos);
    yPos += 5;
  }
  if (settings.businessPhone) {
    doc.text(settings.businessPhone, margin, yPos);
    yPos += 5;
  }
  if (settings.taxId) {
    doc.text(`Tax ID: ${settings.taxId}`, margin, yPos);
    yPos += 5;
  }

  // ============================================
  // INVOICE DETAILS - Right side
  // ============================================

  const detailsX = pageWidth - margin - 60;
  let detailsY = 35;

  doc.setFontSize(10);
  doc.setTextColor(mediumGray);
  doc.setFont('helvetica', 'normal');

  // Invoice number
  doc.text('Invoice Number', detailsX, detailsY);
  detailsY += 5;
  doc.setTextColor(textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoiceNumber, detailsX, detailsY);
  detailsY += 10;

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mediumGray);
  doc.text('Date', detailsX, detailsY);
  detailsY += 5;
  doc.setTextColor(textColor);
  doc.text(formatDate(invoice.paidAt), detailsX, detailsY);
  detailsY += 10;

  // Status
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(mediumGray);
  doc.text('Status', detailsX, detailsY);
  detailsY += 5;
  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), detailsX, detailsY);

  // ============================================
  // BILL TO SECTION
  // ============================================

  yPos = Math.max(yPos, detailsY) + 15;

  // Light background box for Bill To
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, yPos - 5, contentWidth / 2 - 10, 35, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setTextColor(mediumGray);
  doc.setFont('helvetica', 'normal');
  doc.text('BILL TO', margin + 5, yPos + 3);

  yPos += 10;
  doc.setTextColor(textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);

  // We'd need to fetch user data - for now use placeholder
  doc.text('Customer', margin + 5, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (invoice.emailTo) {
    doc.text(invoice.emailTo, margin + 5, yPos);
  }

  yPos += 25;

  // ============================================
  // LINE ITEMS TABLE
  // ============================================

  const tableHead = [['Description', 'Qty', 'Unit Price', 'Total']];
  const tableBody = invoice.lineItems.map((item) => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unitPrice, invoice.currency),
    formatCurrency(item.total, invoice.currency),
  ]);

  doc.autoTable({
    startY: yPos,
    head: tableHead,
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [accentRGB.r, accentRGB.g, accentRGB.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: [51, 51, 51],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsX = pageWidth - margin - 80;
  const totalsValueX = pageWidth - margin;

  // Subtotal
  doc.setFontSize(10);
  doc.setTextColor(mediumGray);
  doc.text('Subtotal', totalsX, yPos);
  doc.setTextColor(textColor);
  doc.text(formatCurrency(invoice.subtotal, invoice.currency), totalsValueX, yPos, {
    align: 'right',
  });
  yPos += 8;

  // Tax (if applicable)
  if (invoice.taxAmount > 0) {
    const taxLabel = settings.taxLabel || 'Tax';
    const taxPercent = invoice.taxRate ? ` (${invoice.taxRate}%)` : '';
    doc.setTextColor(mediumGray);
    doc.text(`${taxLabel}${taxPercent}`, totalsX, yPos);
    doc.setTextColor(textColor);
    doc.text(formatCurrency(invoice.taxAmount, invoice.currency), totalsValueX, yPos, {
      align: 'right',
    });
    yPos += 8;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX, yPos, totalsValueX, yPos);
  yPos += 8;

  // Total - highlighted
  doc.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.roundedRect(totalsX - 5, yPos - 6, 85, 14, 2, 2, 'F');

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', totalsX, yPos + 2);
  doc.text(formatCurrency(invoice.total, invoice.currency), totalsValueX - 5, yPos + 2, {
    align: 'right',
  });

  yPos += 20;

  // Refund notice if applicable
  if (invoice.status === 'refunded' || invoice.status === 'partial_refund') {
    yPos += 5;
    doc.setFillColor(255, 240, 240);
    doc.roundedRect(margin, yPos - 5, contentWidth, 15, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setTextColor(200, 50, 50);
    doc.setFont('helvetica', 'bold');

    const refundText =
      invoice.status === 'refunded'
        ? 'FULLY REFUNDED'
        : `PARTIALLY REFUNDED: ${formatCurrency(invoice.refundedAmount || 0, invoice.currency)}`;
    doc.text(refundText, margin + 5, yPos + 3);
    yPos += 20;
  }

  // ============================================
  // PAYMENT INFO
  // ============================================

  if (invoice.paymentMethod) {
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(mediumGray);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment method: ${invoice.paymentMethod}`, margin, yPos);
    yPos += 5;
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = doc.internal.pageSize.getHeight() - 30;

  // Custom footer text
  if (settings.invoiceFooter) {
    doc.setFontSize(9);
    doc.setTextColor(mediumGray);
    doc.setFont('helvetica', 'normal');
    const footerLines = doc.splitTextToSize(settings.invoiceFooter, contentWidth);
    doc.text(footerLines, margin, footerY - 10);
  }

  // Thank you message
  doc.setFontSize(11);
  doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for your business!', pageWidth / 2, footerY + 5, { align: 'center' });

  // Bottom accent bar
  doc.setFillColor(accentRGB.r, accentRGB.g, accentRGB.b);
  doc.rect(0, doc.internal.pageSize.getHeight() - 5, pageWidth, 5, 'F');

  // Return as Buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Remove # if present
  hex = hex.replace('#', '');

  // Parse
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r, g, b };
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
