'use client';

import React, { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { Loader2, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardStatsRow } from './DashboardStatsRow';
import { NeedsAttentionCard, type AttentionMember } from './NeedsAttentionCard';
import { TopPerformerCard, type TopPerformer } from './TopPerformerCard';
import { ContentCompletionList, type ContentCompletionItem } from './ContentCompletionList';
import { WeekProgressList, type WeekProgressItem } from './WeekProgressList';
import { CurrentWeekContent } from './CurrentWeekContent';
import { EngagementInsights } from './EngagementInsights';
import { UpcomingSection, type UpcomingItem, type PastSessionItem } from './UpcomingSection';
import { type DashboardViewContext } from './ClientCohortSelector';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { EventDetailPopup } from '@/components/scheduling/EventDetailPopup';
import { FillWeekPreviewModal } from '@/components/scheduling/FillWeekPreviewModal';
import { CallSummaryViewModal } from '../CallSummaryViewModal';
import type { Program, ProgramEnrollment, ProgramCohort, ProgramHabitTemplate, TaskDistribution, UnifiedEvent, CallSummary } from '@/types';

// API response types
interface ProgramDashboardData {
  programId: string;
  programName: string;
  programType: 'individual' | 'cohort';
  totalWeeks: number;
  stats: {
    activeClients: number;
    newThisWeek: number;
    avgTaskCompletion: number;
    taskCompletionRange: { min: number; max: number };
    avgStreak: number;
    bestStreak: number;
    contentCompletion: number;
    totalContentItems: number;
    completedContentItems: number;
  };
  needsAttention: AttentionMember[];
  topPerformers: TopPerformer[];
  contentCompletion: ContentCompletionItem[];
  upcoming: UpcomingItem[];
  pastSessions?: PastSessionItem[];
}

interface ClientDashboardData {
  userId: string;
  name: string;
  avatarUrl?: string;
  enrollmentId: string;
  instanceId?: string;
  stats: {
    overallProgress: number;
    currentWeek: number;
    totalWeeks: number;
    currentStreak: number;
    bestStreak: number;
    contentCompletion: number;
    totalContentItems: number;
    completedContentItems: number;
    callsCompleted?: number;
    totalCalls?: number;
  };
  weekProgress: WeekProgressItem[];
  currentWeekContent: {
    modules: Array<{
      moduleId: string;
      title: string;
      lessons: Array<{
        lessonId: string;
        title: string;
        completed: boolean;
        completedAt?: string;
      }>;
    }>;
    articles: Array<{
      articleId: string;
      title: string;
      completed: boolean;
      completedAt?: string;
    }>;
  };
  currentWeekProgramTasks?: {
    completed: number;
    total: number;
    tasks: Array<{ id: string; label: string; completed: boolean }>;
  };
  engagement: {
    taskVelocity: {
      completed: number;
      total: number;
      rate: number;
      trend: 'up' | 'down' | 'stable';
    };
    responseTime: {
      avgHours: number | null;
      sameDayPercent: number;
      bucket: 'same_day' | 'next_day' | 'delayed' | 'no_data';
    };
    consistency: {
      currentStreak: number;
      lastActiveDate: string | null;
      daysSinceActive: number;
      level: 'high' | 'moderate' | 'low' | 'inactive';
    };
    trend: {
      direction: 'improving' | 'stable' | 'declining';
      percentChange: number;
      warning: boolean;
    };
  };
  upcoming: UpcomingItem[];
  pastSessions?: PastSessionItem[];
}

interface EnrollmentWithUser extends ProgramEnrollment {
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
  };
}

interface ProgramDashboardProps {
  program: Program;
  enrollments: EnrollmentWithUser[];
  cohorts: ProgramCohort[];
  // URL state management
  initialClientId?: string;
  initialCohortId?: string;
  onViewContextChange?: (context: DashboardViewContext) => void;
  // Settings props (for collapsed settings section)
  onProgramUpdate?: (updates: Partial<Program>) => Promise<void>;
  className?: string;
}

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

