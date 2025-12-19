'use client';

import React, { useEffect, useState, useMemo } from 'react';
import type { CoachingIntakeForm } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';

// Map goal IDs to labels
const GOALS_LABELS: Record<string, string> = {
  performance: 'Increase my performance',
  blockages: 'Resolve inner blockages',
  time: 'Improve my time management',
  goals: 'Set better goals',
  limits: 'Break my limits',
};

// Map coach preference IDs to labels
const COACH_LABELS: Record<string, string> = {
  no_preference: 'No preference 👍',
  mariyah: 'Mariyah Fefilova, M.S.',
  kelsey: 'Kelsey Walstrom',
  matthew: 'Matthew Hood, CMPC',
};

interface AdminCoachingIntakeFormsTabProps {
  /** Override API endpoint for multi-tenancy (e.g., '/api/coach/org-forms/coaching-intake' for coaches) */
  apiEndpoint?: string;
}

export function AdminCoachingIntakeFormsTab({ apiEndpoint = '/api/admin/coaching-intake-forms' }: AdminCoachingIntakeFormsTabProps) {
  const [forms, setForms] = useState<CoachingIntakeForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);

  const fetchForms = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch forms');
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
        form.phone.includes(query) ||
        (COACH_LABELS[form.coachPreference] || form.coachPreference).toLowerCase().includes(query)
    );
  }, [forms, searchQuery]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4CAF50] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert">Loading forms...</p>
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
            onClick={fetchForms} 
            className="mt-4 bg-[#4CAF50] hover:bg-[#43A047] text-white"
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
            <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] font-albert">Coaching Intake Forms</h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert mt-1">
              {filteredForms.length} of {forms.length} submission{forms.length !== 1 ? 's' : ''}
              {searchQuery && ' matching search'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, email, phone, or coach..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-72 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4CAF50] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
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
              <TableHead className="font-albert">Coach Preference</TableHead>
              <TableHead className="font-albert">Status</TableHead>
              <TableHead className="font-albert">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredForms.map((form) => (
              <React.Fragment key={form.id}>
                <TableRow
                  className="cursor-pointer hover:bg-[#faf8f6] dark:hover:bg-white/5/50 dark:hover:bg-[#171b22]/50"
                  onClick={() => setExpandedFormId(expandedFormId === form.id ? null : form.id)}
                >
                  {/* Expand icon */}
                  <TableCell>
                    <svg 
                      className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#7d8190] transition-transform ${expandedFormId === form.id ? 'rotate-90' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </TableCell>
                  
                  {/* Name */}
                  <TableCell className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8]">
                    {form.name || 'Unknown'}
                  </TableCell>
                  
                  {/* Email */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {form.email}
                  </TableCell>
                  
                  {/* Phone */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {form.phone || '-'}
                  </TableCell>
                  
                  {/* Plan */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      form.planLabel === 'monthly' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {form.planLabel === 'monthly' ? 'Monthly' : 'Quarterly'}
                    </span>
                  </TableCell>
                  
                  {/* Coach Preference */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {COACH_LABELS[form.coachPreference] || form.coachPreference}
                  </TableCell>
                  
                  {/* Stripe Status */}
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${
                      form.stripeSubscriptionSuccessful 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {form.stripeSubscriptionSuccessful ? 'Active ✓' : 'Failed ✗'}
                    </span>
                  </TableCell>
                  
                  {/* Submitted Date */}
                  <TableCell className="font-albert text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                    {new Date(form.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>

                {/* Expanded details row */}
                {expandedFormId === form.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-[#faf8f6]/50 dark:bg-[#11141b]/50 p-0">
                      <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Goals */}
                          <div>
                            <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-2">
                              What they want from coaching:
                            </h4>
                            <ul className="space-y-1">
                              {form.goalsSelected.map((goal) => (
                                <li key={goal} className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] flex items-center gap-2">
                                  <svg className="w-4 h-4 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {GOALS_LABELS[goal] || goal}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Other details */}
                          <div className="space-y-3">
                            {/* Commitment */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1">
                                Commitment:
                              </h4>
                              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
                                {form.commitment === 'commit' ? 'Committed 🚀' : 'Not ready 🫤'}
                              </p>
                            </div>

                            {/* Price ID */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1">
                                Price ID:
                              </h4>
                              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-mono bg-white dark:bg-[#171b22] px-2 py-1 rounded inline-block">
                                {form.priceId}
                              </p>
                            </div>

                            {/* User ID */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1">
                                User ID:
                              </h4>
                              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-mono bg-white dark:bg-[#171b22] px-2 py-1 rounded inline-block">
                                {form.userId}
                              </p>
                            </div>

                            {/* Full timestamp */}
                            <div>
                              <h4 className="font-albert text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] dark:text-[#f5f5f8] mb-1">
                                Submitted at:
                              </h4>
                              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2]">
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#4CAF50]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#4CAF50]"
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
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert text-lg mb-2">No forms found</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 dark:text-[#7d8190] font-albert text-sm">
                No submissions match &quot;{searchQuery}&quot;
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
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#4CAF50]"
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
              <p className="text-[#5f5a55] dark:text-[#b2b6c2] dark:text-[#b2b6c2] font-albert text-lg mb-2">No coaching intake forms yet</p>
              <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 dark:text-[#7d8190] font-albert text-sm">
                When users submit the coaching intake form, they&apos;ll appear here.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}


