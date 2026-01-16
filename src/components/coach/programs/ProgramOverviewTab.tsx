'use client';

import React, { useState, useCallback } from 'react';
import {
  Settings,
  Repeat,
  Calendar,
  Users,
  Plus,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
  BookOpen,
  FileText,
  Download,
  Link2,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Program, ProgramHabitTemplate, TaskDistribution, ProgramEnrollment, DiscoverArticle, DiscoverDownload, DiscoverLink } from '@/types';
import type { DiscoverCourse } from '@/types/discover';
import { ResourceLinkDropdown } from './ResourceLinkDropdown';

interface MemberToWatch {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
  reason: 'top_performer' | 'needs_attention';
  metric: string; // e.g., "95% completion" or "Inactive 5 days"
}

interface ProgramOverviewTabProps {
  program: Program;
  onProgramUpdate: (updates: Partial<Program>) => Promise<void>;
  // For members to watch
  enrollments?: ProgramEnrollment[];
  membersToWatch?: MemberToWatch[];
  isLoadingMembers?: boolean;
  // Available resources for linking
  availableArticles?: DiscoverArticle[];
  availableDownloads?: DiscoverDownload[];
  availableLinks?: DiscoverLink[];
  availableCourses?: DiscoverCourse[];
}

export function ProgramOverviewTab({
  program,
  onProgramUpdate,
  enrollments = [],
  membersToWatch = [],
  isLoadingMembers = false,
  availableArticles = [],
  availableDownloads = [],
  availableLinks = [],
  availableCourses = [],
}: ProgramOverviewTabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [newHabit, setNewHabit] = useState('');

  // Local state for editable settings
  const [includeWeekends, setIncludeWeekends] = useState(program.includeWeekends ?? true);
  const [taskDistribution, setTaskDistribution] = useState<TaskDistribution>(
    program.taskDistribution || 'spread'
  );
  const [habits, setHabits] = useState<ProgramHabitTemplate[]>(program.defaultHabits || []);

  // Local state for resources
  const [linkedArticleIds, setLinkedArticleIds] = useState<string[]>(program.linkedArticleIds || []);
  const [linkedDownloadIds, setLinkedDownloadIds] = useState<string[]>(program.linkedDownloadIds || []);
  const [linkedLinkIds, setLinkedLinkIds] = useState<string[]>(program.linkedLinkIds || []);
  const [linkedCourseIds, setLinkedCourseIds] = useState<string[]>(program.linkedCourseIds || []);

  // Track if settings have changed
  const hasSettingsChanged =
    includeWeekends !== (program.includeWeekends ?? true) ||
    taskDistribution !== (program.taskDistribution || 'spread');

  const hasHabitsChanged = JSON.stringify(habits) !== JSON.stringify(program.defaultHabits || []);

  const hasResourcesChanged =
    JSON.stringify(linkedArticleIds) !== JSON.stringify(program.linkedArticleIds || []) ||
    JSON.stringify(linkedDownloadIds) !== JSON.stringify(program.linkedDownloadIds || []) ||
    JSON.stringify(linkedLinkIds) !== JSON.stringify(program.linkedLinkIds || []) ||
    JSON.stringify(linkedCourseIds) !== JSON.stringify(program.linkedCourseIds || []);

  const hasChanges = hasSettingsChanged || hasHabitsChanged || hasResourcesChanged;

  // Save settings
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Program> = {};
      if (hasSettingsChanged) {
        updates.includeWeekends = includeWeekends;
        updates.taskDistribution = taskDistribution;
      }
      if (hasHabitsChanged) {
        updates.defaultHabits = habits;
      }
      if (hasResourcesChanged) {
        updates.linkedArticleIds = linkedArticleIds;
        updates.linkedDownloadIds = linkedDownloadIds;
        updates.linkedLinkIds = linkedLinkIds;
        updates.linkedCourseIds = linkedCourseIds;
      }
      await onProgramUpdate(updates);
    } finally {
      setIsSaving(false);
    }
  }, [hasSettingsChanged, hasHabitsChanged, hasResourcesChanged, includeWeekends, taskDistribution, habits, linkedArticleIds, linkedDownloadIds, linkedLinkIds, linkedCourseIds, onProgramUpdate]);

  // Add habit
  const addHabit = useCallback(() => {
    if (!newHabit.trim()) return;
    setHabits([...habits, { title: newHabit.trim(), frequency: 'daily' }]);
    setNewHabit('');
  }, [newHabit, habits]);

  // Remove habit
  const removeHabit = useCallback((index: number) => {
    setHabits(habits.filter((_, i) => i !== index));
  }, [habits]);

  // Update habit frequency
  const updateHabitFrequency = useCallback(
    (index: number, frequency: ProgramHabitTemplate['frequency']) => {
      const updated = [...habits];
      updated[index] = { ...updated[index], frequency };
      setHabits(updated);
    },
    [habits]
  );

  const topPerformers = membersToWatch.filter((m) => m.reason === 'top_performer');
  const needsAttention = membersToWatch.filter((m) => m.reason === 'needs_attention');

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      {/* Program Settings Section */}
      <CollapsibleSection
        title="Program Settings"
        icon={Settings}
        description="Default behavior for this program"
        defaultOpen={true}
      >
        <div className="space-y-5">
          {/* Task Distribution */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              Default Task Distribution
            </label>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
              How weekly tasks are spread across days by default
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTaskDistribution('spread')}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all font-albert',
                  taskDistribution === 'spread'
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f7f5f3] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f0ede9] dark:hover:bg-[#1e222a]'
                )}
              >
                Spread Evenly
              </button>
              <button
                type="button"
                onClick={() => setTaskDistribution('repeat-daily')}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all font-albert',
                  taskDistribution === 'repeat-daily'
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f7f5f3] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f0ede9] dark:hover:bg-[#1e222a]'
                )}
              >
                Repeat Daily
              </button>
            </div>
          </div>

          {/* Include Weekends */}
          <div>
            <label className="block text-sm font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
              <Calendar className="w-4 h-4 inline mr-1.5" />
              Include Weekends
            </label>
            <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-3">
              Whether tasks appear on Saturdays and Sundays
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIncludeWeekends(true)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all font-albert',
                  includeWeekends
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f7f5f3] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f0ede9] dark:hover:bg-[#1e222a]'
                )}
              >
                7 Days
              </button>
              <button
                type="button"
                onClick={() => setIncludeWeekends(false)}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all font-albert',
                  !includeWeekends
                    ? 'bg-brand-accent text-white'
                    : 'bg-[#f7f5f3] dark:bg-[#11141b] text-[#5f5a55] dark:text-[#b2b6c2] hover:bg-[#f0ede9] dark:hover:bg-[#1e222a]'
                )}
              >
                Weekdays Only
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Program Habits Section */}
      <CollapsibleSection
        title="Program Habits"
        icon={Repeat}
        description="Daily habits for all enrolled members"
        defaultOpen={true}
      >
        <div className="space-y-3">
          {habits.length === 0 ? (
            <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] italic text-center py-4">
              No habits defined. Add habits to help clients build routines.
            </p>
          ) : (
            <div className="space-y-2">
              {habits.map((habit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-[#f7f5f3] dark:bg-[#11141b] rounded-xl group"
                >
                  <Repeat className="w-4 h-4 text-brand-accent flex-shrink-0" />
                  <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {habit.title}
                  </span>
                  <select
                    value={habit.frequency}
                    onChange={(e) =>
                      updateHabitFrequency(index, e.target.value as ProgramHabitTemplate['frequency'])
                    }
                    className="text-xs px-2 py-1 rounded-lg border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1e222a] text-[#5f5a55] dark:text-[#b2b6c2] font-albert"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekday">Weekdays</option>
                    <option value="custom">Custom</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeHabit(index)}
                    className="p-1.5 text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add habit input */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              placeholder="Add a habit..."
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-lg font-albert text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190]"
            />
            <Button onClick={addHabit} variant="outline" size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Program Resources Section */}
      <CollapsibleSection
        title="Program Resources"
        icon={BookOpen}
        description="Resources available throughout the program"
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Courses */}
          <ResourceSection
            icon={GraduationCap}
            title="Courses"
            linkedIds={linkedCourseIds}
            availableItems={availableCourses}
            onAdd={(id) => setLinkedCourseIds([...linkedCourseIds, id])}
            onRemove={(id) => setLinkedCourseIds(linkedCourseIds.filter((i) => i !== id))}
            getTitle={(item) => item.title}
            emptyMessage="No courses linked"
          />

          {/* Articles */}
          <ResourceSection
            icon={FileText}
            title="Articles"
            linkedIds={linkedArticleIds}
            availableItems={availableArticles}
            onAdd={(id) => setLinkedArticleIds([...linkedArticleIds, id])}
            onRemove={(id) => setLinkedArticleIds(linkedArticleIds.filter((i) => i !== id))}
            getTitle={(item) => item.title}
            emptyMessage="No articles linked"
          />

          {/* Downloads */}
          <ResourceSection
            icon={Download}
            title="Downloads"
            linkedIds={linkedDownloadIds}
            availableItems={availableDownloads}
            onAdd={(id) => setLinkedDownloadIds([...linkedDownloadIds, id])}
            onRemove={(id) => setLinkedDownloadIds(linkedDownloadIds.filter((i) => i !== id))}
            getTitle={(item) => item.title}
            emptyMessage="No downloads linked"
          />

          {/* Links */}
          <ResourceSection
            icon={Link2}
            title="Links"
            linkedIds={linkedLinkIds}
            availableItems={availableLinks}
            onAdd={(id) => setLinkedLinkIds([...linkedLinkIds, id])}
            onRemove={(id) => setLinkedLinkIds(linkedLinkIds.filter((i) => i !== id))}
            getTitle={(item) => item.title}
            emptyMessage="No links added"
          />

          {availableArticles.length === 0 &&
            availableDownloads.length === 0 &&
            availableLinks.length === 0 &&
            availableCourses.length === 0 && (
              <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] italic text-center py-4">
                Create resources in the Discover tab to link them here.
              </p>
            )}
        </div>
      </CollapsibleSection>

      {/* Members to Watch Section */}
      <CollapsibleSection
        title="Members to Watch"
        icon={Users}
        description="Top performers and those needing attention"
        defaultOpen={true}
      >
        {isLoadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        ) : membersToWatch.length === 0 ? (
          <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] italic text-center py-4">
            {enrollments.length === 0
              ? 'No members enrolled yet.'
              : 'Member insights will appear here as activity is tracked.'}
          </p>
        ) : (
          <div className="space-y-5">
            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Top Performers
                  </span>
                </div>
                <div className="space-y-2">
                  {topPerformers.map((member) => (
                    <MemberCard key={member.userId} member={member} variant="success" />
                  ))}
                </div>
              </div>
            )}

            {/* Needs Attention */}
            {needsAttention.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    Needs Attention
                  </span>
                </div>
                <div className="space-y-2">
                  {needsAttention.map((member) => (
                    <MemberCard key={member.userId} member={member} variant="warning" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Save Button - Fixed at bottom */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Member card component
function MemberCard({
  member,
  variant,
}: {
  member: MemberToWatch;
  variant: 'success' | 'warning';
}) {
  const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border',
        variant === 'success'
          ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200/50 dark:border-green-800/30'
          : 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30'
      )}
    >
      <Avatar className="w-9 h-9">
        <AvatarImage src={member.imageUrl} alt={`${member.firstName} ${member.lastName}`} />
        <AvatarFallback
          className={cn(
            'text-xs font-medium',
            variant === 'success'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          )}
        >
          {initials || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
          {member.firstName} {member.lastName}
        </p>
        <p
          className={cn(
            'text-xs font-albert',
            variant === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-amber-600 dark:text-amber-400'
          )}
        >
          {member.metric}
        </p>
      </div>
      {variant === 'success' ? (
        <TrendingUp className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : (
        <TrendingDown className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
    </div>
  );
}

// Resource section component for program-level resources
function ResourceSection<T extends { id: string }>({
  icon: Icon,
  title,
  linkedIds,
  availableItems,
  onAdd,
  onRemove,
  getTitle,
  emptyMessage,
}: {
  icon: React.ElementType;
  title: string;
  linkedIds: string[];
  availableItems: T[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  getTitle: (item: T) => string;
  emptyMessage: string;
}) {
  const linkedItems = linkedIds
    .map((id) => availableItems.find((item) => item.id === id))
    .filter((item): item is T => item !== undefined);

  const availableToLink = availableItems.filter((item) => !linkedIds.includes(item.id));

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[#8c8c8c] dark:text-[#7d8190]" />
        <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
          {title}
        </span>
        {linkedIds.length > 0 && (
          <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">({linkedIds.length})</span>
        )}
      </div>

      {/* Linked items */}
      {linkedItems.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {linkedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 bg-[#f7f5f3] dark:bg-[#11141b] rounded-lg group"
            >
              <Icon className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
              <span className="flex-1 text-sm text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate">
                {getTitle(item)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="p-1 text-[#a7a39e] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add dropdown */}
      {availableToLink.length > 0 ? (
        <select
          className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onAdd(e.target.value);
            }
          }}
        >
          <option value="">Add {title.toLowerCase()}...</option>
          {availableToLink.map((item) => (
            <option key={item.id} value={item.id}>
              {getTitle(item)}
            </option>
          ))}
        </select>
      ) : linkedIds.length === 0 ? (
        <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] italic">{emptyMessage}</p>
      ) : null}
    </div>
  );
}
