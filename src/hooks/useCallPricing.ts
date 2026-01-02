import { useState, useEffect, useCallback } from 'react';
import type { UserCallCredits } from '@/types';

interface UseCallCreditsReturn {
  credits: UserCallCredits | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing user's call credits
 */
export function useCallCredits(): UseCallCreditsReturn {
  const [credits, setCredits] = useState<UserCallCredits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/credits');
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch credits');
      }

      const data = await response.json();
      setCredits(data.credits);
    } catch (err) {
      console.error('[useCallCredits] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  return {
    credits,
    isLoading,
    error,
    refetch: fetchCredits,
  };
}

interface PaymentResult {
  success: boolean;
  paidWithCredits: boolean;
  creditsRemaining?: number;
}

interface UseCallPaymentReturn {
  createPaymentIntent: (eventId: string) => Promise<{
    clientSecret?: string;
    useCredits?: boolean;
    creditsRemaining?: number;
    amount?: number;
  }>;
  confirmPayment: (eventId: string, useCredits?: boolean) => Promise<PaymentResult>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for handling call payments
 */
export function useCallPayment(): UseCallPaymentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (eventId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create payment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmPayment = useCallback(async (eventId: string, useCredits?: boolean): Promise<PaymentResult> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/scheduling/payment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, useCredits }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to confirm payment');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm payment';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createPaymentIntent,
    confirmPayment,
    isLoading,
    error,
  };
}

