'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, Users, Sparkles, TrendingUp, Shield, Target, UserPlus, ListChecks, Eye, Heart } from 'lucide-react';
import Image from 'next/image';
import Script from 'next/script';
import { useGuestSession } from '@/hooks/useGuestSession';
import { EmbeddedPaymentForm } from '@/components/checkout/EmbeddedPaymentForm';

type PlanType = 'trial' | 'standard' | 'premium';

const PLANS: {
  id: PlanType;
  name: string;
  price: string;
  originalPrice?: string;
  period: string;
  perDay: string;
  billedAs: string;
  description: string;
  features: { text: string; bold?: boolean; emoji?: string }[];
  highlighted?: boolean;
  tag?: string;
  trialInfo?: string;
}[] = [
  {
    id: 'trial',
    name: 'Trial',
    price: '$9.99',
    period: '/week',
    perDay: '$1.43',
    billedAs: 'billed weekly',
    description: 'Try everything risk-free for a week',
    trialInfo: 'Then $39.99/month',
    features: [
      { text: 'Full access for 7 days' },
      { text: 'Daily morning & evening check-ins' },
      { text: 'Goal tracking & progress visualization' },
      { text: 'Habit tracking system' },
      { text: 'Daily focus tasks' },
      { text: 'Community access' },
    ],
    tag: 'TRY FIRST',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$39.99',
    period: '/month',
    perDay: '$1.33',
    billedAs: 'billed monthly',
    description: 'Everything you need to build consistency',
    features: [
      { text: 'Daily morning & evening check-ins' },
      { text: 'Founder accountability squad' },
      { text: 'Goal tracking & progress visualization' },
      { text: 'Habit tracking system' },
      { text: 'Weekly reflections' },
      { text: 'Community access' },
    ],
    highlighted: true,
    tag: 'BEST VALUE',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$99',
    period: '/month',
    perDay: '$3.30',
    billedAs: 'billed monthly',
    description: 'For serious growth with accountability',
    features: [
      { text: 'Everything in Standard' },
      { text: 'Premium Squad membership', bold: true, emoji: '👥' },
      { text: 'Dedicated accountability coach', bold: true, emoji: '🎯' },
      { text: 'Priority support' },
      { text: 'Exclusive content & resources' },
      { text: 'Advanced analytics' },
    ],
  },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Daily structure',
    description: 'That keeps you moving forward',
  },
  {
    icon: Users,
    title: 'Accountability squad',
    description: 'So you\'re never doing this alone',
  },
  {
    icon: TrendingUp,
    title: 'Weekly reviews',
    description: 'To lock in your progress',
  },
  {
    icon: Sparkles,
    title: 'Expert strategies',
    description: 'Designed for long-term progress protection',
  },
  {
    icon: Shield,
    title: 'Resource hub',
    description: 'With templates, prompts, and implementation tools',
  },
  {
    icon: Target,
    title: 'Personalized action plan',
    description: 'Based on your specific goals and timeline',
  },
];

// Content Creator specific features
const CONTENT_CREATOR_FEATURES = [
  {
    icon: Calendar,
    title: 'Daily creator schedule',
    description: 'Stay consistent with a publishing rhythm that works',
  },
  {
    icon: Users,
    title: 'Creator squad',
    description: 'Connect with other creators who get it',
  },
  {
    icon: TrendingUp,
    title: 'Weekly growth reviews',
    description: 'Track your reach, engagement, and follower growth',
  },
  {
    icon: Sparkles,
    title: 'Viral content strategies',
    description: 'Proven frameworks to maximize your reach',
  },
  {
    icon: Shield,
    title: 'Creator resource hub',
    description: 'Templates, hooks, and content ideas on demand',
  },
  {
    icon: Target,
    title: '90-day growth roadmap',
    description: 'A clear path to grow and monetize your audience',
  },
];

// Content Creator specific "What happens next" steps
const CONTENT_CREATOR_STEPS = [
  {
    icon: UserPlus,
    number: 1,
    title: 'Join your Creator Squad',
    description: 'Connect with creators who will hold you accountable to publish.',
  },
  {
    icon: ListChecks,
    number: 2,
    title: 'Get your Daily Tasks',
    description: 'Get a daily plan of 3 tasks that will move your page upward.',
  },
  {
    icon: Eye,
    number: 3,
    title: 'Watch your Channel Grow',
    description: 'Stay consistent and track your audience growth every week.',
  },
];

const TESTIMONIALS = [
  {
    name: 'James R.',
    text: 'Finally found a system that keeps me accountable. Lost 15kg and built a morning routine that stuck.',
    rating: 5,
  },
  {
    name: 'Priya S.',
    text: 'The daily check-ins changed everything. I\'ve been more productive in 3 months than the entire last year.',
    rating: 5,
  },
  {
    name: 'Michael K.',
    text: 'Grew my side business to $5k/month while working full-time. The structure made it possible.',
    rating: 5,
  },
];

