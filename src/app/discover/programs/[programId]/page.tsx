'use client';

import { useState, useEffect, useRef } from 'react';
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
  ChevronDown, Quote, Shield, Sparkles
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

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

// Hook for intersection observer animation triggers
function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

// Animated Section Wrapper
function AnimatedSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { ref, isInView } = useInView(0.15);
  
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeInUp}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

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
      {/* Stacked Avatars */}
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
      
      {/* Count and Label */}
      <div className="flex items-center gap-1.5">
        <span 
          className="font-albert font-semibold text-[14px]"
          style={{ color: accentLight }}
        >
          {count.toLocaleString()}
        </span>
        <span className="font-albert text-[14px] text-text-secondary">
          enrolled members
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
    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden bg-white dark:bg-[#171b22]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-colors"
      >
        <span className="font-albert text-[14px] sm:text-[15px] font-medium text-text-primary pr-4">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex-shrink-0"
        >
          <ChevronDown 
            className="w-5 h-5" 
            style={{ color: isOpen ? accentLight : undefined }}
          />
        </motion.div>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
              <p className="font-albert text-[13px] sm:text-[14px] text-text-secondary leading-[1.6]">
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
          <div className="w-10 h-10 border-3 border-[#a07855] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-[14px]">Loading program...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen px-4 py-8">
        <BackButton />
        <div className="text-center mt-12">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
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
  
  // Use coach's branding colors or defaults
  const accentLight = branding?.accentLight || '#a07855';
  const accentDark = branding?.accentDark || '#b8896a';
  const accentLightHover = branding?.accentLight ? adjustColorBrightness(branding.accentLight, -15) : '#8c6245';

  // Get curriculum days if showCurriculum is enabled
  const curriculumDays = program.showCurriculum && days 
    ? days.filter(d => d.title).sort((a, b) => a.dayIndex - b.dayIndex)
    : [];

  // Enrollment CTA Button
  const EnrollButton = ({ className = '', size = 'normal' }: { className?: string; size?: 'normal' | 'large' }) => (
    <Button
      onClick={handleEnroll}
      disabled={!canEnroll || enrolling || (program.type === 'group' && !selectedCohortId)}
      className={`${size === 'large' ? 'py-4 text-[15px]' : 'py-3 text-[14px]'} text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${className}`}
      style={{ 
        background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
        boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.35)}`
      }}
    >
      {enrolling ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
  );

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b]">
      {/* Hero Section */}
      <div className="relative">
        {/* Cover Image */}
        <div 
          className="h-[220px] sm:h-[280px] w-full relative"
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
                <Users className="w-20 h-20" style={{ color: hexToRgba(accentLight, 0.3) }} />
              ) : (
                <User className="w-20 h-20" style={{ color: hexToRgba(accentLight, 0.3) }} />
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

      {/* Main Content - Two Column Layout */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-start">
          {/* Left Column - Program Info */}
          <motion.div 
            className="lg:col-span-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="bg-white dark:bg-[#171b22] rounded-2xl shadow-xl p-5 sm:p-6 border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Badge */}
              <div 
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 mb-3"
                style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
              >
                <Star className="w-4 h-4" style={{ color: accentLight }} />
                <span 
                  className="font-albert text-[12px] font-semibold"
                  style={{ color: accentLight }}
                >
                  {program.type === 'group' ? 'Personal Coaching' : 'Personal Coaching'}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[24px] sm:text-[28px] lg:text-[32px] font-semibold text-text-primary leading-[1.15] tracking-[-1.5px] mb-3">
                {program.name}
              </h1>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span className="font-albert text-[13px]">{program.lengthDays} days</span>
                </div>
                {program.showEnrollmentCount && totalEnrollments && totalEnrollments > 0 && (
                  <EnrolledMembersDisplay 
                    count={totalEnrollments} 
                    avatars={enrolledMemberAvatars || []}
                    accentLight={accentLight}
                  />
                )}
              </div>

              {/* Description */}
              {program.description && (
                <p className="font-albert text-[14px] sm:text-[15px] text-text-secondary leading-[1.6] mb-5">
                  {program.description}
                </p>
              )}

              {/* Coach Card */}
              <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={48}
                    height={48}
                    className="rounded-full border-2 border-white dark:border-[#262b35] shadow-sm"
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white dark:border-[#262b35] shadow-sm"
                    style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                  >
                    <span className="text-white font-albert font-bold text-lg">
                      {program.coachName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="font-semibold text-[15px] text-text-primary font-albert">
                    {program.coachName}
                  </div>
                  <div className="text-[12px] text-text-secondary font-albert">
                    Your Coach
                  </div>
                </div>
              </div>

              {/* Coach Bio */}
              {program.coachBio && (
                <div className="mt-5 pt-5 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <h2 className="font-albert text-[15px] font-semibold text-text-primary mb-2">
                    About Your Coach
                  </h2>
                  <p className="font-albert text-[13px] text-text-secondary leading-[1.6] whitespace-pre-line">
                    {program.coachBio}
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Right Column - Pricing Card (Sticky) */}
          <motion.div 
            className="lg:col-span-2 lg:sticky lg:top-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="bg-white dark:bg-[#171b22] rounded-2xl shadow-xl p-5 sm:p-6 border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Program badge */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div 
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentLightHover, 0.1)})` }}
                >
                  {program.type === 'group' ? (
                    <Users className="w-4 h-4" style={{ color: accentLight }} />
                  ) : (
                    <User className="w-4 h-4" style={{ color: accentLight }} />
                  )}
                  <span 
                    className="font-albert text-[12px] font-semibold"
                    style={{ color: accentLight }}
                  >
                    {program.type === 'group' ? 'Group Program' : '1:1 Coaching'}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="text-center mb-4">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-albert text-[36px] sm:text-[40px] font-bold text-text-primary tracking-[-2px]">
                    {formatPrice(program.priceInCents)}
                  </span>
                </div>
                {program.priceInCents > 0 && (
                  <p className="font-albert text-[12px] text-text-secondary mt-0.5">
                    one-time payment
                  </p>
                )}
              </div>

              {/* Duration callout */}
              <div 
                className="rounded-lg p-2.5 mb-4 text-center"
                style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentLightHover, 0.08)})` }}
              >
                <p className="font-albert text-[13px] text-text-primary">
                  <span className="font-semibold">{program.lengthDays}-day</span> transformation program
                </p>
              </div>

              {/* Enrolled Status */}
              {enrollment && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-semibold font-albert text-[13px]">
                      {enrollment.status === 'active' ? 'You\'re enrolled!' : 'Enrollment confirmed'}
                    </span>
                  </div>
                  {enrollment.status === 'upcoming' && (
                    <p className="text-[12px] text-green-600 dark:text-green-400 mt-1">
                      Starts {formatDate(enrollment.startedAt)}
                    </p>
                  )}
                </div>
              )}

              {/* Cohort Selection */}
              {program.type === 'group' && cohorts && cohorts.length > 0 && !enrollment && (
                <div className="mb-4">
                  <h3 className="font-albert text-[12px] font-semibold text-text-primary mb-2">
                    Select a cohort
                  </h3>
                  <div className="space-y-2">
                    {cohorts.map((cohort) => (
                      <button
                        key={cohort.id}
                        onClick={() => cohort.isAvailableToUser && setSelectedCohortId(cohort.id)}
                        disabled={!cohort.isAvailableToUser}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
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
                            <div className="font-semibold text-text-primary font-albert text-[13px]">
                              {cohort.name}
                            </div>
                            <div className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
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
                                  <Check className="w-4 h-4 mt-0.5 ml-auto" style={{ color: accentLight }} />
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

              {/* Individual Program Info */}
              {program.type === 'individual' && !enrollment && (
                <div className="mb-4 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg">
                  <div className="flex items-center gap-2 text-text-primary">
                    <Calendar className="w-4 h-4 text-green-500" />
                    <span className="font-semibold font-albert text-[13px]">Start anytime</span>
                  </div>
                  <p className="text-[12px] text-text-secondary mt-1">
                    Work directly with your coach at your own pace.
                  </p>
                </div>
              )}

              {/* Cannot Enroll Reason */}
              {!canEnroll && cannotEnrollReason && !enrollment && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-semibold font-albert text-[12px]">{cannotEnrollReason}</span>
                  </div>
                </div>
              )}

              {/* CTA Button */}
              {!enrollment ? (
                <EnrollButton className="w-full" size="large" />
              ) : (
                <Button
                  onClick={() => router.push('/program')}
                  className="w-full py-3 text-[14px] text-white rounded-xl font-semibold transition-all"
                  style={{ 
                    background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                    boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.3)}`
                  }}
                >
                  Go to My Programs
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}

              {/* Trust badges */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Shield className="w-3.5 h-3.5" />
                  <span className="font-albert text-[11px]">Secure checkout</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="font-albert text-[11px]">Full access</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full-Width Sections Below */}
        <div className="mt-12 space-y-0">
          {/* What You'll Learn Section */}
          {program.keyOutcomes && program.keyOutcomes.length > 0 && (
            <AnimatedSection>
              <div 
                className="py-10 sm:py-12 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
                style={{ background: `linear-gradient(to bottom, ${hexToRgba(accentLight, 0.04)}, transparent)` }}
              >
                <div className="max-w-[900px] mx-auto">
                  <h2 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary mb-6 tracking-[-0.5px] text-center">
                    What you&apos;ll learn
                  </h2>
                  <motion.div 
                    className="grid sm:grid-cols-2 gap-3 sm:gap-4"
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                  >
                    {program.keyOutcomes.map((outcome, index) => (
                      <motion.div 
                        key={index} 
                        className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50"
                        variants={staggerItem}
                      >
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                        >
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="font-albert text-[13px] sm:text-[14px] text-text-primary leading-[1.5]">
                          {outcome}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* What's Included Section */}
          {program.features && program.features.length > 0 && (
            <AnimatedSection>
              <div className="py-10 sm:py-12">
                <div className="max-w-[900px] mx-auto">
                  <h2 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary mb-6 tracking-[-0.5px] text-center">
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
                          className="group flex items-start gap-4 p-4 sm:p-5 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] hover:shadow-lg hover:border-transparent transition-all duration-300"
                          style={{ '--hover-shadow': hexToRgba(accentLight, 0.15) } as React.CSSProperties}
                          variants={staggerItem}
                        >
                          <div 
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                            style={{ background: `linear-gradient(135deg, ${hexToRgba(accentLight, 0.15)}, ${hexToRgba(accentDark, 0.1)})` }}
                          >
                            <IconComponent className="w-5 h-5" style={{ color: accentLight }} />
                          </div>
                          <div>
                            <div className="font-albert font-semibold text-[14px] text-text-primary">
                              {feature.title}
                            </div>
                            {feature.description && (
                              <div className="font-albert text-[12px] text-text-secondary mt-1 leading-[1.5]">
                                {feature.description}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Program Curriculum Section */}
          {curriculumDays.length > 0 && (
            <AnimatedSection>
              <div 
                className="py-10 sm:py-12 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
                style={{ background: `linear-gradient(to bottom, ${hexToRgba(accentLight, 0.03)}, transparent)` }}
              >
                <div className="max-w-[900px] mx-auto">
                  <h2 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary mb-6 tracking-[-0.5px] text-center">
                    Program Curriculum
                  </h2>
                  <motion.div 
                    className="space-y-2"
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                  >
                    {curriculumDays.slice(0, 10).map((day, index) => (
                      <motion.div 
                        key={day.id} 
                        className="flex items-center gap-4 p-3 sm:p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 hover:border-transparent hover:shadow-md transition-all"
                        variants={staggerItem}
                      >
                        <div 
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: hexToRgba(accentLight, 0.1) }}
                        >
                          <span className="font-albert font-semibold text-[13px]" style={{ color: accentLight }}>
                            {day.dayIndex}
                          </span>
                        </div>
                        <span className="font-albert text-[13px] sm:text-[14px] text-text-primary">
                          {day.title}
                        </span>
                      </motion.div>
                    ))}
                    {curriculumDays.length > 10 && (
                      <p className="text-center text-[12px] text-text-secondary font-albert pt-2">
                        + {curriculumDays.length - 10} more days
                      </p>
                    )}
                  </motion.div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Testimonials Section */}
          {program.testimonials && program.testimonials.length > 0 && (
            <AnimatedSection>
              <div 
                className="py-10 sm:py-14 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8"
                style={{ background: `linear-gradient(135deg, #1a1a1a, #2d2d2d)` }}
              >
                <div className="max-w-[900px] mx-auto">
                  <h2 className="font-albert text-[18px] sm:text-[20px] font-semibold text-white mb-8 tracking-[-0.5px] text-center">
                    What others are saying
                  </h2>
                  <motion.div 
                    className="grid sm:grid-cols-2 gap-4 sm:gap-6"
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                  >
                    {program.testimonials.map((testimonial: ProgramTestimonial, index: number) => (
                      <motion.div 
                        key={index} 
                        className="relative p-5 sm:p-6 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10"
                        variants={staggerItem}
                      >
                        {/* Quote icon */}
                        <Quote 
                          className="absolute top-4 right-4 w-8 h-8 opacity-20" 
                          style={{ color: accentLight }} 
                        />
                        
                        {/* Stars */}
                        {testimonial.rating && (
                          <div className="flex items-center gap-0.5 mb-3">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= testimonial.rating!
                                    ? 'text-[#FFB800] fill-[#FFB800]'
                                    : 'text-white/20'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        
                        <p className="font-albert text-[13px] sm:text-[14px] text-white/80 leading-[1.6] italic mb-4">
                          &quot;{testimonial.text}&quot;
                        </p>
                        
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[13px]"
                            style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                          >
                            {testimonial.author.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-albert text-[13px] font-medium text-white">
                              {testimonial.author}
                            </p>
                            {testimonial.role && (
                              <p className="font-albert text-[11px] text-white/60">
                                {testimonial.role}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* FAQ Section */}
          {program.faqs && program.faqs.length > 0 && (
            <AnimatedSection>
              <div className="py-10 sm:py-12">
                <div className="max-w-[700px] mx-auto">
                  <h2 className="font-albert text-[18px] sm:text-[20px] font-semibold text-text-primary mb-6 tracking-[-0.5px] text-center">
                    Frequently asked questions
                  </h2>
                  <div className="space-y-2">
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
              </div>
            </AnimatedSection>
          )}

          {/* Final CTA Section */}
          {!enrollment && (
            <AnimatedSection>
              <div 
                className="py-10 sm:py-14 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 mb-8"
                style={{ background: `linear-gradient(135deg, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentDark, 0.04)})` }}
              >
                <div className="max-w-[600px] mx-auto text-center">
                  <h2 className="font-albert text-[20px] sm:text-[24px] font-semibold text-text-primary mb-2 tracking-[-1px]">
                    Ready to transform?
                  </h2>
                  <p className="font-albert text-[13px] sm:text-[14px] text-text-secondary mb-6">
                    Join {totalEnrollments ? `${totalEnrollments}+` : 'other'} members who are already on their journey.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <EnrollButton className="w-full sm:w-auto px-8" size="large" />
                    <div className="flex items-center gap-4 text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-4 h-4" />
                        <span className="font-albert text-[12px]">Secure</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4" />
                        <span className="font-albert text-[12px]">Full access</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>
      </div>

      {/* Bottom Padding */}
      <div className="h-16 sm:h-24" />

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
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Success!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] text-[14px]">
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
              <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              Enrollment Failed
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#5f5a55] dark:text-[#b2b6c2] text-[14px]">
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
