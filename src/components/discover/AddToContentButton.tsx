'use client';

import { useState, useEffect } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { useIsContentOwned } from '@/hooks/useContentOwnership';
import type { PurchasableContentType } from '@/types/discover';

interface AddToContentButtonProps {
  contentType: PurchasableContentType;
  contentId: string;
  priceInCents?: number;
  /** Compact mode for card overlays */
  compact?: boolean;
  className?: string;
  onAdded?: () => void;
}

type ButtonState = 'default' | 'loading' | 'success' | 'owned';

export function AddToContentButton({
  contentType,
  contentId,
  priceInCents,
  compact = false,
  className = '',
  onAdded,
}: AddToContentButtonProps) {
  // Check if user already owns this content
  const { isOwned: initiallyOwned, isLoading: checkingOwnership } = useIsContentOwned(contentType, contentId);
  
  const [state, setState] = useState<ButtonState>('default');
  const [showTooltip, setShowTooltip] = useState(false);

  // Update state when ownership check completes
  useEffect(() => {
    if (!checkingOwnership && initiallyOwned) {
      setState('owned');
    }
  }, [initiallyOwned, checkingOwnership]);

  // Don't render for paid content
  const isFree = !priceInCents || priceInCents === 0;
  if (!isFree) {
    return null;
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (state === 'loading' || state === 'success' || state === 'owned') {
      return;
    }

    setState('loading');

    try {
      const response = await fetch('/api/content/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType, contentId }),
      });

      const data = await response.json();

      if (response.ok || data.alreadyOwned) {
        setState('success');
        onAdded?.();
        
        // Keep success state visible, then transition to owned
        setTimeout(() => {
          setState('owned');
        }, 2000);
      } else {
        console.error('Failed to add content:', data.error);
        setState('default');
      }
    } catch (error) {
      console.error('Error adding content:', error);
      setState('default');
    }
  };

  const getTooltipText = () => {
    switch (state) {
      case 'loading':
        return 'Adding...';
      case 'success':
        return 'Added!';
      case 'owned':
        return 'In My Content';
      default:
        return 'Add to My Content';
    }
  };

  const getIcon = () => {
    const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
    
    switch (state) {
      case 'loading':
        return <Loader2 className={`${iconSize} animate-spin`} />;
      case 'success':
        return <Check className={`${iconSize} text-green-600`} />;
      case 'owned':
        return <Check className={`${iconSize} text-text-muted dark:text-[#7d8190]`} />;
      default:
        return <Plus className={iconSize} />;
    }
  };

  const buttonClasses = compact
    ? `w-7 h-7 flex items-center justify-center rounded-full transition-all ${
        state === 'owned'
          ? 'bg-earth-100/90 dark:bg-[#262b35]/90 text-text-muted dark:text-[#7d8190]'
          : state === 'success'
          ? 'bg-green-100/90 dark:bg-green-900/30 text-green-600'
          : 'bg-white/90 dark:bg-[#171b22]/90 text-text-primary dark:text-[#f5f5f8] hover:bg-white dark:hover:bg-[#171b22] hover:scale-110'
      } backdrop-blur-sm shadow-sm`
    : `w-9 h-9 flex items-center justify-center rounded-full transition-all ${
        state === 'owned'
          ? 'bg-earth-100 dark:bg-[#262b35] text-text-muted dark:text-[#7d8190]'
          : state === 'success'
          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
          : 'bg-earth-50 dark:bg-[#1d222b] text-text-primary dark:text-[#f5f5f8] hover:bg-earth-100 dark:hover:bg-[#262b35]'
      }`;

  return (
    <div 
      className={`relative ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleClick}
        disabled={state === 'loading' || state === 'owned'}
        className={buttonClasses}
        aria-label={getTooltipText()}
      >
        {getIcon()}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#2c2520] text-xs font-medium rounded-md whitespace-nowrap z-50 animate-in fade-in duration-150">
          {getTooltipText()}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2c2520] dark:border-t-[#f5f5f8]" />
        </div>
      )}
    </div>
  );
}
