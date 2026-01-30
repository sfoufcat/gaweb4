'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { Calendar, ChevronRight, UserPlus, RefreshCw, Heart, Activity, AlertCircle, AlertTriangle, Search, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClientCoachingData, FirebaseUser, CoachingPlanType } from '@/types';
import { InviteClientsDialog } from './InviteClientsDialog';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useDemoSession } from '@/contexts/DemoSessionContext';

interface ClientActivityScore {
  status: 'thriving' | 'active' | 'inactive';
  atRisk: boolean;
  lastActivityAt: string | null;
  daysActiveInPeriod: number;
}

interface CoachingClientWithUser extends ClientCoachingData {
  user?: Partial<FirebaseUser>;
  activityScore?: ClientActivityScore;
}

// Activity status colors and icons
const ACTIVITY_STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  thriving: { 
    bg: 'bg-emerald-100 dark:bg-emerald-900/30', 
    text: 'text-emerald-700 dark:text-emerald-400', 
    icon: <Heart className="w-3 h-3" />,
    label: 'Thriving'
  },
  active: { 
    bg: 'bg-amber-100 dark:bg-amber-900/30', 
    text: 'text-amber-700 dark:text-amber-400', 
    icon: <Activity className="w-3 h-3" />,
    label: 'Active'
  },
  inactive: { 
    bg: 'bg-red-100 dark:bg-red-900/30', 
    text: 'text-red-700 dark:text-red-400', 
    icon: <AlertCircle className="w-3 h-3" />,
    label: 'Inactive'
  },
};

interface CoachingClientsTabProps {
  onSelectClient: (clientId: string) => void;
}

/**
 * CoachingClientsTab
 * 
 * Shows a list of all 1:1 coaching clients assigned to the coach.
 * Displayed in the Coach Dashboard.
 */
