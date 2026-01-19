'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  X,
  Calendar,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Check,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Globe,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAvailableSlots } from '@/hooks/useAvailability';
import { useSchedulingActions } from '@/hooks/useScheduling';
import { useCallUsage, formatCallUsageStatus, formatWeeklyLimitStatus, formatExtraCallPrice } from '@/hooks/useCallUsage';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface RequestCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  coachName: string;
  /** If call is paid, show the price */
  isPaid?: boolean;
  priceInCents?: number;
  /** Enrollment ID for program call tracking */
  enrollmentId?: string;
  onSuccess?: () => void;
}

const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
];

interface ProposedTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

type CallTypeOption = 'program' | 'extra';

/**
 * PaymentForm component for Stripe Elements
 */
interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
  amount: number;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
}

function PaymentForm({ onSuccess, onCancel, amount, isSubmitting, setIsSubmitting }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Payment failed');
        setIsSubmitting(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else {
        setError('Payment was not completed');
        setIsSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handlePaymentSubmit} className="space-y-4">
      <div className="p-4 bg-[#f9f8f7] dark:bg-[#1e222a] rounded-xl">
        <PaymentElement />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-6 py-3 text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || isSubmitting}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-albert font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CreditCard className="w-4 h-4" />
          )}
          Pay ${(amount / 100).toFixed(2)}
        </button>
      </div>
    </form>
  );
}

/**
 * RequestCallModal
 *
 * Modal for users/clients to request a call with their coach.
 * They can propose multiple time slots for the coach to choose from.
 *
 * When client has an active program enrollment, shows call type selector:
 * - Program Call: Uses client's monthly allowance
 * - Extra Call: Paid call beyond allowance
 */
