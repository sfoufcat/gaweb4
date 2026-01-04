'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { AlertCircle, CreditCard, RefreshCw, ArrowLeft, Clock, XCircle } from 'lucide-react';

type BlockReason = 'payment_failed' | 'canceled' | 'expired' | 'unknown';
type ResourceType = 'squad' | 'program';

interface SubscriptionInfo {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  reason: BlockReason;
  accessEndsAt?: string;
  currentPeriodEnd?: string;
  daysRemaining?: number;
}

export default function SubscriptionBlockedPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [updatingPayment, setUpdatingPayment] = useState(false);

  const resourceType = searchParams.get('type') as ResourceType || 'program';
  const resourceId = searchParams.get('id') || '';
  const reason = searchParams.get('reason') as BlockReason || 'unknown';

  useEffect(() => {
    async function fetchSubscriptionInfo() {
      if (!resourceId || !isSignedIn) {
        setLoading(false);
        return;
      }

      try {
        // Fetch resource details
        const endpoint = resourceType === 'squad' 
          ? `/api/squad/${resourceId}`
          : `/api/programs/${resourceId}`;
        
        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          
          // Calculate days remaining
          let daysRemaining: number | undefined;
          const accessEndsAt = data.accessEndsAt || data.currentPeriodEnd;
          if (accessEndsAt) {
            const endDate = new Date(accessEndsAt);
            const now = new Date();
            daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }

          setSubscriptionInfo({
            resourceType,
            resourceId,
            resourceName: data.name || (resourceType === 'squad' ? 'Squad' : 'Program'),
            reason,
            accessEndsAt,
            currentPeriodEnd: data.currentPeriodEnd,
            daysRemaining,
          });
        }
      } catch (error) {
        console.error('Error fetching subscription info:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptionInfo();
  }, [resourceId, resourceType, reason, isSignedIn]);

  const handleUpdatePayment = async () => {
    setUpdatingPayment(true);
    try {
      // Redirect to Stripe customer portal for subscription management
      const response = await fetch('/api/billing/subscription-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          resourceId,
          returnUrl: window.location.href,
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to access billing portal. Please try again.');
      }
    } catch (error) {
      console.error('Error accessing billing portal:', error);
      alert('Failed to access billing portal. Please try again.');
    } finally {
      setUpdatingPayment(false);
    }
  };

  const handleResubscribe = () => {
    // Navigate back to the resource's landing page
    const path = resourceType === 'squad'
      ? `/discover/squads/${resourceId}`
      : `/discover/programs/${resourceId}`;
    router.push(path);
  };

  const handleGoBack = () => {
    router.push('/dashboard');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-400">Please sign in to view this page.</p>
          <Button 
            onClick={() => router.push('/sign-in')}
            className="mt-4 bg-[#2dd4bf] hover:bg-[#14b8a6] text-black"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#2dd4bf]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Back Button */}
        <button
          onClick={handleGoBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        {/* Main Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              reason === 'payment_failed' 
                ? 'bg-red-500/10' 
                : reason === 'canceled'
                ? 'bg-amber-500/10'
                : 'bg-gray-500/10'
            }`}>
              {reason === 'payment_failed' ? (
                <AlertCircle className="w-8 h-8 text-red-500" />
              ) : reason === 'canceled' ? (
                <Clock className="w-8 h-8 text-amber-500" />
              ) : (
                <XCircle className="w-8 h-8 text-gray-500" />
              )}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-white text-center mb-2">
            {reason === 'payment_failed' 
              ? 'Payment Failed'
              : reason === 'canceled'
              ? 'Subscription Canceled'
              : 'Access Expired'
            }
          </h1>

          {/* Resource Name */}
          {subscriptionInfo?.resourceName && (
            <p className="text-gray-400 text-center mb-6">
              {subscriptionInfo.resourceName}
            </p>
          )}

          {/* Message */}
          <div className="bg-[#0f0f0f] rounded-xl p-4 mb-6">
            {reason === 'payment_failed' ? (
              <>
                <p className="text-gray-300 text-sm mb-3">
                  We couldn&apos;t process your payment. Please update your payment method to continue accessing this {resourceType}.
                </p>
                {subscriptionInfo?.daysRemaining !== undefined && subscriptionInfo.daysRemaining > 0 && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      {subscriptionInfo.daysRemaining} day{subscriptionInfo.daysRemaining !== 1 ? 's' : ''} remaining before access is removed
                    </span>
                  </div>
                )}
                {subscriptionInfo?.accessEndsAt && (
                  <p className="text-gray-500 text-xs mt-2">
                    Access ends: {formatDate(subscriptionInfo.accessEndsAt)}
                  </p>
                )}
              </>
            ) : reason === 'canceled' ? (
              <>
                <p className="text-gray-300 text-sm mb-3">
                  Your subscription has been canceled. You still have access until the end of your billing period.
                </p>
                {subscriptionInfo?.currentPeriodEnd && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>Access ends on {formatDate(subscriptionInfo.currentPeriodEnd)}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-300 text-sm">
                Your subscription has expired. Resubscribe to regain access to this {resourceType}.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {reason === 'payment_failed' ? (
              <Button
                onClick={handleUpdatePayment}
                disabled={updatingPayment}
                className="w-full bg-[#2dd4bf] hover:bg-[#14b8a6] text-black font-medium h-12"
              >
                {updatingPayment ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Update Payment Method
                  </>
                )}
              </Button>
            ) : reason === 'expired' ? (
              <Button
                onClick={handleResubscribe}
                className="w-full bg-[#2dd4bf] hover:bg-[#14b8a6] text-black font-medium h-12"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Resubscribe
              </Button>
            ) : (
              <Button
                onClick={handleResubscribe}
                variant="outline"
                className="w-full border-[#2a2a2a] text-white hover:bg-[#2a2a2a] h-12"
              >
                View {resourceType === 'squad' ? 'Squad' : 'Program'}
              </Button>
            )}

            <Button
              onClick={handleGoBack}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-[#2a2a2a] h-12"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Help Text */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Need help?{' '}
          <a href="mailto:support@coachful.co" className="text-[#2dd4bf] hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

