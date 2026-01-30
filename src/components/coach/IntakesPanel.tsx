'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Phone,
  Calendar,
  Clock,
  Search,
  X,
  Loader2,
  UserCheck,
  ExternalLink,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  User,
  ChevronRight,
  Link2,
  Plus,
  UserPlus,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { ExpandableSearch } from '@/components/ui/expandable-search';
import { InviteClientsDialog } from './InviteClientsDialog';

interface IntakeEvent {
  id: string;
  prospectName?: string;
  prospectEmail?: string;
  prospectPhone?: string;
  startTime: string;
  endTime?: string;
  status: string;
  intakeCallConfigId?: string;
  intakeConfigName: string;
  intakeConfigDuration: number;
  convertedToUserId?: string;
  convertedAt?: string;
  derivedStatus: 'upcoming' | 'completed' | 'cancelled' | 'no-show' | 'converted';
  meetingLink?: string;
}

type FilterStatus = 'all' | 'upcoming' | 'completed' | 'cancelled' | 'no-show' | 'converted';

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  upcoming: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    icon: Clock,
    label: 'Upcoming',
  },
  completed: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    icon: CheckCircle,
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-gray-100 dark:bg-gray-800/30',
    text: 'text-gray-600 dark:text-gray-400',
    icon: XCircle,
    label: 'Cancelled',
  },
  'no-show': {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    icon: AlertTriangle,
    label: 'No-show',
  },
  converted: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: UserCheck,
    label: 'Converted',
  },
};

interface IntakesPanelProps {
  onSelectClient?: (clientId: string) => void;
}

