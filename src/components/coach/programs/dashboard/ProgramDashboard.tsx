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
import { UpcomingSection, type UpcomingItem } from './UpcomingSection';
import { type DashboardViewContext } from './ClientCohortSelector';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import type { Program, ProgramEnrollment, ProgramCohort, ProgramHabitTemplate, TaskDistribution } from '@/types';

// API response types
interface ProgramDashboardData {
  programId: string;
  programName: string;
  programType: 'individual' | 'cohort';
  totalWeeks: number;
  stats: {
    activeClients: number;
    newThisWeek: number;
    avgProgress: number;
    progressRange: { min: number; max: number };
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
  engagement: {
    reWatched: Array<{ contentId: string; title: string; count: number }>;
    reRead: Array<{ contentId: string; title: string; count: number }>;
    mostActiveDays: string[];
    mostActiveHours: string;
    pattern?: string;
  };
  upcoming: UpcomingItem[];
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
  const programDashboardUrl = viewContext.mode === 'program'
    ? `/api/coach/org-programs/${program.id}/dashboard`
    : null;

  const clientDashboardUrl = viewContext.mode === 'client'
    ? `/api/coach/org-programs/${program.id}/dashboard/client/${viewContext.clientId}`
    : null;

  // Fetch program-wide data
  const { data: programData, isLoading: programLoading } = useSWR<ProgramDashboardData>(
    programDashboardUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Fetch client-specific data
  const { data: clientData, isLoading: clientLoading } = useSWR<ClientDashboardData>(
    clientDashboardUrl,
    fetcher,
    { revalidateOnFocus: false }
  );

  const isLoading = (viewContext.mode === 'program' && programLoading) ||
    (viewContext.mode === 'client' && clientLoading);

  // Handle nudge action
  const handleNudge = useCallback(async (userId: string) => {
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

      // Could show a success toast here
      console.log('[NUDGE] Successfully sent nudge to', userId);
    } catch (error) {
      console.error('[NUDGE] Error:', error);
      // Could show an error toast here
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

          {/* Two-column layout for attention/performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NeedsAttentionCard
              members={programData.needsAttention}
              onNudge={handleNudge}
              onViewClient={handleViewClient}
              isNudging={isNudging}
            />
            <TopPerformerCard
              performers={programData.topPerformers}
              onViewClient={handleViewClient}
            />
          </div>

          {/* Content completion */}
          <ContentCompletionList items={programData.contentCompletion} />

          {/* Upcoming */}
          <UpcomingSection items={programData.upcoming} />
        </div>
      )}

      {/* Client view */}
      {!isLoading && viewContext.mode === 'client' && clientData && (
        <div className="space-y-6">
          {/* Stats row */}
          <DashboardStatsRow mode="client" stats={clientData.stats} />

          {/* Week progress */}
          <WeekProgressList
            weeks={clientData.weekProgress}
            currentWeek={clientData.stats.currentWeek}
          />

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CurrentWeekContent
              weekNumber={clientData.stats.currentWeek}
              modules={clientData.currentWeekContent.modules}
              articles={clientData.currentWeekContent.articles}
            />
            <EngagementInsights
              reWatched={clientData.engagement.reWatched}
              reRead={clientData.engagement.reRead}
              mostActiveDays={clientData.engagement.mostActiveDays}
              mostActiveHours={clientData.engagement.mostActiveHours}
              pattern={clientData.engagement.pattern}
            />
          </div>

          {/* Upcoming */}
          <UpcomingSection items={clientData.upcoming} />
        </div>
      )}

      {/* Cohort view - use program data for now */}
      {!isLoading && viewContext.mode === 'cohort' && programData && (
        <div className="space-y-6">
          <DashboardStatsRow mode="program" stats={programData.stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NeedsAttentionCard
              members={programData.needsAttention}
              onNudge={handleNudge}
              onViewClient={handleViewClient}
              isNudging={isNudging}
            />
            <TopPerformerCard
              performers={programData.topPerformers}
              onViewClient={handleViewClient}
            />
          </div>
          <ContentCompletionList items={programData.contentCompletion} />
          <UpcomingSection items={programData.upcoming} />
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

      {/* Collapsed settings section */}
      {onProgramUpdate && (
        <div className="border-t border-[#e1ddd8] dark:border-[#262b35] pt-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Program Settings</span>
            {showSettings ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showSettings && (
            <div className="mt-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] space-y-4">
              {/* Task Distribution */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Task Distribution
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskDistribution('spread')}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all font-albert',
                      taskDistribution === 'spread'
                        ? 'bg-brand-accent text-white'
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35]'
                    )}
                  >
                    Spread Evenly
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskDistribution('repeat-daily')}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all font-albert',
                      taskDistribution === 'repeat-daily'
                        ? 'bg-brand-accent text-white'
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35]'
                    )}
                  >
                    Repeat Daily
                  </button>
                </div>
              </div>

              {/* Include Weekends */}
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Include Weekends
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIncludeWeekends(true)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all font-albert',
                      includeWeekends
                        ? 'bg-brand-accent text-white'
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35]'
                    )}
                  >
                    7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setIncludeWeekends(false)}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all font-albert',
                      !includeWeekends
                        ? 'bg-brand-accent text-white'
                        : 'bg-white dark:bg-[#171b22] text-[#5f5a55] dark:text-[#b2b6c2] border border-[#e1ddd8] dark:border-[#262b35]'
                    )}
                  >
                    Weekdays Only
                  </button>
                </div>
              </div>

              {/* Save button */}
              {hasSettingsChanged && (
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="w-full px-4 py-2 bg-brand-accent text-white rounded-lg text-sm font-medium hover:bg-brand-accent/90 transition-colors disabled:opacity-50"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
