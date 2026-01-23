'use client';

import { AlertTriangle, ExternalLink, CreditCard } from 'lucide-react';

export interface StripeConnectWarningProps {
  /** Visual variant of the warning */
  variant?: 'inline' | 'banner';
  /** Whether to show the Connect Stripe CTA button */
  showCta?: boolean;
  /** Custom message to display (optional) */
  message?: string;
  /** Custom sub-message for additional context */
  subMessage?: string;
  /** Callback when CTA button is clicked */
  onConnectClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Beautiful warning component shown when Stripe is not connected
 * and a payment feature requires it.
 */
export function StripeConnectWarning({
  variant = 'inline',
  showCta = true,
  message,
  subMessage,
  onConnectClick,
  className = '',
}: StripeConnectWarningProps) {
  const defaultMessage = 'Connect Stripe to accept payments';
  const defaultSubMessage = 'To charge clients through the platform, connect your Stripe account in Settings.';

  const isInline = variant === 'inline';

  return (
    <div
      className={`
        rounded-xl border overflow-hidden
        ${isInline
          ? 'p-3 bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-900/20 dark:to-orange-900/10 border-amber-200/60 dark:border-amber-700/40'
          : 'p-4 bg-gradient-to-r from-amber-50 via-orange-50/30 to-amber-50 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-amber-900/20 border-amber-200 dark:border-amber-700/50'
        }
        ${className}
      `}
    >
      <div className={`flex ${isInline ? 'items-start gap-2.5' : 'items-start gap-3'}`}>
        {/* Icon */}
        <div className={`
          flex-shrink-0 rounded-lg flex items-center justify-center
          ${isInline
            ? 'w-8 h-8 bg-amber-100 dark:bg-amber-800/30'
            : 'w-10 h-10 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-800/40 dark:to-orange-800/30'
          }
        `}>
          <CreditCard className={`
            ${isInline ? 'w-4 h-4' : 'w-5 h-5'}
            text-amber-600 dark:text-amber-400
          `} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`
            font-medium font-albert
            ${isInline
              ? 'text-xs text-amber-800 dark:text-amber-200'
              : 'text-sm text-amber-800 dark:text-amber-200'
            }
          `}>
            {message || defaultMessage}
          </p>
          <p className={`
            mt-0.5 font-albert
            ${isInline
              ? 'text-[11px] text-amber-700/80 dark:text-amber-300/70'
              : 'text-xs text-amber-700 dark:text-amber-300/80'
            }
          `}>
            {subMessage || defaultSubMessage}
          </p>

          {/* CTA Button */}
          {showCta && onConnectClick && (
            <button
              type="button"
              onClick={onConnectClick}
              className={`
                mt-2 inline-flex items-center gap-1.5 font-medium font-albert
                text-amber-700 dark:text-amber-300
                hover:text-amber-800 dark:hover:text-amber-200
                transition-colors
                ${isInline ? 'text-xs' : 'text-sm'}
              `}
            >
              <span>Connect Stripe</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact inline warning for tight spaces (e.g., inside select dropdowns)
 */
export function StripeConnectWarningCompact({
  message = 'Stripe required',
  className = '',
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 text-amber-600 dark:text-amber-400 ${className}`}>
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs font-albert">{message}</span>
    </div>
  );
}
