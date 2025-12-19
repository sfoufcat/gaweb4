'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { PremiumUpgradeForm } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// Map benefit IDs to labels
const BENEFITS_LABELS: Record<string, string> = {
  performance: 'Increase my performance',
  blockages: 'Resolve inner blockages',
  time: 'Improve my time management',
  goals: 'Set better goals',
  limits: 'Break my limits',
};

export function AdminPremiumUpgradeFormsTab() {
  const [forms, setForms] = useState<PremiumUpgradeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  const fetchForms = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/premium-upgrade-forms');
      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const data = await response.json();
      setForms(data.forms || []);
    } catch (err) {
      console.error('Error fetching forms:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch forms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  // Filter forms based on search query
  const filteredForms = useMemo(() => {
    if (!searchQuery.trim()) return forms;
    
    const query = searchQuery.toLowerCase();
    return forms.filter(
      (form) =>
        form.name.toLowerCase().includes(query) ||
        form.email.toLowerCase().includes(query) ||
        form.phone.includes(query)
    );
  }, [forms, searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading forms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button 
            onClick={fetchForms} 
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header with search */}
      <div className="p-6 border-b border-[#e1ddd8] dark:border-[#262b35]/50">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Premium Upgrade Forms</h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-1">
              {filteredForms.length} of {forms.length} submission{forms.length !== 1 ? 's' : ''}
              {searchQuery && ' matching search'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] font-albert text-sm"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:text-[#f5f5f8]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            
            <Button 
              onClick={fetchForms}
              variant="outline"
              className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Forms table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-albert w-[50px]"></TableHead>
              <TableHead className="font-albert">Name</TableHead>
              <TableHead className="font-albert">Email</TableHead>
              <TableHead className="font-albert">Phone</TableHead>
              <TableHead className="font-albert">Plan</TableHead>
              <TableHead className="font-albert">Commitment</TableHead>
              <TableHead className="font-albert">Upgrade Status</TableHead>
              <TableHead className="font-albert">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredForms.map((form) => (
              <React.Fragment key={form.id}>
                <TableRow
                  className="cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-white/5/50"
                  onClick={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
                >
                  {/* Expand icon */}
                  <TableCell>
                    <svg 
                      className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] transition-transform ${expandedFormId === form.id ? 'rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </TableCell>
                  
                  {/* Name */}
                  <TableCell className="font-albert font-medium">
                    {form.name || 'Unknown'}
                  </TableCell>
                  
                  {/* Email */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {form.email}
                  </TableCell>
                  
                  {/* Phone */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {form.phone || '-'}
                  </TableCell>
                  
                  {/* Plan */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      form.planLabel === 'monthly' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {form.planLabel === 'monthly' ? 'Monthly' : '6-Month'}
                    </span>
                  </TableCell>
                  
                  {/* Commitment */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      form.commitment === 'commit' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {form.commitment === 'commit' ? 'Committed 🚀' : 'Not ready 🫤'}
                    </span>
                  </TableCell>
                  
                  {/* Stripe Status */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      form.stripeUpgradeSuccessful 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {form.stripeUpgradeSuccessful ? 'Upgraded ✓' : 'Failed ✗'}
                    </span>
                  </TableCell>
                  
                  {/* Submitted Date */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2]">
                    {new Date(form.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>

                {/* Expanded details row */}
                {expandedFormId === form.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-[#faf8f6]/50 p-0">
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Benefits */}
                          <div>
                            <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                              What they want from Premium Squad:
                            </h4>
                            <ul className="space-y-1">
                              {form.benefitsSelected.map((benefit) => (
                                <li key={benefit} className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-2">
                                  <svg className="w-4 h-4 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {BENEFITS_LABELS[benefit] || benefit}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Other details */}
                          <div className="space-y-3">
                            {/* Upgrade with friends */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                                Upgrade with friends:
                              </h4>
                              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                {form.upgradeWithFriends ? (
                                  <>Yes - {form.friendsNames || 'Names not provided'}</>
                                ) : (
                                  'No, just wants a guided squad'
                                )}
                              </p>
                            </div>

                            {/* Price ID */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                                Price ID:
                              </h4>
                              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-mono bg-white px-2 py-1 rounded inline-block">
                                {form.priceId}
                              </p>
                            </div>

                            {/* User ID */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                                User ID:
                              </h4>
                              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-mono bg-white px-2 py-1 rounded inline-block">
                                {form.userId}
                              </p>
                            </div>

                            {/* Full timestamp */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                                Submitted at:
                              </h4>
                              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                {formatDate(form.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredForms.length === 0 && (
        <div className="p-12 text-center">
          {searchQuery ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#a07855]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#a07855]"
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
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No forms found</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
                No submissions match "{searchQuery}"
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#FF6B6B]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No premium upgrade forms yet</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
                When users submit the premium upgrade form, they'll appear here.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

