'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Video,
  MessageCircle,
  User,
  Plus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Globe,
  Search,
  X,
  CalendarClock,
} from 'lucide-react';
import { useSchedulingEvents, usePendingProposals, useSchedulingActions } from '@/hooks/useScheduling';
import { ScheduleCallModal } from './ScheduleCallModal';
import { EventDetailPopup } from './EventDetailPopup';
import { CounterProposeModal } from './CounterProposeModal';
import type { UnifiedEvent, ClientCoachingData, FirebaseUser } from '@/types';

// Client type for picker
interface CoachingClient {
  id: string;
  userId: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

type ViewMode = 'month' | 'week' | 'day';

interface CalendarViewProps {
  /** Whether this is the coach view (shows all events) or user view (shows user's events) */
  mode?: 'coach' | 'user';
  /** Callback when a time slot is clicked to schedule */
  onScheduleClick?: (date: Date) => void;
}

const VIEW_MODES = [
  { value: 'month' as ViewMode, label: 'Month' },
  { value: 'week' as ViewMode, label: 'Week' },
  { value: 'day' as ViewMode, label: 'Day' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Event type colors
const EVENT_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  coaching_1on1: {
    bg: 'bg-brand-accent/10',
    border: 'border-brand-accent/30',
    text: 'text-brand-accent',
  },
  squad_call: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
  },
  workshop: {
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-300',
  },
  community_event: {
    bg: 'bg-green-100 dark:bg-green-900/20',
    border: 'border-green-300 dark:border-green-700',
    text: 'text-green-700 dark:text-green-300',
  },
};

// Colors for pending proposals (override event type colors)
const PENDING_COLORS = {
  bg: 'bg-red-100 dark:bg-red-900/20',
  border: 'border-red-300 dark:border-red-700',
  text: 'text-red-700 dark:text-red-300',
};

// Scheduling status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  confirmed: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  proposed: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
  pending_response: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertCircle },
  counter_proposed: { bg: 'bg-orange-100', text: 'text-orange-700', icon: AlertCircle },
  declined: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', icon: XCircle },
};

interface EventCardProps {
  event: UnifiedEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onRespond?: (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => void;
  onCounterPropose?: (eventId: string) => void;
}

function EventCard({ event, compact = false, onClick, onRespond, onCounterPropose }: EventCardProps) {
  // Check if this is a pending proposal
  const isPending = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';

  // Use pending colors for pending events, otherwise use event type colors
  const typeColors = isPending ? PENDING_COLORS : (EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.coaching_1on1);
  const statusInfo = event.schedulingStatus ? STATUS_COLORS[event.schedulingStatus] : null;
  const StatusIcon = statusInfo?.icon || CheckCircle;

  const startTime = new Date(event.startDateTime);
  const endTime = event.endDateTime ? new Date(event.endDateTime) : null;

  // Get pending proposed times
  const pendingProposedTimes = event.proposedTimes?.filter(t => t.status === 'pending') || [];

  // Strip "Call request with" prefix from title for cleaner display
  const displayTitle = event.title?.replace(/^Call request with\s*/i, '') || event.title;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatProposedTime = (time: { startDateTime: string; endDateTime: string }) => {
    const start = new Date(time.startDateTime);
    const end = new Date(time.endDateTime);
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dateStr} at ${formatTime(start)} - ${formatTime(end)}`;
  };

  if (compact) {
    // For pending proposals, show "Pending - Name" format
    const compactLabel = isPending
      ? `Pending - ${displayTitle}`
      : `${formatTime(startTime)} ${displayTitle}`;

    return (
      <div
        className={`px-2 py-1 rounded text-xs font-albert truncate ${typeColors.bg} ${typeColors.border} border ${typeColors.text} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        title={compactLabel}
        onClick={onClick}
      >
        {compactLabel}
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl ${typeColors.bg} ${typeColors.border} border`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-albert font-medium truncate ${typeColors.text}`}>
            {displayTitle}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
            <Clock className="w-3 h-3" />
            <span>
              {formatTime(startTime)}
              {endTime && ` - ${formatTime(endTime)}`}
            </span>
          </div>
          {event.eventType === 'coaching_1on1' && event.attendeeIds.length > 0 && (
            <div className="flex items-center gap-2 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <User className="w-3 h-3" />
              <span>1-on-1 Call</span>
            </div>
          )}
          {event.eventType === 'squad_call' && (
            <div className="flex items-center gap-2 mt-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
              <Users className="w-3 h-3" />
              <span>Squad Call</span>
            </div>
          )}
        </div>
        {statusInfo && (
          <div className={`flex-shrink-0 p-1 rounded-full ${statusInfo.bg}`}>
            <StatusIcon className={`w-3 h-3 ${statusInfo.text}`} />
          </div>
        )}
      </div>

