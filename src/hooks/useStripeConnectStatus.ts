import { useState, useEffect, useCallback } from 'react';
import type { StripeConnectStatus } from '@/types';

interface StripeConnectData {
  stripeConnectStatus: StripeConnectStatus;
  stripeConnectAccountId: string | null;
  platformFeePercent: number;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

interface UseStripeConnectStatusReturn {
  /** The current Stripe Connect status */
  status: StripeConnectStatus;
  /** Whether charges are enabled (account can receive payments) */
  chargesEnabled: boolean;
  /** Whether payouts are enabled (account can receive payouts) */
  payoutsEnabled: boolean;
  /** Whether the account is fully connected and can process payments */
  isConnected: boolean;
  /** Whether the account has completed onboarding but is pending verification */
  isPending: boolean;
  /** Whether there is no Stripe account connected */
  isNotConnected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refetch the status */
  refetch: () => Promise<void>;
}

/**
 * Hook to check the current user's organization's Stripe Connect status.
 * 
 * Use this to:
 * - Guard payment/subscription features for coaches without verified Stripe
 * - Show appropriate warnings/CTAs to connect Stripe
 * 
 * @example
 * ```tsx
 * const { isConnected, isLoading } = useStripeConnectStatus();
 * 
 * if (!isConnected) {
 *   return <StripeConnectPrompt />;
 * }
 * ```
 */
export function useStripeConnectStatus(): UseStripeConnectStatusReturn {
  const [data, setData] = useState<StripeConnectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/coach/stripe-connect');
      
      if (!response.ok) {
        if (response.status === 403) {
          // User is not a coach - they don't need Stripe Connect
          setData({
            stripeConnectStatus: 'not_connected',
            stripeConnectAccountId: null,
            platformFeePercent: 0,
            chargesEnabled: false,
            payoutsEnabled: false,
            detailsSubmitted: false,
          });
          return;
        }
        throw new Error('Failed to fetch Stripe Connect status');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('[useStripeConnectStatus] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch Stripe status');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const status = data?.stripeConnectStatus || 'not_connected';
  const chargesEnabled = data?.chargesEnabled ?? false;
  const payoutsEnabled = data?.payoutsEnabled ?? false;
  
  // Account is fully connected when status is 'connected' AND charges are enabled
  const isConnected = status === 'connected' && chargesEnabled;
  const isPending = status === 'pending';
  const isNotConnected = status === 'not_connected';

  return {
    status,
    chargesEnabled,
    payoutsEnabled,
    isConnected,
    isPending,
    isNotConnected,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}




