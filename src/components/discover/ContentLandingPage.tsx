'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
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
import { BackButton } from './BackButton';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { 
  Check,
  ChevronDown,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  Star,
  Video,
  MessageCircle,
  Book,
  Target,
  Calendar,
  Zap,
  Heart,
  FileText,
  BookOpen,
  Download,
  Link as LinkIcon,
} from 'lucide-react';
import type { 
  PurchasableContentType, 
  ContentFeature,
  ContentTestimonial,
  ContentFaq,
} from '@/types/discover';

interface ContentLandingPageProps {
  content: {
    id: string;
    type: PurchasableContentType;
    title: string;
    description?: string;
    coverImageUrl?: string;
    priceInCents: number;
    currency?: string;
    coachName?: string;
    coachImageUrl?: string;
    coachBio?: string;
    keyOutcomes?: string[];
    features?: ContentFeature[];
    testimonials?: ContentTestimonial[];
    faqs?: ContentFaq[];
  };
  /** Whether user already owns this content */
  isOwned?: boolean;
  /** If included in program */
  includedInProgramName?: string;
  /** Callback when user needs to access the content */
  onAccessContent?: () => void;
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
  'message-circle': MessageCircle,
  'book': Book,
  'target': Target,
  'calendar': Calendar,
  'check-circle': CheckCircle,
  'zap': Zap,
  'heart': Heart,
  'star': Star,
  'file-text': FileText,
  'book-open': BookOpen,
  'download': Download,
  'link': LinkIcon,
};

// Get icon for content type
function getContentTypeIcon(type: PurchasableContentType) {
  switch (type) {
    case 'article': return FileText;
    case 'course': return BookOpen;
    case 'event': return Calendar;
    case 'download': return Download;
    case 'link': return LinkIcon;
    default: return FileText;
  }
}

// Get content type label
function getContentTypeLabel(type: PurchasableContentType) {
  switch (type) {
    case 'article': return 'Article';
    case 'course': return 'Course';
    case 'event': return 'Event';
    case 'download': return 'Download';
    case 'link': return 'Resource';
    default: return 'Content';
  }
}

