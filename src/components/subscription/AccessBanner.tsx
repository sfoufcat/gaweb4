'use client';

import { useState } from 'react';
import { AlertCircle, Clock, X, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'expired';

interface AccessBannerProps {
  /** Current subscription status */
  status: SubscriptionStatus;
  /** When access ends (ISO date string) */
  accessEndsAt?: string;
  /** When current billing period ends (ISO date string) */
  currentPeriodEnd?: string;
  /** Resource type for labeling */
  resourceType?: 'squad' | 'program';
  /** Resource ID for navigation */
  resourceId?: string;
  /** Whether the banner can be dismissed */
  dismissible?: boolean;
  /** Callback when update payment is clicked */
  onUpdatePayment?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * AccessBanner - Shows subscription status warnings for squads and programs
 * 
 * Displays different messages based on status:
 * - past_due: Payment failed, X days to update payment
 * - canceled: Subscription canceled, access until period end
 * - expired: Access has ended
 */
export function AccessBanner({
  status,
  accessEndsAt,
  currentPeriodEnd,
  resourceType = 'program',
  resourceId,
  dismissible = true,
  onUpdatePayment,
  className = '',
}: AccessBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Don't show banner for active subscriptions
  if (status === 'active' || dismissed) {
    return null;
  }

  // Calculate days remaining
  const endDate = accessEndsAt || currentPeriodEnd;
  let daysRemaining: number | null = null;
  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get banner style and content based on status
  const getBannerConfig = () => {
    switch (status) {
      case 'past_due':
        return {
          bgColor: 'bg-red-500/10 border-red-500/30',
          textColor: 'text-red-400',
          icon: <AlertCircle className="w-4 h-4 text-red-400" />,
          title: 'Payment Failed',
          message: daysRemaining !== null && daysRemaining > 0
            ? `Update your payment method within ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to keep access to this ${resourceType}.`
            : `Your payment failed. Update your payment method to restore access.`,
          showUpdateButton: true,
        };
      case 'canceled':
        return {
          bgColor: 'bg-amber-500/10 border-amber-500/30',
          textColor: 'text-amber-400',
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          title: 'Subscription Canceled',
          message: currentPeriodEnd
            ? `Your access will end on ${formatDate(currentPeriodEnd)}.`
            : `Your subscription has been canceled.`,
          showUpdateButton: false,
        };
      case 'expired':
        return {
          bgColor: 'bg-gray-500/10 border-gray-500/30',
          textColor: 'text-gray-400',
          icon: <AlertCircle className="w-4 h-4 text-gray-400" />,
          title: 'Access Expired',
          message: `Your subscription has expired. Resubscribe to regain access.`,
          showUpdateButton: false,
        };
      default:
        return null;
    }
  };

  const config = getBannerConfig();
  if (!config) return null;

  const handleUpdatePayment = () => {
    if (onUpdatePayment) {
      onUpdatePayment();
    } else if (resourceId) {
      // Default behavior: navigate to subscription blocked page
      window.location.href = `/subscription-blocked?type=${resourceType}&id=${resourceId}&reason=${status}`;
    }
  };

  return (
    <div className={`relative rounded-lg border px-4 py-3 ${config.bgColor} ${className}`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${config.textColor}`}>
            {config.title}
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {config.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {config.showUpdateButton && (
            <Button
              size="sm"
              onClick={handleUpdatePayment}
              className="bg-red-500 hover:bg-red-600 text-white text-xs h-8"
            >
              <CreditCard className="w-3 h-3 mr-1" />
              Update Payment
            </Button>
          )}
          
          {dismissible && (
            <button
              onClick={() => setDismissed(true)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Mini version of AccessBanner for use in cards or compact spaces
 */
export function AccessBannerMini({
  status,
  accessEndsAt,
  currentPeriodEnd,
}: Pick<AccessBannerProps, 'status' | 'accessEndsAt' | 'currentPeriodEnd'>) {
  if (status === 'active') return null;

  // Calculate days remaining
  const endDate = accessEndsAt || currentPeriodEnd;
  let daysRemaining: number | null = null;
  if (endDate) {
    const end = new Date(endDate);
    const now = new Date();
    daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getConfig = () => {
    switch (status) {
      case 'past_due':
        return {
          bgColor: 'bg-red-500/20',
          textColor: 'text-red-400',
          text: daysRemaining !== null && daysRemaining > 0
            ? `Payment failed • ${daysRemaining}d left`
            : 'Payment failed',
        };
      case 'canceled':
        return {
          bgColor: 'bg-amber-500/20',
          textColor: 'text-amber-400',
          text: currentPeriodEnd
            ? `Ends ${formatDate(currentPeriodEnd)}`
            : 'Canceled',
        };
      case 'expired':
        return {
          bgColor: 'bg-gray-500/20',
          textColor: 'text-gray-400',
          text: 'Expired',
        };
      default:
        return null;
    }
  };

  const config = getConfig();
  if (!config) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      {status === 'past_due' && <AlertCircle className="w-3 h-3" />}
      {status === 'canceled' && <Clock className="w-3 h-3" />}
      <span>{config.text}</span>
    </div>
  );
}



