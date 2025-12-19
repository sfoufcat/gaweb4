'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Calendar, ChevronRight } from 'lucide-react';
import type { ClientCoachingData, FirebaseUser, CoachingPlanType } from '@/types';

interface CoachingClientWithUser extends ClientCoachingData {
  user?: Partial<FirebaseUser>;
}

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
  const [clients, setClients] = useState<CoachingClientWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading coaching clients...</p>
        </div>
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
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-3xl p-12 text-center">
        <div className="w-20 h-20 bg-[#f3f1ef] dark:bg-[#11141b] rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#a07855] dark:text-[#b8896a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3 font-albert tracking-[-1px]">
          No coaching clients yet
        </h2>
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert max-w-md mx-auto">
          When you&apos;re assigned 1:1 coaching clients, they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-0.5px]">
            Coaching Clients
          </h2>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm">
            {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchClients}
          className="px-4 py-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Clients List */}
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
        {clients.map((client, index) => (
          <button
            key={client.id}
            onClick={() => onSelectClient(client.id)}
            className={`w-full flex items-center gap-4 p-4 hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors text-left ${
              index !== clients.length - 1 ? 'border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50' : ''
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] dark:from-[#b8896a] dark:to-[#8c7a6d] flex items-center justify-center text-white font-albert font-semibold">
                  {client.user?.firstName?.charAt(0) || 'C'}
                </div>
              )}
            </div>

            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                  {client.user?.firstName} {client.user?.lastName}
                </p>
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
                  <Calendar className="w-3.5 h-3.5 text-[#a07855] dark:text-[#b8896a]" />
                  <span className="font-albert text-xs text-[#a07855] dark:text-[#b8896a]">
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


