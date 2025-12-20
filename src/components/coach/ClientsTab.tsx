'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import type { UserRole, UserTier, CoachingStatus } from '@/types';
import {
  formatTierName,
  getTierBadgeColor,
  formatCoachingStatus,
  getCoachingStatusBadgeColor,
} from '@/lib/admin-utils-shared';

interface OrgUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  tier: UserTier;
  coachingStatus?: CoachingStatus;
  coaching?: boolean;
  invitedBy?: string | null;
  invitedByName?: string | null;
  inviteCode?: string | null;
  invitedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CoachingClientData {
  id: string;
  actionItems?: Array<{ completed: boolean }>;
  sessionHistory?: Array<unknown>;
}

interface ClientsTabProps {
  onSelectClient: (clientId: string) => void;
}

/**
 * ClientsTab
 * 
 * Shows all users in the coach's organization with a card-based design.
 * Clicking on a user opens their coaching client management page.
 */
export function ClientsTab({ onSelectClient }: ClientsTabProps) {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [coachingData, setCoachingData] = useState<Map<string, CoachingClientData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch users and coaching data in parallel
      const [usersResponse, coachingResponse] = await Promise.all([
        fetch('/api/coach/org-users'),
        fetch('/api/coaching/clients'),
      ]);

      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users');
      }

      const usersData = await usersResponse.json();
      setUsers(usersData.users || []);

      // Coaching data fetch may fail if user has no coaching clients - that's ok
      if (coachingResponse.ok) {
        const coachingResult = await coachingResponse.json();
        const coachingMap = new Map<string, CoachingClientData>();
        (coachingResult.clients || []).forEach((client: CoachingClientData) => {
          coachingMap.set(client.id, client);
        });
        setCoachingData(coachingMap);
      }
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

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.firstName.toLowerCase().includes(query) ||
        user.lastName.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Check if user has coaching access
  const hasCoaching = (user: OrgUser): boolean => {
    const status = user.coachingStatus || (user.coaching ? 'active' : 'none');
    return status !== 'none';
  };

  // Get open action items count for a user
  const getOpenActionItems = (userId: string): number => {
    const data = coachingData.get(userId);
    if (!data?.actionItems) return 0;
    return data.actionItems.filter(item => !item.completed).length;
  };

  // Get sessions count for a user
  const getSessionsCount = (userId: string): number => {
    const data = coachingData.get(userId);
    return data?.sessionHistory?.length || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading clients...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-6">
        <p className="text-red-600 dark:text-red-300 font-albert mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-albert"
        >
          Retry
        </button>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert tracking-[-1px]">
          No clients yet
        </h2>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto">
          Users in your organization will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
            Clients
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">
            {filteredUsers.length} of {users.length} client{users.length !== 1 ? 's' : ''}
            {searchQuery && ' matching search'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 px-3 py-2 pl-9 border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a07855] dark:focus:ring-[#b8896a] font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#8c8c8c] dark:placeholder:text-[#7d8190]"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5f5a55] dark:text-[#7d8190]"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f5a55] dark:text-[#7d8190] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Clients List */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {filteredUsers.map((user, index) => {
          const userHasCoaching = hasCoaching(user);
          const openItems = getOpenActionItems(user.id);
          const sessionsCount = getSessionsCount(user.id);
          const coachingStatus = user.coachingStatus || (user.coaching ? 'active' : 'none');

          return (
            <button
              key={user.id}
              onClick={() => onSelectClient(user.id)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors text-left ${
                index !== filteredUsers.length - 1 ? 'border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50' : ''
              }`}
            >
              {/* Avatar */}
              <div className="shrink-0">
                {user.imageUrl ? (
                  <Image
                    src={user.imageUrl}
                    alt={user.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] dark:from-[#b8896a] dark:to-[#8c7a6d] flex items-center justify-center text-white font-albert font-semibold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              {/* Client Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                    {user.name}
                  </p>
                  {/* Coaching Status Badge */}
                  {userHasCoaching && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-albert ${getCoachingStatusBadgeColor(coachingStatus as CoachingStatus)}`}>
                      {formatCoachingStatus(coachingStatus as CoachingStatus)}
                    </span>
                  )}
                  {/* Tier Badge */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-albert ${getTierBadgeColor(user.tier || 'free')}`}>
                    {formatTierName(user.tier || 'free')}
                  </span>
                </div>
                <p className="font-albert text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                  {user.email}
                </p>
              </div>

              {/* Stats */}
              <div className="hidden sm:flex items-center gap-4 shrink-0 text-[#5f5a55] dark:text-[#b2b6c2]">
                {/* Open Action Items Count */}
                <div className="text-center">
                  <p className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {openItems}
                  </p>
                  <p className="font-albert text-[10px] uppercase tracking-wider">Open</p>
                </div>
                
                {/* Sessions Count */}
                <div className="text-center">
                  <p className="font-albert text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {sessionsCount}
                  </p>
                  <p className="font-albert text-[10px] uppercase tracking-wider">Sessions</p>
                </div>
              </div>

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-[#c4bfb9] dark:text-[#7d8190] shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Empty search state */}
      {filteredUsers.length === 0 && searchQuery && (
        <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl p-12 text-center">
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
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No clients found</p>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
            No clients match &quot;{searchQuery}&quot;
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 px-4 py-2 text-sm text-[#a07855] dark:text-[#b8896a] hover:bg-[#f3f1ef] dark:hover:bg-[#11141b] rounded-full font-albert transition-colors"
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
