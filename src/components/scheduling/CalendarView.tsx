'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
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
import { useOrgCredits } from '@/hooks/useOrgCredits';
import { ScheduleCallModal } from './ScheduleCallModal';
import { EventDetailPopup } from './EventDetailPopup';
import { CounterProposeModal } from './CounterProposeModal';
import type { UnifiedEvent, ClientCoachingData, FirebaseUser } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

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
  cohort_call: {
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    border: 'border-purple-300 dark:border-purple-700',
    text: 'text-purple-700 dark:text-purple-300',
  },
  squad_call: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
  },
  community_event: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
  },
};

// Colors for pending proposals (override event type colors)
const PENDING_COLORS = {
  bg: 'bg-yellow-100 dark:bg-yellow-900/20',
  border: 'border-yellow-300 dark:border-yellow-700',
  text: 'text-yellow-700 dark:text-yellow-300',
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
  hasOrgCredits?: boolean;
  isCoach?: boolean;
}

function EventCard({ event, compact = false, onClick, onRespond, onCounterPropose, hasOrgCredits = true, isCoach = false }: EventCardProps) {
  // Safety check for required event properties
  if (!event || !event.startDateTime) {
    console.error('[EventCard] Invalid event data:', event);
    return null;
  }

  // Check if this is a pending proposal
  const isPending = event.schedulingStatus === 'proposed' || event.schedulingStatus === 'counter_proposed';
  const isConfirmed = event.schedulingStatus === 'confirmed';
  // Show credit warning for coaches on confirmed in-app calls when no credits
  const showCreditWarning = isCoach && isConfirmed && !hasOrgCredits && !event.meetingLink;

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
        className={`px-2 py-1 rounded text-xs font-albert truncate ${typeColors.bg} ${typeColors.border} border ${typeColors.text} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${showCreditWarning ? 'ring-2 ring-red-400 ring-offset-1' : ''}`}
        title={showCreditWarning ? `${compactLabel} (No Credits)` : compactLabel}
        onClick={onClick}
      >
        {showCreditWarning && <AlertCircle className="w-3 h-3 inline mr-1 text-red-500" />}
        {compactLabel}
      </div>
    );
  }

  return (
    <div
      className={`p-3 rounded-xl ${typeColors.bg} ${typeColors.border} border ${showCreditWarning ? 'ring-2 ring-red-400' : ''}`}
    >
      {/* Credit warning for coaches */}
      {showCreditWarning && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>No Credits - Add external link or buy credits</span>
        </div>
      )}
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
  const isDesktop = useMediaQuery('(min-width: 768px)');

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

  // Shared content for both Dialog and Drawer
  const modalContent = (
    <div className="flex flex-col flex-1 min-h-0">
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

      {/* Safe area for mobile */}
      {!isDesktop && <div className="h-6" />}
    </div>
  );

  if (!isOpen) return null;

  // Desktop: Use Dialog
  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md p-0 gap-0 overflow-hidden rounded-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <DialogTitle className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Select Client
            </DialogTitle>
            <DialogDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              Choose a client to schedule a call with
            </DialogDescription>
          </DialogHeader>
          {modalContent}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile: Use Drawer (bottom sheet)
  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh] flex flex-col">
        <DrawerHeader className="px-6 pb-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <DrawerTitle className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
            Select Client
          </DrawerTitle>
          <DrawerDescription className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
            Choose a client to schedule a call with
          </DrawerDescription>
        </DrawerHeader>
        {modalContent}
      </DrawerContent>
    </Drawer>
  );
}

/**
 * CalendarView
 * 
 * A full calendar view for coaches and users to see their scheduled events.
 * Supports month, week, and day views.
 */