// =============================================================================
// QUIZ DATA DISPLAY HELPERS
// =============================================================================

const AUDIENCE_SIZE_LABELS: Record<string, string> = {
  'under-100': '< 100',
  '100-1k': '100 - 1K',
  '1k-10k': '1K - 10K',
  '10k-100k': '10K - 100K',
  '100k-plus': '100K+',
};

// Maps audience size IDs to numeric values for doubling
const AUDIENCE_SIZE_VALUES: Record<string, number> = {
  'under-100': 50,
  '100-1k': 500,
  '1k-10k': 5000,
  '10k-100k': 50000,
  '100k-plus': 100000,
};

// Function to get doubled follower count display
function getDoubledFollowers(audienceSize: string | undefined): string {
  const baseValue = AUDIENCE_SIZE_VALUES[audienceSize || 'under-100'] || 50;
  const doubled = baseValue * 2;
  
  if (doubled >= 100000) return '100K+';
  if (doubled >= 10000) return `${Math.round(doubled / 1000)}K`;
  if (doubled >= 1000) return `${(doubled / 1000).toFixed(1)}K`.replace('.0K', 'K');
  return doubled.toString();
}

const PUBLISHING_VOLUME_LABELS: Record<string, string> = {
  'none-yet': 'Not posting yet',
  'once-a-week': '1x per week',
  '2-4-times': '2-4x per week',
  '4-plus': '4+ per week',
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  'short-form': 'Short-form video',
  'long-form': 'Long-form video',
  'static-posts': 'Static posts',
  'stories': 'Stories',
  'carousels': 'Carousels',
  'live': 'Live streams',
  'threads': 'Threads/Text',
  // Additional IDs from quiz
  'tiktok-shorts': 'TikTok Shorts',
  'youtube-shorts': 'YouTube Shorts',
  'reels': 'Instagram Reels',
  'high-quality-video': 'High-quality video',
  'talking-head': 'Talking head videos',
  'vlogs': 'Vlogs',
  'tutorials': 'Tutorials',
  'podcasts': 'Podcasts',
  'text-posts': 'Text posts',
  'images': 'Images',
  'graphics': 'Graphics',
};

const PLATFORM_LABELS: Record<string, string> = {
  'tiktok': 'TikTok',
  'instagram': 'Instagram',
  'youtube': 'YouTube',
  'linkedin': 'LinkedIn',
  'twitter': 'X/Twitter',
  'newsletter': 'Newsletter',
  'other': 'Other',
};

const PRIMARY_GOAL_LABELS: Record<string, string> = {
  'grow-followers': 'Grow followers',
  'increase-engagement': 'Increase engagement',
  'make-money': 'Monetize content',
  'all-above': 'All-around growth',
};

const STRUGGLE_LABELS: Record<string, string> = {
  'consistency': 'Posting consistently',
  'ideas': 'Content ideas',
  'production': 'Filming/editing',
  'reach': 'Getting views',
  'monetization': 'Making money',
};

const CREATOR_TYPE_LABELS: Record<string, string> = {
  'personal-brand': 'Personal brand',
  'faceless': 'Faceless channel',
  'business': 'Brand / product page',
  'experimenting': 'Short and long form',
};

/**
 * Guest Plan Selection Page
 * Allows guests to select a plan and proceed to payment
 */
