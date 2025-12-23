'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { BackButton } from '@/components/discover';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Users, User, Calendar, Clock, Check, 
  ChevronRight, AlertCircle, Loader2, CheckCircle, XCircle,
  Star, Video, MessageCircle, Book, Target, Zap, Heart,
  ChevronDown
} from 'lucide-react';
import type { Program, ProgramCohort, ProgramDay, ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';

interface CohortWithAvailability extends ProgramCohort {
  spotsRemaining: number;
  isAvailableToUser: boolean;
  unavailableReason?: string;
}

interface ProgramDetailData {
  program: Program & {
    coachName: string;
    coachImageUrl?: string;
  };
  cohorts?: CohortWithAvailability[];
  days?: ProgramDay[];
  totalEnrollments?: number;
  enrollment: {
    id: string;
    status: string;
    cohortId?: string;
    startedAt: string;
  } | null;
  canEnroll: boolean;
  cannotEnrollReason?: string;
  branding?: {
    accentLight: string;
    accentDark: string;
  };
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000FF) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Icon mapping for features
const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'video': Video,
  'users': Users,
  'message-circle': MessageCircle,
  'book': Book,
  'target': Target,
  'calendar': Calendar,
  'check-circle': CheckCircle,
  'zap': Zap,
  'heart': Heart,
  'star': Star,
};

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  
  const programId = params.programId as string;
  
  const [data, setData] = useState<ProgramDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/discover/programs/${programId}`);
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Program not found');
        }
        
        const result = await response.json();
        setData(result);
        
        // Pre-select first available cohort
        if (result.cohorts?.length > 0) {
          const firstAvailable = result.cohorts.find((c: CohortWithAvailability) => c.isAvailableToUser);
          if (firstAvailable) {
            setSelectedCohortId(firstAvailable.id);
          }
        }
      } catch (err) {
        console.error('Error fetching program:', err);
        setError(err instanceof Error ? err.message : 'Failed to load program');
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, [programId]);

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleEnroll = async () => {
    if (!isSignedIn) {
      router.push('/sign-in?redirect=' + encodeURIComponent(`/discover/programs/${programId}`));
      return;
    }

    try {
      setEnrolling(true);
      
      const response = await fetch('/api/programs/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId,
          cohortId: selectedCohortId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to enroll');
      }

      // For paid programs, redirect to checkout
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      // For free programs, show success modal
      setSuccessModal({ open: true, message: result.message || 'Successfully enrolled!' });
    } catch (err) {
      console.error('Enrollment error:', err);
      setErrorModal({ open: true, message: err instanceof Error ? err.message : 'Failed to enroll' });
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading program...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
            {error || 'Program not found'}
          </h2>
          <Button
            onClick={() => router.push('/discover')}
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const { program, cohorts, enrollment, canEnroll, cannotEnrollReason, totalEnrollments, days, branding } = data;
  const selectedCohort = cohorts?.find(c => c.id === selectedCohortId);
  
  // Use coach's branding colors or defaults
  const accentLight = branding?.accentLight || '#a07855';
  const accentDark = branding?.accentDark || '#b8896a';
  // Derived hover color (slightly darker)
  const accentLightHover = branding?.accentLight ? adjustColorBrightness(branding.accentLight, -15) : '#8c6245';

  // Get curriculum days if showCurriculum is enabled
  const curriculumDays = program.showCurriculum && days 
    ? days.filter(d => d.title).sort((a, b) => a.dayIndex - b.dayIndex)
    : [];

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Hero Section */}
      <div className="relative">
        {/* Cover Image */}
        <div 
          className="h-[280px] sm:h-[360px] w-full relative"
          style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.3)}, ${hexToRgba(accentLightHover, 0.1)})` }}
        >
          {program.coverImageUrl ? (
            <Image
              src={program.coverImageUrl}
              alt={program.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.2)}, ${hexToRgba(accentLightHover, 0.1)})` }}
            >
              {program.type === 'group' ? (
                <Users className="w-24 h-24" style={{ color: hexToRgba(accentLight, 0.3) }} />
              ) : (
                <User className="w-24 h-24" style={{ color: hexToRgba(accentLight, 0.3) }} />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        </div>

        {/* Back button overlay */}
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>

        {/* Type badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 backdrop-blur-md shadow-lg ${
            program.type === 'group' 
              ? 'bg-blue-500/90 text-white'
              : 'bg-purple-500/90 text-white'
          }`}>
            {program.type === 'group' ? (
              <>
                <Users className="w-4 h-4" />
                Group Program
              </>
            ) : (
              <>
                <User className="w-4 h-4" />
                1:1 Coaching
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 -mt-24 relative z-10 pb-32">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
          {/* Left Column - Program Info */}
          <div className="lg:col-span-3 space-y-8">
            {/* Main Info Card */}
            <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-xl p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Badge */}
              <div 
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4"
                style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
              >
                <Star className="w-5 h-5" style={{ color: accentLight }} />
                <span 
                  className="font-albert text-[14px] font-semibold bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(to right, ${accentLight}, ${accentLightHover})` }}
                >
                  {program.type === 'group' ? 'Cohort-Based Program' : 'Personal Coaching'}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                {program.name}
              </h1>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 mb-6 text-text-secondary">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-albert">{program.lengthDays} days</span>
                </div>
                {program.showEnrollmentCount && totalEnrollments && totalEnrollments > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span className="font-albert">{totalEnrollments} enrolled</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {program.description && (
                <p className="font-albert text-[16px] sm:text-[18px] text-text-secondary leading-[1.6] mb-6">
                  {program.description}
                </p>
              )}

              {/* Coach Card */}
              <div className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={64}
                    height={64}
                    className="rounded-full border-2 border-white dark:border-[#262b35] shadow-md"
                  />
                ) : (
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white dark:border-[#262b35] shadow-md"
                    style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentLightHover})` }}
                  >
                    <span className="text-white font-albert font-bold text-xl">
                      {program.coachName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[18px] text-text-primary font-albert">
                    {program.coachName}
                  </div>
                  <div className="text-sm text-text-secondary font-albert">
                    Your Coach
                  </div>
                </div>
              </div>

              {/* Coach Bio */}
              {program.coachBio && (
                <div className="mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <h2 className="font-albert text-lg font-semibold text-text-primary mb-3">
                    About Your Coach
                  </h2>
                  <p className="font-albert text-[15px] text-text-secondary leading-[1.6] whitespace-pre-line">
                    {program.coachBio}
                  </p>
                </div>
              )}
            </div>

            {/* Key Outcomes */}
            {program.keyOutcomes && program.keyOutcomes.length > 0 && (
              <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
                <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary mb-6 tracking-[-1px]">
                  What you&apos;ll learn
                </h2>
                <div className="space-y-4">
                  {program.keyOutcomes.map((outcome, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
                      >
                        <Check className="w-4 h-4" style={{ color: accentLight }} />
                      </div>
                      <span className="font-albert text-[16px] text-text-primary leading-[1.5]">
                        {outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features / What's Included */}
            {program.features && program.features.length > 0 && (
              <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
                <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary mb-6 tracking-[-1px]">
                  What&apos;s included
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {program.features.map((feature: ProgramFeature, index: number) => {
                    const IconComponent = feature.icon ? featureIcons[feature.icon] || Star : Star;
                    return (
                      <div key={index} className="flex items-start gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
                        >
                          <IconComponent className="w-5 h-5" style={{ color: accentLight }} />
                        </div>
                        <div>
                          <div className="font-albert font-semibold text-[15px] text-text-primary">
                            {feature.title}
                          </div>
                          {feature.description && (
                            <div className="font-albert text-[13px] text-text-secondary mt-1">
                              {feature.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Curriculum Preview */}
            {curriculumDays.length > 0 && (
              <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
                <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary mb-6 tracking-[-1px]">
                  Program Curriculum
                </h2>
                <div className="space-y-3">
                  {curriculumDays.slice(0, 10).map((day) => (
                    <div key={day.id} className="flex items-center gap-4 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: hexToRgba(accentLight, 0.1) }}
                      >
                        <span className="font-albert font-semibold text-[14px]" style={{ color: accentLight }}>
                          {day.dayIndex}
                        </span>
                      </div>
                      <span className="font-albert text-[15px] text-text-primary">
                        {day.title}
                      </span>
                    </div>
                  ))}
                  {curriculumDays.length > 10 && (
                    <p className="text-center text-sm text-text-secondary font-albert pt-2">
                      + {curriculumDays.length - 10} more days
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Testimonials */}
            {program.testimonials && program.testimonials.length > 0 && (
              <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
                <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary mb-6 tracking-[-1px]">
                  What others are saying
                </h2>
                <div className="space-y-6">
                  {program.testimonials.map((testimonial: ProgramTestimonial, index: number) => (
                    <div key={index} className="p-5 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl">
                      {/* Stars */}
                      {testimonial.rating && (
                        <div className="flex items-center gap-1 mb-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= testimonial.rating!
                                  ? 'text-[#FFB800] fill-[#FFB800]'
                                  : 'text-[#d1ccc5] dark:text-[#7d8190]'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="font-albert text-[15px] text-text-secondary leading-[1.6] italic mb-4">
                        &quot;{testimonial.text}&quot;
                      </p>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[14px]"
                          style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentLightHover})` }}
                        >
                          {testimonial.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-albert text-[14px] font-medium text-text-primary">
                            {testimonial.author}
                          </p>
                          {testimonial.role && (
                            <p className="font-albert text-[12px] text-text-secondary">
                              {testimonial.role}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQs */}
            {program.faqs && program.faqs.length > 0 && (
              <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
                <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary mb-6 tracking-[-1px]">
                  Frequently asked questions
                </h2>
                <div className="space-y-3">
                  {program.faqs.map((faq: ProgramFAQ, index: number) => (
                    <details
                      key={index}
                      className="group bg-[#faf8f6] dark:bg-[#11141b] rounded-xl overflow-hidden"
                    >
                      <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                        <span className="font-albert text-[15px] font-medium text-text-primary pr-4">
                          {faq.question}
                        </span>
                        <ChevronDown
                          className="w-5 h-5 text-text-secondary flex-shrink-0 transition-transform group-open:rotate-180"
                        />
                      </summary>
                      <div className="px-4 pb-4">
                        <p className="font-albert text-[14px] text-text-secondary leading-[1.6]">
                          {faq.answer}
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Pricing Card (Sticky) */}
          <div className="lg:col-span-2 lg:sticky lg:top-6">
            <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-xl p-6 sm:p-8 border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Program badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div 
                  className="flex items-center gap-2 rounded-full px-4 py-2"
                  style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
                >
                  {program.type === 'group' ? (
                    <Users className="w-5 h-5" style={{ color: accentLight }} />
                  ) : (
                    <User className="w-5 h-5" style={{ color: accentLight }} />
                  )}
                  <span 
                    className="font-albert text-[14px] font-semibold bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(to right, ${accentLight}, ${accentLightHover})` }}
                  >
                    {program.type === 'group' ? 'Group Program' : '1:1 Coaching'}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-albert text-[48px] font-bold text-text-primary tracking-[-2px]">
                    {formatPrice(program.priceInCents)}
                  </span>
                </div>
                {program.priceInCents > 0 && (
                  <p className="font-albert text-[14px] text-text-secondary mt-1">
                    one-time payment
                  </p>
                )}
              </div>

              {/* Duration callout */}
              <div 
                className="rounded-xl p-3 mb-6 text-center"
                style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
              >
                <p className="font-albert text-[14px] text-text-primary">
                  <span className="font-semibold">{program.lengthDays}-day</span> transformation program
                </p>
              </div>

              {/* Enrolled Status */}
              {enrollment && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-semibold font-albert">
                      {enrollment.status === 'active' ? 'You\'re enrolled!' : 'Enrollment confirmed'}
                    </span>
                  </div>
                  {enrollment.status === 'upcoming' && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Starts {formatDate(enrollment.startedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Cohort Selection */}
              {program.type === 'group' && cohorts && cohorts.length > 0 && !enrollment && (
                <div className="mb-6">
                  <h3 className="font-albert text-sm font-semibold text-text-primary mb-3">
                    Select a cohort
                  </h3>
                  <div className="space-y-2">
                    {cohorts.map((cohort) => (
                      <button
                        key={cohort.id}
                        onClick={() => cohort.isAvailableToUser && setSelectedCohortId(cohort.id)}
                        disabled={!cohort.isAvailableToUser}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                          !cohort.isAvailableToUser 
                            ? 'border-[#e1ddd8] dark:border-[#262b35] opacity-50 cursor-not-allowed'
                            : 'border-[#e1ddd8] dark:border-[#262b35]'
                        }`}
                        style={selectedCohortId === cohort.id ? {
                          borderColor: accentLight,
                          backgroundColor: hexToRgba(accentLight, 0.05)
                        } : cohort.isAvailableToUser ? {
                          borderColor: undefined,
                        } : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-text-primary font-albert text-[15px]">
                              {cohort.name}
                            </div>
                            <div className="text-sm text-text-secondary flex items-center gap-2 mt-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                            </div>
                          </div>
                          <div className="text-right">
                            {cohort.isAvailableToUser ? (
                              <>
                                {cohort.spotsRemaining > 0 && cohort.spotsRemaining !== -1 ? (
                                  <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                                    {cohort.spotsRemaining} spots left
                                  </div>
                                ) : cohort.spotsRemaining === -1 ? (
                                  <div className="text-sm text-text-secondary">
                                    Open enrollment
                                  </div>
                                ) : null}
                                {selectedCohortId === cohort.id && (
                                  <Check className="w-5 h-5 mt-1 ml-auto" style={{ color: accentLight }} />
                                )}
                              </>
                            ) : (
                              <div className="text-sm text-red-500">
                                {cohort.unavailableReason || 'Unavailable'}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Program Info */}
              {program.type === 'individual' && !enrollment && (
                <div className="mb-6 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                  <div className="flex items-center gap-2 text-text-primary">
                    <Calendar className="w-5 h-5 text-green-500" />
                    <span className="font-semibold font-albert">Start anytime</span>
                  </div>
                  <p className="text-sm text-text-secondary mt-1">
                    Work directly with your coach at your own pace.
                  </p>
                </div>
              )}

              {/* Cannot Enroll Reason */}
              {!canEnroll && cannotEnrollReason && !enrollment && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-semibold font-albert text-sm">{cannotEnrollReason}</span>
                  </div>
                </div>
              )}

              {/* CTA Button */}
              {!enrollment ? (
                <Button
                  onClick={handleEnroll}
                  disabled={!canEnroll || enrolling || (program.type === 'group' && !selectedCohortId)}
                  className="w-full py-4 text-[17px] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-semibold transition-all"
                  style={{ 
                    background: `linear-gradient(to right, ${accentLight}, ${accentLightHover})`,
                    boxShadow: `0 10px 15px -3px ${hexToRgba(accentLight, 0.2)}`
                  }}
                >
                  {enrolling ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : !isSignedIn ? (
                    'Sign in to enroll'
                  ) : program.priceInCents === 0 ? (
                    'Enroll for free'
                  ) : (
                    `Enroll for ${formatPrice(program.priceInCents)}`
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => router.push('/program')}
                  className="w-full py-4 text-[17px] text-white rounded-2xl font-semibold transition-all"
                  style={{ 
                    background: `linear-gradient(to right, ${accentLight}, ${accentLightHover})`,
                    boxShadow: `0 10px 15px -3px ${hexToRgba(accentLight, 0.2)}`
                  }}
                >
                  Go to My Programs
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              )}

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-2 text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span className="font-albert text-[12px]">Secure checkout</span>
                </div>
                <div className="flex items-center gap-2 text-text-secondary">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-albert text-[12px]">Full access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <AlertDialog open={successModal.open} onOpenChange={(open) => {
        if (!open) {
          setSuccessModal({ open: false, message: '' });
          window.location.reload();
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-[#1a1a1a] dark:text-[#f5f5f8]">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Success!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] text-base">
              {successModal.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => {
                setSuccessModal({ open: false, message: '' });
                window.location.reload();
              }}
              className="text-white"
              style={{ backgroundColor: accentLight }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Modal */}
      <AlertDialog open={errorModal.open} onOpenChange={(open) => {
        if (!open) setErrorModal({ open: false, message: '' });
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-[#1a1a1a] dark:text-[#f5f5f8]">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Enrollment Failed
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] text-base">
              {errorModal.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setErrorModal({ open: false, message: '' })}
              className="text-white"
              style={{ backgroundColor: accentLight }}
            >
              Try Again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
