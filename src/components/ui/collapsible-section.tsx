'use client';

import * as React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Show accent border on left when expanded */
  accentBorder?: boolean;
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
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as const,
};

export function CollapsibleSection({
  title,
  icon: Icon,
  description,
  defaultOpen = true,
  children,
  className,
  accentBorder = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      className={cn(
        'border-t border-[#e1ddd8] dark:border-[#262b35] transition-all duration-200',
        accentBorder && isOpen && 'border-l-2 border-l-brand-accent pl-3',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between py-3 transition-all duration-200',
          isOpen
            ? 'text-[#1a1a1a] dark:text-[#f5f5f8]'
            : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
        )}
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <motion.div
              animate={{ scale: isOpen ? 1.05 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <Icon
                className={cn(
                  'w-4 h-4 transition-colors duration-200',
                  isOpen
                    ? 'text-brand-accent'
                    : 'text-[#5f5a55] dark:text-[#b2b6c2]'
                )}
              />
            </motion.div>
          )}
          <span className="text-sm font-semibold font-albert">
            {title}
          </span>
          {description && (
            <span className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert">
              {description}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <ChevronRight className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </motion.div>
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
            <div className="pb-4 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