export function RequestCallModal({
  isOpen,
  onClose,
  coachName,
  isPaid = false,
  priceInCents = 0,
  enrollmentId,
  onSuccess,
}: RequestCallModalProps) {
  const { requestCall, isLoading, error } = useSchedulingActions();

  // Fetch call usage if enrollment exists
  const {
    usage,
    isLoading: usageLoading,
    canScheduleProgramCall,
    isWeeklyLimitReached,
    hasAllowance,
  } = useCallUsage(enrollmentId, isOpen);

  // Booking mode: 'propose' = client proposes times, 'direct' = client books directly
  const callBookingMode = usage?.callBookingMode || 'propose';
  const isDirectBooking = callBookingMode === 'direct';

  // Form state
  const [duration, setDuration] = useState(60);
  const [description, setDescription] = useState('');
  const [callType, setCallType] = useState<CallTypeOption>('program');

  // Selected/proposed times
  const [proposedSlots, setProposedSlots] = useState<ProposedTimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');

  // Success state
  const [showSuccess, setShowSuccess] = useState(false);

  // Payment state for extra calls
  const [showPayment, setShowPayment] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);

  // Date range for available slots (next 30 days)
  const dateRange = useMemo(() => {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }, []);

  // Fetch available slots
  const { slots, isLoading: slotsLoading } = useAvailableSlots(
    dateRange.startDate,
    dateRange.endDate,
    duration
  );

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped: Record<string, typeof slots> = {};
    for (const slot of slots) {
      const date = new Date(slot.start).toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    }
    return grouped;
  }, [slots]);

  // Available dates
  const availableDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  // Determine if we should show call type selector
  const showCallTypeSelector = !!(hasAllowance && enrollmentId);

  // Extra call price - from program or fallback to props
  const extraCallPrice = usage?.pricePerExtraCallCents ?? priceInCents;

  // Auto-select call type based on availability
  useMemo(() => {
    if (!showCallTypeSelector) return;

    // If can't schedule program call, force extra
    if (!canScheduleProgramCall) {
      setCallType('extra');
    }
  }, [showCallTypeSelector, canScheduleProgramCall]);

  // Add a proposed time slot
  const addProposedSlot = useCallback(() => {
    if (!selectedDate || !selectedTime) return;

    const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    const newSlot: ProposedTimeSlot = {
      id: `slot_${Date.now()}`,
      date: selectedDate,
      startTime: selectedTime,
      endTime: endDateTime.toTimeString().slice(0, 5),
    };

    setProposedSlots(prev => [...prev, newSlot]);
    setSelectedTime('');
  }, [selectedDate, selectedTime, duration]);

  // Remove a proposed time slot
  const removeProposedSlot = useCallback((slotId: string) => {
    setProposedSlots(prev => prev.filter(s => s.id !== slotId));
  }, []);

  // Check if payment is required for extra calls
  const requiresPayment = showCallTypeSelector && callType === 'extra' && extraCallPrice > 0;

  // Initialize payment for extra calls
  const initializePayment = useCallback(async () => {
    if (!enrollmentId) return;

    setIsCreatingPayment(true);
    setPaymentError(null);

    try {
      const response = await fetch('/api/scheduling/extra-call-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enrollmentId,
          durationMinutes: duration,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      setPaymentClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setShowPayment(true);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to initialize payment');
    } finally {
      setIsCreatingPayment(false);
    }
  }, [enrollmentId, duration]);

  // Handle form submission (after payment if required)
  const handleSubmit = async (paidPaymentIntentId?: string) => {
    // For direct booking: need selectedDate and selectedTime
    // For propose mode: need at least one proposedSlot
    if (isDirectBooking) {
      if (!selectedDate || !selectedTime) return;
    } else {
      if (proposedSlots.length === 0) return;
    }

    try {
      if (isDirectBooking) {
        // Direct booking: single confirmed event
        const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

        await requestCall({
          directBooking: true,
          startDateTime: startDateTime.toISOString(),
          endDateTime: endDateTime.toISOString(),
          description,
          duration,
          // Pass program call info if applicable
          ...(showCallTypeSelector && {
            isProgramCall: callType === 'program',
            isExtraCall: callType === 'extra',
            enrollmentId,
            ...(paidPaymentIntentId && { paymentIntentId: paidPaymentIntentId }),
          }),
        });
      } else {
        // Propose mode: multiple proposed times
        const proposedTimes = proposedSlots.map(slot => {
          const startDateTime = new Date(`${slot.date}T${slot.startTime}`);
          const endDateTime = new Date(`${slot.date}T${slot.endTime}`);
          return {
            startDateTime: startDateTime.toISOString(),
            endDateTime: endDateTime.toISOString(),
          };
        });

        await requestCall({
          proposedTimes,
          description,
          duration,
          // Pass program call info if applicable
          ...(showCallTypeSelector && {
            isProgramCall: callType === 'program',
            isExtraCall: callType === 'extra',
            enrollmentId,
            ...(paidPaymentIntentId && { paymentIntentId: paidPaymentIntentId }),
          }),
        });
      }

      // Show success message before closing
      setShowSuccess(true);
      setShowPayment(false);
      onSuccess?.();

      // Auto-close after showing success
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  // Handle "Continue" button - either go to payment or submit directly
  const handleContinue = useCallback(() => {
    if (requiresPayment) {
      initializePayment();
    } else {
      handleSubmit();
    }
  }, [requiresPayment, initializePayment]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Format time for display
  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format price
  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Get user's timezone for display
  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Local Time';
    }
  }, []);

  // Format timezone for display (e.g., "America/New_York" -> "New York")
  const formatTimezone = (tz: string) => {
    try {
      return tz.replace(/_/g, ' ').split('/').pop() || tz;
    } catch {
      return tz;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-hidden bg-white dark:bg-[#171b22] rounded-t-2xl sm:rounded-2xl shadow-2xl animate-modal-slide-up sm:animate-modal-zoom-in flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <div>
            <h2 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
              Request a Call
            </h2>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
              with {coachName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#5f5a55] hover:text-[#1a1a1a] dark:text-[#b2b6c2] dark:hover:text-[#f5f5f8] rounded-lg hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
        {/* Success View */}
        {showSuccess ? (
          <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-albert text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              {isDirectBooking ? 'Call Booked!' : 'Request Sent!'}
            </h3>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2]">
              {isDirectBooking
                ? `Your call with ${coachName} has been confirmed.`
                : `Your call request has been sent to ${coachName}. You'll be notified when they respond.`}
            </p>
          </div>
        ) : (
        /* Content */
        <div className="p-6 space-y-6">
          {/* Loading usage */}
          {enrollmentId && usageLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
            </div>
          )}

          {/* Call Type Selector - only show if has program enrollment with allowance */}
          {showCallTypeSelector && !usageLoading && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                Call Type
              </label>

              {/* Program Call Option */}
              <button
                onClick={() => canScheduleProgramCall && setCallType('program')}
                disabled={!canScheduleProgramCall}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  callType === 'program'
                    ? 'border-brand-accent bg-brand-accent/5'
                    : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4050]'
                } ${!canScheduleProgramCall ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    callType === 'program' ? 'border-brand-accent bg-brand-accent' : 'border-[#c5c0ba] dark:border-[#4a5060]'
                  }`}>
                    {callType === 'program' && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-accent" />
                      <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                        Program Call
                      </span>
                    </div>
                    <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                      {formatCallUsageStatus(usage)}
                    </p>
                    {isWeeklyLimitReached && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        {formatWeeklyLimitStatus(usage)}
                      </p>
                    )}
                    {usage?.programName && (
                      <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-1">
                        Linked to: {usage.programName}
                      </p>
                    )}
                  </div>
                </div>
              </button>

              {/* Extra Call Option */}
              {extraCallPrice > 0 && (
                <button
                  onClick={() => setCallType('extra')}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    callType === 'extra'
                      ? 'border-brand-accent bg-brand-accent/5'
                      : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#c5c0ba] dark:hover:border-[#3a4050]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      callType === 'extra' ? 'border-brand-accent bg-brand-accent' : 'border-[#c5c0ba] dark:border-[#4a5060]'
                    }`}>
                      {callType === 'extra' && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                          Extra Call — {formatExtraCallPrice(extraCallPrice)}
                        </span>
                      </div>
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                        Not linked to program. Coach receives payment after confirmation.
                      </p>
                    </div>
                  </div>
                </button>
              )}

              {/* No extra call price set */}
              {extraCallPrice === 0 && !canScheduleProgramCall && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    You&apos;ve used all your program calls. Contact your coach to schedule an extra call.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Price notice - only show for extra/non-program calls */}
          {((isPaid && priceInCents > 0 && !showCallTypeSelector) ||
            (showCallTypeSelector && callType === 'extra' && extraCallPrice > 0)) && (
            <div className="flex items-center gap-3 p-4 bg-brand-accent/10 border border-brand-accent/20 rounded-xl">
              <DollarSign className="w-5 h-5 text-brand-accent" />
              <div>
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {formatPrice(showCallTypeSelector ? extraCallPrice : priceInCents)} per call
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  You&apos;ll be prompted to pay after the coach confirms
                </p>
              </div>
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              Duration
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 py-2 px-4 rounded-lg font-albert text-sm font-medium transition-colors ${
                    duration === opt.value
                      ? 'bg-brand-accent text-white'
                      : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-[#f3f1ef] dark:bg-[#1e222a] border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2]" />
                  <span className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {isDirectBooking ? 'Select Your Time Slot' : 'Select Date & Time'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Globe className="w-3 h-3" />
                  <span>{formatTimezone(userTimezone)}</span>
                </div>
              </div>
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                {isDirectBooking
                  ? 'Select an available time slot to book your call.'
                  : 'Propose times that work for you. Times shown in your local timezone.'}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
                </div>
              ) : availableDates.length === 0 ? (
                <p className="text-center text-[#a7a39e] dark:text-[#7d8190] py-8">
                  No available time slots in the next 30 days.
                </p>
              ) : (
                <>
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      Date
                    </label>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {availableDates.slice(0, 14).map(date => (
                        <button
                          key={date}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime('');
                          }}
                          className={`px-3 py-2 rounded-lg font-albert text-sm transition-colors ${
                            selectedDate === date
                              ? 'bg-brand-accent text-white'
                              : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746]'
                          }`}
                        >
                          {formatDate(date)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time Selection */}
                  {selectedDate && slotsByDate[selectedDate] && (
                    <div>
                      <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                        Time
                      </label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {slotsByDate[selectedDate].map((slot, index) => {
                          const time = new Date(slot.start).toTimeString().slice(0, 5);
                          return (
                            <button
                              key={index}
                              onClick={() => setSelectedTime(time)}
                              className={`px-3 py-2 rounded-lg font-albert text-sm transition-colors ${
                                selectedTime === time
                                  ? 'bg-brand-accent text-white'
                                  : 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e8e4df] dark:hover:bg-[#313746]'
                              }`}
                            >
                              {formatTime(time)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Add Time Button - only for propose mode */}
                  {!isDirectBooking && selectedDate && selectedTime && (
                    <button
                      onClick={addProposedSlot}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 text-brand-accent rounded-lg font-albert font-medium hover:bg-brand-accent/20 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add this time
                    </button>
                  )}

                  {/* Selected time confirmation - for direct booking */}
                  {isDirectBooking && selectedDate && selectedTime && (
                    <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {formatDate(selectedDate)} at {formatTime(selectedTime)} ({duration} min)
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Proposed Times List - only for propose mode */}
          {!isDirectBooking && proposedSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                Your Proposed Times
              </label>
              <div className="space-y-2">
                {proposedSlots.map(slot => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="font-albert text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {formatDate(slot.date)} at {formatTime(slot.startTime)}
                      </span>
                    </div>
                    <button
                      onClick={() => removeProposedSlot(slot.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
              What would you like to discuss? (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Share what you'd like to cover in the call..."
              className="w-full px-4 py-3 bg-white dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] focus:outline-none focus:ring-2 focus:ring-brand-accent resize-none"
            />
          </div>

          {/* Error Message */}
          {(error || paymentError) && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error || paymentError}</p>
            </div>
          )}
        </div>
        )}

        {/* Payment View - show when payment is required and initialized */}
        {showPayment && paymentClientSecret && (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl">
              <CreditCard className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Complete Payment
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Pay {formatPrice(extraCallPrice)} for your extra call
                </p>
              </div>
            </div>

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: paymentClientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#1a1a1a',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <PaymentForm
                amount={extraCallPrice}
                onSuccess={(paidIntentId) => {
                  handleSubmit(paidIntentId);
                }}
                onCancel={() => {
                  setShowPayment(false);
                  setPaymentClientSecret(null);
                  setPaymentIntentId(null);
                }}
                isSubmitting={isPaymentSubmitting}
                setIsSubmitting={setIsPaymentSubmitting}
              />
            </Elements>
          </div>
        )}

        {/* Footer - hide when showing success or payment */}
        {!showSuccess && !showPayment && (
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#171b22]">
          <button
            onClick={onClose}
            className="px-6 py-3 text-[#5f5a55] dark:text-[#b2b6c2] font-albert font-medium hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={
              // Different validation for direct booking vs propose mode
              (isDirectBooking ? (!selectedDate || !selectedTime) : proposedSlots.length === 0) ||
              isLoading ||
              isCreatingPayment ||
              (showCallTypeSelector && !canScheduleProgramCall && callType === 'program')
            }
            className="flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] dark:bg-brand-accent text-white rounded-xl font-albert font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {(isLoading || isCreatingPayment) && <Loader2 className="w-4 h-4 animate-spin" />}
            {requiresPayment
              ? 'Continue to Payment'
              : isDirectBooking
                ? 'Book Call'
                : 'Send Request'}
          </button>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
