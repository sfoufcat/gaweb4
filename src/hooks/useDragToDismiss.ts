'use client';

import { useRef, useCallback, useEffect, RefObject } from 'react';

interface UseDragToDismissOptions {
  onClose: () => void;
  threshold?: number;        // pixels to drag before dismiss (default: 100)
  velocityThreshold?: number; // velocity to trigger dismiss (default: 0.5)
  disabled?: boolean;
}

interface UseDragToDismissReturn {
  sheetRef: RefObject<HTMLDivElement | null>;
  handleRef: RefObject<HTMLDivElement | null>;
  handleProps: {
    style: React.CSSProperties;
  };
  backdropProps: {
    style: { opacity: number };
  };
}

/**
 * Hook to add native-feeling swipe-to-dismiss behavior to mobile slide-up modals.
 *
 * Uses native event listeners with passive: false to properly prevent scroll during drag.
 *
 * Usage:
 * ```tsx
 * const { sheetRef, handleRef, handleProps, backdropProps } = useDragToDismiss({ onClose });
 *
 * return (
 *   <div className="fixed inset-0">
 *     <div className="backdrop" {...backdropProps} onClick={onClose} />
 *     <div ref={sheetRef} className="sheet">
 *       <div ref={handleRef} {...handleProps} className="grabber">
 *         <div className="grabber-bar" />
 *       </div>
 *       {children}
 *     </div>
 *   </div>
 * );
 * ```
 */
export function useDragToDismiss({
  onClose,
  threshold = 100,
  velocityThreshold = 0.5,
  disabled = false,
}: UseDragToDismissOptions): UseDragToDismissReturn {
  const sheetRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    startY: 0,
    currentY: 0,
    startTime: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });
  const backdropOpacity = useRef(1);
  const onCloseRef = useRef(onClose);

  // Keep onClose ref updated
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Apply transform to sheet during drag
  const updateTransform = useCallback((translateY: number) => {
    if (!sheetRef.current) return;

    // Rubber band effect when dragging up
    const actualTranslate = translateY < 0
      ? translateY * 0.2 // Resistance when dragging up
      : translateY;

    sheetRef.current.style.transform = `translateY(${actualTranslate}px)`;
    sheetRef.current.style.transition = 'none';

    // Update backdrop opacity (fade out as sheet is dragged down)
    const maxDrag = threshold * 2;
    const opacity = Math.max(0, 1 - (translateY / maxDrag));
    backdropOpacity.current = opacity;
  }, [threshold]);

  // Animate sheet back to original position
  const animateBack = useCallback(() => {
    if (!sheetRef.current) return;

    sheetRef.current.style.transform = 'translateY(0)';
    sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
    backdropOpacity.current = 1;
  }, []);

  // Animate sheet out and close
  const animateOut = useCallback(() => {
    if (!sheetRef.current) return;

    const sheetHeight = sheetRef.current.offsetHeight;
    sheetRef.current.style.transform = `translateY(${sheetHeight}px)`;
    sheetRef.current.style.transition = 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)';
    backdropOpacity.current = 0;

    // Call onClose after animation
    setTimeout(() => {
      onCloseRef.current();
      // Reset transform after close
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
        sheetRef.current.style.transition = '';
      }
    }, 200);
  }, []);

  // Set up native event listeners with passive: false
  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      dragState.current = {
        isDragging: true,
        startY: touch.clientY,
        currentY: touch.clientY,
        startTime: Date.now(),
        lastY: touch.clientY,
        lastTime: Date.now(),
        velocity: 0,
      };
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragState.current.isDragging) return;

      // Prevent native scrolling while dragging - this requires passive: false
      e.preventDefault();

      const touch = e.touches[0];
      const deltaY = touch.clientY - dragState.current.startY;
      const now = Date.now();
      const timeDelta = now - dragState.current.lastTime;

      // Calculate velocity (pixels per millisecond)
      if (timeDelta > 0) {
        dragState.current.velocity = (touch.clientY - dragState.current.lastY) / timeDelta;
      }

      dragState.current.currentY = touch.clientY;
      dragState.current.lastY = touch.clientY;
      dragState.current.lastTime = now;

      updateTransform(deltaY);
    };

    const handleTouchEnd = () => {
      if (!dragState.current.isDragging) return;

      const deltaY = dragState.current.currentY - dragState.current.startY;
      const velocity = dragState.current.velocity;

      dragState.current.isDragging = false;

      // Dismiss if:
      // 1. Dragged past threshold, OR
      // 2. Released with high downward velocity (fast flick)
      const shouldDismiss = deltaY > threshold || (deltaY > 20 && velocity > velocityThreshold);

      if (shouldDismiss) {
        animateOut();
      } else {
        animateBack();
      }
    };

    // Add event listeners with passive: false for touchmove to allow preventDefault
    handle.addEventListener('touchstart', handleTouchStart, { passive: true });
    handle.addEventListener('touchmove', handleTouchMove, { passive: false });
    handle.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      handle.removeEventListener('touchstart', handleTouchStart);
      handle.removeEventListener('touchmove', handleTouchMove);
      handle.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, threshold, velocityThreshold, updateTransform, animateBack, animateOut]);

  // Reset sheet transform when component unmounts or closes
  useEffect(() => {
    return () => {
      if (sheetRef.current) {
        sheetRef.current.style.transform = '';
        sheetRef.current.style.transition = '';
      }
    };
  }, []);

  return {
    sheetRef,
    handleRef,
    handleProps: {
      style: { touchAction: 'none' } as React.CSSProperties,
    },
    backdropProps: {
      style: { opacity: backdropOpacity.current },
    },
  };
}

export default useDragToDismiss;