// Format price
function formatPrice(cents: number, currency = 'usd') {
  if (cents === 0) return 'Free';
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Animation variants
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

// FAQ Accordion
function FAQItem({ 
  faq, 
  isOpen, 
  onToggle, 
  accentLight 
}: { 
  faq: ContentFaq; 
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

/**
 * ContentLandingPage - Shared landing page template for all purchasable content types
 */
export function ContentLandingPage({
  content,
  isOwned = false,
  includedInProgramName,
  onAccessContent,
}: ContentLandingPageProps) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { colors } = useBrandingValues();
  
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  
  const ContentIcon = getContentTypeIcon(content.type);
  const accentLight = colors.accentLight;
  const accentDark = colors.accentDark;
  
  const handlePurchase = async () => {
    if (!isSignedIn) {
      const returnPath = window.location.pathname;
      router.push(`/sign-in?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    
    setIsPurchasing(true);
    
    try {
      const response = await fetch('/api/content/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: content.type,
          contentId: content.id,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Purchase failed');
      }
      
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      
      setSuccessModal({ 
        open: true, 
        message: result.message || 'Content added to your library!' 
      });
      
    } catch (error) {
      console.error('Purchase error:', error);
      setErrorModal({ 
        open: true, 
        message: error instanceof Error ? error.message : 'Purchase failed' 
      });
    } finally {
      setIsPurchasing(false);
    }
  };
  
  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Hero Section */}
      <div className="relative">
        <div 
          className="h-[200px] sm:h-[260px] w-full relative"
          style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.3)}, ${hexToRgba(accentDark, 0.1)})` }}
        >
          {content.coverImageUrl ? (
            <Image
              src={content.coverImageUrl}
              alt={content.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ContentIcon 
                className="w-16 h-16" 
                style={{ color: hexToRgba(accentLight, 0.4) }} 
              />
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
            <ContentIcon className="w-3.5 h-3.5" />
            {getContentTypeLabel(content.type)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
          
          {/* Two Column Grid */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            
            {/* Left Column - Content Info */}
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
                  {getContentTypeLabel(content.type)}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                {content.title}
              </h1>

              {/* Description */}
              {content.description && (
                <p className="font-albert text-[16px] text-text-secondary leading-[1.6] mb-6">
                  {content.description}
                </p>
              )}

              {/* Coach Info */}
              {content.coachName && (
                <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
                  {content.coachImageUrl ? (
                    <Image
                      src={content.coachImageUrl}
                      alt={content.coachName}
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
                        {content.coachName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-[16px] text-text-primary font-albert">
                      {content.coachName}
                    </div>
                    <div className="text-[13px] text-text-secondary font-albert">
                      Creator
                    </div>
                  </div>
                </div>
              )}

              {/* Coach Bio */}
              {content.coachBio && (
                <div className="mt-6">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary mb-2">
                    About the Creator
                  </h3>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] whitespace-pre-line">
                    {content.coachBio}
                  </p>
                </div>
              )}

              {/* Key Outcomes */}
              {content.keyOutcomes && content.keyOutcomes.length > 0 && (
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
                    {content.keyOutcomes.map((outcome, index) => (
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

              {/* First Testimonial Preview */}
              {content.testimonials && content.testimonials.length > 0 && (
                <div className="mt-8 bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (content.testimonials![0].rating || 5)
                            ? 'text-[#FFB800] fill-[#FFB800]'
                            : 'text-[#d1ccc5]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6] italic mb-4">
                    &quot;{content.testimonials[0].quote}&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    {content.testimonials[0].imageUrl ? (
                      <Image
                        src={content.testimonials[0].imageUrl}
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
                        {content.testimonials[0].name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-albert text-[13px] font-medium text-text-primary">
                        {content.testimonials[0].name}
                      </p>
                      {content.testimonials[0].title && (
                        <p className="font-albert text-[11px] text-text-secondary">
                          {content.testimonials[0].title}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sticky Purchase Card */}
            <div className="lg:col-span-2 lg:sticky lg:top-8">
              <div className="bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-8 shadow-lg border border-[#e1ddd8] dark:border-[#262b35]">
                {/* Content type badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div 
                    className="flex items-center gap-2 rounded-full px-4 py-2"
                    style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
                  >
                    <ContentIcon className="w-4 h-4" style={{ color: accentLight }} />
                    <span 
                      className="font-albert text-[13px] font-semibold"
                      style={{ color: accentLight }}
                    >
                      {getContentTypeLabel(content.type)}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary tracking-[-2px]">
                      {formatPrice(content.priceInCents, content.currency)}
                    </span>
                  </div>
                  {content.priceInCents > 0 && (
                    <p className="font-albert text-[13px] text-text-secondary mt-1">
                      one-time payment
                    </p>
                  )}
                </div>

                {/* Owned Status */}
                {isOwned && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-semibold font-albert text-[14px]">
                        You own this!
                      </span>
                    </div>
                    {includedInProgramName && (
                      <p className="text-[12px] text-green-600 dark:text-green-400 mt-1 ml-7">
                        Included in {includedInProgramName}
                      </p>
                    )}
                  </div>
                )}

                {/* CTA Button */}
                {!isOwned ? (
                  <Button
                    onClick={handlePurchase}
                    disabled={isPurchasing}
                    className="w-full py-4 text-[16px] text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.35)}`
                    }}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : !isSignedIn ? (
                      'Sign in to purchase'
                    ) : content.priceInCents === 0 ? (
                      'Get for free'
                    ) : (
                      `Purchase for ${formatPrice(content.priceInCents, content.currency)}`
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={onAccessContent}
                    className="w-full py-4 text-[16px] text-white rounded-2xl font-semibold transition-all"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.3)}`
                    }}
                  >
                    Access Content
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
                    <span className="font-albert text-[12px]">Instant access</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Section */}
          {content.features && content.features.length > 0 && (
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
                {content.features.map((feature, index) => {
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

          {/* All Testimonials */}
          {content.testimonials && content.testimonials.length > 1 && (
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
                {content.testimonials.slice(1).map((testimonial, index) => (
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
          {content.faqs && content.faqs.length > 0 && (
            <div className="mt-12 max-w-[800px] mx-auto">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary text-center mb-8 tracking-[-1px]">
                Frequently asked questions
              </h2>
              <div className="space-y-3">
                {content.faqs.map((faq, index) => (
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

      {/* Bottom CTA (when not owned) */}
      {!isOwned && (
        <div className="bg-[#1a1a1a] pt-12 pb-24 md:pb-12 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8">
          <div className="max-w-[600px] mx-auto px-4 text-center">
            <h2 className="font-albert text-[24px] sm:text-[28px] font-semibold text-white mb-3 tracking-[-1px]">
              Ready to get started?
            </h2>
            <p className="font-albert text-[15px] text-white/70 mb-6">
              Get instant access to this {getContentTypeLabel(content.type).toLowerCase()}.
            </p>
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="inline-block py-4 px-8 rounded-3xl font-albert text-[16px] font-semibold transition-all duration-200 text-white"
              style={{ 
                background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                boxShadow: `0 8px 25px -4px ${hexToRgba(accentLight, 0.4)}`
              }}
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : content.priceInCents === 0 ? (
                'Get for Free'
              ) : (
                `Purchase for ${formatPrice(content.priceInCents, content.currency)}`
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
              Purchase Failed
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

