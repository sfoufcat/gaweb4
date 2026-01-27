'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Gift, Loader2, X, UserPlus, Users, AlertCircle, Check } from 'lucide-react';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface Client {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  imageUrl?: string;
}

interface Cohort {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  startDate: string;
}

interface ProgramInfo {
  id: string;
  name: string;
  type: 'individual' | 'group';
  priceInCents: number;
  currency?: string;
}

interface EnrollClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollComplete: () => void;
  program: ProgramInfo | null;
  existingEnrollmentUserIds: string[];
  initialCohortId?: string | null;
}

export function EnrollClientsModal({
  isOpen,
  onClose,
  onEnrollComplete,
  program,
  existingEnrollmentUserIds,
  initialCohortId,
}: EnrollClientsModalProps) {
  // Client-side only rendering to avoid hydration issues with portals
  const [isMounted, setIsMounted] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSelectedClientIds(new Set());
      setSelectedCohortId(null);
      setError(null);
    }
  }, [isOpen]);

  // Set initial cohort when provided
  useEffect(() => {
    if (isOpen && initialCohortId) {
      setSelectedCohortId(initialCohortId);
    }
  }, [isOpen, initialCohortId]);

  // Fetch clients when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchClients = async () => {
      setLoading(true);
      try {
        // Use /api/coach/org-users which gets all org members from Clerk
        // (same as "All Clients" page) - this works on localhost and prod
        const res = await fetch('/api/coach/org-users');
        if (res.ok) {
          const data = await res.json();
          // Map from org-users format to Client format
          // org-users returns: { users: [{ id, email, firstName, lastName, imageUrl, orgRole, ... }] }
          const allClients = (data.users || [])
            // Filter out coaches/admins - only show members
            .filter((u: { orgRole?: string }) => !u.orgRole || u.orgRole === 'member')
            .map((u: { id: string; email?: string; firstName?: string; lastName?: string; imageUrl?: string }) => ({
              id: u.id,
              email: u.email || '',
              firstName: u.firstName || '',
              lastName: u.lastName || '',
              name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unnamed',
              imageUrl: u.imageUrl || '',
            }));
          // Filter out already enrolled clients
          const available = allClients.filter(
            (u: Client) => !existingEnrollmentUserIds.includes(u.id)
          );
          setClients(available);
        }
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [isOpen, existingEnrollmentUserIds]);

  // Fetch cohorts for group programs
  useEffect(() => {
    if (!isOpen || !program || program.type !== 'group') return;

    const fetchCohorts = async () => {
      setLoadingCohorts(true);
      try {
        const res = await fetch(`/api/coach/org-programs/${program.id}/cohorts?status=upcoming,active`);
        if (res.ok) {
          const data = await res.json();
          const availableCohorts = (data.cohorts || []).filter(
            (c: Cohort) => c.status === 'upcoming' || c.status === 'active'
          );
          setCohorts(availableCohorts);
          // Auto-select first cohort if only one
          if (availableCohorts.length === 1) {
            setSelectedCohortId(availableCohorts[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch cohorts:', error);
      } finally {
        setLoadingCohorts(false);
      }
    };

    fetchCohorts();
  }, [isOpen, program]);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;

    const query = searchQuery.toLowerCase();
    return clients.filter((client) => {
      const name = client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim();
      return (
        name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query)
      );
    });
  }, [clients, searchQuery]);

  // Toggle client selection
  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  // Toggle select all
  const toggleSelectAll = () => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map((c) => c.id)));
    }
  };

  // Format price
  const formatPrice = (priceInCents: number, currency?: string) => {
    return (priceInCents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Get client display name
  const getClientName = (client: Client) => {
    return client.name || `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email;
  };

  // Handle enroll
  const handleEnroll = async () => {
    if (!program || selectedClientIds.size === 0) return;
    if (program.type === 'group' && !selectedCohortId) {
      setError('Please select a cohort first');
      return;
    }

    setError(null);
    setEnrolling(true);
    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const clientId of selectedClientIds) {
      try {
        const res = await fetch('/api/programs/enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programId: program.id,
            cohortId: program.type === 'group' ? selectedCohortId : undefined,
            targetUserId: clientId,
          }),
        });

        if (res.ok) {
          results.success++;
        } else {
          results.failed++;
          // Extract error message from API response
          try {
            const errorData = await res.json();
            if (errorData.error && !results.errors.includes(errorData.error)) {
              results.errors.push(errorData.error);
            }
          } catch {
            // If parsing fails, continue with generic error
          }
        }
      } catch {
        results.failed++;
      }
    }

    setEnrolling(false);

    if (results.failed > 0) {
      // Show detailed error messages
      let errorMessage = `Failed to enroll ${results.failed} client${results.failed !== 1 ? 's' : ''}.`;
      if (results.errors.length > 0) {
        errorMessage += ` ${results.errors.join(' ')}`;
      }
      if (results.success > 0) {
        errorMessage += ` ${results.success} enrolled successfully.`;
      }
      setError(errorMessage);
      if (results.success > 0) {
        // Partial success - still close and refresh
        onEnrollComplete();
      }
      return;
    }

    // All successful
    onEnrollComplete();
  };

  if (!program) return null;

  const isPaidProgram = program.priceInCents > 0;
  const isGroupProgram = program.type === 'group';
  const canEnroll = selectedClientIds.size > 0 && (!isGroupProgram || selectedCohortId);
  const allSelected = filteredClients.length > 0 && selectedClientIds.size === filteredClients.length;

  const content = (
    <div className="flex flex-col h-full max-h-[calc(85vh-120px)]">
      {/* Paid Program Warning */}
      {isPaidProgram && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <Gift className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300 font-albert">
                This is a paid program ({formatPrice(program.priceInCents, program.currency)})
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/80 font-albert mt-0.5">
                Selected clients will receive complimentary access
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300 font-albert">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Combined Controls Row */}
      <div className="px-4 pt-4 flex items-center gap-3">
        {/* Cohort Selector - pill style with status badge */}
        {isGroupProgram && !loadingCohorts && cohorts.length > 0 && (
          <Select value={selectedCohortId || ''} onValueChange={setSelectedCohortId}>
            <SelectTrigger className="w-auto min-w-[140px] h-10 rounded-full bg-white dark:bg-[#1e222a] border-[#e1ddd8] dark:border-[#262b35] shadow-sm px-4 font-albert text-sm font-medium hover:shadow-md transition-all focus:ring-2 focus:ring-brand-accent/50">
              <SelectValue placeholder="Select cohort...">
                {(() => {
                  const cohort = cohorts.find(c => c.id === selectedCohortId);
                  if (!cohort) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <span>{cohort.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        cohort.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}>
                        {cohort.status}
                      </span>
                    </div>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id} className="font-albert text-sm">
                  <div className="flex items-center gap-2">
                    <span>{cohort.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      cohort.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {cohort.status}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Loading state */}
        {isGroupProgram && loadingCohorts && (
          <div className="flex items-center h-10 px-4">
            <Loader2 className="w-4 h-4 animate-spin text-brand-accent" />
          </div>
        )}

        {/* No cohorts warning - inline pill */}
        {isGroupProgram && !loadingCohorts && cohorts.length === 0 && (
          <div className="flex items-center gap-2 h-10 px-3 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-300 font-albert">No cohorts</span>
          </div>
        )}

        {/* Expandable Search - right aligned */}
        <div className="ml-auto">
          <ExpandableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search clients..."
          />
        </div>
      </div>

      {/* Select All */}
      {filteredClients.length > 0 && (
        <div className="px-4 pt-3 mt-3 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm font-albert text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              allSelected
                ? 'bg-brand-accent border-brand-accent'
                : 'border-[#e1ddd8] dark:border-[#3a4150]'
            }`}>
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <span>
              {allSelected ? 'Deselect all' : 'Select all'} ({filteredClients.length} available)
            </span>
          </button>
        </div>
      )}

      {/* Client List */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 min-h-[200px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-[#5f5a55] dark:text-[#b2b6c2] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
              {clients.length === 0 ? 'No clients available' : 'No matching clients'}
            </p>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {clients.length === 0
                ? 'Add clients first to enroll them'
                : 'Try a different search term'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => toggleClient(client.id)}
                className="w-full flex items-center gap-3 p-2 hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] rounded-lg transition-colors text-left"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedClientIds.has(client.id)
                    ? 'bg-brand-accent border-brand-accent'
                    : 'border-[#e1ddd8] dark:border-[#3a4150]'
                }`}>
                  {selectedClientIds.has(client.id) && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-[#e1ddd8] dark:bg-[#262b35]">
                  {client.imageUrl ? (
                    <Image
                      src={client.imageUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#5f5a55] dark:text-[#b2b6c2] text-sm font-medium font-albert">
                      {getClientName(client).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                    {getClientName(client)}
                  </p>
                  <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                    {client.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Help Message */}
      <div className="px-4 py-3 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
        <p className="text-xs text-center text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
          Adding new members?{' '}
          <Link
            href="/coach/clients?openInvite=true"
            className="text-brand-accent hover:underline font-medium"
            onClick={onClose}
          >
            Add them as clients first
          </Link>
        </p>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={enrolling}
          className="flex-1 h-10 font-albert text-sm border-[#e1ddd8] dark:border-[#3a4150]"
        >
          Cancel
        </Button>
        <Button
          onClick={handleEnroll}
          disabled={!canEnroll || enrolling}
          className="flex-1 h-10 font-albert text-sm bg-brand-accent hover:bg-brand-accent/90 text-white disabled:opacity-50"
        >
          {enrolling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Enroll {selectedClientIds.size > 0 ? selectedClientIds.size : ''} Client{selectedClientIds.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Don't render the dialog portal until mounted on client
  if (!isMounted) {
    return null;
  }

  // Desktop: Dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl max-h-[90vh]">
          <DialogHeader className="px-4 pt-4 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  Enroll Clients
                </DialogTitle>
                <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                  Add clients to &quot;{program.name}&quot;
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Drawer (slide up)
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="px-4 pt-0 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <DrawerTitle className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Enroll Clients
          </DrawerTitle>
          <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
            Add clients to &quot;{program.name}&quot;
          </DrawerDescription>
        </DrawerHeader>
        {content}
        {/* Safe area padding for mobile */}
        <div className="h-6" />
      </DrawerContent>
    </Drawer>
  );
}