      {/* Action buttons for pending proposals */}
      {(event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed') && onRespond && (
        <div className="flex flex-col gap-2 mt-3">
          {/* Show proposed times with individual Accept buttons */}
          {pendingProposedTimes.length > 0 ? (
            <>
              <p className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                {pendingProposedTimes.length} proposed time{pendingProposedTimes.length > 1 ? 's' : ''}:
              </p>
              {pendingProposedTimes.map((time) => (
                <div
                  key={time.id}
                  className="flex items-center justify-between p-2 bg-white/50 dark:bg-[#1e222a]/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                    <CalendarIcon className="w-3 h-3" />
                    <span>{formatProposedTime(time)}</span>
                  </div>
                  <button
                    onClick={() => onRespond(event.id, 'accept', time.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 transition-colors"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Accept
                  </button>
                </div>
              ))}
            </>
          ) : (
            /* Fallback if no proposed times - use first time slot */
            <button
              onClick={() => onRespond(event.id, 'accept', event.proposedTimes?.[0]?.id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Accept
            </button>
          )}
          <button
            onClick={() => onRespond(event.id, 'decline')}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
          >
            <XCircle className="w-3 h-3" />
            Decline All
          </button>
          {onCounterPropose && (
            <button
              onClick={() => onCounterPropose(event.id)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-lg text-xs font-medium hover:bg-[#e8e4df] dark:hover:bg-[#313746] transition-colors"
            >
              <CalendarClock className="w-3 h-3" />
              Propose Different Time
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ClientPickerModal
 * Modal for selecting a client to schedule a call with
 */
function ClientPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (client: CoachingClient) => void;
}) {
  const [clients, setClients] = useState<CoachingClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    async function fetchClients() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/coaching/clients');
        if (!response.ok) throw new Error('Failed to fetch clients');
        const data = await response.json();
        setClients(data.clients || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setIsLoading(false);
      }
    }

    fetchClients();
  }, [isOpen]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => {
      const name = `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.toLowerCase();
      const email = (client.user?.email || '').toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [clients, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md max-h-[80vh] flex flex-col bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Select Client
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a7a39e] dark:text-[#7d8190]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 bg-[#f3f1ef] dark:bg-[#1e222a] border border-transparent rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
          </div>
        </div>

        {/* Client List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
              {searchQuery ? 'No clients match your search' : 'No coaching clients found'}
            </p>
          ) : (
            <div className="space-y-2">
              {filteredClients.map((client) => {
                const name = `${client.user?.firstName || ''} ${client.user?.lastName || ''}`.trim() || 'Unknown';
                return (
                  <button
                    key={client.id}
                    onClick={() => onSelect(client)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors text-left"
                  >
                    {client.user?.imageUrl ? (
                      <Image
                        src={client.user.imageUrl}
                        alt={name}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-accent/20 flex items-center justify-center">
                        <User className="w-5 h-5 text-brand-accent" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] truncate">
                        {name}
                      </p>
                      {client.user?.email && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] truncate">
                          {client.user.email}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * CalendarView
 * 
 * A full calendar view for coaches and users to see their scheduled events.
 * Supports month, week, and day views.
 */
export function CalendarView({ mode = 'coach', onScheduleClick }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Event detail popup states
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRespondLoading, setIsRespondLoading] = useState(false);

  // Counter-propose modal states
  const [counterProposeEvent, setCounterProposeEvent] = useState<UnifiedEvent | null>(null);
  const [isCounterProposing, setIsCounterProposing] = useState(false);
  const [counterProposeError, setCounterProposeError] = useState<string | null>(null);

  // Client picker and schedule modal states
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<CoachingClient | null>(null);

  const { respondToProposal } = useSchedulingActions();

  // Handle client selection from picker
  const handleClientSelect = useCallback((client: CoachingClient) => {
    setSelectedClient(client);
    setShowClientPicker(false);
    setShowScheduleModal(true);
  }, []);

  // Handle schedule modal close
  const handleScheduleModalClose = useCallback(() => {
    setShowScheduleModal(false);
    setSelectedClient(null);
  }, []);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() + (6 - dayOfWeek));
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };
  }, [currentDate, viewMode]);

  // Fetch events
  const { events, isLoading, error, refetch } = useSchedulingEvents({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    role: mode === 'coach' ? 'host' : 'all',
  });

  // Handle schedule success (defined after refetch is available)
  const handleScheduleSuccess = useCallback(() => {
    setShowScheduleModal(false);
    setSelectedClient(null);
    refetch(); // Refresh calendar events
  }, [refetch]);

  // Pending proposals
  const { proposals, refetch: refetchProposals } = usePendingProposals();

  // Merge events with proposals for grid display
  const allEventsForGrid = useMemo(() => {
    // Combine regular events with proposals
    // Use a Set to avoid duplicates (in case proposals overlap with events)
    const eventIds = new Set(events.map(e => e.id));
    const uniqueProposals = proposals.filter(p => !eventIds.has(p.id));
    return [...events, ...uniqueProposals];
  }, [events, proposals]);

  // Group all events (including proposals) by date
  const eventsByDate = useMemo(() => {
    const grouped: Record<string, UnifiedEvent[]> = {};
    for (const event of allEventsForGrid) {
      const dateKey = new Date(event.startDateTime).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    }
    // Sort events within each day - pending first, then by time
    for (const dateKey in grouped) {
      grouped[dateKey].sort((a, b) => {
        const aIsPending = a.schedulingStatus === 'proposed' || a.schedulingStatus === 'counter_proposed';
        const bIsPending = b.schedulingStatus === 'proposed' || b.schedulingStatus === 'counter_proposed';
        // Pending events first
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        // Then by time
        return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
      });
    }
    return grouped;
  }, [allEventsForGrid]);

  // Navigation
  const navigate = useCallback((direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const newDate = new Date(currentDate);
    const delta = direction === 'prev' ? -1 : 1;

    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + delta);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + delta * 7);
    } else {
      newDate.setDate(newDate.getDate() + delta);
    }

    setCurrentDate(newDate);
  }, [currentDate, viewMode]);

  // Handle event click - show detail popup
  const handleEventClick = useCallback((event: UnifiedEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEvent(event);
    // Get position for desktop popup - use click coordinates directly
    setPopupPosition({ x: e.clientX, y: e.clientY + 8 });
  }, []);;;;

  // Handle respond to proposal
  const handleRespond = useCallback(async (eventId: string, action: 'accept' | 'decline', selectedTimeId?: string) => {
    setIsRespondLoading(true);
    try {
      await respondToProposal({ eventId, action, selectedTimeId });
      setSelectedEvent(null);
      refetch();
      refetchProposals();
    } catch (err) {
      // Error handled by hook
    } finally {
      setIsRespondLoading(false);
    }
  }, [respondToProposal, refetch, refetchProposals]);

  // Handle counter-propose - open modal
  const handleCounterPropose = useCallback((eventId: string) => {
    const event = allEventsForGrid.find(e => e.id === eventId) || proposals.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(null); // Close detail popup
      setCounterProposeEvent(event);
      setCounterProposeError(null);
    }
  }, [allEventsForGrid, proposals]);

  // Handle counter-propose submission
  const handleCounterProposeSubmit = useCallback(async (
    proposedTimes: Array<{ startDateTime: string; endDateTime: string }>,
    message?: string
  ) => {
    if (!counterProposeEvent) return;

    setIsCounterProposing(true);
    setCounterProposeError(null);

    try {
      await respondToProposal({
        eventId: counterProposeEvent.id,
        action: 'counter',
        counterTimes: proposedTimes,
        message,
      });
      setCounterProposeEvent(null);
      refetch();
      refetchProposals();
    } catch (err) {
      setCounterProposeError(err instanceof Error ? err.message : 'Failed to submit counter-proposal');
      throw err;
    } finally {
      setIsCounterProposing(false);
    }
  }, [counterProposeEvent, respondToProposal, refetch, refetchProposals]);

  // Generate calendar grid for month view
  const calendarDays = useMemo(() => {
    if (viewMode !== 'month') return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    
    // Add days from previous month
    const startDay = firstDay.getDay();
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      days.push({ date, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i);
      days.push({ date, isCurrentMonth: true });
    }
    
    // Add days from next month to complete the grid
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate, viewMode]);

  // Header title based on view mode
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
  }, [currentDate, viewMode]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="space-y-6">
      {/* Pending Proposals Alert */}
      {proposals.length > 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-albert font-medium text-yellow-800 dark:text-yellow-200">
                {proposals.length} pending proposal{proposals.length !== 1 ? 's' : ''} awaiting response
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Review and respond to call requests below
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('prev')}
              className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('today')}
              className="px-3 py-1.5 text-sm font-albert font-medium rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigate('next')}
              className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            {headerTitle}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Schedule Call Button (coach mode only) */}
          {mode === 'coach' && (
            <button
              onClick={() => setShowClientPicker(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[#6b6560] dark:text-[#9ca3af] hover:bg-[#ebe8e4] dark:hover:bg-[#262b35] hover:text-[#1a1a1a] dark:hover:text-white rounded-lg font-albert font-medium text-[15px] transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Schedule Call
            </button>
          )}

          {/* View mode toggle */}
          <div className="flex p-1 bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg">
            {VIEW_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setViewMode(value)}
                className={`px-3 py-1.5 rounded-md font-albert text-sm font-medium transition-colors ${
                  viewMode === value
                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      ) : viewMode === 'month' ? (
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[#e1ddd8] dark:border-[#262b35]">
            {DAYS_OF_WEEK.map(day => (
              <div
                key={day}
                className="px-3 py-2 text-center text-sm font-albert font-medium text-[#5f5a55] dark:text-[#b2b6c2]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, index) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentDay = isToday(date);

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-b border-r border-[#e1ddd8] dark:border-[#262b35] last:border-r-0 [&:nth-child(7n)]:border-r-0 ${
                    !isCurrentMonth ? 'bg-[#f9f8f7] dark:bg-[#11141b]' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full font-albert text-sm mb-1 ${
                      isCurrentDay
                        ? 'bg-brand-accent text-white'
                        : isCurrentMonth
                        ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                        : 'text-[#a7a39e] dark:text-[#7d8190]'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        compact
                        onClick={(e) => handleEventClick(event, e)}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Week/Day view - show events in time slots */
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                No events scheduled for this {viewMode}.
              </p>
            ) : (
              events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRespond={handleRespond}
                  onCounterPropose={handleCounterPropose}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-accent/20 border border-brand-accent/40" />
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">1-on-1 Calls</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Squad Calls</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700" />
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Workshops</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
          <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Events</span>
        </div>
      </div>

      {/* Client Picker Modal */}
      <ClientPickerModal
        isOpen={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        onSelect={handleClientSelect}
      />

      {/* Schedule Call Modal */}
      {selectedClient && (
        <ScheduleCallModal
          isOpen={showScheduleModal}
          onClose={handleScheduleModalClose}
          clientId={selectedClient.userId}
          clientName={`${selectedClient.user?.firstName || ''} ${selectedClient.user?.lastName || ''}`.trim() || 'Client'}
          onSuccess={handleScheduleSuccess}
        />
      )}

      {/* Event Detail Popup */}
      {selectedEvent && (
        <EventDetailPopup
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRespond={handleRespond}
          onCounterPropose={handleCounterPropose}
          isLoading={isRespondLoading}
          position={popupPosition || undefined}
        />
      )}

      {/* Counter-Propose Modal */}
      {counterProposeEvent && (
        <CounterProposeModal
          isOpen={!!counterProposeEvent}
          onClose={() => setCounterProposeEvent(null)}
          event={counterProposeEvent}
          onSubmit={handleCounterProposeSubmit}
          isLoading={isCounterProposing}
          error={counterProposeError}
        />
      )}
    </div>
  );
}