export function IntakesPanel({ onSelectClient }: IntakesPanelProps) {
  const { isDemoMode } = useDemoMode();
  const [events, setEvents] = useState<IntakeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/coach/intake-events');
      if (!res.ok) throw new Error('Failed to fetch intake events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intakes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(e => e.derivedStatus === filterStatus);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => {
        const name = e.prospectName?.toLowerCase() || '';
        const email = e.prospectEmail?.toLowerCase() || '';
        return name.includes(query) || email.includes(query);
      });
    }

    return result;
  }, [events, filterStatus, searchQuery]);

  // Handle status updates
  const handleMarkNoShow = async (eventId: string) => {
    setIsUpdating(eventId);
    try {
      const res = await fetch(`/api/coach/intake-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'no_show' }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchEvents();
    } catch (err) {
      console.error('Failed to mark no-show:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleMarkConverted = async (eventId: string, userId: string) => {
    setIsUpdating(eventId);
    try {
      const res = await fetch(`/api/coach/intake-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convertedToUserId: userId }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await fetchEvents();
    } catch (err) {
      console.error('Failed to mark converted:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const upcoming = events.filter(e => e.derivedStatus === 'upcoming').length;
    const completed = events.filter(e => e.derivedStatus === 'completed').length;
    const converted = events.filter(e => e.derivedStatus === 'converted').length;
    const total = events.length;
    const conversionRate = completed + converted > 0 ? Math.round((converted / (completed + converted)) * 100) : 0;
    return { upcoming, completed, converted, total, conversionRate };
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">{error}</p>
        <button
          onClick={fetchEvents}
          className="mt-4 px-4 py-2 text-sm font-medium text-brand-accent hover:text-brand-accent/80 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1d222b] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#262b35]">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Total Intakes</p>
          <p className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-[#1d222b] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#262b35]">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Upcoming</p>
          <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400 font-albert">{stats.upcoming}</p>
        </div>
        <div className="bg-white dark:bg-[#1d222b] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#262b35]">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Converted</p>
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400 font-albert">{stats.converted}</p>
        </div>
        <div className="bg-white dark:bg-[#1d222b] rounded-xl p-4 border border-[#e1ddd8] dark:border-[#262b35]">
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Conversion Rate</p>
          <p className="text-2xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">{stats.conversionRate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center justify-between">
        {/* Mobile: Filter dropdown on left, Search + Add on right */}
        <div className="flex items-center justify-between w-full sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35] text-sm font-medium font-albert text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-[#262b35] transition-colors">
                <Filter className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                <span>{filterStatus === 'all' ? 'All' : STATUS_CONFIG[filterStatus]?.label || filterStatus}</span>
                <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-1.5 rounded-2xl bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] min-w-[140px]">
              {(['all', 'upcoming', 'completed', 'converted', 'no-show', 'cancelled'] as FilterStatus[]).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-sm font-medium font-albert cursor-pointer transition-colors',
                    filterStatus === status
                      ? 'bg-[#f5f3f0] dark:bg-[#262b35] text-[#1a1a1a] dark:text-white focus:bg-[#f5f3f0] dark:focus:bg-[#262b35] focus:text-[#1a1a1a] dark:focus:text-white'
                      : 'bg-transparent text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white'
                  )}
                >
                  {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Right side: Search + Add */}
          <div className="flex items-center gap-2">
            <ExpandableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by name or email..."
            />
            {/* Only show + button on mobile when there are intakes */}
            {events.length > 0 && (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-accent text-white hover:bg-brand-accent/90 transition-colors flex-shrink-0"
                title="Invite to intake call"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop: Status Filter Tabs */}
        <div className="hidden sm:flex gap-2 flex-wrap">
          {(['all', 'upcoming', 'completed', 'converted', 'no-show', 'cancelled'] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium font-albert transition-colors',
                filterStatus === status
                  ? 'bg-brand-accent text-white'
                  : 'bg-[#f5f3f0] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#ebe8e4] dark:hover:bg-[#2d333f]'
              )}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status]?.label || status}
            </button>
          ))}
        </div>

        {/* Desktop: Search and Add button */}
        <div className="hidden sm:flex items-center gap-3">
          <ExpandableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by name or email..."
          />
          {events.length > 0 && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-accent text-white hover:bg-brand-accent/90 transition-colors text-sm font-medium font-albert"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite</span>
            </button>
          )}
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f5f3f0] dark:bg-[#262b35] flex items-center justify-center mb-4">
            <Phone className="w-8 h-8 text-[#a7a39e] dark:text-[#7d8190]" />
          </div>
          <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            {events.length === 0 ? 'No intake calls yet' : 'No results found'}
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6 max-w-sm">
            {events.length === 0
              ? 'Invite prospects to book an intake call to start converting leads into clients.'
              : 'Try adjusting your filters or search query.'}
          </p>
          {events.length === 0 && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-accent text-white hover:bg-brand-accent/90 transition-colors text-sm font-medium font-albert shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite to Intake Call</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((event) => {
            const statusConfig = STATUS_CONFIG[event.derivedStatus];
            const StatusIcon = statusConfig?.icon || Clock;
            const startTime = parseISO(event.startTime);
            const isUpcoming = !isPast(startTime);

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-[#1d222b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Prospect Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                        {event.prospectName || 'Unknown'}
                      </h4>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert truncate">
                        {event.prospectEmail || 'No email'}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Call Info */}
                  <div className="hidden md:block text-center px-4">
                    <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                      {event.intakeConfigName}
                    </p>
                    <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      {event.intakeConfigDuration} min
                    </p>
                  </div>

                  {/* Right: Date/Time & Status */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                        {format(startTime, 'MMM d, yyyy')}
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                        {format(startTime, 'h:mm a')}
                        {isUpcoming && (
                          <span className="ml-1 text-blue-600 dark:text-blue-400">
                            ({formatDistanceToNow(startTime, { addSuffix: true })})
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        statusConfig?.bg,
                        statusConfig?.text
                      )}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig?.label}</span>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] rounded-lg transition-colors"
                          disabled={isUpdating === event.id}
                        >
                          {isUpdating === event.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#5f5a55]" />
                          ) : (
                            <MoreVertical className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {event.meetingLink && (
                          <DropdownMenuItem asChild>
                            <a href={event.meetingLink} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Join Meeting
                            </a>
                          </DropdownMenuItem>
                        )}
                        {event.derivedStatus === 'completed' && (
                          <DropdownMenuItem
                            onClick={() => {
                              // TODO: Open user search modal and pass selected userId
                              // For now, this is a placeholder
                              const userId = prompt('Enter client user ID to mark as converted:');
                              if (userId) {
                                handleMarkConverted(event.id, userId);
                              }
                            }}
                          >
                            <UserCheck className="w-4 h-4 mr-2" />
                            Mark as Converted
                          </DropdownMenuItem>
                        )}
                        {event.derivedStatus === 'completed' && !event.convertedToUserId && (
                          <DropdownMenuItem onClick={() => handleMarkNoShow(event.id)}>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Mark as No-show
                          </DropdownMenuItem>
                        )}
                        {event.convertedToUserId && onSelectClient && (
                          <DropdownMenuItem onClick={() => onSelectClient(event.convertedToUserId!)}>
                            <ChevronRight className="w-4 h-4 mr-2" />
                            View Client
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Mobile: Call Info */}
                <div className="md:hidden mt-3 pt-3 border-t border-[#e1ddd8] dark:border-[#262b35] flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{event.intakeConfigName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{event.intakeConfigDuration} min</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite Clients Dialog - opens with intake preselected */}
      <InviteClientsDialog
        isOpen={showInviteDialog}
        onClose={() => setShowInviteDialog(false)}
        initialTargetType="intake"
      />
    </div>
  );
}
