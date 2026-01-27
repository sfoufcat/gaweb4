'use client';

/**
 * UpcomingProgramView Component
 *
 * Clean, simple view for enrolled users whose program hasn't started yet.
 */

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, ChevronDown, Clock, Users, User, FileText, Video, Link2, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { EnrolledProgramWithDetails } from '@/hooks/useMyPrograms';
import type { ProgramWeek, ProgramModule } from '@/types';

interface UpcomingProgramViewProps {
  program: EnrolledProgramWithDetails;
  onBack?: () => void;
  showBackButton?: boolean;
}

function formatStartDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupWeeksByModule(
  weeks: ProgramWeek[],
  modules: ProgramModule[]
): Map<string, ProgramWeek[]> {
  const grouped = new Map<string, ProgramWeek[]>();

  if (!modules || modules.length === 0) {
    grouped.set('__no_module__', weeks);
    return grouped;
  }

  for (const week of weeks) {
    const moduleId = week.moduleId || '__no_module__';
    const existing = grouped.get(moduleId) || [];
    existing.push(week);
    grouped.set(moduleId, existing);
  }

  return grouped;
}

interface ResourcePreview {
  type: 'course' | 'article' | 'download' | 'link' | 'video' | 'questionnaire';
  title: string;
}

function getModuleResources(moduleWeeks: ProgramWeek[]): ResourcePreview[] {
  const resources: ResourcePreview[] = [];

  for (const week of moduleWeeks) {
    // Check resourceAssignments first (newer format)
    if (week.resourceAssignments) {
      for (const assignment of week.resourceAssignments) {
        if (assignment.title && resources.length < 2) {
          resources.push({
            type: assignment.resourceType,
            title: assignment.title,
          });
        }
      }
    }

    if (resources.length >= 2) break;
  }

  return resources;
}

function getResourceIcon(type: ResourcePreview['type']) {
  switch (type) {
    case 'course':
      return BookOpen;
    case 'video':
      return Video;
    case 'article':
    case 'download':
      return FileText;
    case 'link':
      return Link2;
    default:
      return FileText;
  }
}

