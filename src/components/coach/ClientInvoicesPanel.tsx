'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Send, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Invoice, InvoicePaymentType } from '@/types';

const PAYMENT_TYPE_LABELS: Record<InvoicePaymentType, string> = {
  program_enrollment: 'Program',
  content_purchase: 'Content',
  squad_subscription: 'Squad',
  funnel_payment: 'Funnel',
  subscription_renewal: 'Renewal',
  scheduled_call: 'Call',
};

interface ClientInvoicesPanelProps {
  userId: string;
  isDemoMode?: boolean;
}

/**
 * Panel showing invoices for a specific client
 * Used in ClientDetailView to show payment history
 */
export function ClientInvoicesPanel({ userId, isDemoMode = false }: ClientInvoicesPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isDemoMode) {
        setInvoices([
          {
            id: 'demo-inv-1',
            invoiceNumber: 'DEMO-202501-0001',
            organizationId: 'demo-org',
            userId,
            paymentType: 'program_enrollment',
            referenceId: 'demo-enrollment-1',
            referenceName: '30-Day Transformation',
            lineItems: [{ description: '30-Day Transformation', quantity: 1, unitPrice: 29900, total: 29900 }],
            subtotal: 29900,
            taxAmount: 0,
            total: 29900,
            currency: 'usd',
            paidAt: new Date().toISOString(),
            status: 'paid',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/invoices?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    if (userId) {
      fetchInvoices();
    }
  }, [userId, fetchInvoices]);

  const handleDownloadPdf = async (invoiceId: string) => {
    setActionLoading(invoiceId);
    try {
      window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendEmail = async (invoiceId: string) => {
    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/resend`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resend email');
      alert('Invoice email sent successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-earth-500 mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-6 text-center text-[#6b6560] dark:text-[#8b9299]">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((invoice) => (
        <div
          key={invoice.id}
          className="flex items-center justify-between p-3 bg-[#faf8f6] dark:bg-[#1e222a] rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#6b6560] dark:text-[#8b9299]">
                {invoice.invoiceNumber}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  invoice.status === 'paid'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : invoice.status === 'refunded'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                }`}
              >
                {invoice.status === 'paid' && <Check className="w-2.5 h-2.5" />}
                {invoice.status}
              </span>
            </div>
            <div className="text-sm font-medium text-[#3d3731] dark:text-white truncate mt-0.5">
              {invoice.referenceName}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#6b6560] dark:text-[#8b9299] mt-0.5">
              <span>{PAYMENT_TYPE_LABELS[invoice.paymentType]}</span>
              <span>•</span>
              <span>{formatDate(invoice.paidAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <span className="font-medium text-[#3d3731] dark:text-white">
              {formatCurrency(invoice.total, invoice.currency)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDownloadPdf(invoice.id)}
              disabled={actionLoading === invoice.id}
              className="h-7 w-7 p-0"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResendEmail(invoice.id)}
              disabled={actionLoading === invoice.id}
              className="h-7 w-7 p-0"
              title="Resend Email"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ClientInvoicesPanel;
