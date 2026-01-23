'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useStripeConnectStatus } from '@/hooks/useStripeConnectStatus';
import {
  X,
  CreditCard,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface StripeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when Stripe is successfully connected */
  onConnected?: () => void;
}

/**
 * Modal overlay for connecting Stripe account without leaving the current page.
 * Opens Stripe onboarding in a new tab and polls for connection status.
 */
export function StripeConnectModal({ isOpen, onClose, onConnected }: StripeConnectModalProps) {
  const { status, isConnected, isPending, refetch, isLoading: statusLoading } = useStripeConnectStatus();

  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOpenedStripe, setHasOpenedStripe] = useState(false);

  // Poll for status changes when user has opened Stripe
  useEffect(() => {
    if (!isOpen || !hasOpenedStripe) return;

    const interval = setInterval(async () => {
      await refetch();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [isOpen, hasOpenedStripe, refetch]);

  // Auto-close when connected
  useEffect(() => {
    if (isConnected && hasOpenedStripe) {
      onConnected?.();
      // Small delay to show success state
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  }, [isConnected, hasOpenedStripe, onConnected, onClose]);

  const handleConnectStripe = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const response = await fetch('/api/coach/stripe-connect', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Stripe onboarding');
      }

      if (data.url) {
        // Open Stripe onboarding in new tab
        window.open(data.url, '_blank', 'noopener,noreferrer');
        setHasOpenedStripe(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const handleCheckStatus = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const handleClose = useCallback(() => {
    setHasOpenedStripe(false);
    setError(null);
    onClose();
  }, [onClose]);

  const content = (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-accent/20 to-brand-accent/10 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-brand-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Connect Stripe
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Accept payments from your clients
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-2 rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
        </button>
      </div>

      {/* Status Display */}
      <div className="mb-6">
        {isConnected ? (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-200 font-albert">
                  Stripe Connected!
                </p>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-albert">
                  You can now accept payments from clients.
                </p>
              </div>
            </div>
          </div>
        ) : isPending ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200 font-albert">
                  Verification Pending
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 font-albert">
                  Complete your Stripe account setup to start accepting payments.
                </p>
              </div>
            </div>
          </div>
        ) : hasOpenedStripe ? (
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200 font-albert">
                  Waiting for Stripe...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-albert">
                  Complete the setup in the Stripe tab, then come back here.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-[#faf8f6] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#262b35]">
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Connect your Stripe account to accept credit card payments,
              set up subscriptions, and manage payouts — all directly through the platform.
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50">
          <p className="text-sm text-red-700 dark:text-red-300 font-albert">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {!isConnected && !hasOpenedStripe && (
          <button
            type="button"
            onClick={handleConnectStripe}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-accent text-white font-medium font-albert hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Stripe...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Connect with Stripe
              </>
            )}
          </button>
        )}

        {hasOpenedStripe && !isConnected && (
          <>
            <button
              type="button"
              onClick={handleConnectStripe}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-accent text-white font-medium font-albert hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening Stripe...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Open Stripe Again
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={statusLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium font-albert hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {statusLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  I&apos;ve Connected
                </>
              )}
            </button>
          </>
        )}

        {isPending && (
          <button
            type="button"
            onClick={handleConnectStripe}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-accent text-white font-medium font-albert hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Opening Stripe...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Continue Setup
              </>
            )}
          </button>
        )}

        {isConnected && (
          <button
            type="button"
            onClick={handleClose}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-brand-accent text-white font-medium font-albert hover:bg-brand-accent/90 transition-colors cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Done
          </button>
        )}

        {!isConnected && (
          <button
            type="button"
            onClick={handleClose}
            className="w-full px-4 py-2 text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors cursor-pointer"
          >
            I&apos;ll do this later
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[10010]" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 z-[10010] bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 z-[10011] overflow-y-auto pointer-events-none">
          <div className="flex min-h-full items-center justify-center p-4 pointer-events-none">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative z-[10012] w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all pointer-events-auto">
                {content}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