export function UpcomingProgramView({
  program: enrolled,
  onBack,
  showBackButton = true,
}: UpcomingProgramViewProps) {
  const { program, enrollment, cohort } = enrolled;

  const startDate = cohort?.startDate || enrollment.startedAt;
  const formattedStartDate = formatStartDate(startDate);

  const weeks = program.weeks || [];
  const modules = program.modules || [];

  const weeksByModule = useMemo(
    () => groupWeeksByModule(weeks, modules),
    [weeks, modules]
  );

  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.slice(0, 1).map((m) => m.id))
  );

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  const hasWeeks = weeks.length > 0;
  const hasModules = modules.length > 0;

  return (
    <div className="space-y-6">
      {/* Header: Back + Title + Badge */}
      <div className="flex items-center gap-3">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#2a303c] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary dark:text-[#f5f5f8]" />
          </button>
        )}
        <h1 className="font-albert text-[32px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.2]">
          {program.name}
        </h1>
        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Enrolled
        </Badge>
      </div>

      {/* Description */}
      {program.description && (
        <p className="font-albert text-[15px] text-text-secondary dark:text-[#a7a39e] leading-relaxed">
          {program.description}
        </p>
      )}

      {/* Cover Image */}
      <div className="relative h-[200px] w-full rounded-[20px] overflow-hidden bg-[#f5f3f0] dark:bg-[#171b22]">
        {program.coverImageUrl ? (
          <Image
            src={program.coverImageUrl}
            alt={program.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="font-albert text-[48px] font-bold text-text-muted/50 dark:text-[#7d8190]/50">
              {program.name[0]}
            </span>
          </div>
        )}
      </div>

      {/* Program Starts Card */}
      <div className="relative rounded-[20px] p-6 overflow-hidden bg-white/70 dark:bg-[#1c2026]/70 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <p className="font-albert text-[13px] text-text-muted dark:text-[#7d8190]">
              Program starts on
            </p>
            <p className="font-albert text-[20px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
              {formattedStartDate}
            </p>
          </div>
        </div>
      </div>

      {/* Coach Card */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
        <div className="flex items-center gap-3">
          <Avatar className="w-11 h-11">
            <AvatarImage src={program.coachImageUrl} alt={program.coachName} />
            <AvatarFallback className="bg-brand-accent/10 text-brand-accent font-medium">
              {program.coachName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-albert text-[12px] text-text-muted dark:text-[#7d8190]">Your coach</p>
            <p className="font-albert text-[16px] font-medium text-text-primary dark:text-[#f5f5f8]">{program.coachName}</p>
          </div>
        </div>
      </div>

      {/* Program Overview */}
      {hasWeeks ? (
        <div className="space-y-4">
          <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
            Program overview
          </h2>

          {hasModules ? (
            <div className="space-y-3">
              {modules.map((module, index) => {
                const moduleWeeks = weeksByModule.get(module.id) || [];
                const isExpanded = expandedModules.has(module.id);
                const moduleResources = getModuleResources(moduleWeeks);

                return (
                  <div
                    key={module.id}
                    className="bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden"
                  >
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#f5f3f0] dark:hover:bg-[#1c2129] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-full bg-brand-accent/10 dark:bg-brand-accent/20 flex items-center justify-center text-[13px] font-semibold text-brand-accent">
                          {index + 1}
                        </span>
                        <span className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px]">
                          {module.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-albert text-[13px] text-text-muted dark:text-[#7d8190]">
                          {moduleWeeks.length} week{moduleWeeks.length !== 1 ? 's' : ''}
                        </span>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                        </motion.div>
                      </div>
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-2 border-t border-[#f0ede8] dark:border-[#2a303c]">
                            {moduleWeeks.map((week) => (
                              <div
                                key={week.id}
                                className="flex items-center py-2.5"
                              >
                                <span className="font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px]">
                                  {week.name || `Week ${week.weekNumber}`}
                                </span>
                                {week.theme && (
                                  <span className="font-albert text-[13px] text-text-muted dark:text-[#7d8190] ml-2">
                                    — {week.theme}
                                  </span>
                                )}
                              </div>
                            ))}

                            {/* Resources Preview - inline on one row, no divider */}
                            {moduleResources.length > 0 && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                                <span className="font-albert text-[11px] font-medium text-text-muted dark:text-[#7d8190] uppercase tracking-wider">
                                  Resources
                                </span>
                                {moduleResources.map((resource, idx) => {
                                  const Icon = getResourceIcon(resource.type);
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      <Icon className="w-3.5 h-3.5 text-brand-accent flex-shrink-0" />
                                      <span className="font-albert text-[13px] text-text-secondary dark:text-[#a7a39e]">
                                        {resource.title}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#171b22] rounded-[16px] px-5 py-2">
              {weeks.map((week) => (
                <div
                  key={week.id}
                  className="flex items-center py-2.5"
                >
                  <span className="font-albert text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px]">
                    {week.name || `Week ${week.weekNumber}`}
                  </span>
                  {week.theme && (
                    <span className="font-albert text-[13px] text-text-muted dark:text-[#7d8190] ml-2">
                      — {week.theme}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-8 text-center">
          <Calendar className="w-10 h-10 text-text-muted dark:text-[#7d8190] mx-auto mb-3" />
          <p className="font-albert text-[16px] font-medium text-text-primary dark:text-[#f5f5f8]">Program details coming soon</p>
          <p className="font-sans text-[14px] text-text-muted dark:text-[#7d8190] mt-1">
            Your coach is preparing the content.
          </p>
        </div>
      )}

      {/* Program Details Card */}
      <div className="bg-white dark:bg-[#171b22] rounded-[20px] p-4">
        <div className="flex items-center gap-6">
          {/* Duration */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-accent" />
            <span className="font-albert text-[14px] text-text-secondary dark:text-[#a7a39e]">
              {program.lengthDays} days
              {program.lengthWeeks && ` (${program.lengthWeeks} weeks)`}
            </span>
          </div>

          <div className="h-5 w-px bg-[#e8e4df] dark:bg-[#2a303c]" />

          {/* Type */}
          <div className="flex items-center gap-2">
            {program.type === 'group' ? (
              <Users className="w-4 h-4 text-brand-accent" />
            ) : (
              <User className="w-4 h-4 text-brand-accent" />
            )}
            <span className="font-albert text-[14px] text-text-secondary dark:text-[#a7a39e]">
              {program.type === 'group' ? 'Group' : '1:1'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
