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
  Users, Check, 
  ChevronRight, AlertCircle, Loader2, CheckCircle, XCircle,
  Star, Video, MessageCircle, Book, Target, Zap, Heart,
  ChevronDown, Shield, Calendar
} from 'lucide-react';
import type { SquadFeature, SquadTestimonial, SquadFaq } from '@/types';
import { SquadPaymentModal } from '@/components/squad/SquadPaymentModal';

interface SquadDetailData {
  squad: {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    avatarUrl?: string;
    visibility: string;
    coachId: string | null;
    coachName: string;
    coachImageUrl?: string;
    coachBio?: string;
    priceInCents: number;
    currency: string;
    subscriptionEnabled: boolean;
    billingInterval?: 'monthly' | 'quarterly' | 'yearly';
    keyOutcomes: string[];
    features: SquadFeature[];
    testimonials: SquadTestimonial[];
    faqs: SquadFaq[];
    showMemberCount?: boolean;
  };
  memberCount?: number;
  memberAvatars?: string[];
  isMember: boolean;
  membershipStatus?: string;
  canJoin: boolean;
  cannotJoinReason?: string;
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

// Members Avatar Stack
function MembersDisplay({ 
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
          members
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
  faq: SquadFaq; 
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

export default function SquadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  
  const squadId = params.squadId as string;
  
  const [data, setData] = useState<SquadDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    priceInCents: number;
    currency: string;
    billingInterval: string;
  }>({ open: false, priceInCents: 0, currency: 'usd', billingInterval: 'monthly' });

  useEffect(() => {
    const fetchSquad = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/discover/squads/${squadId}`);
        
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Squad not found');
        }
        
        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching squad:', err);
        setError(err instanceof Error ? err.message : 'Failed to load squad');
      } finally {
        setLoading(false);
      }
    };

    fetchSquad();
  }, [squadId]);

  const formatPrice = (cents: number, interval?: string) => {
    if (cents === 0) return 'Free';
    const price = `$${(cents / 100).toFixed(0)}`;
    if (interval) {
      const intervalMap: Record<string, string> = {
        'monthly': '/mo',
        'quarterly': '/3mo',
        'yearly': '/yr',
      };
      return `${price}${intervalMap[interval] || ''}`;
    }
    return price;
  };

  const handleJoin = async () => {
    if (!isSignedIn) {
      router.push('/sign-in?redirect=' + encodeURIComponent(`/discover/squads/${squadId}`));
      return;
    }

    // If squad requires subscription, open payment modal directly
    if (data?.squad.subscriptionEnabled && data.squad.priceInCents > 0) {
      setPaymentModal({
        open: true,
        priceInCents: data.squad.priceInCents,
        currency: data.squad.currency || 'usd',
        billingInterval: data.squad.billingInterval || 'monthly',
      });
      return;
    }

    // Free squad - join directly
    try {
      setJoining(true);
      
      const response = await fetch('/api/squad/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to join');
      }

      setSuccessModal({ open: true, message: result.message || 'Successfully joined the squad!' });
    } catch (err) {
      console.error('Join error:', err);
      setErrorModal({ open: true, message: err instanceof Error ? err.message : 'Failed to join' });
    } finally {
      setJoining(false);
    }
  };

  const handlePaymentSuccess = () => {
    setPaymentModal({ open: false, priceInCents: 0, currency: 'usd', billingInterval: 'monthly' });
    setSuccessModal({ open: true, message: 'Welcome to the squad! Your membership is now active.' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] pb-24 lg:pb-8">
        {/* Hero Section Skeleton */}
        <section className="relative">
          {/* Background gradient placeholder */}
          <div className="absolute inset-0 h-[300px] bg-gradient-to-b from-[#e1ddd8]/30 to-transparent dark:from-[#262b35]/30" />
          
          <div className="relative px-4 pt-5 pb-8">
            {/* Back Button */}
            <div className="w-9 h-9 rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse mb-6" />
            
            {/* Squad Avatar */}
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
              <div className="h-8 w-48 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="h-4 w-64 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/40 dark:bg-[#222631] animate-pulse" />
                <div className="h-4 w-20 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-24 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
              </div>
            </div>

            {/* CTA Button */}
            <div className="h-14 w-full rounded-full bg-[#e1ddd8]/50 dark:bg-[#262b35] animate-pulse" />
          </div>
        </section>

        {/* Content Sections Skeleton */}
        <section className="px-4 py-6">
          <div className="flex flex-col gap-6">
            {/* What You'll Get */}
            <div className="flex flex-col gap-3">
              <div className="h-6 w-32 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#e1ddd8]/40 dark:bg-[#222631] animate-pulse" />
                    <div className="h-4 w-3/4 bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-3">
              <div className="h-6 w-24 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white/60 dark:bg-[#171b22] rounded-2xl p-4">
                    <div className="w-10 h-10 rounded-xl bg-[#e1ddd8]/40 dark:bg-[#222631] animate-pulse mb-3" />
                    <div className="h-4 w-20 bg-[#e1ddd8]/50 dark:bg-[#262b35] rounded-lg animate-pulse mb-2" />
                    <div className="h-3 w-full bg-[#e1ddd8]/30 dark:bg-[#1d222b] rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
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
            {error || 'Squad not found'}
          </h2>
          <Button
            onClick={() => router.push('/discover')}
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
          >
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const { squad, isMember, canJoin, cannotJoinReason, memberCount, memberAvatars, branding } = data;
  
  const accentLight = branding?.accentLight || '#a07855';
  const accentDark = branding?.accentDark || '#b8896a';
  const accentLightHover = branding?.accentLight ? adjustColorBrightness(branding.accentLight, -15) : '#8c6245';

  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Hero Section - Full Width */}
      <div className="relative">
        <div 
          className="h-[200px] sm:h-[260px] w-full relative"
          style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.3)}, ${hexToRgba(accentLightHover, 0.1)})` }}
        >
          {squad.avatarUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={squad.avatarUrl}
                alt={squad.name}
                width={120}
                height={120}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-white/20 shadow-lg"
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div 
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl flex items-center justify-center border-4 border-white/20 shadow-lg"
                style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
              >
                <Users className="w-12 h-12 sm:w-16 sm:h-16 text-white/80" />
              </div>
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
            <Users className="w-3.5 h-3.5" />
            Squad
          </span>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
          
          {/* Top Section - Two Column Grid */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            
            {/* Left Column - Squad Info */}
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
                  {squad.subscriptionEnabled ? 'Membership Squad' : 'Squad'}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                {squad.name}
              </h1>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                {squad.showMemberCount && memberCount !== undefined && memberCount > 0 && (
                  <MembersDisplay 
                    count={memberCount} 
                    avatars={memberAvatars || []}
                    accentLight={accentLight}
                  />
                )}
              </div>

              {/* Description */}
              {squad.description && (
                <p className="font-albert text-[16px] text-text-secondary leading-[1.6] mb-6">
                  {squad.description}
                </p>
              )}

              {/* Coach Info */}
              {squad.coachId && (
                <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
                  {squad.coachImageUrl ? (
                    <Image
                      src={squad.coachImageUrl}
                      alt={squad.coachName}
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
                        {squad.coachName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-[16px] text-text-primary font-albert">
                      {squad.coachName}
                    </div>
                    <div className="text-[13px] text-text-secondary font-albert">
                      Squad Lead
                    </div>
                  </div>
                </div>
              )}

              {/* Coach Bio */}
              {squad.coachBio && (
                <div className="mt-6">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary mb-2">
                    About Your Coach
                  </h3>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] whitespace-pre-line">
                    {squad.coachBio}
                  </p>
                </div>
              )}

              {/* Key Outcomes */}
              {squad.keyOutcomes && squad.keyOutcomes.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary mb-4">
                    What you&apos;ll get
                  </h3>
                  <motion.div 
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {squad.keyOutcomes.map((outcome, index) => (
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
              {squad.testimonials && squad.testimonials.length > 0 && (
                <div className="mt-8 bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-4 h-4 text-[#FFB800] fill-[#FFB800]"
                      />
                    ))}
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] italic mb-4">
                    &quot;{squad.testimonials[0].quote}&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    {squad.testimonials[0].imageUrl ? (
                      <Image
                        src={squad.testimonials[0].imageUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="w-9 h-9 rounded-full"
                      />
                    ) : (
                      <div 
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[13px]"
                        style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                      >
                        {squad.testimonials[0].name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-albert text-[13px] font-medium text-text-primary">
                        {squad.testimonials[0].name}
                      </p>
                      {squad.testimonials[0].title && (
                        <p className="font-albert text-[11px] text-text-secondary">
                          {squad.testimonials[0].title}
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
                {/* Squad badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div 
                    className="flex items-center gap-2 rounded-full px-4 py-2"
                    style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
                  >
                    <Users className="w-4 h-4" style={{ color: accentLight }} />
                    <span 
                      className="font-albert text-[13px] font-semibold"
                      style={{ color: accentLight }}
                    >
                      {squad.subscriptionEnabled ? 'Membership' : 'Squad'}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary tracking-[-2px]">
                      {formatPrice(squad.priceInCents, squad.subscriptionEnabled ? squad.billingInterval : undefined)}
                    </span>
                  </div>
                  {squad.priceInCents > 0 && (
                    <p className="font-albert text-[13px] text-text-secondary mt-1">
                      {squad.subscriptionEnabled ? 'recurring membership' : 'one-time payment'}
                    </p>
                  )}
                </div>

                {/* Community callout */}
                <div 
                  className="rounded-xl p-3 mb-6 text-center"
                  style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentDark, 0.08)})` }}
                >
                  <p className="font-albert text-[14px] text-text-primary">
                    <span className="font-semibold">Evergreen</span> squad — join anytime
                  </p>
                </div>

                {/* Member Status */}
                {isMember && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold font-albert text-[14px]">
                        You&apos;re a member!
                      </span>
                    </div>
                  </div>
                )}

                {/* Cannot Join Reason */}
                {!canJoin && cannotJoinReason && !isMember && (
                  <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-semibold font-albert text-[13px]">{cannotJoinReason}</span>
                    </div>
                  </div>
                )}

                {/* CTA Button */}
                {!isMember ? (
                  <Button
                    onClick={handleJoin}
                    disabled={!canJoin || joining}
                    className="w-full py-4 text-[16px] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.35)}`
                    }}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : !isSignedIn ? (
                      'Sign in to join'
                    ) : squad.priceInCents === 0 ? (
                      'Join for free'
                    ) : (
                      `Join for ${formatPrice(squad.priceInCents, squad.subscriptionEnabled ? squad.billingInterval : undefined)}`
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() => router.push('/squad')}
                    className="w-full py-4 text-[16px] text-white rounded-2xl font-semibold transition-all"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.3)}`
                    }}
                  >
                    Go to My Squad
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
          {squad.features && squad.features.length > 0 && (
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
                {squad.features.map((feature, index) => {
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

          {/* All Testimonials Card */}
          {squad.testimonials && squad.testimonials.length > 1 && (
            <div className="mt-8 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                What members are saying
              </h2>
              <motion.div 
                className="grid sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {squad.testimonials.slice(1).map((testimonial, index) => (
                  <motion.div 
                    key={index} 
                    className="p-5 bg-[#faf8f6] dark:bg-[#11141b] rounded-2xl"
                    variants={staggerItem}
                  >
                    <div className="flex items-center gap-0.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className="w-4 h-4 text-[#FFB800] fill-[#FFB800]"
                        />
                      ))}
                    </div>
                    <p className="font-albert text-[14px] text-text-secondary leading-[1.6] italic mb-4">
                      &quot;{testimonial.quote}&quot;
                    </p>
                    <div className="flex items-center gap-3">
                      {testimonial.imageUrl ? (
                        <Image
                          src={testimonial.imageUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[12px]"
                          style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                        >
                          {testimonial.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-albert text-[13px] font-medium text-text-primary">
                          {testimonial.name}
                        </p>
                        {testimonial.title && (
                          <p className="font-albert text-[11px] text-text-secondary">
                            {testimonial.title}
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
          {squad.faqs && squad.faqs.length > 0 && (
            <div className="mt-12 max-w-[800px] mx-auto">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                Frequently asked questions
              </h2>
              <div className="space-y-3">
                {squad.faqs.map((faq, index) => (
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
      {!isMember && (
        <div 
          className="bg-[#1a1a1a] pt-12 pb-24 md:pb-12 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8"
        >
          <div className="max-w-[600px] mx-auto px-4 text-center">
            <h2 className="font-albert text-[24px] sm:text-[28px] font-semibold text-white mb-3 tracking-[-1px]">
              Ready to join the squad?
            </h2>
            <p className="font-albert text-[15px] text-white/70 mb-6">
              {memberCount ? `Join ${memberCount}+ members` : 'Join other members'} who are already part of this squad.
            </p>
            <Button
              onClick={handleJoin}
              disabled={!canJoin || joining}
              className="py-4 px-8 rounded-3xl font-albert text-[16px] font-semibold transition-all duration-200 text-white"
              style={{ 
                background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                boxShadow: `0 8px 25px -4px ${hexToRgba(accentLight, 0.4)}`
              }}
            >
              {joining ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : squad.priceInCents === 0 ? (
                'Join Now — It\'s Free'
              ) : (
                `Join for ${formatPrice(squad.priceInCents, squad.subscriptionEnabled ? squad.billingInterval : undefined)}`
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <SquadPaymentModal
        isOpen={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, priceInCents: 0, currency: 'usd', billingInterval: 'monthly' })}
        onSuccess={handlePaymentSuccess}
        squadId={squadId}
        squadName={squad.name}
        priceInCents={paymentModal.priceInCents}
        currency={paymentModal.currency}
        billingInterval={paymentModal.billingInterval}
      />

      {/* Success Modal */}
      <AlertDialog open={successModal.open} onOpenChange={(open) => {
        if (!open) {
          setSuccessModal({ open: false, message: '' });
          router.push('/squad');
        }
      }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-3 text-text-primary">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              Welcome to the squad!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary text-[14px]">
              {successModal.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => {
                setSuccessModal({ open: false, message: '' });
                router.push('/squad');
              }}
              className="text-white"
              style={{ backgroundColor: accentLight }}
            >
              Go to Squad
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
              Join Failed
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

