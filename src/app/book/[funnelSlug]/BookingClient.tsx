'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Script from 'next/script';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Video,
  User,
  Mail,
  Phone,
  ArrowLeft,
  Sparkles,
  CalendarCheck,
} from 'lucide-react';
import type { IntakeFormField, FunnelTrackingConfig } from '@/types';

interface BookingClientProps {
  config: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    duration: number;
    coverImageUrl?: string;
    requireEmail: boolean;
    requireName: boolean;
    requirePhone?: boolean;
    customFields?: IntakeFormField[];
    confirmationMessage?: string;
  };
  organization: {
    name: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  coach: {
    name: string;
    avatarUrl?: string;
  };
  timezone: string;
  orgSlug: string;
  funnelSlug: string;
  funnel?: {
    id: string;
    slug: string;
    name: string;
    tracking?: FunnelTrackingConfig;
  };
}

interface TimeSlot {
  start: string;
  end: string;
  duration: number;
}

type Step = 'calendar' | 'form' | 'confirmation';

export function BookingClient({
  config,
  organization,
  coach,
  timezone: coachTimezone,
  orgSlug,
  funnelSlug,
  funnel,
}: BookingClientProps) {
  // Step navigation
  const [step, setStep] = useState<Step>('calendar');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Booking state
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    eventId: string;
    meetingUrl?: string;
    confirmationMessage: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // User timezone
  const userTimezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  // Brand color from organization or default
  const brandColor = organization.primaryColor || '#a07855';

  // Fetch slots when date is selected
  useEffect(() => {
    if (!selectedDate) return;

    const fetchSlots = async () => {
      setIsLoadingSlots(true);
      setError(null);

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        const response = await fetch(
          `/api/public/intake/funnel/${orgSlug}/${funnelSlug}/slots?` +
            `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch available times');
        }

        const data = await response.json();
        setSlots(data.slots || []);
      } catch (err) {
        console.error('Error fetching slots:', err);
        setError('Failed to load available times');
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, orgSlug, funnelSlug]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: userTimezone,
    });
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('calendar');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setIsBooking(true);
    setError(null);

    try {
      const response = await fetch(`/api/public/intake/funnel/${orgSlug}/${funnelSlug}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDateTime: selectedSlot.start,
          endDateTime: selectedSlot.end,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
          timezone: userTimezone,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to book');
      }

      const data = await response.json();
      setBookingResult({
        eventId: data.event.id,
        meetingUrl: data.event.meetingUrl,
        confirmationMessage: data.confirmationMessage,
      });
      setStep('confirmation');
    } catch (err) {
      console.error('Error booking:', err);
      setError(err instanceof Error ? err.message : 'Failed to book. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const days = getDaysInMonth(currentMonth);
  const monthYear = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Tracking pixels from funnel
  const tracking = funnel?.tracking;

  return (
    <>
      {/* Tracking Pixels */}
      {tracking?.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${tracking.metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {tracking?.googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${tracking.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${tracking.googleAnalyticsId}');
            `}
          </Script>
        </>
      )}

      {tracking?.googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${tracking.googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${tracking.googleAdsId}');
            `}
          </Script>
        </>
      )}

      {tracking?.customHeadHtml && (
        <Script id="custom-head" strategy="afterInteractive">
          {tracking.customHeadHtml}
        </Script>
      )}

      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 to-transparent dark:from-white/[0.02] pointer-events-none" style={{ height: '50vh' }} />

        <div className="relative py-8 sm:py-12 px-4">
          <div className="max-w-lg mx-auto relative">
            {/* Back button - at top-left of container when on form step (matches funnel step pattern) */}
            {step === 'form' && (
              <button
                onClick={handleBack}
                className="absolute -top-2 left-0 p-2 rounded-full hover:bg-[#f5f3f0] dark:hover:bg-[#262b35] transition-colors z-10"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
              </button>
            )}

            {/* Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              {/* Logo */}
              {organization.logoUrl && (
                <div className="mb-4">
                  <img
                    src={organization.logoUrl}
                    alt={organization.name}
                    className="h-10 mx-auto object-contain"
                  />
                </div>
              )}

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-tight">
                {config.name}
              </h1>

              {/* Meta info */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#171b22] rounded-full text-sm text-[#5f5a55] dark:text-[#b2b6c2] shadow-sm border border-[#e1ddd8] dark:border-[#262b35]">
                  <Clock className="h-3.5 w-3.5" />
                  {config.duration} min
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#171b22] rounded-full text-sm text-[#5f5a55] dark:text-[#b2b6c2] shadow-sm border border-[#e1ddd8] dark:border-[#262b35]">
                  <Video className="h-3.5 w-3.5" />
                  Video call
                </span>
              </div>

              {/* Coach name */}
              <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] mt-3 font-albert">
                with {coach.name}
              </p>
            </motion.div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-800/30 font-albert text-sm"
              >
                {error}
              </motion.div>
            )}

            {/* Main Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-[#171b22] rounded-3xl shadow-xl shadow-black/[0.03] dark:shadow-black/20 border border-[#e1ddd8]/50 dark:border-[#262b35] overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {/* CALENDAR STEP */}
                {step === 'calendar' && (
                  <motion.div
                    key="calendar"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    {/* Calendar Header */}
                    <div className="flex items-center justify-between mb-5">
                      <button
                        onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                        className="p-2.5 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-xl transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      </button>
                      <h2 className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] text-lg">
                        {monthYear}
                      </h2>
                      <button
                        onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                        className="p-2.5 hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] rounded-xl transition-colors"
                      >
                        <ChevronRight className="h-5 w-5 text-[#5f5a55] dark:text-[#b2b6c2]" />
                      </button>
                    </div>

                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div
                          key={day}
                          className="text-center text-xs font-albert font-medium text-[#a7a39e] dark:text-[#7d8190] py-2"
                        >
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((date, i) => (
                        <div key={i} className="aspect-square p-0.5">
                          {date && (
                            <button
                              onClick={() => !isDateDisabled(date) && setSelectedDate(date)}
                              disabled={isDateDisabled(date)}
                              className={`w-full h-full flex items-center justify-center rounded-xl text-sm font-albert font-medium transition-all duration-200 ${
                                isDateSelected(date)
                                  ? 'text-white shadow-lg'
                                  : isDateDisabled(date)
                                  ? 'text-[#d1ccc7] dark:text-[#3a3f4b] cursor-not-allowed'
                                  : isToday(date)
                                  ? 'bg-[#f3f1ef] dark:bg-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#e9e5e0] dark:hover:bg-[#313746]'
                                  : 'text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#f3f1ef] dark:hover:bg-[#262b35]'
                              }`}
                              style={isDateSelected(date) ? { backgroundColor: brandColor } : undefined}
                            >
                              {date.getDate()}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    {selectedDate && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        <h3 className="font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
                          {selectedDate.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </h3>

                        {isLoadingSlots ? (
                          <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin" style={{ color: brandColor }} />
                          </div>
                        ) : slots.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="h-10 w-10 text-[#d1ccc7] dark:text-[#3a3f4b] mx-auto mb-3" />
                            <p className="text-[#a7a39e] dark:text-[#7d8190] font-albert">
                              No available times for this date
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {slots.map(slot => (
                              <button
                                key={slot.start}
                                onClick={() => handleSelectSlot(slot)}
                                className="px-3 py-2.5 text-sm font-albert font-medium bg-[#f9f8f7] dark:bg-[#1d222b] border border-[#e1ddd8] dark:border-[#313746] rounded-xl hover:border-[#a07855] dark:hover:border-[#b8896a] hover:bg-[#faf6f3] dark:hover:bg-[#222631] transition-all duration-200 text-[#1a1a1a] dark:text-[#f5f5f8]"
                              >
                                {formatTime(slot.start)}
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Timezone note */}
                    <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] mt-5 text-center font-albert">
                      Times shown in {userTimezone.replace(/_/g, ' ')}
                    </p>
                  </motion.div>
                )}

                {/* FORM STEP */}
                {step === 'form' && selectedSlot && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="p-6"
                  >
                    {/* Selected time display */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-[#f9f8f7] to-[#faf6f3] dark:from-[#1d222b] dark:to-[#222631] rounded-2xl border border-[#e1ddd8] dark:border-[#313746]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <CalendarCheck className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <div>
                          <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {new Date(selectedSlot.start).toLocaleDateString(undefined, {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                            {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Name field */}
                      <div>
                        <label className="block text-sm font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a7a39e] dark:text-[#7d8190]" />
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your name"
                            className="w-full pl-11 pr-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#a7a39e] dark:placeholder-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                            style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Email field */}
                      <div>
                        <label className="block text-sm font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a7a39e] dark:text-[#7d8190]" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            className="w-full pl-11 pr-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#a7a39e] dark:placeholder-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                            style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      {/* Phone field (optional) */}
                      {config.requirePhone && (
                        <div>
                          <label className="block text-sm font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                            Phone <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a7a39e] dark:text-[#7d8190]" />
                            <input
                              type="tel"
                              required
                              value={phone}
                              onChange={e => setPhone(e.target.value)}
                              placeholder="Your phone number"
                              className="w-full pl-11 pr-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#a7a39e] dark:placeholder-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      )}

                      {/* Custom fields */}
                      {config.customFields?.map(field => (
                        <div key={field.id}>
                          <label className="block text-sm font-albert font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              required={field.required}
                              value={customFieldValues[field.id] || ''}
                              onChange={e => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                              placeholder={field.placeholder}
                              rows={3}
                              className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#a7a39e] dark:placeholder-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:border-transparent resize-none transition-shadow"
                              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              required={field.required}
                              value={customFieldValues[field.id] || ''}
                              onChange={e => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                              className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                            >
                              <option value="">Select an option</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                              required={field.required}
                              value={customFieldValues[field.id] || ''}
                              onChange={e => setCustomFieldValues(v => ({ ...v, [field.id]: e.target.value }))}
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 bg-[#f9f8f7] dark:bg-[#11141b] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] placeholder-[#a7a39e] dark:placeholder-[#7d8190] font-albert focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
                            />
                          )}
                        </div>
                      ))}

                      {/* Submit button */}
                      <button
                        type="submit"
                        disabled={isBooking}
                        className="w-full py-3.5 rounded-xl font-albert font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                        style={{ backgroundColor: brandColor }}
                      >
                        {isBooking ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Booking...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Confirm Booking
                          </>
                        )}
                      </button>
                    </form>
                  </motion.div>
                )}

                {/* CONFIRMATION STEP */}
                {step === 'confirmation' && bookingResult && selectedSlot && (
                  <motion.div
                    key="confirmation"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="p-8 text-center"
                  >
                    {/* Success icon */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${brandColor}15` }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      >
                        <Sparkles className="h-10 w-10" style={{ color: brandColor }} />
                      </motion.div>
                    </motion.div>

                    <h2 className="text-2xl font-albert font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                      You're all set!
                    </h2>

                    <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-6">
                      {bookingResult.confirmationMessage || 'Your call has been booked successfully.'}
                    </p>

                    {/* Booking details card */}
                    <div className="p-5 bg-gradient-to-r from-[#f9f8f7] to-[#faf6f3] dark:from-[#1d222b] dark:to-[#222631] rounded-2xl border border-[#e1ddd8] dark:border-[#313746] mb-6 text-left">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${brandColor}15` }}
                        >
                          <Video className="h-5 w-5" style={{ color: brandColor }} />
                        </div>
                        <div>
                          <p className="font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                            {config.name}
                          </p>
                          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mt-0.5">
                            {new Date(selectedSlot.start).toLocaleDateString(undefined, {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                            {' at '}
                            {formatTime(selectedSlot.start)}
                          </p>
                          <p className="text-xs text-[#a7a39e] dark:text-[#7d8190] font-albert mt-1">
                            with {coach.name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Meeting link button */}
                    {bookingResult.meetingUrl && (
                      <a
                        href={bookingResult.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-albert font-semibold text-white shadow-lg hover:shadow-xl transition-all duration-200"
                        style={{ backgroundColor: brandColor }}
                      >
                        <Video className="h-4 w-4" />
                        Join Meeting
                      </a>
                    )}

                    {/* Email confirmation note */}
                    <p className="text-sm text-[#a7a39e] dark:text-[#7d8190] font-albert mt-6">
                      A confirmation has been sent to {email}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Footer */}
            <p className="text-center text-xs text-[#a7a39e] dark:text-[#7d8190] mt-8 font-albert">
              Powered by{' '}
              <a href="https://coachful.co" className="hover:text-[#5f5a55] dark:hover:text-[#b2b6c2] transition-colors">
                Coachful
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Custom body HTML (for tracking) */}
      {tracking?.customBodyHtml && (
        <div dangerouslySetInnerHTML={{ __html: tracking.customBodyHtml }} />
      )}
    </>
  );
}
