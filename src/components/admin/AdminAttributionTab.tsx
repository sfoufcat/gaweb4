'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Mail, 
  MousePointer2,
  Globe,
  Search,
  Filter,
  Download,
  Loader2,
  ChevronDown,
  ExternalLink,
  Calendar,
  Users,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuizLead, UTMData } from '@/types';

interface AttributionStats {
  total: number;
  converted: number;
  conversionRate: number;
  bySource: Record<string, { leads: number; converted: number; rate: number }>;
  byMedium: Record<string, { leads: number; converted: number; rate: number }>;
  byCampaign: Record<string, { leads: number; converted: number; rate: number }>;
  byDay: { date: string; leads: number; converted: number }[];
}

type DateRange = '7d' | '30d' | '90d' | 'all';

/**
 * AdminAttributionTab
 * 
 * Analytics dashboard for tracking lead attribution sources.
 * Shows breakdowns by UTM source, medium, campaign, and trends over time.
 */
export function AdminAttributionTab() {
  const [leads, setLeads] = useState<QuizLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/quiz-leads?limit=1000');
      
      if (!response.ok) {
        throw new Error('Failed to fetch attribution data');
      }
      
      const data = await response.json();
      setLeads(data.leads);
    } catch (err) {
      console.error('Error fetching attribution data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load attribution data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filter leads by date range
  const filteredLeads = useMemo(() => {
    if (dateRange === 'all') return leads;
    
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return leads.filter(lead => new Date(lead.createdAt) >= cutoff);
  }, [leads, dateRange]);

  // Calculate attribution stats
  const stats = useMemo((): AttributionStats => {
    const bySource: Record<string, { leads: number; converted: number; rate: number }> = {};
    const byMedium: Record<string, { leads: number; converted: number; rate: number }> = {};
    const byCampaign: Record<string, { leads: number; converted: number; rate: number }> = {};
    const byDayMap: Record<string, { leads: number; converted: number }> = {};
    
    let converted = 0;
    
    filteredLeads.forEach(lead => {
      const isConverted = !!lead.convertedAt;
      if (isConverted) converted++;
      
      // Get source (from utmData or legacy source field)
      const source = lead.utmData?.source || lead.source || 'direct';
      const medium = lead.utmData?.medium || 'none';
      const campaign = lead.utmData?.campaign || 'none';
      const day = lead.createdAt.split('T')[0];
      
      // By Source
      if (!bySource[source]) bySource[source] = { leads: 0, converted: 0, rate: 0 };
      bySource[source].leads++;
      if (isConverted) bySource[source].converted++;
      
      // By Medium
      if (!byMedium[medium]) byMedium[medium] = { leads: 0, converted: 0, rate: 0 };
      byMedium[medium].leads++;
      if (isConverted) byMedium[medium].converted++;
      
      // By Campaign
      if (campaign !== 'none') {
        if (!byCampaign[campaign]) byCampaign[campaign] = { leads: 0, converted: 0, rate: 0 };
        byCampaign[campaign].leads++;
        if (isConverted) byCampaign[campaign].converted++;
      }
      
      // By Day
      if (!byDayMap[day]) byDayMap[day] = { leads: 0, converted: 0 };
      byDayMap[day].leads++;
      if (isConverted) byDayMap[day].converted++;
    });
    
    // Calculate rates
    Object.values(bySource).forEach(s => s.rate = s.leads > 0 ? (s.converted / s.leads) * 100 : 0);
    Object.values(byMedium).forEach(m => m.rate = m.leads > 0 ? (m.converted / m.leads) * 100 : 0);
    Object.values(byCampaign).forEach(c => c.rate = c.leads > 0 ? (c.converted / c.leads) * 100 : 0);
    
    // Convert day map to sorted array
    const byDay = Object.entries(byDayMap)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      total: filteredLeads.length,
      converted,
      conversionRate: filteredLeads.length > 0 ? (converted / filteredLeads.length) * 100 : 0,
      bySource,
      byMedium,
      byCampaign,
      byDay,
    };
  }, [filteredLeads]);

  // Get leads for selected source
  const sourceLeads = useMemo(() => {
    if (!selectedSource) return [];
    return filteredLeads.filter(lead => {
      const source = lead.utmData?.source || lead.source || 'direct';
      return source === selectedSource;
    });
  }, [filteredLeads, selectedSource]);

  const exportToCSV = () => {
    const headers = ['Email', 'Name', 'Source', 'Medium', 'Campaign', 'Content', 'Term', 'Referrer', 'Landing Page', 'Converted', 'Created At'];
    const rows = filteredLeads.map(lead => [
      lead.email,
      lead.name || '',
      lead.utmData?.source || lead.source || 'direct',
      lead.utmData?.medium || '',
      lead.utmData?.campaign || '',
      lead.utmData?.content || '',
      lead.utmData?.term || '',
      lead.referrer || '',
      lead.landingPage || '',
      lead.convertedAt ? 'Yes' : 'No',
      new Date(lead.createdAt).toLocaleDateString(),
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attribution-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'google':
        return <MousePointer2 className="w-4 h-4" />;
      case 'woodpecker':
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'direct':
        return <Globe className="w-4 h-4" />;
      default:
        return <ExternalLink className="w-4 h-4" />;
    }
  };

  const getMediumColor = (medium: string) => {
    switch (medium.toLowerCase()) {
      case 'cpc':
      case 'ppc':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'email':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
      case 'organic':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'social':
        return 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400';
      case 'referral':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400 font-sans">{error}</p>
        <Button onClick={fetchLeads} variant="outline" size="sm" className="mt-3">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Attribution Analytics
          </h2>
          <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            Track where your coach leads are coming from
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Date Range Filter */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowDateMenu(!showDateMenu)}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              {dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : dateRange === '90d' ? 'Last 90 days' : 'All time'}
              <ChevronDown className="w-4 h-4" />
            </Button>
            
            {showDateMenu && (
              <div className="absolute top-full right-0 mt-1 w-40 bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] shadow-lg py-1 z-10">
                {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setDateRange(range);
                      setShowDateMenu(false);
                    }}
                    className={`w-full px-4 py-2 text-left font-sans text-sm hover:bg-[#faf8f6] dark:hover:bg-[#262b35] ${
                      dateRange === range ? 'text-brand-accent font-semibold' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                    }`}
                  >
                    {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : range === '90d' ? 'Last 90 days' : 'All time'}
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
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-4 gap-4">
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
              <Percent className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                {stats.conversionRate.toFixed(1)}%
              </div>
              <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Conversion Rate
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="font-albert font-bold text-2xl text-[#1a1a1a] dark:text-[#f5f5f8]">
                {Object.keys(stats.bySource).length}
              </div>
              <div className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                Sources
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* By Source */}
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
          <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-accent" />
            By Source
          </h3>
          
          {Object.keys(stats.bySource).length === 0 ? (
            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center py-4">
              No attribution data yet. Use UTM parameters in your URLs.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.bySource)
                .sort((a, b) => b[1].leads - a[1].leads)
                .map(([source, data]) => (
                  <button
                    key={source}
                    onClick={() => setSelectedSource(selectedSource === source ? null : source)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${
                      selectedSource === source 
                        ? 'bg-brand-accent/10 border border-brand-accent/30' 
                        : 'hover:bg-[#faf8f6] dark:hover:bg-[#262b35]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#faf8f6] dark:bg-[#262b35] flex items-center justify-center">
                        {getSourceIcon(source)}
                      </div>
                      <div className="text-left">
                        <div className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] capitalize">
                          {source}
                        </div>
                        <div className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                          {data.converted} / {data.leads} converted
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {data.leads}
                      </div>
                      <div className={`font-sans text-xs ${data.rate >= 20 ? 'text-green-600 dark:text-green-400' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
                        {data.rate.toFixed(1)}%
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* By Medium */}
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
          <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-accent" />
            By Medium
          </h3>
          
          {Object.keys(stats.byMedium).length === 0 ? (
            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] text-center py-4">
              No medium data yet
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byMedium)
                .sort((a, b) => b[1].leads - a[1].leads)
                .map(([medium, data]) => (
                  <div key={medium} className="flex items-center justify-between p-3 rounded-lg hover:bg-[#faf8f6] dark:hover:bg-[#262b35]">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getMediumColor(medium)}`}>
                        {medium}
                      </span>
                      <span className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {data.converted} / {data.leads} converted
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {data.leads}
                      </div>
                      <div className={`font-sans text-xs ${data.rate >= 20 ? 'text-green-600 dark:text-green-400' : 'text-[#5f5a55] dark:text-[#b2b6c2]'}`}>
                        {data.rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaigns Table */}
      {Object.keys(stats.byCampaign).length > 0 && (
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
          <div className="p-5 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-accent" />
              Campaign Performance
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e1ddd8] dark:border-[#262b35] bg-[#faf8f6] dark:bg-[#11141b]">
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Campaign</th>
                  <th className="px-4 py-3 text-right font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Leads</th>
                  <th className="px-4 py-3 text-right font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Converted</th>
                  <th className="px-4 py-3 text-right font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Rate</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.byCampaign)
                  .sort((a, b) => b[1].leads - a[1].leads)
                  .map(([campaign, data]) => (
                    <tr key={campaign} className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 last:border-0">
                      <td className="px-4 py-3 font-sans text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {campaign}
                      </td>
                      <td className="px-4 py-3 text-right font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {data.leads}
                      </td>
                      <td className="px-4 py-3 text-right font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {data.converted}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          data.rate >= 25 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          data.rate >= 10 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                          'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                        }`}>
                          {data.rate.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Source Detail */}
      {selectedSource && sourceLeads.length > 0 && (
        <div className="bg-white dark:bg-[#1a1e26] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
          <div className="p-5 border-b border-[#e1ddd8] dark:border-[#262b35] flex items-center justify-between">
            <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] flex items-center gap-2">
              {getSourceIcon(selectedSource)}
              Leads from "{selectedSource}"
              <span className="text-sm font-normal text-[#5f5a55] dark:text-[#b2b6c2]">
                ({sourceLeads.length} leads)
              </span>
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSelectedSource(null)}>
              Close
            </Button>
          </div>
          
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-[#faf8f6] dark:bg-[#11141b]">
                <tr className="border-b border-[#e1ddd8] dark:border-[#262b35]">
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Email</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Medium</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Campaign</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Status</th>
                  <th className="px-4 py-3 text-left font-albert text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {sourceLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 last:border-0">
                    <td className="px-4 py-3 font-sans text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {lead.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getMediumColor(lead.utmData?.medium || 'none')}`}>
                        {lead.utmData?.medium || 'none'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                      {lead.utmData?.campaign || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.convertedAt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs font-semibold">
                          <CheckCircle2 className="w-3 h-3" />
                          Converted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-semibold">
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
        </div>
      )}

      {/* Help Section */}
      <div className="bg-gradient-to-r from-brand-accent/5 to-[#8c6245]/5 dark:from-brand-accent/10 dark:to-[#8c6245]/10 rounded-xl border border-brand-accent/20 p-5">
        <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
          📊 How to Track Attribution
        </h3>
        <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
          Add UTM parameters to your marketing URLs to track where leads come from:
        </p>
        <div className="space-y-2">
          <div className="bg-white dark:bg-[#1a1e26] rounded-lg p-3">
            <div className="font-sans text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Google Ads:</div>
            <code className="font-mono text-xs text-brand-accent break-all">
              growthaddicts.com/?utm_source=google&utm_medium=cpc&utm_campaign=coaching_platform
            </code>
          </div>
          <div className="bg-white dark:bg-[#1a1e26] rounded-lg p-3">
            <div className="font-sans text-xs font-semibold text-[#5f5a55] dark:text-[#b2b6c2] mb-1">Cold Email (Woodpecker):</div>
            <code className="font-mono text-xs text-brand-accent break-all">
              growthaddicts.com/?utm_source=woodpecker&utm_medium=email&utm_campaign=cold_outreach_jan26
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

