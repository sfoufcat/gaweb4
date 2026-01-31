'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { FileText, Settings, CreditCard, Download, Send, ExternalLink, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePickerCompact } from '@/components/ui/date-picker';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import { InvoiceClientSelector } from '@/components/coach/invoices/InvoiceClientSelector';
import { useDemoMode } from '@/contexts/DemoModeContext';
import type { Invoice, InvoiceSettings } from '@/types';

interface Client {
  id: string;
  clerkId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
}

// Subtab types
type InvoicesSubtab = 'all-invoices' | 'settings' | 'stripe-connect';

const SUBTABS = [
  { id: 'all-invoices' as const, label: 'All Invoices', icon: FileText },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
  { id: 'stripe-connect' as const, label: 'Stripe Connect', icon: CreditCard },
];

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  program_enrollment: 'Program',
  content_purchase: 'Content',
  squad_subscription: 'Squad',
  funnel_payment: 'Funnel',
  subscription_renewal: 'Renewal',
  scheduled_call: 'Call',
};

interface InvoicesTabProps {
  onSubtabChange?: (subtab: string) => void;
  initialSubtab?: string;
}

export function InvoicesTab({ onSubtabChange, initialSubtab }: InvoicesTabProps) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const [activeSubtab, setActiveSubtab] = useState<InvoicesSubtab>(
    (initialSubtab as InvoicesSubtab) || 'all-invoices'
  );

  const handleSubtabChange = (subtab: InvoicesSubtab) => {
    setActiveSubtab(subtab);
    onSubtabChange?.(subtab);
  };

  return (
    <div className="space-y-6">
      {/* Subtab Navigation */}
      <div className="flex gap-2 p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-xl w-fit">
        {SUBTABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleSubtabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-albert font-medium text-sm transition-colors ${
                activeSubtab === tab.id
                  ? 'bg-white dark:bg-[#262b35] shadow-sm text-[#3d3731] dark:text-white'
                  : 'text-[#6b6560] dark:text-[#8b9299] hover:text-[#3d3731] dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subtab Content */}
      {activeSubtab === 'all-invoices' && <InvoicesListPanel isDemoMode={isDemoMode} openSignupModal={openSignupModal} />}
      {activeSubtab === 'settings' && <InvoiceSettingsPanel isDemoMode={isDemoMode} openSignupModal={openSignupModal} />}
      {activeSubtab === 'stripe-connect' && <StripeConnectPanel isDemoMode={isDemoMode} openSignupModal={openSignupModal} />}
    </div>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

function InvoicesTableSkeleton() {
  return (
    <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#1e222a]">
              {['Invoice', 'Description', 'Type', 'Amount', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-[#e1ddd8] dark:border-[#262b35] last:border-0">
                <td className="px-4 py-3">
                  <div className="h-4 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1" />
                  <div className="h-3 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="h-4 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse ml-auto" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-16 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                    <div className="h-8 w-8 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
            <div className="h-6 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-2" />
            <div className="h-4 w-56 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-5" />
            <div className="space-y-4">
              {[1, 2, 3].map((j) => (
                <div key={j}>
                  <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1.5" />
                  <div className="h-10 w-full bg-[#e1ddd8] dark:bg-[#262b35] rounded-xl animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Invoice Settings skeleton */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="h-6 w-36 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-2" />
        <div className="h-4 w-52 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-5" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="h-4 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1.5" />
              <div className="h-10 w-full bg-[#e1ddd8] dark:bg-[#262b35] rounded-xl animate-pulse" />
              <div className="h-3 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mt-1.5" />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="h-4 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1" />
                <div className="h-3 w-44 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
              </div>
              <div className="h-6 w-11 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <div className="h-4 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1.5" />
            <div className="h-[88px] w-full bg-[#e1ddd8] dark:bg-[#262b35] rounded-xl animate-pulse" />
            <div className="h-3 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mt-1.5" />
          </div>
        </div>
      </div>
      {/* Tax Settings skeleton */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="h-6 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-5" />
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="h-4 w-20 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-1" />
            <div className="h-3 w-36 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
          </div>
          <div className="h-6 w-11 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
        </div>
      </div>
      {/* Save button skeleton */}
      <div className="flex justify-end">
        <div className="h-10 w-[120px] bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

function StripeConnectSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#e1ddd8] dark:bg-[#262b35] rounded-xl animate-pulse flex-shrink-0" />
          <div className="flex-1">
            <div className="h-6 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-2" />
            <div className="h-4 w-72 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
            <div className="mt-4">
              <div className="h-6 w-24 bg-[#e1ddd8] dark:bg-[#262b35] rounded-full animate-pulse" />
            </div>
            <div className="mt-6 flex gap-3">
              <div className="h-10 w-32 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-10 w-40 bg-[#e1ddd8] dark:bg-[#262b35] rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>
      {/* Info card skeleton */}
      <div className="bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
        <div className="h-5 w-28 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-64 bg-[#e1ddd8] dark:bg-[#262b35] rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// INVOICES LIST PANEL
// ============================================================================

interface InvoicesListPanelProps {
  isDemoMode: boolean;
  openSignupModal: () => void;
}

function InvoicesListPanel({ isDemoMode, openSignupModal }: InvoicesListPanelProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Fetch clients for the selector
  useEffect(() => {
    const fetchClients = async () => {
      if (isDemoMode) {
        setClients([
          { id: '1', clerkId: 'demo-user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          { id: '2', clerkId: 'demo-user-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        ]);
        setClientsLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/coaching/clients');
        if (res.ok) {
          const data = await res.json();
          // Map nested user data to flat structure expected by InvoiceClientSelector
          const mappedClients = (data.clients || []).map((c: Record<string, unknown>) => ({
            id: c.id as string,
            clerkId: c.userId as string,
            firstName: (c.user as Record<string, unknown>)?.firstName || c.cachedUserFirstName || '',
            lastName: (c.user as Record<string, unknown>)?.lastName || c.cachedUserLastName || '',
            email: (c.user as Record<string, unknown>)?.email || c.cachedUserEmail || '',
            imageUrl: (c.user as Record<string, unknown>)?.imageUrl || c.cachedUserImageUrl || '',
          }));
          setClients(mappedClients);
        }
      } catch (err) {
        console.error('Failed to fetch clients:', err);
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, [isDemoMode]);

  const fetchInvoices = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      if (isDemoMode) {
        // Demo data
        setInvoices([
          {
            id: 'demo-inv-1',
            invoiceNumber: 'DEMO-202501-0001',
            organizationId: 'demo-org',
            userId: 'demo-user-1',
            paymentType: 'program_enrollment',
            referenceId: 'demo-enrollment-1',
            referenceName: '30-Day Transformation Program',
            lineItems: [{ description: '30-Day Transformation Program', quantity: 1, unitPrice: 29900, total: 29900 }],
            subtotal: 29900,
            taxAmount: 0,
            total: 29900,
            currency: 'usd',
            paidAt: new Date().toISOString(),
            status: 'paid',
            emailSentAt: new Date().toISOString(),
            emailTo: 'client@example.com',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'demo-inv-2',
            invoiceNumber: 'DEMO-202501-0002',
            organizationId: 'demo-org',
            userId: 'demo-user-2',
            paymentType: 'content_purchase',
            referenceId: 'demo-content-1',
            referenceName: 'Mindset Mastery Course',
            lineItems: [{ description: 'Mindset Mastery Course', quantity: 1, unitPrice: 4900, total: 4900 }],
            subtotal: 4900,
            taxAmount: 0,
            total: 4900,
            currency: 'usd',
            paidAt: new Date(Date.now() - 86400000).toISOString(),
            status: 'paid',
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            updatedAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (selectedClientId) params.set('userId', selectedClientId);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (!reset && cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');

      const data = await res.json();

      if (reset) {
        setInvoices(data.invoices);
      } else {
        setInvoices((prev) => [...prev, ...data.invoices]);
      }
      setHasMore(data.hasMore);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, selectedClientId, startDate, endDate, cursor]);

  useEffect(() => {
    fetchInvoices(true);
  }, [selectedClientId, startDate, endDate]);

  const handleDownloadPdf = async (invoiceId: string) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }

    setActionLoading(invoiceId);
    try {
      window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendEmail = async (invoiceId: string) => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }

    setActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/resend`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to resend email');
      // Show success - could add toast here
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

  const filteredInvoices = invoices.filter((inv) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(term) ||
      inv.referenceName.toLowerCase().includes(term) ||
      inv.emailTo?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Client Selector */}
        <div className="flex-1 min-w-0 sm:flex-none sm:w-[180px]">
          <InvoiceClientSelector
            clients={clients}
            value={selectedClientId}
            onChange={setSelectedClientId}
            loading={clientsLoading}
          />
        </div>

        {/* Spacer - pushes date range and search to the right on desktop */}
        <div className="hidden sm:block sm:flex-1" />

        {/* Date Range */}
        <div className="flex-1 min-w-0 sm:flex-none sm:w-[150px]">
          <DatePickerCompact
            value={startDate || undefined}
            onChange={(date) => setStartDate(date)}
            placeholder="Start"
            maxDate={endDate ? new Date(endDate) : undefined}
            className="h-10 px-2 sm:px-3"
          />
        </div>
        <div className="flex-1 min-w-0 sm:flex-none sm:w-[150px]">
          <DatePickerCompact
            value={endDate || undefined}
            onChange={(date) => setEndDate(date)}
            placeholder="End"
            minDate={startDate ? new Date(startDate) : undefined}
            className="h-10 px-2 sm:px-3"
          />
        </div>

        {/* Expandable Search */}
        <ExpandableSearch
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search invoices..."
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && invoices.length === 0 && <InvoicesTableSkeleton />}

      {/* Empty State */}
      {!loading && filteredInvoices.length === 0 && (
        <div className="text-center py-12 text-[#6b6560] dark:text-[#8b9299]">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No invoices yet</p>
          <p className="text-sm mt-1">Invoices will appear here when clients make payments</p>
        </div>
      )}

      {/* Invoices Table */}
      {filteredInvoices.length > 0 && (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#1e222a]">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Invoice
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Description
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Type
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Date
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#6b6560] dark:text-[#8b9299]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-[#e1ddd8] dark:border-[#262b35] last:border-0 hover:bg-[#faf8f6] dark:hover:bg-[#1e222a] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-[#3d3731] dark:text-white">
                        {invoice.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-[#3d3731] dark:text-white">{invoice.referenceName}</div>
                      {invoice.emailTo && (
                        <div className="text-xs text-[#6b6560] dark:text-[#8b9299]">{invoice.emailTo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#f3f1ef] dark:bg-[#262b35] text-[#6b6560] dark:text-[#8b9299]">
                        {PAYMENT_TYPE_LABELS[invoice.paymentType]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-medium text-[#3d3731] dark:text-white">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : invoice.status === 'refunded'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}
                      >
                        {invoice.status === 'paid' && <Check className="w-3 h-3" />}
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b6560] dark:text-[#8b9299]">
                      {formatDate(invoice.paidAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownloadPdf(invoice.id)}
                          disabled={actionLoading === invoice.id}
                          className="h-8 w-8 p-0"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendEmail(invoice.id)}
                          disabled={actionLoading === invoice.id}
                          className="h-8 w-8 p-0"
                          title="Resend Email"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="p-4 text-center border-t border-[#e1ddd8] dark:border-[#262b35]">
              <Button
                variant="outline"
                onClick={() => fetchInvoices(false)}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INVOICE SETTINGS PANEL
// ============================================================================

interface InvoiceSettingsPanelProps {
  isDemoMode: boolean;
  openSignupModal: () => void;
}

function InvoiceSettingsPanel({ isDemoMode, openSignupModal }: InvoiceSettingsPanelProps) {
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    businessEmail: '',
    businessPhone: '',
    taxId: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    invoicePrefix: '',
    taxEnabled: false,
    defaultTaxRate: 0,
    taxLabel: '',
    autoSendInvoices: true,
    invoiceFooter: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      if (isDemoMode) {
        setFormData({
          businessName: 'Demo Coaching Co.',
          businessEmail: 'billing@demo.coach',
          businessPhone: '+1 (555) 123-4567',
          taxId: '',
          addressLine1: '123 Demo Street',
          addressLine2: '',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94102',
          country: 'United States',
          invoicePrefix: 'DEMO',
          taxEnabled: false,
          defaultTaxRate: 0,
          taxLabel: 'Tax',
          autoSendInvoices: true,
          invoiceFooter: 'Thank you for your business!',
        });
        setLoading(false);
        return;
      }

      const res = await fetch('/api/coach/invoice-settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      setSettings(data);
      setFormData({
        businessName: data.businessName || '',
        businessEmail: data.businessEmail || '',
        businessPhone: data.businessPhone || '',
        taxId: data.taxId || '',
        addressLine1: data.businessAddress?.line1 || '',
        addressLine2: data.businessAddress?.line2 || '',
        city: data.businessAddress?.city || '',
        state: data.businessAddress?.state || '',
        postalCode: data.businessAddress?.postalCode || '',
        country: data.businessAddress?.country || '',
        invoicePrefix: data.invoicePrefix || '',
        taxEnabled: data.taxEnabled || false,
        defaultTaxRate: data.defaultTaxRate || 0,
        taxLabel: data.taxLabel || '',
        autoSendInvoices: data.autoSendInvoices ?? true,
        invoiceFooter: data.invoiceFooter || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const payload: Partial<InvoiceSettings> = {
        businessName: formData.businessName,
        businessEmail: formData.businessEmail || undefined,
        businessPhone: formData.businessPhone || undefined,
        taxId: formData.taxId || undefined,
        businessAddress: formData.addressLine1
          ? {
              line1: formData.addressLine1,
              line2: formData.addressLine2 || undefined,
              city: formData.city,
              state: formData.state || undefined,
              postalCode: formData.postalCode,
              country: formData.country,
            }
          : undefined,
        invoicePrefix: formData.invoicePrefix || undefined,
        taxEnabled: formData.taxEnabled,
        defaultTaxRate: formData.taxEnabled ? formData.defaultTaxRate : undefined,
        taxLabel: formData.taxEnabled ? formData.taxLabel || undefined : undefined,
        autoSendInvoices: formData.autoSendInvoices,
        invoiceFooter: formData.invoiceFooter || undefined,
      };

      const res = await fetch('/api/coach/invoice-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Common input class for consistency
  const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#5f6470] focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors";

  if (loading) {
    return <InvoiceSettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-600 dark:text-green-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 flex-shrink-0" />
          Settings saved successfully
        </div>
      )}

      {/* Two-column grid for Business Info and Address */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Information */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">Business Information</h3>
            <p className="text-sm text-[#6b6560] dark:text-[#8b9299] mt-1">
              Appears on your invoices
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Business Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                placeholder="Your Business Name"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                  placeholder="billing@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.businessPhone}
                  onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Tax ID / VAT Number
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                placeholder="e.g., VAT123456789"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Business Address */}
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">Business Address</h3>
            <p className="text-sm text-[#6b6560] dark:text-[#8b9299] mt-1">
              Your official business address
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Address Line 1
              </label>
              <input
                type="text"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="123 Main Street"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Address Line 2
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                placeholder="Suite 100"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="San Francisco"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  State / Region
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="CA"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="94102"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="United States"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Settings - Full Width */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">Invoice Settings</h3>
          <p className="text-sm text-[#6b6560] dark:text-[#8b9299] mt-1">
            Customize your invoice preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={formData.invoicePrefix}
                onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value.toUpperCase() })}
                placeholder="COACH"
                maxLength={10}
                className={`${inputClass} uppercase`}
              />
              <p className="text-xs text-[#6b6560] dark:text-[#8b9299] mt-1.5">
                Example: {formData.invoicePrefix || 'COACH'}-202501-0001
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-[#3d3731] dark:text-white">Auto-send Invoices</div>
                <p className="text-xs text-[#6b6560] dark:text-[#8b9299] mt-0.5">
                  Email invoices when payments are received
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, autoSendInvoices: !formData.autoSendInvoices })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.autoSendInvoices ? 'bg-brand-accent' : 'bg-gray-200 dark:bg-[#262b35]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    formData.autoSendInvoices ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
              Invoice Footer
            </label>
            <textarea
              value={formData.invoiceFooter}
              onChange={(e) => setFormData({ ...formData, invoiceFooter: e.target.value })}
              placeholder="Thank you for your business!"
              rows={4}
              className={`${inputClass} resize-none`}
            />
            <p className="text-xs text-[#6b6560] dark:text-[#8b9299] mt-1.5">
              Appears at the bottom of every invoice
            </p>
          </div>
        </div>
      </div>

      {/* Tax Settings - Full Width */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="mb-5">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">Tax Settings</h3>
          <p className="text-sm text-[#6b6560] dark:text-[#8b9299] mt-1">
            Configure tax calculations for invoices
          </p>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <div className="text-sm font-medium text-[#3d3731] dark:text-white">Enable Tax</div>
            <p className="text-xs text-[#6b6560] dark:text-[#8b9299] mt-0.5">
              Add tax to invoices automatically
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, taxEnabled: !formData.taxEnabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              formData.taxEnabled ? 'bg-brand-accent' : 'bg-gray-200 dark:bg-[#262b35]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                formData.taxEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {formData.taxEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 mt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={formData.defaultTaxRate}
                onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                min="0"
                max="100"
                step="0.01"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3d3731] dark:text-white mb-1.5">
                Tax Label
              </label>
              <input
                type="text"
                value={formData.taxLabel}
                onChange={(e) => setFormData({ ...formData, taxLabel: e.target.value })}
                placeholder="VAT, GST, Sales Tax"
                className={inputClass}
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// STRIPE CONNECT PANEL
// ============================================================================

interface StripeConnectPanelProps {
  isDemoMode: boolean;
  openSignupModal: () => void;
}

function StripeConnectPanel({ isDemoMode, openSignupModal }: StripeConnectPanelProps) {
  const [status, setStatus] = useState<'not_connected' | 'pending' | 'connected'>('not_connected');
  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      if (isDemoMode) {
        setStatus('connected');
        setChargesEnabled(true);
        setPayoutsEnabled(true);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/coach/stripe-connect');
      if (!res.ok) throw new Error('Failed to fetch Stripe Connect status');
      const data = await res.json();
      setStatus(data.stripeConnectStatus || 'not_connected');
      setChargesEnabled(data.chargesEnabled || false);
      setPayoutsEnabled(data.payoutsEnabled || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }

    try {
      setConnecting(true);
      setError(null);

      const res = await fetch('/api/coach/stripe-connect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create connect link');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return <StripeConnectSkeleton />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-6">
        <div className="flex items-start gap-4">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FIcon.jpeg?alt=media&token=a0b3f96f-af0e-4f5e-87a8-50d4ddce4080"
            alt="Stripe"
            width={48}
            height={48}
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />

          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#3d3731] dark:text-white">Stripe Connect</h3>
            <p className="text-sm text-[#6b6560] dark:text-[#8b9299] mt-1">
              Connect your Stripe account to accept payments directly from clients.
            </p>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    status === 'connected'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {status === 'connected' && <Check className="w-3 h-3" />}
                  {status === 'connected'
                    ? 'Connected'
                    : status === 'pending'
                      ? 'Setup Incomplete'
                      : 'Not Connected'}
                </span>
              </div>

              {status === 'connected' && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${chargesEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}
                    />
                    <span className="text-[#6b6560] dark:text-[#8b9299]">
                      Charges: {chargesEnabled ? 'Enabled' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${payoutsEnabled ? 'bg-green-500' : 'bg-yellow-500'}`}
                    />
                    <span className="text-[#6b6560] dark:text-[#8b9299]">
                      Payouts: {payoutsEnabled ? 'Enabled' : 'Pending'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              {status === 'connected' ? (
                <>
                  <Button variant="outline" onClick={fetchStatus} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh Status
                  </Button>
                  <Button variant="outline" onClick={handleConnect} disabled={connecting} className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Open Stripe Dashboard
                  </Button>
                </>
              ) : (
                <Button onClick={handleConnect} disabled={connecting} className="gap-2">
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4" />
                      {status === 'pending' ? 'Complete Setup' : 'Connect Stripe Account'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">How it works</h4>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
          <li>• Client payments go directly to your Stripe account</li>
          <li>• A small platform fee (1%) is deducted automatically</li>
          <li>• You control your own payouts and bank transfers</li>
          <li>• Invoices are generated automatically for every payment</li>
        </ul>
      </div>
    </div>
  );
}

export default InvoicesTab;