export function CoachingClientsTab({ onSelectClient }: CoachingClientsTabProps) {
  const { isDemoMode, openSignupModal } = useDemoMode();
  const demoSession = useDemoSession();
  const [clients, setClients] = useState<CoachingClientWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search expand/collapse handlers
  const handleSearchExpand = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, []);

  const handleSearchCollapse = useCallback(() => {
    setIsSearchExpanded(false);
    setSearchQuery('');
  }, []);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(client => {
      const firstName = client.user?.firstName?.toLowerCase() || '';
      const lastName = client.user?.lastName?.toLowerCase() || '';
      const email = client.user?.email?.toLowerCase() || '';
      return firstName.includes(query) || lastName.includes(query) || email.includes(query);
    });
  }, [clients, searchQuery]);

  const handleAddNewClients = () => {
    if (isDemoMode) {
      openSignupModal();
      return;
    }
    setShowInviteDialog(true);
  };

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      if (isDemoMode) {
        // Map demo clients to CoachingClientWithUser
        const demoClients = demoSession.clients.map(dc => ({
           id: `demo-org_${dc.userId}`,
           userId: dc.userId,
           organizationId: 'demo-org',
           coachId: 'demo-coach',
           coachingPlan: 'monthly' as CoachingPlanType,
           startDate: dc.joinedAt,
           focusAreas: ['Goal Setting', 'Habit Building'],
           resources: [],
           privateNotes: [],
           createdAt: dc.joinedAt,
           updatedAt: dc.joinedAt,
           user: {
             id: dc.userId,
             firstName: dc.name.split(' ')[0],
             lastName: dc.name.split(' ').slice(1).join(' '),
             email: dc.email,
             imageUrl: dc.avatarUrl
           },
           activityScore: {
             status: dc.status as 'thriving' | 'active' | 'inactive',
             atRisk: dc.atRisk,
             lastActivityAt: dc.lastActivityAt,
             daysActiveInPeriod: dc.daysActiveInPeriod
           },
           actionItems: [],
           sessionHistory: [],
           nextCall: {
             datetime: null,
             timezone: 'UTC',
             location: 'chat'
           }
        }));
        setClients(demoClients);
        setLoading(false);
        return;
      }

      const response = await fetch('/api/coaching/clients');
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }

      const data = await response.json();
      setClients(data.clients || []);
    } catch (err) {
      console.error('Error fetching coaching clients:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPlanLabel = (plan: CoachingPlanType | null) => {
    if (!plan) return '—';
    return plan === 'monthly' ? 'Monthly' : 'Quarterly';
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-7 w-40 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
        </div>
        {/* Client rows skeleton */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#e1ddd8]/50 dark:bg-[#272d38]/50" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
                <div className="h-4 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
              </div>
              <div className="h-6 w-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <p className="text-red-600 dark:text-red-300 font-albert mb-4">{error}</p>
        <button
          onClick={fetchClients}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
        >
          Retry
        </button>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <>
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert tracking-[-1px]">
            No coaching clients yet
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto mb-6">
            Start by inviting clients to join your program.
          </p>
          <button
            onClick={handleAddNewClients}
            className="px-2.5 py-1.5 rounded-lg text-[15px] text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white font-albert font-medium transition-colors duration-200 inline-flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Add New Clients
          </button>
        </div>
        <InviteClientsDialog
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
          Coaching Clients
        </h2>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">
          {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
        </p>

        {/* Icon toolbar row */}
        <div className="flex items-center gap-1 mt-4">
          {/* Animated search input */}
          <div
            className={cn(
              "flex items-center overflow-hidden transition-all duration-300 ease-out",
              isSearchExpanded ? "opacity-100" : "w-0 opacity-0"
            )}
            style={{ width: isSearchExpanded ? '200px' : 0 }}
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9ca3af] focus:outline-none focus:ring-0 font-albert"
            />
          </div>

          {/* Search toggle button */}
          <button
            onClick={isSearchExpanded ? handleSearchCollapse : handleSearchExpand}
            className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title={isSearchExpanded ? "Close search" : "Search clients"}
          >
            {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchClients}
            className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Plus button */}
          <button
            onClick={handleAddNewClients}
            className="p-2 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            title="Add New Clients"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invite Dialog */}
      <InviteClientsDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
      />

      {/* Clients List */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {filteredClients.map((client, index) => (
          <button
            key={client.id}
            onClick={() => onSelectClient(client.id)}
            className={`w-full flex items-center gap-4 p-4 hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors text-left ${
              index !== filteredClients.length - 1 ? 'border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50' : ''
            }`}
          >
            {/* Avatar */}
            <div className="shrink-0">
              {client.user?.imageUrl ? (
                <Image
                  src={client.user.imageUrl}
                  alt={client.user.firstName || 'Client'}
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center text-brand-accent-foreground font-albert font-semibold">
                  {client.user?.firstName?.charAt(0) || 'C'}
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                  {client.user?.firstName} {client.user?.lastName}
                </p>
                {/* Activity Status Badge */}
                {client.activityScore && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-albert ${
                    ACTIVITY_STATUS_CONFIG[client.activityScore.status]?.bg
                  } ${
                    ACTIVITY_STATUS_CONFIG[client.activityScore.status]?.text
                  }`}>
                    {ACTIVITY_STATUS_CONFIG[client.activityScore.status]?.icon}
                    {ACTIVITY_STATUS_CONFIG[client.activityScore.status]?.label}
                  </span>
                )}
                {/* At Risk Badge */}
                {client.activityScore?.atRisk && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-albert bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                    <AlertTriangle className="w-3 h-3" />
                    At Risk
                  </span>
                )}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-albert ${
                  client.coachingPlan === 'quarterly' 
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {formatPlanLabel(client.coachingPlan)}
                </span>
              </div>
              <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                {client.user?.email}
              </p>
              
              {/* Next Call Info */}
              {client.nextCall?.datetime && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                  <span className="font-albert text-xs text-brand-accent">
                    Next call: {formatDate(client.nextCall.datetime)}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 shrink-0 text-[#5f5a55] dark:text-[#b2b6c2]">
              {/* Action Items Count */}
              <div className="text-center">
                <p className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {client.actionItems?.filter(i => !i.completed).length || 0}
                </p>
                <p className="font-albert text-[10px] uppercase tracking-wider">Open</p>
              </div>
              
              {/* Sessions Count */}
              <div className="text-center">
                <p className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {client.sessionHistory?.length || 0}
                </p>
                <p className="font-albert text-[10px] uppercase tracking-wider">Sessions</p>
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight className="w-5 h-5 text-[#c4bfb9] dark:text-[#7d8190] shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}


