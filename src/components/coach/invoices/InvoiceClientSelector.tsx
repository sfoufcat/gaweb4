'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { Check, ChevronDown, ChevronLeft, ChevronRight, User, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * InvoiceClientSelector Component
 *
 * Dropdown for filtering invoices by client. Shows "All Clients" option first,
 * followed by individual clients with their profile info.
 */

interface Client {
  id: string;
  clerkId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
}

interface InvoiceClientSelectorProps {
  clients: Client[];
  value: string | null; // null = "All Clients"
  onChange: (userId: string | null) => void;
  loading?: boolean;
  className?: string;
}

export function InvoiceClientSelector({
  clients,
  value,
  onChange,
  loading = false,
  className = '',
}: InvoiceClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;

  // Get display name for a client
  const getClientName = (client: Client) => {
    if (client.firstName || client.lastName) {
      return `${client.firstName || ''} ${client.lastName || ''}`.trim();
    }
    return client.email || 'Unknown Client';
  };

  // Get display info for current selection
  const currentDisplay = useMemo(() => {
    if (value === null) {
      return { name: 'All Clients', imageUrl: null, isAll: true };
    }
    const client = clients.find(c => c.clerkId === value);
    if (client) {
      return {
        name: getClientName(client),
        imageUrl: client.imageUrl,
        isAll: false,
      };
    }
    return { name: 'Select client...', imageUrl: null, isAll: false };
  }, [value, clients]);

  // Filter by search term
  const filteredClients = useMemo(() =>
    clients.filter(c => {
      const name = getClientName(c).toLowerCase();
      const email = (c.email || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      return name.includes(term) || email.includes(term);
    }),
    [clients, searchTerm]
  );

  // Sort by name
  const sortedClients = useMemo(() =>
    [...filteredClients].sort((a, b) =>
      getClientName(a).localeCompare(getClientName(b))
    ),
    [filteredClients]
  );

  // Pagination
  const totalPages = Math.ceil(sortedClients.length / PAGE_SIZE);
  const paginatedClients = sortedClients.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const selectAll = () => {
    onChange(null);
    setOpen(false);
    setSearchTerm('');
  };

  const selectClient = (client: Client) => {
    onChange(client.clerkId);
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 font-normal text-left border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1e222a] px-2 sm:px-3 rounded-xl"
          >
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              {currentDisplay.isAll ? (
                <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-brand-accent/10 flex-shrink-0">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-brand-accent" />
                </div>
              ) : currentDisplay.imageUrl ? (
                <Image
                  src={currentDisplay.imageUrl}
                  alt={currentDisplay.name}
                  width={24}
                  height={24}
                  className="rounded-full flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6"
                />
              ) : (
                <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                  <User className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-text-secondary dark:text-[#7d8190]" />
                </div>
              )}
              <span className="text-xs sm:text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                {loading ? '...' : currentDisplay.name}
              </span>
            </div>
            <ChevronDown className="ml-1 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          {/* Search input */}
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto p-1">
            {/* All Clients option - always first */}
            <button
              type="button"
              onClick={selectAll}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${
                  value === null
                    ? 'bg-brand-accent border-brand-accent'
                    : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                }`}
              >
                {value === null && (
                  <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                )}
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/10 flex-shrink-0">
                <Users className="h-4 w-4 text-brand-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  All Clients
                </div>
                <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Show all invoices
                </div>
              </div>
            </button>

            {/* Separator */}
            {paginatedClients.length > 0 && (
              <div className="my-1 mx-2 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
            )}

            {/* Individual clients */}
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading clients...
              </div>
            ) : sortedClients.length === 0 && searchTerm ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                No clients found.
              </div>
            ) : sortedClients.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                No clients yet.
              </div>
            ) : (
              paginatedClients.map(client => {
                const isSelected = value === client.clerkId;
                const clientName = getClientName(client);

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => selectClient(client)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left"
                  >
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 flex-shrink-0 transition-all ${
                        isSelected
                          ? 'bg-brand-accent border-brand-accent'
                          : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#171b22]'
                      }`}
                    >
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      )}
                    </div>
                    {client.imageUrl ? (
                      <Image
                        src={client.imageUrl}
                        alt={clientName}
                        width={28}
                        height={28}
                        className="rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex-shrink-0">
                        <User className="h-4 w-4 text-text-secondary dark:text-[#7d8190]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {clientName}
                      </div>
                      <div className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                        {client.email}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer with pagination */}
          {sortedClients.length > PAGE_SIZE && (
            <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b] flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </button>
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] min-w-[60px] text-center">
                  {totalPages > 0 ? `${currentPage + 1} of ${totalPages}` : '0 of 0'}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-[#e9e5e0] dark:hover:bg-[#262b35] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                </button>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {sortedClients.length} client{sortedClients.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
