'use client';

import { useState, useRef, TouchEvent, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface SwipeAction {
  icon: ReactNode;
  label: string;
  bgColor: string;
  onClick: () => void | Promise<void>;
}

interface SwipeableChatItemProps {
  children: ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
  itemId: string;
  openItemId: string | null;
  onOpen: (id: string | null) => void;
}

const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 76;

export function SwipeableChatItem({
  children,
  actions,
  disabled = false,
  itemId,
  openItemId,
  onOpen,
}: SwipeableChatItemProps) {
  const [translateX, setTranslateX] = useState(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isVerticalScrollRef = useRef(false);
  const maxSwipe = actions.length * ACTION_WIDTH;

  // Controlled: if another item opens, close this one
  const isOpen = openItemId === itemId;

  // When another item opens (isOpen becomes false externally), close this one
  useEffect(() => {
    if (!isOpen) {
      setTranslateX(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only react to isOpen changes, not translateX

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isDraggingRef.current = false;
    isVerticalScrollRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = startXRef.current - currentX;
    const diffY = startYRef.current - currentY;

    // Determine scroll direction on first significant movement
    if (!isDraggingRef.current && !isVerticalScrollRef.current) {
      if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
        // Vertical scroll detected - don't interfere
        isVerticalScrollRef.current = true;
        return;
      }
      if (Math.abs(diffX) > 10) {
        isDraggingRef.current = true;
      }
    }

    if (isVerticalScrollRef.current) return;
    if (!isDraggingRef.current) return;

    // Calculate new position
    let newTranslate: number;
    if (isOpen) {
      // If already open, start from open position
      newTranslate = -maxSwipe - diffX;
    } else {
      newTranslate = -diffX;
    }

    // Clamp between 0 and -maxSwipe (allow small overscroll for feel)
    newTranslate = Math.max(-maxSwipe - 20, Math.min(20, newTranslate));
    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    if (disabled || isVerticalScrollRef.current) return;

    // Snap to open or closed based on threshold
    if (Math.abs(translateX) > SWIPE_THRESHOLD) {
      setTranslateX(-maxSwipe);
      onOpen(itemId); // Tell parent this item is now open
    } else {
      setTranslateX(0);
      if (isOpen) {
        onOpen(null); // Close
      }
    }
    isDraggingRef.current = false;
  };

  const handleActionClick = (action: SwipeAction) => {
    console.log('[SwipeableChatItem] handleActionClick called:', { label: action.label, itemId });
    // Reset swipe state
    setTranslateX(0);
    onOpen(null);
    // Execute action
    action.onClick();
  };

  // Close on click outside (clicking the content area)
  const handleContentClick = () => {
    if (isOpen) {
      setTranslateX(0);
      onOpen(null);
    }
  };

  if (actions.length === 0 || disabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons revealed on swipe - hidden when closed to prevent visual bleed-through */}
      <div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{
          width: maxSwipe,
          visibility: translateX === 0 ? 'hidden' : 'visible',
        }}
      >
        {actions.map((action, i) => {
          const isLast = i === actions.length - 1;
          return (
            <button
              key={i}
              onClick={() => handleActionClick(action)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 text-white text-[11px] font-medium transition-all active:opacity-80',
                isLast && 'rounded-r-2xl',
                action.bgColor
              )}
              style={{ width: ACTION_WIDTH }}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main content slides left - rounded */}
      <div
        className="relative bg-white dark:bg-[#171b22] touch-pan-y rounded-2xl"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDraggingRef.current ? 'none' : 'transform 0.25s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleContentClick}
      >
        {children}
      </div>
    </div>
  );
}
