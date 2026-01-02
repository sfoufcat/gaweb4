'use client';

import { useState, useEffect } from 'react';
import { Phone, Calendar, DollarSign, Loader2 } from 'lucide-react';
import { RequestCallModal } from './RequestCallModal';
import type { CoachCallSettings } from '@/types';

interface RequestCallCardProps {
  coachName: string;
  coachAvatarUrl?: string;
}

/**
 * RequestCallCard
 * 
 * A card displayed on the user's homepage that allows them to request
 * a call with their coach. Only shown if the coach allows client requests.
 */
export function RequestCallCard({ coachName, coachAvatarUrl }: RequestCallCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [callSettings, setCallSettings] = useState<CoachCallSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  // Fetch call settings to check if requests are allowed and pricing
  useEffect(() => {
    async function fetchCallSettings() {
      try {
        const response = await fetch('/api/scheduling/call-settings');
        if (response.ok) {
          const data = await response.json();
          setCallSettings(data.settings);
          setIsAllowed(data.settings?.allowClientRequests ?? true);
        }
      } catch (err) {
        console.error('Error fetching call settings:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCallSettings();
  }, []);

  // Don't render if loading or not allowed
  if (isLoading) {
    return null;
  }

  if (!isAllowed) {
    return null;
  }

  const isPaid = callSettings?.pricingModel === 'per_call' || callSettings?.pricingModel === 'both';
  const priceInCents = callSettings?.pricePerCallCents || 0;

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  return (
    <>
      <div className="p-4 bg-gradient-to-br from-brand-accent/5 to-brand-accent/10 border border-brand-accent/20 rounded-2xl">
        <div className="flex items-center gap-4">
          {/* Coach Avatar */}
          <div className="flex-shrink-0">
            {coachAvatarUrl ? (
              <img
                src={coachAvatarUrl}
                alt={coachName}
                className="w-12 h-12 rounded-full object-cover border-2 border-brand-accent/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-accent/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-brand-accent" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              {callSettings?.callRequestButtonLabel || 'Schedule a Call'}
            </h3>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] line-clamp-1">
              {callSettings?.callRequestDescription || `Book a 1-on-1 call with ${coachName}`}
            </p>
            {isPaid && priceInCents > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <DollarSign className="w-3 h-3 text-brand-accent" />
                <span className="text-xs font-medium text-brand-accent">
                  {formatPrice(priceInCents)} per call
                </span>
              </div>
            )}
          </div>

          {/* Request Button */}
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-brand-accent text-white rounded-xl font-albert font-medium text-sm hover:bg-brand-accent/90 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Request
          </button>
        </div>
      </div>

      {/* Request Call Modal */}
      <RequestCallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        coachName={coachName}
        isPaid={isPaid}
        priceInCents={priceInCents}
        onSuccess={() => {
          // Could show a success toast here
        }}
      />
    </>
  );
}

