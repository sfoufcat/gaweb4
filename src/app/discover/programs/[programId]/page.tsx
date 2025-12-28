'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
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
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, User, Calendar, Clock, Check, 
  ChevronRight, AlertCircle, Loader2, CheckCircle, XCircle,
  Star, Video, MessageCircle, Book, Target, Zap, Heart,
  ChevronDown, Shield
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
  enrolledMemberAvatars?: string[];
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

// Stagger animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

// Enrolled Members Avatar Stack
function EnrolledMembersDisplay({ 
  count, 
  avatars, 
  accentLight 
}: { 
  count: number; 
  avatars: string[];
  accentLight: string;
}) {
  if (count === 0) return null;
  
  return (
    <div className="flex items-center gap-3">
      {avatars.length > 0 && (
        <div className="flex -space-x-2">
          {avatars.slice(0, 3).map((avatar, index) => (
            <div
              key={index}
              className="w-8 h-8 rounded-full border-2 border-white dark:border-[#171b22] overflow-hidden shadow-sm"
              style={{ zIndex: 3 - index }}
            >
              <Image
                src={avatar}
                alt=""
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span 
          className="font-albert font-semibold text-[14px]"
          style={{ color: accentLight }}
        >
          {count.toLocaleString()}
        </span>
        <span className="font-albert text-[14px] text-text-secondary">
          enrolled
        </span>
      </div>
    </div>
  );
}

// FAQ Accordion Item with Animation
function FAQItem({ 
  faq, 
  isOpen, 
  onToggle, 
  accentLight 
}: { 
  faq: ProgramFAQ; 
  isOpen: boolean; 
  onToggle: () => void;
  accentLight: string;
}) {
  return (
    <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-colors"
      >
        <span className="font-albert text-[15px] font-medium text-text-primary pr-4">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown 
            className="w-5 h-5 text-text-secondary" 
            style={isOpen ? { color: accentLight } : undefined}
          />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              <p className="font-albert text-[14px] text-text-secondary leading-[1.6]">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [joinCommunity, setJoinCommunity] = useState(true); // Default to opt-in for client community
  const [selectedStartDate, setSelectedStartDate] = useState<string>('');

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
          joinCommunity: joinCommunity, // For individual programs with client community
          startDate: selectedStartDate || undefined, // For individual programs with custom start date
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to enroll');
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

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
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary font-albert text-[14px]">Loading program...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8 bg-[#faf8f6] dark:bg-[#05070b]">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-text-primary font-albert mb-2">
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

  const { program, cohorts, enrollment, canEnroll, cannotEnrollReason, totalEnrollments, enrolledMemberAvatars, days, branding } = data;
  const selectedCohort = cohorts?.find(c => c.id === selectedCohortId);
  
  const accentLight = branding?.accentLight || '#a07855';
  const accentDark = branding?.accentDark || '#b8896a';
  const accentLightHover = branding?.accentLight ? adjustColorBrightness(branding.accentLight, -15) : '#8c6245';

  const curriculumDays = program.showCurriculum && days 
    ? days.filter(d => d.title).sort((a, b) => a.dayIndex - b.dayIndex)
    : [];

  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Hero Section - Full Width */}
      <div className="relative">
        <div 
          className="h-[200px] sm:h-[260px] w-full relative"
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
                <Users className="w-16 h-16" style={{ color: hexToRgba(accentLight, 0.4) }} />
              ) : (
                <User className="w-16 h-16" style={{ color: hexToRgba(accentLight, 0.4) }} />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>

        {/* Back button */}
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>

        {/* Type badge */}
        <div className="absolute top-4 right-4">
          <span 
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg text-white"
            style={{ backgroundColor: hexToRgba(accentLight, 0.9) }}
          >
            {program.type === 'group' ? (
              <>
                <Users className="w-3.5 h-3.5" />
                Group
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                1:1 Coaching
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
          
          {/* Top Section - Two Column Grid */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            
            {/* Left Column - Program Info */}
            <div className="lg:col-span-3">
              {/* Badge */}
              <div 
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 mb-4"
                style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
              >
                <Star className="w-4 h-4" style={{ color: accentLight }} />
                <span 
                  className="font-albert text-[13px] font-semibold"
                  style={{ color: accentLight }}
                >
                  {program.type === 'group' ? 'Personal Coaching' : 'Personal Coaching'}
                </span>
              </div>

              {/* Title (Hero Headline) */}
              <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                {program.heroHeadline || program.name}
              </h1>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Clock className="w-4 h-4" />
                  <span className="font-albert text-[14px]">{program.lengthDays} days</span>
                </div>
                {program.showEnrollmentCount && totalEnrollments && totalEnrollments > 0 && (
                  <EnrolledMembersDisplay 
                    count={totalEnrollments} 
                    avatars={enrolledMemberAvatars || []}
                    accentLight={accentLight}
                  />
                )}
              </div>

              {/* Description (Hero Subheadline) */}
              {(program.heroSubheadline || program.description) && (
                <p className="font-albert text-[16px] text-text-secondary leading-[1.6] mb-6">
                  {program.heroSubheadline || program.description}
                </p>
              )}

              {/* Coach Info */}
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={56}
                    height={56}
                    className="rounded-full border-2 border-white dark:border-[#262b35] shadow-md"
                  />
                ) : (
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center border-2 border-white dark:border-[#262b35] shadow-md"
                    style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                  >
                    <span className="text-white font-albert font-bold text-xl">
                      {program.coachName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[16px] text-text-primary font-albert">
                    {program.coachName}
                  </div>
                  <div className="text-[13px] text-text-secondary font-albert">
                    Your Coach
                  </div>
                </div>
              </div>

              {/* Coach Bio */}
              {program.coachBio && (
                <div className="mt-6">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary mb-2">
                    {program.coachHeadline || 'About Your Coach'}
                  </h3>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] whitespace-pre-line">
                    {program.coachBio}
                  </p>
                  {/* Coach Bullets/Credentials */}
                  {program.coachBullets && program.coachBullets.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {program.coachBullets.map((bullet, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accentLight }} />
                          <span className="font-albert text-[14px] text-text-secondary">
                            {bullet}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Benefits List (Key Outcomes) */}
              {program.keyOutcomes && program.keyOutcomes.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary mb-4">
                    What you&apos;ll learn
                  </h3>
                  <motion.div 
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {program.keyOutcomes.map((outcome, index) => (
                      <motion.div key={index} className="flex items-start gap-3" variants={staggerItem}>
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: accentLight }} />
                        </div>
                        <span className="font-albert text-[15px] text-text-primary leading-[1.5]">
                          {outcome}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Testimonial Preview (single) */}
              {program.testimonials && program.testimonials.length > 0 && (
                <div className="mt-8 bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (program.testimonials![0].rating || 5)
                            ? 'text-[#FFB800] fill-[#FFB800]'
                            : 'text-[#d1ccc5]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] italic mb-4">
                    &quot;{program.testimonials[0].text}&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[13px]"
                      style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                    >
                      {program.testimonials[0].author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-albert text-[13px] font-medium text-text-primary">
                        {program.testimonials[0].author}
                      </p>
                      {program.testimonials[0].role && (
                        <p className="font-albert text-[11px] text-text-secondary">
                          {program.testimonials[0].role}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sticky Pricing Card */}
            <div className="lg:col-span-2 lg:sticky lg:top-8">
              <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-8 shadow-lg border border-[#e1ddd8] dark:border-[#262b35]">
                {/* Program badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div 
                    className="flex items-center gap-2 rounded-full px-4 py-2"
                    style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
                  >
                    {program.type === 'group' ? (
                      <Users className="w-4 h-4" style={{ color: accentLight }} />
                    ) : (
                      <User className="w-4 h-4" style={{ color: accentLight }} />
                    )}
                    <span 
                      className="font-albert text-[13px] font-semibold"
                      style={{ color: accentLight }}
                    >
                      {program.type === 'group' ? 'Group Program' : '1:1 Coaching'}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary tracking-[-2px]">
                      {formatPrice(program.priceInCents)}
                    </span>
                  </div>
                  {program.priceInCents > 0 && (
                    <p className="font-albert text-[13px] text-text-secondary mt-1">
                      one-time payment
                    </p>
                  )}
                </div>

                {/* Duration callout */}
                <div 
                  className="rounded-xl p-3 mb-6 text-center"
                  style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentDark, 0.08)})` }}
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
                      <span className="font-semibold font-albert text-[14px]">
                        {enrollment.status === 'active' ? 'You\'re enrolled!' : 'Enrollment confirmed'}
                      </span>
                    </div>
                    {enrollment.status === 'upcoming' && (
                      <p className="text-[12px] text-green-600 dark:text-green-400 mt-1 ml-7">
                        Starts {formatDate(enrollment.startedAt)}
                      </p>
                    )}
                  </div>
                )}

                {/* Cohort Selection */}
                {program.type === 'group' && cohorts && cohorts.length > 0 && !enrollment && (
                  <div className="mb-6">
                    <h3 className="font-albert text-[13px] font-semibold text-text-primary mb-3">
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
                              : selectedCohortId === cohort.id
                                ? ''
                                : 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#d1ccc5]'
                          }`}
                          style={selectedCohortId === cohort.id ? {
                            borderColor: accentLight,
                            backgroundColor: hexToRgba(accentLight, 0.05)
                          } : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-text-primary font-albert text-[14px]">
                                {cohort.name}
                              </div>
                              <div className="text-[12px] text-text-secondary flex items-center gap-1.5 mt-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                              </div>
                            </div>
                            <div className="text-right">
                              {cohort.isAvailableToUser ? (
                                <>
                                  {cohort.spotsRemaining > 0 && cohort.spotsRemaining !== -1 ? (
                                    <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                                      {cohort.spotsRemaining} spots left
                                    </div>
                                  ) : cohort.spotsRemaining === -1 ? (
                                    <div className="text-[11px] text-text-secondary">
                                      Open enrollment
                                    </div>
                                  ) : null}
                                  {selectedCohortId === cohort.id && (
                                    <Check className="w-4 h-4 mt-1 ml-auto" style={{ color: accentLight }} />
                                  )}
                                </>
                              ) : (
                                <div className="text-[11px] text-red-500">
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

                {/* Individual Program Start Date */}
                {program.type === 'individual' && !enrollment && (
                  <div className="mb-6 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                    {program.allowCustomStartDate ? (
                      // User can select their start date
                      <>
                        <div className="flex items-center gap-2 text-text-primary mb-3">
                          <Calendar className="w-5 h-5" style={{ color: accentLight }} />
                          <span className="font-semibold font-albert text-[14px]">Choose your start date</span>
                        </div>
                        <input
                          type="date"
                          value={selectedStartDate}
                          onChange={(e) => setSelectedStartDate(e.target.value)}
                          min={program.defaultStartDate || new Date().toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#3a3f4b] rounded-lg bg-white dark:bg-[#1d222b] text-text-primary font-albert text-[14px] focus:outline-none focus:ring-2 transition-colors"
                          style={{ ['--tw-ring-color' as string]: accentLight }}
                        />
                        <p className="text-[12px] text-text-secondary mt-2">
                          {program.defaultStartDate 
                            ? `Earliest start date: ${formatDate(program.defaultStartDate)}`
                            : 'Select when you want to begin your journey'
                          }
                        </p>
                      </>
                    ) : program.defaultStartDate ? (
                      // Fixed start date set by coach
                      <>
                        <div className="flex items-center gap-2 text-text-primary">
                          <Calendar className="w-5 h-5" style={{ color: accentLight }} />
                          <span className="font-semibold font-albert text-[14px]">Program starts {formatDate(program.defaultStartDate)}</span>
                        </div>
                        <p className="text-[13px] text-text-secondary mt-1 ml-7">
                          Work directly with your coach on this schedule.
                        </p>
                      </>
                    ) : (
                      // No start date configured - immediate start (backward compatible)
                      <>
                        <div className="flex items-center gap-2 text-text-primary">
                          <Calendar className="w-5 h-5 text-green-500" />
                          <span className="font-semibold font-albert text-[14px]">Start anytime</span>
                        </div>
                        <p className="text-[13px] text-text-secondary mt-1 ml-7">
                          Work directly with your coach at your own pace.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Client Community Opt-in - For individual programs with community enabled */}
                {program.type === 'individual' && program.clientCommunityEnabled && !enrollment && (
                  <label className="flex items-start gap-3 mb-6 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl cursor-pointer hover:bg-[#f5f2ef] dark:hover:bg-[#1d222b] transition-colors">
                    <input
                      type="checkbox"
                      checked={joinCommunity}
                      onChange={(e) => setJoinCommunity(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-2 border-[#d4cfc9] dark:border-[#3a3f4b] text-[#a07855] focus:ring-[#a07855] focus:ring-offset-0"
                      style={{ accentColor: accentLight }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#a07855]" style={{ color: accentLight }} />
                        <span className="font-semibold font-albert text-[14px] text-text-primary">
                          Join the Client Community
                        </span>
                      </div>
                      <p className="text-[13px] text-text-secondary mt-1 leading-[1.5]">
                        Connect with other participants in a shared group chat. Share wins, ask questions, and support each other.
                      </p>
                    </div>
                  </label>
                )}

                {/* Cannot Enroll Reason */}
                {!canEnroll && cannotEnrollReason && !enrollment && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold font-albert text-[13px]">{cannotEnrollReason}</span>
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                {!enrollment ? (
                  <Button
                    onClick={handleEnroll}
                    disabled={!canEnroll || enrolling || (program.type === 'group' && !selectedCohortId)}
                    className="w-full py-4 text-[16px] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.35)}`
                    }}
                  >
                    {enrolling ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : !isSignedIn ? (
                      'Sign in to enroll'
                    ) : program.heroCtaText ? (
                      program.heroCtaText
                    ) : program.priceInCents === 0 ? (
                      'Enroll for free'
                    ) : (
                      `Enroll for ${formatPrice(program.priceInCents)}`
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push('/program')}
                    className="w-full py-4 text-[16px] text-white rounded-2xl font-semibold transition-all"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.3)}`
                    }}
                  >
                    Go to My Programs
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                )}

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Shield className="w-4 h-4" />
                    <span className="font-albert text-[12px]">Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-albert text-[12px]">Full access</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Sections - Stacked Cards */}
          
          {/* What's Included Card */}
          {program.features && program.features.length > 0 && (
            <div className="mt-12 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                What&apos;s included
              </h2>
              <motion.div 
                className="grid sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {program.features.map((feature: ProgramFeature, index: number) => {
                  const IconComponent = feature.icon ? featureIcons[feature.icon] || Star : Star;
                  return (
                    <motion.div 
                      key={index} 
                      className="flex items-start gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl"
                      variants={staggerItem}
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${hexToRgba(accentLight, 0.15)}, ${hexToRgba(accentDark, 0.1)})` }}
                      >
                        <IconComponent className="w-5 h-5" style={{ color: accentLight }} />
                      </div>
                      <div>
                        <div className="font-albert font-semibold text-[15px] text-text-primary">
                          {feature.title}
                        </div>
                        {feature.description && (
                          <div className="font-albert text-[13px] text-text-secondary mt-1 leading-[1.5]">
                            {feature.description}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          )}

          {/* Curriculum Card */}
          {curriculumDays.length > 0 && (
            <div className="mt-8 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                Program Curriculum
              </h2>
              <motion.div 
                className="space-y-2"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {curriculumDays.slice(0, 10).map((day) => (
                  <motion.div 
                    key={day.id} 
                    className="flex items-center gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl"
                    variants={staggerItem}
                  >
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
                  </motion.div>
                ))}
                {curriculumDays.length > 10 && (
                  <p className="text-center text-[13px] text-text-secondary font-albert pt-2">
                    + {curriculumDays.length - 10} more days
                  </p>
                )}
              </motion.div>
            </div>
          )}

          {/* All Testimonials Card */}
          {program.testimonials && program.testimonials.length > 1 && (
            <div className="mt-8 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                What others are saying
              </h2>
              <motion.div 
                className="grid sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {program.testimonials.slice(1).map((testimonial: ProgramTestimonial, index: number) => (
                  <motion.div 
                    key={index} 
                    className="p-5 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl"
                    variants={staggerItem}
                  >
                    {testimonial.rating && (
                      <div className="flex items-center gap-0.5 mb-3">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= testimonial.rating!
                                ? 'text-[#FFB800] fill-[#FFB800]'
                                : 'text-[#d1ccc5]'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    <p className="font-albert text-[14px] text-text-secondary leading-[1.6] italic mb-4">
                      &quot;{testimonial.text}&quot;
                    </p>
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[12px]"
                        style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                      >
                        {testimonial.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-albert text-[13px] font-medium text-text-primary">
                          {testimonial.author}
                        </p>
                        {testimonial.role && (
                          <p className="font-albert text-[11px] text-text-secondary">
                            {testimonial.role}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* FAQ Section */}
          {program.faqs && program.faqs.length > 0 && (
            <div className="mt-12 max-w-[800px] mx-auto">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                Frequently asked questions
              </h2>
              <div className="space-y-3">
                {program.faqs.map((faq: ProgramFAQ, index: number) => (
                  <FAQItem
                    key={index}
                    faq={faq}
                    isOpen={openFaqIndex === index}
                    onToggle={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    accentLight={accentLight}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating CTA - Dark Card */}
      {!enrollment && (
        <div 
          className="bg-[#1a1a1a] pt-12 pb-24 md:pb-12 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8"
        >
          <div className="max-w-[600px] mx-auto px-4 text-center">
            <h2 className="font-albert text-[24px] sm:text-[28px] font-semibold text-white mb-3 tracking-[-1px]">
              Ready to start your transformation?
            </h2>
            <p className="font-albert text-[15px] text-white/70 mb-6">
              Join {totalEnrollments ? `${totalEnrollments}+` : ''} members who are already on their growth journey.
            </p>
            <Button
              onClick={handleEnroll}
              disabled={!canEnroll || enrolling || (program.type === 'group' && !selectedCohortId)}
              className="inline-flex items-center justify-center py-4 px-8 rounded-3xl font-albert text-[16px] font-semibold transition-all duration-200 text-white"
              style={{ 
                background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                boxShadow: `0 8px 25px -4px ${hexToRgba(accentLight, 0.4)}`
              }}
            >
              {enrolling ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : program.heroCtaText ? (
                program.heroCtaText
              ) : program.priceInCents === 0 ? (
                'Enroll Now — It\'s Free'
              ) : (
                `Enroll for ${formatPrice(program.priceInCents)}`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <AlertDialog open={successModal.open} onOpenChange={(open) => {
        if (!open) {
          setSuccessModal({ open: false, message: '' });
          window.location.reload();
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-text-primary">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Success!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-[14px]">
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
            <AlertDialogTitle className="flex items-center gap-3 text-text-primary">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Enrollment Failed
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-[14px]">
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