export function ProgramDashboard({
  program,
  enrollments,
  cohorts,
  initialClientId,
  initialCohortId,
  onViewContextChange,
  onProgramUpdate,
  className,
}: ProgramDashboardProps) {
  // Determine initial view context
  const getInitialContext = (): DashboardViewContext => {
    if (initialClientId) {
      const enrollment = enrollments.find(e => e.userId === initialClientId);
      if (enrollment) {
        const name = enrollment.user?.firstName
          ? `${enrollment.user.firstName} ${enrollment.user.lastName || ''}`.trim()
          : enrollment.user?.email || 'Client';
        return { mode: 'client', clientId: initialClientId, clientName: name, enrollmentId: enrollment.id };
      }
    }
    if (initialCohortId) {
      const cohort = cohorts.find(c => c.id === initialCohortId);
      if (cohort) {
        return { mode: 'cohort', cohortId: initialCohortId, cohortName: cohort.name };
      }
    }
    return { mode: 'program' };
  };

  const [viewContext, setViewContext] = useState<DashboardViewContext>(getInitialContext);
  const [showSettings, setShowSettings] = useState(false);
  const [isNudging, setIsNudging] = useState<string | null>(null);
  const [nudgedUsers, setNudgedUsers] = useState<Set<string>>(new Set());

  // Event detail modal state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showEventDetailPopup, setShowEventDetailPopup] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [selectedEventHasSummary, setSelectedEventHasSummary] = useState<boolean | undefined>(undefined);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | undefined>(undefined);

  // Fill week modal state
  const [fillWeekEventId, setFillWeekEventId] = useState<string | null>(null);
  const [fillWeekSummary, setFillWeekSummary] = useState<CallSummary | null>(null);
  const [isFetchingSummary, setIsFetchingSummary] = useState(false);

  // Summary view modal state
  const [viewingSummary, setViewingSummary] = useState<CallSummary | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Sync viewContext when props change (header selector updates)
  React.useEffect(() => {
    const newContext = getInitialContext();
    // Only update if the context mode/ids actually changed
    if (
      newContext.mode !== viewContext.mode ||
      (newContext.mode === 'client' && viewContext.mode === 'client' && newContext.clientId !== viewContext.clientId) ||
      (newContext.mode === 'cohort' && viewContext.mode === 'cohort' && newContext.cohortId !== viewContext.cohortId)
    ) {
      setViewContext(newContext);
    }
  }, [initialClientId, initialCohortId]);

  // Settings state
  const [includeWeekends, setIncludeWeekends] = useState(program.includeWeekends ?? true);
  const [taskDistribution, setTaskDistribution] = useState<TaskDistribution>(
    program.taskDistribution || 'spread'
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const hasSettingsChanged =
    includeWeekends !== (program.includeWeekends ?? true) ||
    taskDistribution !== (program.taskDistribution || 'spread');

  // Handle view context change
  const handleViewContextChange = useCallback((context: DashboardViewContext) => {
    setViewContext(context);
    onViewContextChange?.(context);
  }, [onViewContextChange]);

  // Build API URLs
  // For program mode, fetch all enrollments; for cohort mode, filter by cohortId
  const programDashboardUrl = useMemo(() => {
    if (viewContext.mode === 'program') {
      return `/api/coach/org-programs/${program.id}/dashboard`;
    }
    if (viewContext.mode === 'cohort') {
      return `/api/coach/org-programs/${program.id}/dashboard?cohortId=${viewContext.cohortId}`;
    }
    return null;
  }, [viewContext.mode, viewContext.mode === 'cohort' ? viewContext.cohortId : null, program.id]);

  const clientDashboardUrl = viewContext.mode === 'client'
    ? `/api/coach/org-programs/${program.id}/dashboard/client/${viewContext.clientId}`
    : null;

  // Fetch program/cohort-wide data
  const { data: programData, isLoading: programLoading, mutate: mutateProgramData } = useSWR<ProgramDashboardData>(
    programDashboardUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch client-specific data
  const { data: clientData, isLoading: clientLoading, mutate: mutateClientData } = useSWR<ClientDashboardData>(
    clientDashboardUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = ((viewContext.mode === 'program' || viewContext.mode === 'cohort') && programLoading) ||
    (viewContext.mode === 'client' && clientLoading);

  // Handle nudge action
  const handleNudge = useCallback(async (userId: string): Promise<boolean> => {
    setIsNudging(userId);
    try {
      const response = await fetch('/api/coach/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          programId: program.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send nudge');
      }

      // Track successful nudge
      setNudgedUsers(prev => new Set([...prev, userId]));
      console.log('[NUDGE] Successfully sent nudge to', userId);
      return true;
    } catch (error) {
      console.error('[NUDGE] Error:', error);
      return false;
    } finally {
      setIsNudging(null);
    }
  }, [program.id]);

  // Handle view client from dashboard cards
  const handleViewClient = useCallback((userId: string) => {
    const enrollment = enrollments.find(e => e.userId === userId);
    if (enrollment) {
      const name = enrollment.user?.firstName
        ? `${enrollment.user.firstName} ${enrollment.user.lastName || ''}`.trim()
        : enrollment.user?.email || 'Client';
      handleViewContextChange({
        mode: 'client',
        clientId: userId,
        clientName: name,
        enrollmentId: enrollment.id,
      });
    }
  }, [enrollments, handleViewContextChange]);

  // Save settings
  const handleSaveSettings = useCallback(async () => {
    if (!onProgramUpdate || !hasSettingsChanged) return;
    setIsSavingSettings(true);
    try {
      await onProgramUpdate({
        includeWeekends,
        taskDistribution,
      });
    } finally {
      setIsSavingSettings(false);
    }
  }, [onProgramUpdate, hasSettingsChanged, includeWeekends, taskDistribution]);

  // Handle clicking on a past session
  const handlePastSessionClick = useCallback(async (item: PastSessionItem, clickPosition?: { x: number; y: number }) => {
    setSelectedEventId(item.eventId);
    setPopupPosition(clickPosition);
    // Store hasSummary from the item (already verified by API)
    setSelectedEventHasSummary(item.hasSummary);

    // Fetch full event data first, then show popup
    try {
      const response = await fetch(`/api/events/${item.eventId}`);
      if (response.ok) {
        const data = await response.json();
        const eventData = data.event || data;
        if (eventData?.id && eventData?.startDateTime) {
          setSelectedEvent(eventData);
          setShowEventDetailPopup(true);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to fetch event:', err);
    }

    // Fallback: show minimal event if fetch fails
    const minimalEvent: UnifiedEvent = {
      id: item.eventId,
      title: item.title,
      startDateTime: item.date,
      eventType: item.eventType || 'coaching_1on1',
    } as UnifiedEvent;
    setSelectedEvent(minimalEvent);
    setShowEventDetailPopup(true);
  }, []);

  // Handle summary generated - refresh the dashboard data
  const handleSummaryGenerated = useCallback(() => {
    // Mutate both endpoints to refresh data
    mutateProgramData();
    mutateClientData();
  }, [mutateProgramData, mutateClientData]);

  // Handle fill week - fetch summary and open modal
  const handleFillWeek = useCallback(async (eventId: string) => {
    setIsFetchingSummary(true);
    try {
      const response = await fetch(`/api/events/${eventId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setFillWeekSummary(data.summary);
        setFillWeekEventId(eventId);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setIsFetchingSummary(false);
    }
  }, []);

  // Handle view summary - fetch summary and open CallSummaryViewModal directly
  const handleViewSummary = useCallback(async (summaryId: string) => {
    try {
      const response = await fetch(`/api/coach/call-summaries/${summaryId}`);
      if (!response.ok) {
        console.error('Failed to fetch summary');
        return;
      }
      const data = await response.json();
      if (data.summary) {
        setViewingSummary(data.summary);
        setIsSummaryModalOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  // Enrich pastSessions with onClick, onSummaryGenerated, onFillWeek, and onViewSummary handlers
  const enrichPastSessions = useCallback((sessions?: PastSessionItem[]): PastSessionItem[] | undefined => {
    if (!sessions) return undefined;
    return sessions.map(item => ({
      ...item,
      onClick: (e: React.MouseEvent) => handlePastSessionClick(item, { x: e.clientX, y: e.clientY }),
      onSummaryGenerated: handleSummaryGenerated,
      onFillWeek: item.hasSummary ? () => handleFillWeek(item.eventId) : undefined,
      onViewSummary: item.hasSummary && item.summaryId ? () => handleViewSummary(item.summaryId!) : undefined,
    }));
  }, [handlePastSessionClick, handleSummaryGenerated, handleFillWeek, handleViewSummary]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
        </div>
      )}

      {/* Program-wide view */}
      {!isLoading && viewContext.mode === 'program' && programData && (
        <div className="space-y-6">
          {/* Stats row */}
          <DashboardStatsRow mode="program" stats={programData.stats} />

          {/* Row 1: Upcoming + Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingSection items={programData.upcoming} pastItems={enrichPastSessions(programData.pastSessions)} />
            <TopPerformerCard
              performers={programData.topPerformers}
              onViewClient={handleViewClient}
            />
          </div>

          {/* Row 2: Content Completion + Needs Attention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContentCompletionList items={programData.contentCompletion} />
            <NeedsAttentionCard
              members={programData.needsAttention}
              onNudge={handleNudge}
              onViewClient={handleViewClient}
              isNudging={isNudging}
              nudgedUsers={nudgedUsers}
            />
          </div>
        </div>
      )}

      {/* Client view */}
      {!isLoading && viewContext.mode === 'client' && clientData && (
        <div className="space-y-6">
          {/* Stats row */}
          <DashboardStatsRow mode="client" stats={clientData.stats} />

          {/* Row 1: Upcoming + Week Progress side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingSection items={clientData.upcoming} pastItems={enrichPastSessions(clientData.pastSessions)} />
            <WeekProgressList
              weeks={clientData.weekProgress}
              currentWeek={clientData.stats.currentWeek}
              thisWeekTasks={
                clientData.currentWeekProgramTasks && clientData.currentWeekProgramTasks.total > 0
                  ? clientData.currentWeekProgramTasks
                  : undefined
              }
              daysRemainingInWeek={(() => {
                const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday
                // Week ends Friday (5). Sat/Sun = 0 days remaining
                if (today === 0 || today === 6) return 0; // Weekend
                return 5 - today; // Mon=4, Tue=3, Wed=2, Thu=1, Fri=0
              })()}
              totalProgramWeeks={(() => {
                // Calculate total weeks INCLUDING onboarding (week 0) and closing (week -1)
                // The API gives us stats.totalWeeks which excludes special weeks
                // Add 2 for onboarding and closing
                return clientData.stats.totalWeeks + 2;
              })()}
              programEndDate={(() => {
                // Calculate end date from enrollment start + program length
                const enrollment = enrollments.find(e => e.id === clientData.enrollmentId);
                if (enrollment) {
                  const startDate = new Date(enrollment.startedAt || enrollment.createdAt || new Date());
                  const endDate = new Date(startDate);
                  endDate.setDate(endDate.getDate() + (program.lengthDays || 60));
                  return endDate.toISOString().split('T')[0];
                }
                return undefined;
              })()}
            />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CurrentWeekContent
              weekNumber={clientData.stats.currentWeek}
              modules={clientData.currentWeekContent.modules}
              articles={clientData.currentWeekContent.articles}
            />
            <EngagementInsights
              taskVelocity={clientData.engagement.taskVelocity}
              responseTime={clientData.engagement.responseTime}
              consistency={clientData.engagement.consistency}
              trend={clientData.engagement.trend}
            />
          </div>
        </div>
      )}

      {/* Cohort view - use program data for now */}
      {!isLoading && viewContext.mode === 'cohort' && programData && (
        <div className="space-y-6">
          <DashboardStatsRow mode="program" stats={programData.stats} />

          {/* Row 1: Upcoming + Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingSection items={programData.upcoming} pastItems={enrichPastSessions(programData.pastSessions)} />
            <TopPerformerCard
              performers={programData.topPerformers}
              onViewClient={handleViewClient}
            />
          </div>

          {/* Row 2: Content Completion + Needs Attention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContentCompletionList items={programData.contentCompletion} />
            <NeedsAttentionCard
              members={programData.needsAttention}
              onNudge={handleNudge}
              onViewClient={handleViewClient}
              isNudging={isNudging}
              nudgedUsers={nudgedUsers}
            />
          </div>
        </div>
      )}

      {/* Empty state when no data */}
      {!isLoading && viewContext.mode === 'program' && !programData && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#f3f1ef] dark:bg-[#262b35] flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-[#a7a39e] dark:text-[#5f6470]" />
          </div>
          <p className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            No dashboard data available
          </p>
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] mt-1">
            Enroll clients to see program analytics
          </p>
        </div>
      )}


      {/* Event Detail Popup for 1:1 calls */}
      {selectedEvent && showEventDetailPopup && (
        <EventDetailPopup
          event={selectedEvent}
          isOpen={showEventDetailPopup}
          onClose={() => {
            setShowEventDetailPopup(false);
            setSelectedEvent(null);
            setSelectedEventId(null);
            setSelectedEventHasSummary(undefined);
            setPopupPosition(undefined);
          }}
          isHost={true}
          position={popupPosition}
          hasSummaryOverride={selectedEventHasSummary}
          onViewSummary={(summaryId) => {
            setShowEventDetailPopup(false);
            handleViewSummary(summaryId);
          }}
        />
      )}

      {/* Fill Week Preview Modal */}
      {fillWeekEventId && (
        <FillWeekPreviewModal
          isOpen={!!fillWeekEventId}
          onClose={() => {
            setFillWeekEventId(null);
            setFillWeekSummary(null);
          }}
          eventId={fillWeekEventId}
          summary={fillWeekSummary}
          onFilled={() => {
            setFillWeekEventId(null);
            setFillWeekSummary(null);
            // Refresh dashboard data
            mutateProgramData();
            mutateClientData();
          }}
        />
      )}

      {/* Call Summary View Modal */}
      <CallSummaryViewModal
        summary={viewingSummary}
        isOpen={isSummaryModalOpen}
        onClose={() => {
          setIsSummaryModalOpen(false);
          setViewingSummary(null);
        }}
        entityName={viewContext.mode === 'client' ? viewContext.clientName : viewContext.mode === 'cohort' ? viewContext.cohortName : undefined}
      />
    </div>
  );
}
