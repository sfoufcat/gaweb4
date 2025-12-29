'use client';

import { useState } from 'react';
import { AlertTriangle, CreditCard, RefreshCw, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaymentFailedBannerProps {
  graceEndsAt: string;
  onUpdatePayment?: () => void;
  onRetryPayment?: () => Promise<boolean>;
}

/**
 * Payment Failed Banner
 * 
 * Displays a prominent warning at the top of the coach dashboard when
 * their subscription payment has failed. Shows the remaining grace period
 * and provides actions to update or retry payment.
 */
export function PaymentFailedBanner({
  graceEndsAt,
  onUpdatePayment,
  onRetryPayment,
}: PaymentFailedBannerProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Calculate days remaining in grace period
  const graceEnd = new Date(graceEndsAt);
  const now = new Date();
  const msRemaining = graceEnd.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60)));
  
  // Format the grace end date
  const formattedDate = graceEnd.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // If payment succeeded after retry, show success message briefly
  if (retrySuccess) {
    return (
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-emerald-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">Payment successful! Your subscription has been restored.</span>
        </div>
      </div>
    );
  }

  // Don't show if dismissed (temporary, will come back on page refresh)
  if (isDismissed) {
    return null;
  }

  // Don't show if grace period has expired (middleware should block anyway)
  if (msRemaining <= 0) {
    return null;
  }

  const handleRetryPayment = async () => {
    if (!onRetryPayment) return;
    
    setIsRetrying(true);
    setRetryError(null);
    
    try {
      const success = await onRetryPayment();
      if (success) {
        setRetrySuccess(true);
        // Auto-refresh after 2 seconds to update dashboard state
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setRetryError('Payment retry failed. Please update your payment method.');
      }
    } catch {
      setRetryError('Unable to retry payment. Please update your payment method.');
    } finally {
      setIsRetrying(false);
    }
  };

  // Determine urgency level for styling
  const isUrgent = daysRemaining <= 1;
  const isWarning = daysRemaining === 2;

  return (
    <div 
      className={`
        border-b px-4 py-4 relative
        ${isUrgent 
          ? 'bg-gradient-to-r from-red-600 to-red-500 text-white' 
          : isWarning
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border-amber-200'
        }
      `}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Warning message */}
          <div className="flex items-start gap-3 flex-1">
            <AlertTriangle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${isUrgent || isWarning ? 'text-white' : 'text-amber-600'}`} />
            <div>
              <h3 className="font-semibold text-lg">
                Payment Failed
              </h3>
              <p className={`text-sm ${isUrgent || isWarning ? 'text-white/90' : 'text-amber-700'}`}>
                {daysRemaining > 0 ? (
                  <>
                    You have <span className="font-bold">{daysRemaining === 1 ? `${hoursRemaining} hours` : `${daysRemaining} days`}</span> to update your payment method. 
                    Access will be suspended on {formattedDate} if payment is not received.
                  </>
                ) : (
                  <>Your access will be suspended today if payment is not received.</>
                )}
              </p>
              {retryError && (
                <p className="text-sm mt-2 font-medium text-red-200">
                  {retryError}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {onRetryPayment && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryPayment}
                disabled={isRetrying}
                className={`
                  ${isUrgent || isWarning 
                    ? 'bg-white/20 hover:bg-white/30 text-white border-white/30' 
                    : 'border-amber-300 text-amber-700 hover:bg-amber-100'
                  }
                `}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry Payment
                  </>
                )}
              </Button>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={onUpdatePayment}
              className={`
                ${isUrgent || isWarning 
                  ? 'bg-white text-red-600 hover:bg-white/90' 
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
                }
              `}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Update Payment Method
            </Button>
          </div>
        </div>
      </div>

      {/* Dismiss button (temporary dismiss until page refresh) */}
      <button
        onClick={() => setIsDismissed(true)}
        className={`
          absolute top-2 right-2 p-1 rounded-full transition-colors
          ${isUrgent || isWarning 
            ? 'hover:bg-white/20 text-white/70 hover:text-white' 
            : 'hover:bg-amber-200 text-amber-500 hover:text-amber-700'
          }
        `}
        aria-label="Dismiss temporarily"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

