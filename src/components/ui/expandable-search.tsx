'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const expandVariants = {
  collapsed: {
    width: 40,
  },
  expanded: {
    width: 220,
  },
};

const inputVariants = {
  collapsed: {
    opacity: 0,
    width: 0,
  },
  expanded: {
    opacity: 1,
    width: 'auto',
  },
};

const transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1] as const,
};

export function ExpandableSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: ExpandableSearchProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleExpand = () => {
    setIsExpanded(true);
    // Focus input after animation starts
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleCollapse = () => {
    if (!value) {
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onChange('');
      setIsExpanded(false);
    }
  };

  return (
    <motion.div
      initial={false}
      animate={isExpanded ? 'expanded' : 'collapsed'}
      variants={expandVariants}
      transition={transition}
      className={cn(
        'relative flex items-center h-10 rounded-xl overflow-hidden',
        isExpanded && 'bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#262b35] ring-2 ring-brand-accent',
        'transition-all duration-200',
        className
      )}
    >
      {/* Search icon button (collapsed state) / Icon (expanded state) */}
      <button
        type="button"
        onClick={isExpanded ? undefined : handleExpand}
        className={cn(
          'flex items-center justify-center flex-shrink-0 w-10 h-10 rounded-xl',
          !isExpanded && 'hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer',
          isExpanded && 'cursor-default'
        )}
        aria-label="Search"
      >
        <Search className="w-4 h-4 text-[#6b6560] dark:text-[#8b9299]" />
      </button>

      {/* Input field */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={inputVariants}
            transition={transition}
            className="flex items-center flex-1 pr-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={handleCollapse}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                'w-full bg-transparent text-sm',
                'text-[#3d3731] dark:text-white',
                'placeholder:text-[#a09a94] dark:placeholder:text-[#6b6560]',
                'focus:outline-none'
              )}
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="flex-shrink-0 p-1 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-md transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 text-[#6b6560] dark:text-[#8b9299]" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
