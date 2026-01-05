'use client';

/**
 * ModulePreviewSection Component
 *
 * Displays what's coming in the program: modules with expandable weeks.
 * Current module highlighted, future modules shown as locked previews.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Lock,
  CheckCircle,
  Circle,
  Calendar,
} from 'lucide-react';
import type { ProgramModule, ProgramWeek } from '@/types';

interface ModulePreviewSectionProps {
  modules: ProgramModule[];
  weeks: ProgramWeek[];
  currentModuleIndex: number;
  currentWeekIndex: number;
  programLengthDays: number;
}

export function ModulePreviewSection({
  modules,
  weeks,
  currentModuleIndex,
  currentWeekIndex,
  programLengthDays,
}: ModulePreviewSectionProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set([modules[currentModuleIndex]?.id].filter(Boolean))
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

  const getModuleWeeks = (moduleId: string) => {
    return weeks.filter((w) => w.moduleId === moduleId);
  };

  const getModuleStatus = (index: number) => {
    if (index < currentModuleIndex) return 'completed';
    if (index === currentModuleIndex) return 'current';
    return 'upcoming';
  };

  const getWeekStatus = (week: ProgramWeek) => {
    const globalWeekIndex = weeks.findIndex((w) => w.id === week.id);
    if (globalWeekIndex < currentWeekIndex) return 'completed';
    if (globalWeekIndex === currentWeekIndex) return 'current';
    return 'upcoming';
  };

  if (modules.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h2 className="font-albert text-[24px] font-medium text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] leading-[1.3]">
        Program Modules
      </h2>

      <div className="space-y-3">
        {modules.map((module, index) => {
          const status = getModuleStatus(index);
          const isExpanded = expandedModules.has(module.id);
          const moduleWeeks = getModuleWeeks(module.id);
          const isLocked = status === 'upcoming';

          return (
            <div
              key={module.id}
              className={`
                bg-white dark:bg-[#171b22] rounded-[16px] overflow-hidden
                border transition-all duration-200
                ${
                  status === 'current'
                    ? 'border-brand-accent/30 dark:border-brand-accent/40'
                    : 'border-transparent hover:border-[#e8e4df] dark:hover:border-[#2a303c]'
                }
              `}
            >
              {/* Module Header */}
              <button
                onClick={() => !isLocked && toggleModule(module.id)}
                disabled={isLocked}
                className={`
                  w-full px-5 py-4 flex items-center justify-between
                  ${isLocked ? 'cursor-default opacity-75' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Status Icon */}
                  <div
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${
                      status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : status === 'current'
                        ? 'bg-brand-accent/10 dark:bg-brand-accent/20'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }
                  `}
                  >
                    {status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : status === 'current' ? (
                      <Circle className="w-4 h-4 text-brand-accent fill-brand-accent/30" />
                    ) : (
                      <Lock className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                    )}
                  </div>

                  <div className="text-left">
                    <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] leading-[1.3]">
                      {isLocked && module.previewTitle
                        ? module.previewTitle
                        : module.name}
                    </h3>
                    {(isLocked ? module.previewDescription : module.description) && (
                      <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190] mt-0.5 line-clamp-1">
                        {isLocked ? module.previewDescription : module.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Week count */}
                  <span className="text-[12px] text-text-muted dark:text-[#7d8190]">
                    {moduleWeeks.length} week{moduleWeeks.length !== 1 ? 's' : ''}
                  </span>

                  {!isLocked && (
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-5 h-5 text-[#a7a39e] dark:text-[#7d8190]" />
                    </motion.div>
                  )}
                </div>
              </button>

              {/* Weeks List */}
              <AnimatePresence initial={false}>
                {isExpanded && !isLocked && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 space-y-2">
                      {moduleWeeks.map((week) => {
                        const weekStatus = getWeekStatus(week);

                        return (
                          <div
                            key={week.id}
                            className={`
                              flex items-center gap-3 p-3 rounded-[12px]
                              ${
                                weekStatus === 'current'
                                  ? 'bg-brand-accent/5 dark:bg-brand-accent/10'
                                  : 'bg-[#f9f8f7] dark:bg-[#11141b]'
                              }
                            `}
                          >
                            {/* Week status indicator */}
                            <div className="shrink-0">
                              {weekStatus === 'completed' ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : weekStatus === 'current' ? (
                                <div className="w-4 h-4 rounded-full border-2 border-brand-accent bg-brand-accent/30" />
                              ) : (
                                <Circle className="w-4 h-4 text-[#d4cfc9] dark:text-[#7d8190]" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-[14px] font-medium text-text-primary dark:text-[#f5f5f8] leading-[1.4]">
                                {week.name || `Week ${week.weekNumber}`}
                              </p>
                              {week.theme && (
                                <p className="font-sans text-[12px] text-text-muted dark:text-[#7d8190] mt-0.5">
                                  {week.theme}
                                </p>
                              )}
                            </div>

                            {/* Days range */}
                            <span className="shrink-0 flex items-center gap-1 text-[11px] text-text-muted dark:text-[#7d8190]">
                              <Calendar className="w-3 h-3" />
                              Days {week.startDayIndex}-{week.endDayIndex}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
