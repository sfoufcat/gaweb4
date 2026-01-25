'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, ChevronRight, Check } from 'lucide-react';
import type { Invoice, InvoicePaymentType } from '@/types';

const PAYMENT_TYPE_LABELS: Record<InvoicePaymentType, string> = {
  program_enrollment: 'Program',
  content_purchase: 'Content',
  squad_subscription: 'Squad',
  funnel_payment: 'Funnel',
  subscription_renewal: 'Renewal',
  scheduled_call: 'Call',
};

interface InvoicesSectionProps {
  className?: string;
}

/**
 * Client-facing invoices section
 * Shows the client's own invoices with download links
 */
export function InvoicesSection({ className = '' }: InvoicesSectionProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/client/invoices?limit=10');
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.invoices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  const handleDownload = (invoiceId: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  // Show nothing if still loading
  if (loading) {
    return (
      <div className={className}>
        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
          Invoices
        </h3>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
          <div className="animate-pulse flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show nothing if no invoices
  if (!loading && invoices.length === 0) {
    return (
      <div className={className}>
        <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
          Invoices
        </h3>
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-6 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-[#a09a94] dark:text-[#6b7280]" />
          <p className="text-sm text-text-secondary dark:text-[#b2b6c2]">No invoices yet</p>
        </div>
      </div>
    );
  }

  const displayInvoices = expanded ? invoices : invoices.slice(0, 3);

  return (
    <div className={className}>
      <h3 className="font-albert text-lg text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-4">
        Invoices
      </h3>
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {error ? (
          <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <>
            <div className="divide-y divide-[#e1ddd8]/30 dark:divide-[#262b35]/30">
              {displayInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8] truncate">
                        {invoice.referenceName}
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
                    <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-[#b2b6c2] mt-0.5">
                      <span>{invoice.invoiceNumber}</span>
                      <span>•</span>
                      <span>{formatDate(invoice.paidAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-medium text-text-primary dark:text-[#f5f5f8]">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </span>
                    <button
                      onClick={() => handleDownload(invoice.id)}
                      className="p-1.5 text-text-secondary dark:text-[#b2b6c2] hover:text-text-primary dark:hover:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {invoices.length > 3 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-3 text-sm font-medium text-earth-600 dark:text-earth-400 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors flex items-center justify-center gap-1 border-t border-[#e1ddd8]/30 dark:border-[#262b35]/30"
              >
                {expanded ? 'Show less' : `View all ${invoices.length} invoices`}
                <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default InvoicesSection;
