'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { BackButton, SectionHeader } from '@/components/discover';
import { Button } from '@/components/ui/button';
import { 
  Users, User, Calendar, Clock, DollarSign, Check, 
  ChevronRight, AlertCircle, Loader2 
} from 'lucide-react';
import type { Program, ProgramCohort } from '@/types';

interface CohortWithAvailability extends ProgramCohort {
  spotsRemaining: number;
  isAvailableToUser: boolean;
  unavailableReason?: string;
}

interface ProgramDetailData {
  program: Program & {
    coachName: string;
    coachImageUrl?: string;
    coachBio?: string;
  };
  cohorts?: CohortWithAvailability[];
  enrollment: {
    id: string;
    status: string;
    cohortId?: string;
    startedAt: string;
  } | null;
  canEnroll: boolean;
  cannotEnrollReason?: string;
}

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { organization } = useOrganization();
  
  const programId = params.programId as string;
  
  const [data, setData] = useState<ProgramDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

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

      // For free programs, show success and refresh
      alert(result.message || 'Successfully enrolled!');
      
      // Refresh the page data
      window.location.reload();
    } catch (err) {
      console.error('Enrollment error:', err);
      alert(err instanceof Error ? err.message : 'Failed to enroll');
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

  const { program, cohorts, enrollment, canEnroll, cannotEnrollReason } = data;
  const selectedCohort = cohorts?.find(c => c.id === selectedCohortId);

  return (
    <div className="min-h-screen pb-32">
      {/* Header with cover image */}
      <div className="relative">
        {/* Cover Image */}
        <div className="h-[200px] sm:h-[280px] w-full bg-gradient-to-br from-[#a07855]/30 to-[#8c6245]/10 relative">
          {program.coverImageUrl ? (
            <Image
              src={program.coverImageUrl}
              alt={program.name}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {program.type === 'group' ? (
                <Users className="w-20 h-20 text-[#a07855]/30" />
              ) : (
                <User className="w-20 h-20 text-[#a07855]/30" />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>

        {/* Back button overlay */}
        <div className="absolute top-4 left-4">
          <BackButton />
        </div>

        {/* Type badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 backdrop-blur-sm ${
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

      {/* Content */}
      <div className="px-4 sm:px-8 -mt-16 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Main Card */}
          <div className="bg-white dark:bg-[#171b22] rounded-2xl shadow-xl p-6 sm:p-8">
            {/* Title & Price */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-[-1px] mb-2">
                  {program.name}
                </h1>
                <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Clock className="w-4 h-4" />
                  <span className="font-albert">{program.lengthDays} days</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl sm:text-3xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {formatPrice(program.priceInCents)}
                </div>
                {program.priceInCents > 0 && (
                  <div className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                    one-time payment
                  </div>
                )}
              </div>
            </div>

            {/* Coach */}
            <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl mb-6">
              {program.coachImageUrl ? (
                <Image
                  src={program.coachImageUrl}
                  alt={program.coachName}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#a07855]/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-[#a07855]" />
                </div>
              )}
              <div>
                <div className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {program.coachName}
                </div>
                <div className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  Your Coach
                </div>
              </div>
            </div>

            {/* Description */}
            {program.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  About this program
                </h2>
                <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed whitespace-pre-line">
                  {program.description}
                </p>
              </div>
            )}

            {/* Enrollment Status */}
            {enrollment && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold font-albert">
                    {enrollment.status === 'active' ? 'You\'re enrolled!' : 'Enrollment confirmed'}
                  </span>
                </div>
                {enrollment.status === 'upcoming' && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Your program starts on {formatDate(enrollment.startedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Cohort Selection for Group Programs */}
            {program.type === 'group' && cohorts && cohorts.length > 0 && !enrollment && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                  Select a cohort
                </h2>
                <div className="space-y-2">
                  {cohorts.map((cohort) => (
                    <button
                      key={cohort.id}
                      onClick={() => cohort.isAvailableToUser && setSelectedCohortId(cohort.id)}
                      disabled={!cohort.isAvailableToUser}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedCohortId === cohort.id
                          ? 'border-[#a07855] bg-[#a07855]/5'
                          : cohort.isAvailableToUser
                          ? 'border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/50'
                          : 'border-[#e1ddd8] dark:border-[#262b35] opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            {cohort.name}
                          </div>
                          <div className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] flex items-center gap-2 mt-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(cohort.startDate)} - {formatDate(cohort.endDate)}
                          </div>
                        </div>
                        <div className="text-right">
                          {cohort.isAvailableToUser ? (
                            <>
                              {cohort.spotsRemaining > 0 && cohort.spotsRemaining !== -1 ? (
                                <div className="text-sm text-green-600 dark:text-green-400">
                                  {cohort.spotsRemaining} spots left
                                </div>
                              ) : cohort.spotsRemaining === -1 ? (
                                <div className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                                  Open enrollment
                                </div>
                              ) : null}
                              {selectedCohortId === cohort.id && (
                                <Check className="w-5 h-5 text-[#a07855] mt-1 ml-auto" />
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
                <div className="flex items-center gap-2 text-[#1a1a1a] dark:text-[#f5f5f8]">
                  <Calendar className="w-5 h-5 text-green-500" />
                  <span className="font-semibold font-albert">Start anytime</span>
                </div>
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                  This is a 1:1 coaching program. You'll work directly with your coach at your own pace.
                </p>
              </div>
            )}

            {/* Cannot Enroll Reason */}
            {!canEnroll && cannotEnrollReason && !enrollment && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-semibold font-albert">{cannotEnrollReason}</span>
                </div>
              </div>
            )}

            {/* Enroll Button */}
            {!enrollment && (
              <Button
                onClick={handleEnroll}
                disabled={!canEnroll || enrolling || (program.type === 'group' && !selectedCohortId)}
                className="w-full py-4 text-lg bg-[#a07855] hover:bg-[#8c6245] text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
            )}

            {/* Go to Program Button (when enrolled) */}
            {enrollment && (
              <Button
                onClick={() => router.push('/')}
                className="w-full py-4 text-lg bg-[#a07855] hover:bg-[#8c6245] text-white"
              >
                Go to My Programs
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