export default function GuestPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, sessionId, saveData, isLoading: sessionLoading } = useGuestSession();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  
  // Embedded payment form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const paymentFormRef = useRef<HTMLDivElement>(null);
  
  // Primary CTA visibility tracking using callback ref
  const [primaryCTAElement, setPrimaryCTAElement] = useState<HTMLDivElement | null>(null);
  const primaryCTARef = useCallback((node: HTMLDivElement | null) => {
    setPrimaryCTAElement(node);
  }, []);
  const [isPrimaryCTAVisible, setIsPrimaryCTAVisible] = useState(true);

  // Get selected plan data for dynamic text
  const selectedPlanData = PLANS.find(p => p.id === selectedPlan);

  // Detect if user is on the Content Creator track
  const isContentCreator = data.preselectedTrack === 'content_creator' || !!data.creatorType;

  // Select features and steps based on track
  const activeFeatures = isContentCreator ? CONTENT_CREATOR_FEATURES : FEATURES;

  // Check if checkout was canceled
  useEffect(() => {
    if (searchParams.get('checkout') === 'canceled') {
      setError('Payment was canceled. Please try again when you\'re ready.');
    }
  }, [searchParams]);

  // Redirect to your-info if email is not set
  useEffect(() => {
    if (!sessionLoading && !data.email) {
      router.push('/start/your-info');
    }
  }, [sessionLoading, data.email, router]);

  // Redirect to create-account if payment is already completed
  // This prevents users who already paid from seeing the plan page again
  useEffect(() => {
    if (!sessionLoading && data.paymentStatus === 'completed') {
      router.push('/start/create-account');
    }
  }, [sessionLoading, data.paymentStatus, router]);

  // Scroll to payment form when it appears
  useEffect(() => {
    if (showPaymentForm && paymentFormRef.current) {
      paymentFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showPaymentForm]);

  // Track primary CTA visibility to show/hide sticky button
  useEffect(() => {
    if (!primaryCTAElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPrimaryCTAVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(primaryCTAElement);

    return () => observer.disconnect();
  }, [primaryCTAElement]);

  const handleContinue = async () => {
    if (!selectedPlan || !sessionId || !data.email) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Save selected plan to guest session
      await saveData({ selectedPlan });
      
      // Create subscription with embedded payment
      const response = await fetch('/api/checkout/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          plan: selectedPlan,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          guestSessionId: sessionId,
        }),
      });
      
      // Safely parse JSON - handle empty or malformed responses
      const result = await response.json().catch(() => null);
      
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to create subscription');
      }
      
      if (!result) {
        throw new Error('Empty response from server');
      }
      
      if (result.clientSecret) {
        setClientSecret(result.clientSecret);
        setShowPaymentForm(true);
        setIsLoading(false);
      } else {
        throw new Error('No client secret received');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      setIsLoading(false);
    }
  };

  const handleCancelPayment = () => {
    setShowPaymentForm(false);
    setClientSecret(null);
  };

  const handlePaymentSuccess = () => {
    router.push('/start/success');
  };

  if (sessionLoading) {
    return (
      <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#e1ddd8]" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-t-[#a07855] animate-spin" />
        </div>
        <p className="text-text-secondary font-sans text-[15px] text-center">Loading your plan...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col">
        {/* Logo Header - centered */}
        <motion.div 
          className="pt-6 pb-4 px-6 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={48} 
            height={48} 
            className="rounded-lg"
          />
        </motion.div>

        {/* Content */}
        <div className="flex-1 px-4 py-6 lg:py-12">
          <div className="w-full max-w-4xl mx-auto">
            
            {/* ============================================================= */}
            {/* PAGE TITLE */}
            {/* ============================================================= */}
            {isContentCreator && (
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
              >
                <h1 className="font-albert text-[28px] md:text-[36px] lg:text-[42px] text-text-primary tracking-[-1.5px] leading-[1.15]">
                  Your 3 months creator plan is ready, {data.firstName || 'Creator'}
                </h1>
              </motion.div>
            )}

            {/* ============================================================= */}
            {/* BEFORE / AFTER TRANSFORMATION SECTION */}
            {/* ============================================================= */}
            {isContentCreator && (
              <motion.div
                className="mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {/* Before/After Comparison Card */}
                <div className="bg-[#f5ebe0] rounded-[20px] overflow-hidden border border-[#e1ddd8]">
                  {/* Image Section */}
                  <div className="relative grid grid-cols-2">
                    {/* Now Side */}
                    <div className="relative bg-gradient-to-b from-[#e8ddd0] to-[#f5ebe0] pt-6 px-4 flex flex-col items-center justify-end min-h-[200px] md:min-h-[280px]">
                      <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fnow.png?alt=media&token=cb306ed9-f12d-460f-abd0-b0952af905d2" 
                        alt="" 
                        width={192}
                        height={240}
                        className="w-36 h-44 md:w-48 md:h-60 object-contain object-bottom"
                      />
                    </div>
                    
                    {/* Arrow */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <div className="bg-white rounded-full p-2 shadow-md">
                        <svg className="w-5 h-5 md:w-6 md:h-6 text-[#a07855]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </div>
                    
                    {/* 3 Months Side */}
                    <div className="relative bg-gradient-to-b from-[#faf8f6] to-[#f5ebe0] pt-6 px-4 flex flex-col items-center justify-end min-h-[200px] md:min-h-[280px]">
                      <Image 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2F3months.png?alt=media&token=09900df7-1a57-43a6-84db-94a2cdd476aa" 
                        alt="" 
                        width={192}
                        height={240}
                        className="w-36 h-44 md:w-48 md:h-60 object-contain object-bottom"
                      />
                    </div>
                  </div>
                  
                  {/* Stats Comparison */}
                  <div className="grid grid-cols-2 border-t border-[#e1ddd8]">
                    {/* Column Headers */}
                    <div className="p-2 border-r border-[#e1ddd8] bg-[#ebe3d8]">
                      <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary text-center">Now</p>
                    </div>
                    <div className="p-2 bg-[#f0ebe4]">
                      <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary text-center">3 months</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 border-t border-[#e1ddd8]">
                    {/* Now Stats */}
                    <div className="p-4 md:p-5 border-r border-[#e1ddd8]">
                      <div className="space-y-3">
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Followers</p>
                          <p className="font-albert text-[16px] md:text-[20px] font-semibold text-[#d97706]">
                            {AUDIENCE_SIZE_LABELS[data.currentAudienceSize || ''] || '< 100'}
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Publishing</p>
                          <p className="font-albert text-[14px] md:text-[16px] font-semibold text-[#d97706]">
                            {PUBLISHING_VOLUME_LABELS[data.weeklyPublishingVolume || ''] || 'Inconsistent'}
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Income</p>
                          <p className="font-albert text-[14px] md:text-[16px] font-semibold text-[#d97706]">
                            No income
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Momentum</p>
                          <div className="flex gap-1 mt-1">
                            <div className="w-4 h-1.5 bg-[#d97706] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#e1ddd8] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#e1ddd8] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#e1ddd8] rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* 3 Months Stats */}
                    <div className="p-4 md:p-5">
                      <div className="space-y-3">
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Followers</p>
                          <p className="font-albert text-[16px] md:text-[20px] font-semibold text-[#22c55e]">
                            {getDoubledFollowers(data.currentAudienceSize)}
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Publishing</p>
                          <p className="font-albert text-[14px] md:text-[16px] font-semibold text-[#22c55e]">
                            Consistent
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Income</p>
                          <p className="font-albert text-[14px] md:text-[16px] font-semibold text-[#22c55e]">
                            Profitable product
                          </p>
                        </div>
                        <div>
                          <p className="font-sans text-[11px] md:text-[12px] text-text-muted">Momentum</p>
                          <div className="flex gap-1 mt-1">
                            <div className="w-4 h-1.5 bg-[#22c55e] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#22c55e] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#22c55e] rounded-full" />
                            <div className="w-4 h-1.5 bg-[#22c55e] rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <p className="text-center font-sans text-[10px] text-text-muted mt-2">
                  *Results vary per person and are not guaranteed.
                </p>
              </motion.div>
            )}

            {/* ============================================================= */}
            {/* PERSONAL SUMMARY SECTION */}
            {/* ============================================================= */}
            {isContentCreator && (
              <motion.div
                className="mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h2 className="font-albert text-[24px] md:text-[28px] text-text-primary tracking-[-1px] mb-5">
                  Personal summary based on your answers
                </h2>
                
                <div className="space-y-4">
                  {/* Current Posting */}
                  {data.weeklyPublishingVolume && (
                    <div className="bg-white rounded-2xl p-4 border border-[#e1ddd8]">
                      <div className="flex items-start gap-3">
                        <div className="text-[24px]">📊</div>
                        <div className="flex-1">
                          <p className="font-sans text-[12px] text-text-muted mb-1">Current posting frequency</p>
                          <p className="font-albert text-[18px] font-semibold text-text-primary">
                            {PUBLISHING_VOLUME_LABELS[data.weeklyPublishingVolume] || data.weeklyPublishingVolume}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Content Types */}
                  {data.contentTypes && data.contentTypes.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-[#e1ddd8]">
                      <div className="flex items-start gap-3">
                        <div className="text-[24px]">🎬</div>
                        <div className="flex-1">
                          <p className="font-sans text-[12px] text-text-muted mb-1">Preferred content types</p>
                          <p className="font-albert text-[16px] font-semibold text-text-primary">
                            {data.contentTypes.map((t: string) => CONTENT_TYPE_LABELS[t] || t.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Biggest Struggle */}
                  {data.contentStruggles && data.contentStruggles.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border border-[#e1ddd8]">
                      <div className="flex items-start gap-3">
                        <div className="text-[24px]">🎯</div>
                        <div className="flex-1">
                          <p className="font-sans text-[12px] text-text-muted mb-1">Main challenge to solve</p>
                          <p className="font-albert text-[16px] font-semibold text-text-primary">
                            {data.contentStruggles.map((s: string) => STRUGGLE_LABELS[s] || s).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ============================================================= */}
            {/* YOUR PLAN IS READY SECTION */}
            {/* ============================================================= */}
            {isContentCreator && (
              <motion.div
                className="mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h2 className="font-albert text-[24px] md:text-[28px] text-text-primary tracking-[-1px] mb-1">
                  Content creator plan for {data.firstName || 'you'} is{' '}
                  <span className="text-[#22c55e]">ready!</span>
                </h2>
                <p className="font-sans text-[14px] text-text-secondary mb-5">
                  Based on your answers, here&apos;s your personalized plan
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Posting Frequency */}
                  <div className="bg-[#faf8f6] rounded-xl p-3 border border-[#e1ddd8]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">📅</span>
                      <span className="font-sans text-[11px] text-text-muted">Posting Goal</span>
                    </div>
                    <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary">
                      {data.weeklyPublishingVolume === '4-plus' ? '4+ posts/week' :
                       data.weeklyPublishingVolume === '2-4-times' ? '3 posts/week' :
                       data.weeklyPublishingVolume === 'once-a-week' ? '2 posts/week' :
                       '3 posts/week'}
                    </p>
                  </div>
                  
                  {/* Creator Type */}
                  <div className="bg-[#faf8f6] rounded-xl p-3 border border-[#e1ddd8]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">🎨</span>
                      <span className="font-sans text-[11px] text-text-muted">Building</span>
                    </div>
                    <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary">
                      {data.creatorType 
                        ? (CREATOR_TYPE_LABELS[data.creatorType] || data.creatorType)
                        : 'Personal brand'}
                    </p>
                  </div>
                  
                  {/* Platform */}
                  <div className="bg-[#faf8f6] rounded-xl p-3 border border-[#e1ddd8]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">📱</span>
                      <span className="font-sans text-[11px] text-text-muted">Main Platform</span>
                    </div>
                    <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary">
                      {data.mainPlatform 
                        ? (PLATFORM_LABELS[data.mainPlatform] || data.mainPlatform)
                        : 'TikTok'}
                    </p>
                  </div>
                  
                  {/* Goal */}
                  <div className="bg-[#faf8f6] rounded-xl p-3 border border-[#e1ddd8]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">🎯</span>
                      <span className="font-sans text-[11px] text-text-muted">90-Day Goal</span>
                    </div>
                    <p className="font-albert text-[14px] md:text-[16px] font-semibold text-text-primary">
                      {PRIMARY_GOAL_LABELS[data.primary90DayGoal || ''] || 'Grow audience'}
                    </p>
                  </div>
                </div>
                
                {/* Goals checklist */}
                {data.primary90DayGoal && (
                  <div className="mt-4">
                    <p className="font-sans text-[12px] text-text-muted mb-2">Goals for your program also include:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#22c55e]" />
                        <span className="font-sans text-[12px] text-text-secondary">Build consistency</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#22c55e]" />
                        <span className="font-sans text-[12px] text-text-secondary">Grow audience</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#22c55e]" />
                        <span className="font-sans text-[12px] text-text-secondary">Stay accountable</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#22c55e]" />
                        <span className="font-sans text-[12px] text-text-secondary">Track progress</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ============================================================= */}
            {/* CHOOSE YOUR PLAN HEADER (for non-content-creator) */}
            {/* ============================================================= */}
            {!isContentCreator && (
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <h1 className="font-albert text-[32px] lg:text-[48px] text-text-primary tracking-[-2px] leading-[1.15] mb-3">
                  <span className="bg-gradient-to-r from-[#a07855] via-[#d4a574] to-[#a07855] bg-clip-text text-transparent">
                    Your growth plan is ready
                  </span>
                </h1>
                <p className="font-sans text-[16px] lg:text-[19px] text-text-secondary tracking-[-0.3px] leading-[1.4]">
                  Choose the plan that fits your goals
                </p>
              </motion.div>
            )}

            {/* Choose Your Plan label for content creators */}
            {isContentCreator && (
              <motion.div
                className="mb-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.35 }}
              >
                <h3 className="font-albert text-[20px] md:text-[24px] text-text-primary tracking-[-0.5px]">
                  Choose your plan
                </h3>
              </motion.div>
            )}

            {/* Plan Cards - Horizontal scroll on mobile */}
            <motion.div 
              className="flex md:grid md:grid-cols-3 gap-3 lg:gap-5 mb-8 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible snap-x snap-mandatory md:snap-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {PLANS.map((plan, index) => (
                <motion.button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  disabled={isLoading || showPaymentForm}
                  className={`relative flex-shrink-0 w-[48%] md:w-full text-left p-3 md:p-5 rounded-[16px] md:rounded-[24px] border-2 transition-all snap-start ${
                    selectedPlan === plan.id
                      ? 'border-[#a07855] bg-[#faf8f6] shadow-lg'
                      : 'border-[#e1ddd8] bg-white hover:border-[#d4d0cb] hover:shadow-sm'
                  } disabled:opacity-50`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + index * 0.1 }}
                  whileHover={{ scale: isLoading ? 1 : 1.01 }}
                  whileTap={{ scale: isLoading ? 1 : 0.99 }}
                >
                  {/* Tag */}
                  {plan.tag && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 md:px-3 md:py-1 bg-gradient-to-r from-[#a07855] to-[#c9a07a] rounded-full whitespace-nowrap">
                      <span className="text-white text-[8px] md:text-[10px] font-bold tracking-wider">{plan.tag}</span>
                    </div>
                  )}

                  {/* Radio Button */}
                  <div className="flex items-start justify-between mb-2 md:mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-albert text-[16px] md:text-[20px] font-semibold text-text-primary tracking-[-0.5px]">
                        {plan.name}
                      </h3>
                      <p className="font-sans text-[10px] md:text-[12px] text-text-secondary leading-snug line-clamp-2">
                        {plan.description}
                      </p>
                    </div>
                    <div className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-2 transition-all ${
                      selectedPlan === plan.id
                        ? 'border-[#a07855] bg-[#a07855]'
                        : 'border-[#d4d0cb]'
                    }`}>
                      {selectedPlan === plan.id && (
                        <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" strokeWidth={3} />
                      )}
                    </div>
                  </div>

                  {/* Price - Daily rate prominent */}
                  <div className="mb-2 md:mb-3">
                    <div className="flex items-baseline gap-0.5 md:gap-1">
                      <span className="font-albert text-[22px] md:text-[32px] font-bold text-text-primary tracking-[-1px]">
                        {plan.perDay}
                      </span>
                      <span className="font-sans text-[11px] md:text-[13px] text-text-secondary">
                        /day
                      </span>
                    </div>
                    <p className="font-sans text-[9px] md:text-[11px] text-text-muted">
                      {plan.price}{plan.period} · {plan.billedAs}
                    </p>
                    {plan.trialInfo && (
                      <p className="font-sans text-[8px] md:text-[10px] text-text-tertiary mt-0.5">
                        {plan.trialInfo}
                      </p>
                    )}
                  </div>

                  {/* Features - Hidden on mobile, show on md+ */}
                  <ul className="hidden md:block space-y-1.5">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#22c55e] flex-shrink-0 mt-0.5" strokeWidth={3} />
                        <span className={`font-sans text-[12px] ${feature.bold ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                          {feature.emoji && <span className="mr-1">{feature.emoji}</span>}
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* Abbreviated features on mobile */}
                  <ul className="md:hidden space-y-1">
                    {plan.features.slice(0, 3).map((feature, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-[#22c55e] flex-shrink-0 mt-0.5" strokeWidth={3} />
                        <span className={`font-sans text-[10px] leading-tight ${feature.bold ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="font-sans text-[9px] text-text-muted pl-4">
                        +{plan.features.length - 3} more
                      </li>
                    )}
                  </ul>
                </motion.button>
              ))}
            </motion.div>

            {/* Terms Agreement */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="max-w-3xl mx-auto mb-8"
            >
              <label className="flex items-start gap-3 cursor-pointer group">
                <div 
                  onClick={() => !showPaymentForm && setAgreedToTerms(!agreedToTerms)}
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all mt-0.5 ${
                    agreedToTerms 
                      ? 'border-[#a07855] bg-[#a07855]' 
                      : 'border-[#d4d0cb] group-hover:border-[#a07855]/50'
                  } ${showPaymentForm ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {agreedToTerms && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <span className="font-sans text-[13px] text-text-secondary leading-relaxed">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245]">Terms and Conditions</a>,{' '}
                  <a href="/privacy" target="_blank" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245]">Privacy policy</a>,{' '}
                  <a href="/subscription-policy" target="_blank" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245]">Subscription policy</a> and the{' '}
                  <a href="/refund-policy" target="_blank" className="text-[#a07855] underline underline-offset-2 hover:text-[#8c6245]">Refund and Cancellation policy</a>
                </span>
              </label>
            </motion.div>

            {/* Main CTA Button - Yellow */}
            <motion.div
              ref={primaryCTARef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="max-w-xl mx-auto mb-8"
            >
              <button
                onClick={handleContinue}
                disabled={isLoading || !agreedToTerms || showPaymentForm}
                className="w-full bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Start your transformation'
                )}
              </button>
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div 
                className="max-w-xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}

            {/* Embedded Payment Form - Directly below main CTA and terms */}
            <AnimatePresence>
              {showPaymentForm && clientSecret && (
                <motion.div
                  ref={paymentFormRef}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-4xl mx-auto mb-8"
                >
                  <div className="bg-[#faf8f6] rounded-2xl border border-[#e1ddd8] p-6">
                    <EmbeddedPaymentForm
                      clientSecret={clientSecret}
                      onSuccess={handlePaymentSuccess}
                      onCancel={handleCancelPayment}
                      planName={selectedPlan === 'premium' ? 'Premium' : selectedPlan === 'trial' ? 'Trial' : 'Standard'}
                      price={selectedPlan === 'premium' ? '$99' : selectedPlan === 'trial' ? '$9.99' : '$39.99'}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Billing Info */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="max-w-3xl mx-auto mb-12"
            >
              <p className="font-sans text-[12px] text-text-tertiary text-center leading-relaxed">
                {selectedPlan === 'trial' ? (
                  <>
                    By clicking "Start your transformation", you will be charged <span className="font-semibold text-text-secondary">$9.99</span> for your first week. 
                    After 7 days, your subscription will automatically convert to <span className="font-semibold text-text-secondary">$39.99/month</span> until you cancel.
                  </>
                ) : (
                  <>
                    By clicking "Start your transformation", I agree that the plan I have selected will automatically renew until I cancel. 
                    GrowthAddicts will automatically charge my payment method <span className="font-semibold text-text-secondary">{selectedPlanData?.price}</span> every{' '}
                    <span className="font-semibold text-text-secondary">month</span>.
                  </>
                )}{' '}
                I can cancel online by visiting my account on the website or in the app.
              </p>
            </motion.div>

            {/* 30-Day Guarantee */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="max-w-2xl mx-auto mb-16"
            >
              <div className="bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] rounded-[24px] p-6 lg:p-8 border border-[#bbf7d0]">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <Shield className="w-6 h-6 text-[#22c55e]" />
                  </div>
                  <div>
                    <h3 className="font-albert text-[22px] font-bold text-[#166534] tracking-[-0.5px] mb-2">
                      30-day satisfaction guarantee
                    </h3>
                    <p className="font-sans text-[14px] text-[#15803d] leading-relaxed">
                      If you don&apos;t see noticeable progress in the GrowthAddicts system despite completing your daily required tasks, you can request a full refund within 30 days.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Features Grid - "What you get" */}
            <motion.div 
              className="mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                What you get
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {activeFeatures.map((feature, index) => (
                  <motion.div
                    key={index}
                    className="p-4 bg-white rounded-2xl border border-[#e1ddd8]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.55 + index * 0.05 }}
                  >
                    <feature.icon className="w-6 h-6 text-[#a07855] mb-2" />
                    <h4 className="font-albert text-[16px] font-semibold text-text-primary tracking-[-0.5px] mb-1">
                      {feature.title}
                    </h4>
                    <p className="font-sans text-[13px] text-text-secondary">
                      {feature.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Vincent's Experience Video Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mb-16"
            >
              <div className="text-center mb-8">
                <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] mb-3">
                  Vincent&apos;s experience
                </h2>
                <p className="font-sans text-[15px] text-text-secondary max-w-lg mx-auto">
                  Hear how Growth Addicts helped Vincent stay consistent and transform his daily habits.
                </p>
              </div>
              <div className="max-w-3xl mx-auto">
                <div className="relative bg-white rounded-2xl border border-[#e1ddd8] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.08)] overflow-hidden">
                  {/* 16:9 Aspect Ratio Container */}
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                    <video
                      className="absolute inset-0 w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster=""
                      disablePictureInPicture
                      controlsList="noplaybackrate nodownload"
                    >
                      <source 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/video%2FIMG_6354.mov?alt=media&token=c516ed9c-8406-4f46-acad-f147985276d4" 
                        type="video/quicktime"
                      />
                      <source 
                        src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/video%2FIMG_6354.mov?alt=media&token=c516ed9c-8406-4f46-acad-f147985276d4" 
                        type="video/mp4"
                      />
                      Your browser does not support the video tag.
                    </video>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* What Happens Next Section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              className="mb-16"
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                What happens next
              </h2>
              <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
                {isContentCreator ? (
                  // Content Creator specific steps
                  <>
                    {CONTENT_CREATOR_STEPS.map((step, index) => (
                      <motion.div
                        key={step.number}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.7 + index * 0.05 }}
                        className="bg-white rounded-2xl p-4 md:p-6 border border-[#e1ddd8] flex items-start gap-4 md:flex-col md:text-center md:items-center"
                      >
                        <div className="w-12 h-12 md:w-14 md:h-14 bg-[#faf8f6] rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 md:mx-auto md:mb-4">
                          <step.icon className="w-6 h-6 md:w-7 md:h-7 text-[#a07855]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 md:block">
                            <div className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 bg-[#a07855] text-white font-sans text-[11px] md:text-[12px] font-bold rounded-full md:mb-3">
                              {step.number}
                            </div>
                            <h4 className="font-sans text-[14px] md:text-[15px] font-semibold text-text-primary mb-0 md:mb-2">
                              {step.title}
                            </h4>
                          </div>
                          <p className="font-sans text-[12px] md:text-[13px] text-text-secondary leading-relaxed mt-1 md:mt-0">
                            {step.description}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </>
                ) : (
                  // Generic steps
                  <>
                    {/* Step 1 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.7 }}
                      className="bg-white rounded-2xl p-4 md:p-6 border border-[#e1ddd8] flex items-start gap-4 md:flex-col md:text-center md:items-center"
                    >
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-[#faf8f6] rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 md:mx-auto md:mb-4">
                        <UserPlus className="w-6 h-6 md:w-7 md:h-7 text-[#a07855]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 md:block">
                          <div className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 bg-[#a07855] text-white font-sans text-[11px] md:text-[12px] font-bold rounded-full md:mb-3">
                            1
                          </div>
                          <h4 className="font-sans text-[14px] md:text-[15px] font-semibold text-text-primary mb-0 md:mb-2">
                            Join your Accountability Squad
                          </h4>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] text-text-secondary leading-relaxed mt-1 md:mt-0">
                          Meet the people who will help you stay on track every day.
                        </p>
                      </div>
                    </motion.div>

                    {/* Step 2 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.75 }}
                      className="bg-white rounded-2xl p-4 md:p-6 border border-[#e1ddd8] flex items-start gap-4 md:flex-col md:text-center md:items-center"
                    >
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-[#faf8f6] rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 md:mx-auto md:mb-4">
                        <ListChecks className="w-6 h-6 md:w-7 md:h-7 text-[#a07855]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 md:block">
                          <div className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 bg-[#a07855] text-white font-sans text-[11px] md:text-[12px] font-bold rounded-full md:mb-3">
                            2
                          </div>
                          <h4 className="font-sans text-[14px] md:text-[15px] font-semibold text-text-primary mb-0 md:mb-2">
                            Set your Big 3 Daily Tasks
                          </h4>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] text-text-secondary leading-relaxed mt-1 md:mt-0">
                          You&apos;ll choose the three actions that move you forward each day.
                        </p>
                      </div>
                    </motion.div>

                    {/* Step 3 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.8 }}
                      className="bg-white rounded-2xl p-4 md:p-6 border border-[#e1ddd8] flex items-start gap-4 md:flex-col md:text-center md:items-center"
                    >
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-[#faf8f6] rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 md:mx-auto md:mb-4">
                        <Eye className="w-6 h-6 md:w-7 md:h-7 text-[#a07855]" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 md:block">
                          <div className="inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 bg-[#a07855] text-white font-sans text-[11px] md:text-[12px] font-bold rounded-full md:mb-3">
                            3
                          </div>
                          <h4 className="font-sans text-[14px] md:text-[15px] font-semibold text-text-primary mb-0 md:mb-2">
                            Stay accountable
                          </h4>
                        </div>
                        <p className="font-sans text-[12px] md:text-[13px] text-text-secondary leading-relaxed mt-1 md:mt-0">
                          Your squad will see your progress and help you stay consistent every day.
                        </p>
                      </div>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Marketing Card - Your Journey Starts Here */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.85 }}
              className="mb-16"
            >
              <div className="bg-gradient-to-br from-[#faf8f6] to-[#f5f0eb] rounded-[24px] p-8 lg:p-10 border border-[#e1ddd8] text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Heart className="w-8 h-8 text-[#a07855]" />
                </div>
                <h3 className="font-albert text-[24px] lg:text-[28px] font-bold text-text-primary tracking-[-1px] mb-3">
                  Your transformation starts today
                </h3>
                <p className="font-sans text-[15px] text-text-secondary leading-relaxed max-w-xl mx-auto mb-6">
                  You&apos;ve already taken the first step by getting this far. Thousands of people just like you have used GrowthAddicts to build lasting habits, achieve their goals, and become the best version of themselves.
                </p>
                <p className="font-sans text-[14px] font-semibold text-[#a07855]">
                  The best time to start was yesterday. The second best time is now.
                </p>
              </div>
            </motion.div>

            {/* Testimonials - "What people are saying" */}
            <motion.div 
              className="mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
            >
              <h2 className="font-albert text-[28px] lg:text-[32px] text-text-primary tracking-[-1.5px] text-center mb-8">
                What people are saying
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {TESTIMONIALS.map((testimonial, index) => (
                  <motion.div
                    key={index}
                    className="p-4 bg-white rounded-2xl border border-[#e1ddd8]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.95 + index * 0.1 }}
                  >
                    <div className="flex gap-0.5 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <span key={i} className="text-amber-400 text-[14px]">★</span>
                      ))}
                    </div>
                    <p className="font-sans text-[14px] text-text-secondary mb-2">&quot;{testimonial.text}&quot;</p>
                    <p className="font-sans text-[13px] font-semibold text-text-primary">{testimonial.name}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Trust badges */}
            <motion.div 
              className="flex flex-wrap items-center justify-center gap-6 text-text-secondary mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="font-sans text-[12px]">Secure payment</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
                <span className="font-sans text-[12px]">Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <span className="font-sans text-[12px]">Powered by Stripe</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Bottom CTA - Sticky on all screen sizes, hidden when payment form is showing or primary CTA is visible */}
        {!showPaymentForm && !isPrimaryCTAVisible && (
          <motion.div 
            className="sticky bottom-0 px-6 pb-6 pt-4 bg-gradient-to-t from-app-bg via-app-bg to-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.05 }}
          >
            <button
              onClick={handleContinue}
              disabled={!selectedPlan || !agreedToTerms || isLoading}
              className="w-full max-w-xl mx-auto block bg-gradient-to-r from-[#f7c948] to-[#f5b820] text-[#2c2520] font-sans font-bold text-[16px] py-4 px-6 rounded-[32px] shadow-[0px_8px_24px_0px_rgba(247,201,72,0.35)] hover:shadow-[0px_12px_32px_0px_rgba(247,201,72,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
              'Start your transformation'
            )}
          </button>
        </motion.div>
        )}

        {/* Meta Pixel Code */}
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1347713597075016');
            fbq('track', 'PageView');
            fbq('track', 'AddToCart');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: 'none' }} alt=""
            src="https://www.facebook.com/tr?id=1347713597075016&ev=PageView&noscript=1"
          />
        </noscript>

        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-16653181105"
          strategy="afterInteractive"
        />
        <Script id="google-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-16653181105');
          `}
        </Script>
      </div>
    </div>
  );
}
