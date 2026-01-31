'use client';

import { useState, useEffect } from 'react';
import { X, Heart, Activity, AlertCircle, AlertTriangle, Calendar, Clock, CheckCircle2, Target, TrendingUp, MessageCircle } from 'lucide-react';
import type { HealthStatus } from '@/lib/analytics/constants';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
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

interface ClientDetailData {
  tasksCompleted: number;
  tasksTotal: number;
  habitsCompleted: number;
  habitsTotal: number;
  checkinsCompleted: number;
  streakDays: number;
  weeklyActivity: number[];
  recentActivities: { type: string; label: string; date: string }[];
}

interface ClientDetailModalProps {
  client: ClientData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDemoMode?: boolean;
}

export function ClientDetailModal({ client, open, onOpenChange, isDemoMode = false }: ClientDetailModalProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [detailData, setDetailData] = useState<ClientDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);

  useEffect(() => {
    if (open && client && !isDemoMode) {
      fetchClientDetail();
    } else if (open && client && isDemoMode) {
      // Generate demo detail data
      setDetailData({
        tasksCompleted: Math.floor(Math.random() * 20) + 5,
        tasksTotal: 25,
        habitsCompleted: Math.floor(Math.random() * 15) + 3,
        habitsTotal: 21,
        checkinsCompleted: Math.floor(Math.random() * 7) + 1,
        streakDays: Math.floor(Math.random() * 14) + 1,
        weeklyActivity: Array.from({ length: 7 }, () => Math.floor(Math.random() * 5)),
        recentActivities: [
          { type: 'task', label: 'Completed morning routine', date: new Date().toISOString() },
          { type: 'habit', label: 'Meditation (5 min)', date: new Date(Date.now() - 86400000).toISOString() },
          { type: 'checkin', label: 'Weekly reflection', date: new Date(Date.now() - 172800000).toISOString() },
        ],
      });
    }
  }, [open, client, isDemoMode]);

  const fetchClientDetail = async () => {
    if (!client) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/coach/analytics/clients/${client.userId}`);
      if (response.ok) {
        const data = await response.json();
        setDetailData(data);
      }
    } catch (error) {
      console.error('Failed to fetch client detail:', error);
    } finally {
      setLoading(false);
    }
  };

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
      case 'thriving': return <Heart className="w-4 h-4" />;
      case 'active': return <Activity className="w-4 h-4" />;
      case 'inactive': return <AlertCircle className="w-4 h-4" />;
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

  const handleMessageClient = () => {
    if (isDemoMode) {
      alert('DM functionality is disabled in demo mode');
      return;
    }
    setShowDmModal(true);
  };

  if (!client) return null;

  const content = (
    <div className="space-y-6">
      {/* Client Header */}
      <div className="flex items-start gap-4">
        {client.avatarUrl ? (
          <img
            src={client.avatarUrl}
            alt={client.name}
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-accent to-[#8c6245] dark:from-[#b8896a] dark:to-brand-accent flex items-center justify-center text-white font-semibold text-xl">
            {client.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{client.name}</h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">{client.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${getStatusColor(client.status)}`}>
              {getStatusIcon(client.status)}
              <span className="capitalize">{client.status}</span>
            </span>
            {client.atRisk && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                At Risk
              </span>
            )}
          </div>
        </div>
        {!isDemoMode && (
          <button
            onClick={handleMessageClient}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Message
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Last Active</span>
          </div>
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{formatDate(client.lastActivityAt)}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Days Active</span>
          </div>
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{client.daysActiveInPeriod} / 7</p>
        </div>

        <div className="p-3 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Primary Signal</span>
          </div>
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] capitalize">{client.primarySignal || 'None'}</p>
        </div>

        <div className="p-3 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
            <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Member Since</span>
          </div>
          <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{formatDate(client.joinedAt)}</p>
        </div>
      </div>

      {/* Program & Community */}
      {(client.programName || client.squadName) && (
        <div className="p-4 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
          <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">Enrollment</h4>
          <div className="space-y-2">
            {client.programName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Program</span>
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{client.programName}</span>
              </div>
            )}
            {client.squadName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Community</span>
                <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{client.squadName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Progress */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : detailData && (
        <>
          <div className="p-4 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
            <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">Progress This Week</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Tasks</span>
                  <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{detailData.tasksCompleted}/{detailData.tasksTotal}</span>
                </div>
                <div className="h-2 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${(detailData.tasksCompleted / detailData.tasksTotal) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Habits</span>
                  <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{detailData.habitsCompleted}/{detailData.habitsTotal}</span>
                </div>
                <div className="h-2 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${(detailData.habitsCompleted / detailData.habitsTotal) * 100}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Check-ins</span>
                  <span className="text-xs font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">{detailData.checkinsCompleted}</span>
                </div>
                <div className="h-2 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((detailData.checkinsCompleted / 7) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {detailData.recentActivities.length > 0 && (
            <div className="p-4 rounded-xl bg-white/60 dark:bg-[#171b22]/60 border border-[#e1ddd8]/60 dark:border-[#262b35]/60">
              <h4 className="text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] mb-3">Recent Activity</h4>
              <div className="space-y-2">
                {detailData.recentActivities.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-3 py-2 border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{activity.label}</p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#faf8f6] dark:bg-[#11141b]">
            <DialogHeader>
              <DialogTitle className="sr-only">Client Details</DialogTitle>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>

        {showDmModal && client && (
          <SendDMModal
            recipients={[{
              userId: client.userId,
              name: client.name,
              email: client.email,
              avatarUrl: client.avatarUrl,
            }]}
            onClose={() => setShowDmModal(false)}
            onSuccess={(count) => {
              console.log(`Successfully sent ${count} messages`);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] bg-[#faf8f6] dark:bg-[#11141b]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Client Details</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 overflow-y-auto">
            {content}
          </div>
        </DrawerContent>
      </Drawer>

      {showDmModal && client && (
        <SendDMModal
          recipients={[{
            userId: client.userId,
            name: client.name,
            email: client.email,
            avatarUrl: client.avatarUrl,
          }]}
          onClose={() => setShowDmModal(false)}
          onSuccess={(count) => {
            console.log(`Successfully sent ${count} messages`);
          }}
        />
      )}
    </>
  );
}
