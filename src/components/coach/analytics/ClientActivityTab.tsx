'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  Heart, 
  Activity, 
  AlertCircle, 
  AlertTriangle,
  Search,
  Calendar,
  RefreshCw,
  Eye,
  MessageCircle,
  Send,
} from 'lucide-react';
import type { HealthStatus } from '@/lib/analytics/constants';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useDemoSession } from '@/contexts/DemoSessionContext';
import { generateDemoClients } from '@/lib/demo-data';
import { SendDMModal, type DMRecipient } from '@/components/coach/SendDMModal';

interface ClientData {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: HealthStatus;
  atRisk: boolean;
  lastActivityAt: string | null;
  primarySignal: string | null;
  daysActiveInPeriod: number;
  programId?: string;
  programName?: string;
  squadId?: string;
  squadName?: string;
  joinedAt: string;
}

interface ClientSummary {
  totalClients: number;
  thrivingCount: number;
  activeCount: number;
  inactiveCount: number;
  atRiskCount: number;
  activeRate: number;
}

interface ClientActivityTabProps {
  apiBasePath?: string;
}

export function ClientActivityTab({ apiBasePath = '/api/coach/analytics' }: ClientActivityTabProps) {
  const { isDemoMode } = useDemoMode();
  const demoSession = useDemoSession();
  
  const [clients, setClients] = useState<ClientData[]>([]);
  const [summary, setSummary] = useState<ClientSummary>({
    totalClients: 0,
    thrivingCount: 0,
    activeCount: 0,
    inactiveCount: 0,
    atRiskCount: 0,
    activeRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'thriving' | 'active' | 'inactive' | 'at-risk'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // DM Modal state
  const [dmRecipients, setDmRecipients] = useState<DMRecipient[]>([]);
  const [showDmModal, setShowDmModal] = useState(false);

  // Generate demo data (memoized to prevent re-generation)
  const demoData = useMemo(() => generateDemoClients(18), []);

  const fetchClients = useCallback(async (isRefresh = false) => {
    // Skip API call in demo mode
    if (isDemoMode) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`${apiBasePath}/clients?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch client analytics');
      }

      const data = await response.json();
      setClients(data.clients || []);
      setSummary(data.summary || {
        totalClients: 0,
        thrivingCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        atRiskCount: 0,
        activeRate: 0,
      });
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBasePath, statusFilter, isDemoMode]);

  const handleRefresh = () => {
    if (isDemoMode) return; // No refresh in demo mode
    fetchClients(true);
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);
  
  // Use demo data when in demo mode (from session context for interactivity)
  const displayClients: ClientData[] = useMemo(() => {
    if (isDemoMode) {
      // Apply status filter to session demo data
      let filtered = demoSession.clients as ClientData[];
      if (statusFilter !== 'all') {
        if (statusFilter === 'at-risk') {
          filtered = filtered.filter(c => c.atRisk);
        } else {
          filtered = filtered.filter(c => c.status === statusFilter);
        }
      }
      return filtered;
    }
    return clients;
  }, [isDemoMode, demoSession.clients, clients, statusFilter]);
  
  const displaySummary: ClientSummary = useMemo(() => {
    if (isDemoMode) {
      // Compute summary from session clients
      const sessionClients = demoSession.clients;
      return {
        totalClients: sessionClients.length,
        thrivingCount: sessionClients.filter(c => c.status === 'thriving').length,
        activeCount: sessionClients.filter(c => c.status === 'active').length,
        inactiveCount: sessionClients.filter(c => c.status === 'inactive').length,
        atRiskCount: sessionClients.filter(c => c.atRisk).length,
        activeRate: Math.round(
          (sessionClients.filter(c => c.status === 'thriving' || c.status === 'active').length / 
           sessionClients.length) * 100
        ) || 0,
      };
    }
    return summary;
  }, [isDemoMode, demoSession.clients, summary]);

  const getStatusColor = (status: HealthStatus) => {
    switch (status) {
      case 'thriving':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'active':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'inactive':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'thriving': return <Heart className="w-3.5 h-3.5" />;
      case 'active': return <Activity className="w-3.5 h-3.5" />;
      case 'inactive': return <AlertCircle className="w-3.5 h-3.5" />;
    }
  };

  const getSignalLabel = (signal: string | null) => {
    switch (signal) {
      case 'task': return 'Tasks';
      case 'habit': return 'Habits';
      case 'checkin': return 'Check-ins';
      case 'weekly': return 'Weekly';
      default: return 'None';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Open DM modal for a single client
  const handleMessageClient = useCallback((client: ClientData) => {
    if (isDemoMode) {
      alert('DM functionality is disabled in demo mode');
      return;
    }
    setDmRecipients([{
      userId: client.userId,
      name: client.name,
      email: client.email,
      avatarUrl: client.avatarUrl,
    }]);
    setShowDmModal(true);
  }, [isDemoMode]);

  // Filter clients by search query
  const filteredClients = displayClients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.programName?.toLowerCase().includes(query) ||
      client.squadName?.toLowerCase().includes(query)
    );
  });

  // Open DM modal for all filtered clients (bulk)
  const handleMessageFiltered = useCallback(() => {
    if (isDemoMode) {
      alert('DM functionality is disabled in demo mode');
      return;
    }
    const recipients: DMRecipient[] = filteredClients.map(client => ({
      userId: client.userId,
      name: client.name,
      email: client.email,
      avatarUrl: client.avatarUrl,
    }));
    setDmRecipients(recipients);
    setShowDmModal(true);
  }, [isDemoMode, filteredClients]);

  // Close DM modal
  const handleCloseDmModal = useCallback(() => {
    setShowDmModal(false);
    setDmRecipients([]);
  }, []);

  if (loading && !isDemoMode) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
        <div className="h-96 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
      </div>
    );
  }

  if (error && !isDemoMode) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="mb-4 px-4 py-3 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl flex items-center gap-3">
          <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 font-albert">
              Demo Mode Active
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-albert">
              Showing sample client data for demonstration purposes
            </p>
          </div>
        </div>
      )}
      
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          Client Activity
        </h3>
        {!isDemoMode && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-accent text-white hover:bg-brand-accent/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-brand-accent" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Total</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.totalClients}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Clients</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Thriving</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.thrivingCount}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">4+ days active</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Active</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.activeCount}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Some activity</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Inactive</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.inactiveCount}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">No activity</p>
        </div>

        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert">At Risk</span>
          </div>
          <div className="text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            {displaySummary.atRiskCount}
          </div>
          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">Declining</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55]" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30 dark:focus:ring-brand-accent/30"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'thriving', 'active', 'inactive', 'at-risk'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-brand-accent text-white'
                  : 'bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#e1ddd8] dark:hover:bg-[#272d38]'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
        
        {/* Bulk Message Button */}
        {filteredClients.length > 0 && !isDemoMode && (
          <button
            onClick={handleMessageFiltered}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Message {statusFilter !== 'all' ? statusFilter.replace('-', ' ') : 'All'} ({filteredClients.length})
          </button>
        )}
      </div>

      {/* Clients Table */}
      <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
        {filteredClients.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
            <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
              No clients found
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              {searchQuery ? 'Try a different search term' : 'No clients match the current filter'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#faf8f6] dark:bg-[#11141b] border-b border-[#e1ddd8] dark:border-[#262b35]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Last Active</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Primary Signal</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Program</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Community</th>
                  {!isDemoMode && (
                    <th className="text-right px-4 py-3 text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
                {filteredClients.map((client) => (
                  <tr key={client.userId} className="hover:bg-[#faf8f6] dark:hover:bg-[#1a1f2a] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {client.avatarUrl ? (
                          <img 
                            src={client.avatarUrl} 
                            alt={client.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center text-white font-semibold text-sm">
                            {client.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">{client.name}</p>
                          <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">{client.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(client.status)}`}>
                          {getStatusIcon(client.status)}
                          {client.status}
                        </span>
                        {client.atRisk && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            At Risk
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        <Calendar className="w-4 h-4" />
                        {formatDate(client.lastActivityAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {getSignalLabel(client.primarySignal)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {client.programName || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {client.squadName || '—'}
                      </span>
                    </td>
                    {!isDemoMode && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleMessageClient(client)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title={`Message ${client.name}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Message
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Send DM Modal */}
      {showDmModal && dmRecipients.length > 0 && (
        <SendDMModal
          recipients={dmRecipients}
          onClose={handleCloseDmModal}
          onSuccess={(count) => {
            console.log(`Successfully sent ${count} messages`);
          }}
        />
      )}
    </div>
  );
}

