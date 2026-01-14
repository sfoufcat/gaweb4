'use client';

import { useState, useRef, useEffect } from 'react';
import { Tag, Check, X, Loader2, ChevronDown, Percent, DollarSign } from 'lucide-react';
import { UseDiscountCodeReturn } from '@/hooks/useDiscountCode';
import { cn } from '@/lib/utils';

interface DiscountCodeInputProps {
  discount: UseDiscountCodeReturn;
  className?: string;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function DiscountCodeInput({ discount, className, compact = false }: DiscountCodeInputProps) {
  const {
    code,
    setCode,
    isValidating,
    validationResult,
    isExpanded,
    setIsExpanded,
    validateCode,
    clearDiscount,
    hasValidDiscount,
  } = discount;

  const inputRef = useRef<HTMLInputElement>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Show success animation briefly
  useEffect(() => {
    if (hasValidDiscount) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hasValidDiscount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await validateCode();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!hasValidDiscount) {
        setIsExpanded(false);
        setCode('');
      }
    }
  };

  // If discount is applied, show the applied state
  if (hasValidDiscount && validationResult?.discountCode) {
    const discountCode = validationResult.discountCode;
    const discountDisplay = discountCode.type === 'percentage'
      ? `${discountCode.value}%`
      : `$${(discountCode.value / 100).toFixed(2)}`;

    return (
      <div className={cn('relative', className)}>
        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-xl border transition-all duration-300',
            'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
            compact ? 'px-3 py-2' : 'px-4 py-3'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              'flex items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40',
              compact ? 'w-7 h-7' : 'w-8 h-8'
            )}>
              {discountCode.type === 'percentage' ? (
                <Percent className={cn('text-green-600 dark:text-green-400', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              ) : (
                <DollarSign className={cn('text-green-600 dark:text-green-400', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-albert font-semibold text-green-700 dark:text-green-300',
                  compact ? 'text-sm' : 'text-base'
                )}>
                  {discountCode.code}
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-200 dark:bg-green-800 font-albert font-medium text-green-800 dark:text-green-200',
                  compact ? 'text-[10px]' : 'text-xs'
                )}>
                  <Check className="w-3 h-3" />
                  {discountDisplay} off
                </span>
              </div>
              {discountCode.name && !compact && (
                <span className="text-xs text-green-600 dark:text-green-400 truncate">
                  {discountCode.name}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearDiscount}
            className="p-1.5 rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-colors flex-shrink-0"
            aria-label="Remove discount code"
          >
            <X className={cn('text-green-600 dark:text-green-400', compact ? 'w-4 h-4' : 'w-5 h-5')} />
          </button>
        </div>
      </div>
    );
  }

  // Collapsed state - just a button to expand
  if (!isExpanded) {
    return (
      <div className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl border border-dashed transition-all duration-200',
            'border-[#d1cdc8] dark:border-[#3a3f4b] text-[#6b6560] dark:text-[#9ca3af]',
            'hover:border-brand-accent hover:text-brand-accent hover:bg-brand-accent/5',
            compact ? 'px-3 py-2' : 'px-4 py-2.5'
          )}
        >
          <Tag className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          <span className={cn('font-albert font-medium', compact ? 'text-sm' : 'text-[15px]')}>
            Have a discount code?
          </span>
          <ChevronDown className={cn('opacity-50', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        </button>
      </div>
    );
  }

  // Expanded state - input field
  return (
    <div className={cn('relative', className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border transition-all duration-200',
            'bg-white dark:bg-[#0d1117] border-[#e1ddd8] dark:border-[#262b35]',
            'focus-within:ring-2 focus-within:ring-brand-accent/30 focus-within:border-brand-accent',
            validationResult && !validationResult.valid && 'border-red-300 dark:border-red-800',
            compact ? 'px-3 py-2' : 'px-4 py-3'
          )}
        >
          <Tag className={cn('text-[#9a948e] dark:text-[#6b7280] flex-shrink-0', compact ? 'w-4 h-4' : 'w-5 h-5')} />
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              // Clear previous validation when typing
              if (validationResult) {
                discount.clearDiscount();
                setCode(e.target.value.toUpperCase());
                setIsExpanded(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter code"
            className={cn(
              'flex-1 bg-transparent font-albert font-medium tracking-wide outline-none',
              'text-[#1a1a1a] dark:text-[#f5f5f8] placeholder:text-[#9a948e] dark:placeholder:text-[#6b7280]',
              compact ? 'text-sm' : 'text-base'
            )}
            disabled={isValidating}
            autoCapitalize="characters"
          />
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!code && (
              <button
                type="button"
                onClick={() => {
                  setIsExpanded(false);
                  setCode('');
                }}
                className="p-1 rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
                aria-label="Cancel"
              >
                <X className={cn('text-[#9a948e] dark:text-[#6b7280]', compact ? 'w-4 h-4' : 'w-5 h-5')} />
              </button>
            )}
            {code && (
              <button
                type="submit"
                disabled={isValidating || !code.trim()}
                className={cn(
                  'px-3 py-1 rounded-lg font-albert font-medium transition-all',
                  'bg-brand-accent text-brand-accent-foreground',
                  'hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed',
                  compact ? 'text-xs' : 'text-sm'
                )}
              >
                {isValidating ? (
                  <Loader2 className={cn('animate-spin', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
                ) : (
                  'Apply'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {validationResult && !validationResult.valid && validationResult.error && (
          <div className={cn(
            'mt-2 flex items-center gap-2 text-red-600 dark:text-red-400',
            compact ? 'text-xs' : 'text-sm'
          )}>
            <X className="w-4 h-4 flex-shrink-0" />
            <span className="font-albert">{validationResult.error}</span>
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * Price display component that shows original and discounted price
 */
interface DiscountedPriceDisplayProps {
  originalAmountCents: number;
  discount: UseDiscountCodeReturn;
  currency?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function DiscountedPriceDisplay({
  originalAmountCents,
  discount,
  currency = 'USD',
  className,
  size = 'md',
}: DiscountedPriceDisplayProps) {
  const { hasValidDiscount, finalPrice, displayDiscount } = discount;

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const sizeClasses = {
    sm: { original: 'text-sm', final: 'text-lg', badge: 'text-[10px] px-1.5 py-0.5' },
    md: { original: 'text-base', final: 'text-2xl', badge: 'text-xs px-2 py-0.5' },
    lg: { original: 'text-lg', final: 'text-3xl', badge: 'text-sm px-2.5 py-1' },
  };

  if (!hasValidDiscount) {
    return (
      <div className={cn('font-albert', className)}>
        <span className={cn('font-bold text-[#1a1a1a] dark:text-[#f5f5f8]', sizeClasses[size].final)}>
          {formatPrice(originalAmountCents)}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-albert line-through text-[#9a948e] dark:text-[#6b7280]',
          sizeClasses[size].original
        )}>
          {formatPrice(originalAmountCents)}
        </span>
        <span className={cn(
          'inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-albert font-medium',
          sizeClasses[size].badge
        )}>
          {displayDiscount}
        </span>
      </div>
      <span className={cn('font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8]', sizeClasses[size].final)}>
        {formatPrice(finalPrice)}
      </span>
    </div>
  );
}
