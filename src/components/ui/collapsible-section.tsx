'use client';

import * as React from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Badge indicating section importance */
  badge?: 'essential' | 'recommended' | 'optional';
  /** Shows green dot when collapsed indicating section has content */
  hasContent?: boolean;
}

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
  },
};

const contentTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export function CollapsibleSection({
  title,
  icon: Icon,
  description,
  defaultOpen = true,
  children,
  className,
  badge,
  hasContent,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        'rounded-xl bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-sm border border-[#e1ddd8]/60 dark:border-[#262b35]/60 overflow-hidden transition-all duration-200',
        isOpen && 'shadow-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3.5 transition-all duration-200 hover:bg-[#f7f5f3]/50 dark:hover:bg-[#1e222a]/50',
          isOpen && 'border-b border-[#e1ddd8]/40 dark:border-[#262b35]/40'
        )}
      >
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200',
              isOpen
                ? 'bg-brand-accent/10 text-brand-accent'
                : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#5f5a55] dark:text-[#b2b6c2]'
            )}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-sm font-semibold font-albert transition-colors duration-200',
                isOpen
                  ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                  : 'text-[#5f5a55] dark:text-[#b2b6c2]'
              )}>
                {title}
              </span>
              {badge && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                  badge === 'essential' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                  badge === 'recommended' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  badge === 'optional' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                )}>
                  {badge.charAt(0).toUpperCase() + badge.slice(1)}
                </span>
              )}
            </div>
            {description && (
              <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
                {description}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && !isOpen && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          )}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-200 flex-shrink-0',
              isOpen
                ? 'bg-[#f3f1ef] dark:bg-[#262b35]'
                : 'bg-transparent'
            )}
          >
            <ChevronDown className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={contentVariants}
            transition={contentTransition}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
