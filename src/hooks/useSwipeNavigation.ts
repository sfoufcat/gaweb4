'use client';

import { useRef, useCallback, TouchEvent } from 'react';

interface UseSwipeNavigationOptions {
  /** Callback when swipe right is detected */
  onSwipeRight: () => void;
  /** Distance from left edge to detect swipe start (default: 30px) */
  edgeThreshold?: number;
  /** Minimum swipe distance to trigger (default: 60px) */
  swipeThreshold?: number;
  /** Whether swipe is disabled */
  disabled?: boolean;
}

/**
 * Hook for detecting swipe-right gestures from the left edge of the screen.
 * Useful for "swipe to go back" navigation patterns.
 */
export function useSwipeNavigation({
  onSwipeRight,
  edgeThreshold = 30,
  swipeThreshold = 60,
  disabled = false,
}: UseSwipeNavigationOptions) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isEdgeSwipeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isVerticalScrollRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      isDraggingRef.current = false;
      isVerticalScrollRef.current = false;

      // Check if touch started near left edge
      isEdgeSwipeRef.current = touch.clientX <= edgeThreshold;
    },
    [disabled, edgeThreshold]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (disabled || !isEdgeSwipeRef.current) return;

      const touch = e.touches[0];
      const diffX = touch.clientX - startXRef.current;
      const diffY = touch.clientY - startYRef.current;

      // Determine scroll direction on first significant movement
      if (!isDraggingRef.current && !isVerticalScrollRef.current) {
        if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
          // Vertical scroll detected - don't interfere
          isVerticalScrollRef.current = true;
          return;
        }
        if (Math.abs(diffX) > 10 && diffX > 0) {
          // Horizontal swipe right detected
          isDraggingRef.current = true;
        }
      }
    },
    [disabled]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isEdgeSwipeRef.current || isVerticalScrollRef.current) {
      // Reset refs
      isEdgeSwipeRef.current = false;
      isDraggingRef.current = false;
      isVerticalScrollRef.current = false;
      return;
    }

    // Check if swipe distance exceeds threshold
    // Note: We need to track the final position, but since we don't have it in touchend,
    // we rely on isDragging which only becomes true if diffX > 10 and moving right
    if (isDraggingRef.current) {
      // The swipe was significant enough, trigger callback
      onSwipeRight();
    }

    // Reset refs
    isEdgeSwipeRef.current = false;
    isDraggingRef.current = false;
    isVerticalScrollRef.current = false;
  }, [disabled, onSwipeRight]);

  // Alternative: Track swipe distance more precisely
  const currentXRef = useRef(0);

  const handleTouchMoveWithDistance = useCallback(
    (e: TouchEvent) => {
      if (disabled || !isEdgeSwipeRef.current) return;

      const touch = e.touches[0];
      currentXRef.current = touch.clientX;
      const diffX = touch.clientX - startXRef.current;
      const diffY = touch.clientY - startYRef.current;

      // Determine scroll direction on first significant movement
      if (!isDraggingRef.current && !isVerticalScrollRef.current) {
        if (Math.abs(diffY) > 10 && Math.abs(diffY) > Math.abs(diffX)) {
          isVerticalScrollRef.current = true;
          return;
        }
        if (diffX > 10) {
          isDraggingRef.current = true;
        }
      }
    },
    [disabled]
  );

  const handleTouchEndWithDistance = useCallback(() => {
    if (disabled || !isEdgeSwipeRef.current || isVerticalScrollRef.current) {
      isEdgeSwipeRef.current = false;
      isDraggingRef.current = false;
      isVerticalScrollRef.current = false;
      return;
    }

    const swipeDistance = currentXRef.current - startXRef.current;

    if (isDraggingRef.current && swipeDistance >= swipeThreshold) {
      onSwipeRight();
    }

    isEdgeSwipeRef.current = false;
    isDraggingRef.current = false;
    isVerticalScrollRef.current = false;
  }, [disabled, onSwipeRight, swipeThreshold]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMoveWithDistance,
    onTouchEnd: handleTouchEndWithDistance,
  };
}
