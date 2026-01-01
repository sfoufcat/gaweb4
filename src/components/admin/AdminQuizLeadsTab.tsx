'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search,
  Filter,
  Download,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { QuizLead } from '@/types';

interface QuizLeadStats {
  total: number;
  converted: number;
  notConverted: number;
}

/**
 * AdminQuizLeadsTab
 * 
 * Admin dashboard tab for viewing quiz leads from the landing page.
 */
export function AdminQuizLeadsTab() {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [stats, setStats] = useState<QuizLeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'converted' | 'not_converted'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filter === 'converted') params.set('converted', 'true');
      if (filter === 'not_converted') params.set('converted', 'false');
      if (search) params.set('search', search);
      
      const response = await fetch(`/api/admin/quiz-leads?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch quiz leads');
      }
      
      const data = await response.json();
      setLeads(data.leads);
      setStats(data.stats);
    } catch (err) {
      console.error('Error fetching quiz leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz leads');
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const exportToCSV = () => {
    const headers = ['Email', 'Name', 'Client Count', 'Frustrations', 'Impact Features', 'Referral Code', 'Converted', 'Created At'];
    const rows = leads.map(lead => [
      lead.email,
      lead.name || '',
      lead.clientCount,
      lead.frustrations.join('; '),
      lead.impactFeatures.join('; '),
      lead.referralCode || '',
      lead.convertedAt ? 'Yes' : 'No',
      new Date(lead.createdAt).toLocaleDateString(),
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.total}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Total Leads
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.converted}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Converted
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {stats.notConverted}
                </div>
                <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Not Converted
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8580]" />
          <Input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            {filter === 'all' ? 'All' : filter === 'converted' ? 'Converted' : 'Not Converted'}
            <ChevronDown className="w-4 h-4" />
          </Button>
          
          {showFilterMenu && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg py-1 z-10">
              {(['all', 'converted', 'not_converted'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setShowFilterMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left font-sans text-sm hover:bg-[#faf8f6] dark:hover:bg-[#262b35] ${
                    filter === f ? 'text-brand-accent font-semibold' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'converted' ? 'Converted' : 'Not Converted'}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 font-sans">{error}</p>
            <Button onClick={fetchLeads} variant="outline" size="sm" className="mt-3">
              Try Again
            </Button>
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-[#8a8580] mx-auto mb-3" />
            <p className="font-sans text-[#5f5a55] dark:text-[#b2b6c2]">No quiz leads yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Email</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Name</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Clients</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Frustrations</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Status</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 last:border-0">
                    <td className="px-4 py-3 font-sans text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {lead.email}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {lead.name || '-'}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {lead.clientCount || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.frustrations.slice(0, 2).map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-[#faf8f6] dark:bg-[#262b35] rounded text-xs font-sans text-[#5f5a55] dark:text-[#b2b6c2]"
                          >
                            {f.replace(/_/g, ' ').slice(0, 20)}...
                          </span>
                        ))}
                        {lead.frustrations.length > 2 && (
                          <span className="px-2 py-0.5 text-xs font-sans text-[#8a8580]">
                            +{lead.frustrations.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.convertedAt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Converted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

