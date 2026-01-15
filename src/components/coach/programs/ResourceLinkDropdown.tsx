'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResourceItem {
  id: string;
  title: string;
  subtitle?: string; // Optional subtitle (e.g., date)
}

interface ResourceGroup {
  label: string;
  items: ResourceItem[];
  iconClassName?: string;
}

interface ResourceLinkDropdownProps {
  placeholder: string;
  icon: LucideIcon;
  groups: ResourceGroup[];
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void; // Optional delete handler
  onCreateNew?: () => void;
  createNewLabel?: string;
  pageSize?: number; // Items per page (default: 10)
}

export function ResourceLinkDropdown({
  placeholder,
  icon: Icon,
  groups,
  onSelect,
  onDelete,
  onCreateNew,
  createNewLabel = 'Create new',
  pageSize = 10,
}: ResourceLinkDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update dropdown position when opened - use layoutEffect for synchronous positioning
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap (mt-1)
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    } else if (!isOpen) {
      // Reset position when closed so it recalculates fresh on next open
      setDropdownPosition(null);
    }
  }, [isOpen]);

  // Reset page when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(0);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the dropdown menu and the trigger button
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      if (isOutsideDropdown && isOutsideTrigger) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setIsOpen(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent selecting the item
    console.log('[ResourceLinkDropdown] Delete clicked for id:', id);
    // Only block if this specific item is already being deleted
    if (!onDelete || deletingId === id) {
      console.log('[ResourceLinkDropdown] Delete blocked - onDelete:', !!onDelete, 'deletingId:', deletingId);
      return;
    }

    setDeletingId(id);
    console.log('[ResourceLinkDropdown] Calling onDelete...');

    // Call onDelete and handle the promise
    Promise.resolve(onDelete(id))
      .then(() => {
        console.log('[ResourceLinkDropdown] Delete completed successfully');
      })
      .catch((err) => {
        console.error('[ResourceLinkDropdown] Delete failed:', err);
      })
      .finally(() => {
        setDeletingId(null);
      });
  };

  const handleCreateNew = () => {
    if (onCreateNew) {
      onCreateNew();
    }
    setIsOpen(false);
  };

  // Flatten all items from all groups for pagination
  const allItems = useMemo(() => {
    return groups.flatMap(g => g.items.map(item => ({ ...item, group: g })));
  }, [groups]);

  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const hasItems = totalItems > 0;

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return allItems.slice(start, end);
  }, [allItems, currentPage, pageSize]);

  const goToNextPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Render dropdown menu in a portal to escape overflow-hidden containers
  // Only render when position is calculated to prevent flash at (0,0)
  const dropdownMenu = isOpen && dropdownPosition && typeof document !== 'undefined' ? createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
      }}
      className={cn(
        "z-[10001]",
        "border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]",
        "shadow-lg rounded-xl overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
    >
          <div className="max-h-[400px] overflow-y-auto">
            {/* Group header - show only first group label if we have paginated items */}
            {paginatedItems.length > 0 && (
              <div className="px-3 py-2">
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-semibold uppercase tracking-wider">
                  {groups[0]?.label || 'Items'}
                </span>
              </div>
            )}

            {/* Paginated items */}
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm",
                  "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
                  "text-[#1a1a1a] dark:text-[#f5f5f8] font-albert group"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", item.group.iconClassName || "text-brand-accent")} />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate">{item.title}</span>
                    {item.subtitle && (
                      <span className="block text-xs text-[#8c8c8c] dark:text-[#7d8190] truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </button>
                {onDelete && (
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className={cn(
                      "p-1.5 rounded-md transition-colors flex-shrink-0 z-10",
                      "text-[#a7a39e] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20",
                      // On desktop: show on hover, on mobile: always visible
                      !isMobile && "opacity-0 group-hover:opacity-100",
                      deletingId === item.id && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={currentPage === 0}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a]",
                    currentPage === 0 && "opacity-30 cursor-not-allowed"
                  )}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[#8c8c8c] dark:text-[#7d8190]">
                  {currentPage + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={currentPage >= totalPages - 1}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a]",
                    currentPage >= totalPages - 1 && "opacity-30 cursor-not-allowed"
                  )}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Separator before create new - only if there are items */}
            {hasItems && onCreateNew && (
              <div className="h-px bg-[#e1ddd8] dark:bg-[#262b35] mx-2" />
            )}

            {/* Create new option - always show if provided */}
            {onCreateNew && (
              <button
                type="button"
                onClick={handleCreateNew}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left",
                  "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
                  "text-brand-accent font-albert font-medium"
                )}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>{createNewLabel}</span>
              </button>
            )}

            {/* Empty state when no items and no create option */}
            {!hasItems && !onCreateNew && (
              <div className="px-3 py-4 text-center">
                <span className="text-sm text-[#8c8c8c] dark:text-[#7d8190] italic">
                  No items available
                </span>
              </div>
            )}
          </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative w-full">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#11141b] px-3 py-2 text-sm",
          "hover:bg-[#f7f5f3] dark:hover:bg-[#1e222a] transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-0",
          "text-[#8c8c8c] dark:text-[#7d8190] font-albert"
        )}
      >
        <span>{placeholder}</span>
        <ChevronDown className={cn(
          "h-4 w-4 opacity-50 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown menu rendered via portal */}
      {dropdownMenu}
    </div>
  );
}