export function CalendarView({ mode = 'coach', onScheduleClick }: CalendarViewProps) {
  const { user } = useUser();
  const currentUserId = user?.id;

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Check org credits for coaches (to show warnings on events)
  const isCoach = mode === 'coach';
  const { hasCredits: orgHasCredits } = useOrgCredits(isCoach);

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
      // Safety check: skip events without valid startDateTime
      if (!event || !event.startDateTime) {
        console.error('[CalendarView] Skipping event with missing startDateTime:', event?.id);
        continue;
      }
      // Use local date, not UTC date, so events display on the correct calendar day
      const eventDate = new Date(event.startDateTime);
      const dateKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
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

  // Week days for week view timeline
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate, viewMode]);

  // Header title based on view mode (mobile-friendly)
  const headerTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      // Shorter format for mobile
      return isMobile
        ? `${MONTHS[weekStart.getMonth()].slice(0,3)} ${weekStart.getDate()}-${weekEnd.getDate()}`
        : `${MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('en-US', {
        weekday: isMobile ? 'short' : 'long',
        month: isMobile ? 'short' : 'long',
        day: 'numeric',
      });
    }
  }, [currentDate, viewMode, isMobile]);

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

      {/* Header - Mobile-first single row */}
      <div className="flex items-center justify-between gap-2">
        {/* Navigation + Title */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('prev')}
            className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('today')}
            className="px-2 py-1 font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-lg transition-colors"
          >
            {headerTitle}
          </button>
          <button
            onClick={() => navigate('next')}
            className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode + Schedule Button */}
        <div className="flex items-center gap-2">
          {/* Desktop: Expanded view mode buttons */}
          <div className="hidden md:flex items-center bg-[#f3f1ef] dark:bg-[#1e222a] rounded-lg p-1">
            {VIEW_MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setViewMode(value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === value
                    ? 'bg-white dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] shadow-sm'
                    : 'text-[#666] dark:text-[#9ca3af] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Mobile: Compact dropdown */}
          <div className="md:hidden">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[90px] h-9 text-sm bg-[#f3f1ef] dark:bg-[#1e222a] border-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEW_MODES.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'coach' && (
            <>
              {/* Desktop: Full button */}
              <button
                onClick={() => setShowClientPicker(true)}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule Call
              </button>
              {/* Mobile: Icon only */}
              <button
                onClick={() => setShowClientPicker(true)}
                className="md:hidden p-2 bg-brand-accent text-white rounded-lg hover:opacity-90 transition-opacity"
                title="Schedule Call"
              >
                <Plus className="w-5 h-5" />
              </button>
            </>
          )}
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
        <>
          {/* Mobile: Compact Grid + Agenda */}
          {isMobile ? (
            <div className="flex flex-col gap-4">
              {/* Compact Month Grid */}
              <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-3">
                {/* Single-letter day headers */}
                <div className="grid grid-cols-7 mb-2">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-center text-xs font-medium text-[#a7a39e] dark:text-[#7d8190]">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Compact date grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    const dayEvents = eventsByDate[dateKey] || [];
                    const isSelected = selectedAgendaDate?.toDateString() === date.toDateString();
                    const isCurrentDay = isToday(date);
                    const hasPending = dayEvents.some(e => e.schedulingStatus === 'proposed' || e.schedulingStatus === 'counter_proposed');

                    // Get event dot colors based on event types
                    const eventDots = dayEvents.slice(0, 3).map(e => {
                      if (e.schedulingStatus === 'proposed' || e.schedulingStatus === 'counter_proposed') {
                        return 'bg-yellow-500';
                      }
                      switch (e.eventType) {
                        case 'coaching_1on1': return 'bg-brand-accent';
                        case 'squad_call': return 'bg-blue-500';
                        case 'community_event': return 'bg-green-500';
                        default: return 'bg-brand-accent';
                      }
                    });

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedAgendaDate(date)}
                        className={cn(
                          "aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors",
                          !isCurrentMonth && "text-[#d1cdc8] dark:text-[#4a5162]",
                          isCurrentMonth && !isSelected && "text-[#1a1a1a] dark:text-[#f5f5f8]",
                          isCurrentDay && !isSelected && "bg-brand-accent/10 text-brand-accent font-semibold",
                          isSelected && "bg-brand-accent text-white font-semibold",
                        )}
                      >
                        {date.getDate()}
                        {/* Event dots */}
                        {dayEvents.length > 0 && (
                          <div className="flex gap-0.5 mt-0.5">
                            {eventDots.map((dotColor, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "w-1 h-1 rounded-full",
                                  isSelected ? "bg-white" : dotColor
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agenda for Selected Date */}
              <div>
                {selectedAgendaDate ? (
                  <>
                    <h3 className="font-albert font-semibold text-lg text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                      {selectedAgendaDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    {(() => {
                      const dateKey = `${selectedAgendaDate.getFullYear()}-${String(selectedAgendaDate.getMonth() + 1).padStart(2, '0')}-${String(selectedAgendaDate.getDate()).padStart(2, '0')}`;
                      const agendaEvents = eventsByDate[dateKey] || [];
                      return agendaEvents.length === 0 ? (
                        <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                          No events scheduled
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {agendaEvents.map(event => (
                            <EventCard
                              key={event.id}
                              event={event}
                              onClick={(e) => handleEventClick(event, e)}
                              onRespond={event.proposedBy !== currentUserId ? handleRespond : undefined}
                              onCounterPropose={event.proposedBy !== currentUserId ? handleCounterPropose : undefined}
                              hasOrgCredits={orgHasCredits}
                              isCoach={isCoach}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-4">
                    Tap a date to see events
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Desktop: Original Grid View */
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
                  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
                            hasOrgCredits={orgHasCredits}
                            isCoach={isCoach}
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
          )}
        </>
      ) : viewMode === 'week' ? (
        /* Week view - timeline with day separators */
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
            {weekDays.map((day) => {
              const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateKey] || [];
              const isDayToday = isToday(day);
              const formattedDate = day.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div key={dateKey} className="py-2">
                  {/* Day separator */}
                  <div className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                    <span className={cn(
                      "text-sm font-medium whitespace-nowrap",
                      isDayToday ? "text-brand-accent font-semibold" : "text-[#5f5a55] dark:text-[#b2b6c2]"
                    )}>
                      {isDayToday ? 'Today' : formattedDate}
                    </span>
                    <div className="flex-1 h-px bg-[#e1ddd8] dark:bg-[#262b35]" />
                  </div>

                  {dayEvents.length === 0 ? (
                    <p className="text-center text-sm text-[#a7a39e] dark:text-[#7d8190] py-4">
                      No events
                    </p>
                  ) : (
                    <div className="space-y-2 px-4 pb-2">
                      {dayEvents.map(event => (
                        <EventCard
                          key={event.id}
                          event={event}
                          onClick={(e) => handleEventClick(event, e)}
                          onRespond={event.proposedBy !== currentUserId ? handleRespond : undefined}
                          onCounterPropose={event.proposedBy !== currentUserId ? handleCounterPropose : undefined}
                          hasOrgCredits={orgHasCredits}
                          isCoach={isCoach}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day view - show events for single day */
        <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4">
          <div className="space-y-4">
            {events.length === 0 ? (
              <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                No events scheduled for this day.
              </p>
            ) : (
              events.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  onRespond={event.proposedBy !== currentUserId ? handleRespond : undefined}
                  onCounterPropose={event.proposedBy !== currentUserId ? handleCounterPropose : undefined}
                  hasOrgCredits={orgHasCredits}
                  isCoach={isCoach}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Legend - hidden on mobile */}
      {!isMobile && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700" />
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-brand-accent/20 border border-brand-accent/40" />
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">1:1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700" />
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Program Calls</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700" />
            <span className="text-[#5f5a55] dark:text-[#b2b6c2]">Community Calls</span>
          </div>
        </div>
      )}

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
          // Only show respond buttons if user is NOT the proposer of this event
          onRespond={selectedEvent.proposedBy !== currentUserId ? handleRespond : undefined}
          onCounterPropose={selectedEvent.proposedBy !== currentUserId ? handleCounterPropose : undefined}
          isLoading={isRespondLoading}
          position={popupPosition || undefined}
          isHost={isCoach}
          onEventUpdated={refetch}
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

