'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import type { Coach, CoachingPlanType } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CoachingClient {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  timezone?: string;
  coachId: string | null;
  coachingPlan: CoachingPlanType | null;
  hasCoachingData: boolean;
  startDate?: string;
  nextCallDateTime?: string;
  coach: Partial<Coach> | null;
  createdAt: number;
}

/**
 * AdminCoachingClientsTab
 * 
 * Allows super admins to:
 * - View all users with coaching access
 * - Search for users
 * - Assign coaches to users
 * - Set coaching plan type
 */
export function AdminCoachingClientsTab() {
  const [clients, setClients] = useState<CoachingClient[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CoachingClient | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<CoachingPlanType>('monthly');
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch clients and coaches in parallel
      const [clientsResponse, coachesResponse] = await Promise.all([
        fetch('/api/admin/coaching-clients'),
        fetch('/api/admin/coaches'),
      ]);

      if (!clientsResponse.ok) {
        throw new Error('Failed to fetch coaching clients');
      }
      if (!coachesResponse.ok) {
        throw new Error('Failed to fetch coaches');
      }

      const [clientsData, coachesData] = await Promise.all([
        clientsResponse.json(),
        coachesResponse.json(),
      ]);

      setClients(clientsData.clients || []);
      setCoaches(coachesData.coaches || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    
    const query = searchQuery.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        client.coach?.name?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleOpenAssignModal = (client: CoachingClient) => {
    setSelectedClient(client);
    setSelectedCoachId(client.coachId || '');
    setSelectedPlan(client.coachingPlan || 'monthly');
    setShowAssignModal(true);
  };

  const handleAssignCoach = async () => {
    if (!selectedClient || !selectedCoachId) return;

    try {
      setAssigning(true);

      const response = await fetch('/api/admin/coaching-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedClient.id,
          coachId: selectedCoachId,
          coachingPlan: selectedPlan,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to assign coach');
      }

      // Refresh data
      await fetchData();
      setShowAssignModal(false);
    } catch (err) {
      console.error('Error assigning coach:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign coach');
    } finally {
      setAssigning(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">Loading coaching clients...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button 
            onClick={fetchData} 
            className="mt-4 bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header with search */}
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Coaching Clients</h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
              {filteredClients.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
              {searchQuery && ' matching search'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, or coach..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] hover:text-[#1a1a1a] dark:text-[#f5f5f8] dark:hover:text-[#f5f5f8]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            <Button 
              onClick={fetchData}
              variant="outline"
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Clients table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-albert">Client</TableHead>
              <TableHead className="font-albert">Email</TableHead>
              <TableHead className="font-albert">Timezone</TableHead>
              <TableHead className="font-albert">Plan</TableHead>
              <TableHead className="font-albert">Coach</TableHead>
              <TableHead className="font-albert">Next Call</TableHead>
              <TableHead className="font-albert">Start Date</TableHead>
              <TableHead className="font-albert w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.map((client) => (
              <TableRow key={client.id}>
                {/* Client */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    {client.imageUrl ? (
                      <Image
                        src={client.imageUrl}
                        alt={client.name}
                        width={36}
                        height={36}
                        className="rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#a07855]/10 flex items-center justify-center text-[#a07855] dark:text-[#b8896a] font-albert font-semibold text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]">
                      {client.name || 'Unnamed'}
                    </span>
                  </div>
                </TableCell>
                
                {/* Email */}
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                  {client.email}
                </TableCell>
                
                {/* Timezone */}
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                  {client.timezone || '—'}
                </TableCell>
                
                {/* Plan */}
                <TableCell>
                  {client.coachingPlan ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      client.coachingPlan === 'monthly' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {client.coachingPlan === 'monthly' ? 'Monthly' : 'Quarterly'}
                    </span>
                  ) : (
                    <span className="text-[#8c8c8c] text-sm">—</span>
                  )}
                </TableCell>
                
                {/* Coach */}
                <TableCell>
                  {client.coach ? (
                    <div className="flex items-center gap-2">
                      {client.coach.imageUrl ? (
                        <Image
                          src={client.coach.imageUrl}
                          alt={client.coach.name || ''}
                          width={24}
                          height={24}
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#a07855] flex items-center justify-center text-white text-[10px] font-semibold">
                          {client.coach.name?.charAt(0) || 'C'}
                        </div>
                      )}
                      <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]">
                        {client.coach.name}
                      </span>
                    </div>
                  ) : (
                    <span className="font-albert text-sm text-amber-600">Not assigned</span>
                  )}
                </TableCell>
                
                {/* Next Call */}
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                  {formatDate(client.nextCallDateTime)}
                </TableCell>
                
                {/* Start Date */}
                <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                  {formatDate(client.startDate)}
                </TableCell>
                
                {/* Actions */}
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenAssignModal(client)}
                    className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5 font-albert text-sm"
                  >
                    {client.coachId ? 'Edit' : 'Assign'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredClients.length === 0 && (
        <div className="p-12 text-center">
          {searchQuery ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#a07855]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert text-lg mb-2">No clients found</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 dark:text-[#7d8190] font-albert text-sm">
                No clients match &quot;{searchQuery}&quot;
              </p>
              <Button
                variant="outline"
                onClick={() => setSearchQuery('')}
                className="mt-4 border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
              >
                Clear search
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#a07855]/10 to-[#8c6245]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#a07855] dark:text-[#b8896a]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert text-lg mb-2">No coaching clients yet</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 dark:text-[#7d8190] font-albert text-sm">
                Users with coaching subscriptions will appear here.
              </p>
            </>
          )}
        </div>
      )}

      {/* Assign Coach Modal */}
      <AlertDialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-xl tracking-[-0.5px]">
              {selectedClient?.coachId ? 'Edit Coach Assignment' : 'Assign Coach'}
            </AlertDialogTitle>
          </AlertDialogHeader>

          <div className="space-y-5 py-3">
            {/* Client Info */}
            {selectedClient && (
              <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                {selectedClient.imageUrl ? (
                  <Image
                    src={selectedClient.imageUrl}
                    alt={selectedClient.name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#a07855]/10 flex items-center justify-center text-[#a07855] dark:text-[#b8896a] font-albert font-semibold">
                    {selectedClient.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]">{selectedClient.name}</p>
                  <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">{selectedClient.email}</p>
                </div>
              </div>
            )}

            {/* Coach Selector */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-2">
                Coach
              </label>
              <select
                value={selectedCoachId}
                onChange={(e) => setSelectedCoachId(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] rounded-xl font-albert text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:ring-[#b8896a]/30 dark:focus:ring-[#b8896a]/30 focus:border-[#a07855] dark:border-[#b8896a] dark:focus:border-[#b8896a] transition-all appearance-none cursor-pointer"
              >
                <option value="">Select a coach...</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Plan Selector */}
            <div>
              <label className="block font-albert font-medium text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-2">
                Coaching Plan
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlan('monthly')}
                  className={`flex-1 px-4 py-3 rounded-xl font-albert text-[14px] transition-all ${
                    selectedPlan === 'monthly'
                      ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#1a1f28]'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlan('quarterly')}
                  className={`flex-1 px-4 py-3 rounded-xl font-albert text-[14px] transition-all ${
                    selectedPlan === 'quarterly'
                      ? 'bg-[#a07855] dark:bg-[#b8896a] text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#1a1f28]'
                  }`}
                >
                  Quarterly
                </button>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={assigning}
              className="font-albert rounded-full border-[#e1ddd8] dark:border-[#262b35]"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAssignCoach}
              disabled={assigning || !selectedCoachId}
              className="font-albert rounded-full bg-[#a07855] dark:bg-[#b8896a] hover:bg-[#8c6245] dark:hover:bg-[#a07855] text-white disabled:opacity-50"
            >
              {assigning ? 'Assigning...' : 'Assign Coach'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


