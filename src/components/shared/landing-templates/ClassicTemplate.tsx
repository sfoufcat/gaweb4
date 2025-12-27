'use client';

import { Check, Star, ChevronDown, Shield, CheckCircle, Clock, Users, User } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { ProgramFeature, ProgramTestimonial, ProgramFAQ } from '@/types';

export interface LandingTemplateProps {
  headline?: string;
  subheadline?: string;
  programName?: string;
  programDescription?: string;
  programImageUrl?: string;
  coachName?: string;
  coachImageUrl?: string;
  coachBio?: string;
  keyOutcomes?: string[];
  features?: ProgramFeature[];
  testimonials?: ProgramTestimonial[];
  faqs?: ProgramFAQ[];
  ctaText?: string;
  ctaSubtext?: string;
  showTestimonials?: boolean;
  showFAQ?: boolean;
  onCTA?: () => void;
  // Program display props
  priceInCents?: number;
  durationDays?: number;
  enrolledCount?: number;
  programType?: 'individual' | 'group';
  // Brand accent colors
  accentLight?: string;
  accentDark?: string;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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

// Icon mapping for features
const featureIconMap: Record<string, string> = {
  'video': '📹',
  'users': '👥',
  'message-circle': '💬',
  'book': '📚',
  'target': '🎯',
  'calendar': '📅',
  'check-circle': '✅',
  'zap': '⚡',
  'heart': '❤️',
  'star': '⭐',
};

// FAQ Accordion Item
interface FAQItemProps {
  faq: ProgramFAQ;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ 
  faq, 
  isOpen, 
  onToggle, 
}: FAQItemProps) {
  return (
    <div className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-colors"
      >
        <span className="font-albert text-[15px] font-medium text-text-primary dark:text-[#f5f5f8] pr-4">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown 
            className={`w-5 h-5 text-text-secondary dark:text-[#7d8190] ${isOpen ? 'text-[#a07855]' : ''}`}
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
              <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6]">
                {faq.answer}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ClassicTemplate({
  headline,
  subheadline,
  programName,
  programDescription,
  programImageUrl,
  coachName,
  coachImageUrl,
  coachBio,
  keyOutcomes = [],
  features = [],
  testimonials = [],
  faqs = [],
  ctaText = 'Get Started',
  ctaSubtext,
  showTestimonials = true,
  showFAQ = true,
  onCTA,
  priceInCents = 0,
  durationDays = 30,
  enrolledCount = 0,
  programType = 'individual',
  accentLight = '#a07855',
  accentDark = '#b8896a',
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Use headline/subheadline or fall back to program name/description
  const displayHeadline = headline || programName || 'Transform Your Life';
  const displaySubheadline = subheadline || programDescription;

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Hero Section - Full Width Cover Image */}
      <div className="relative">
        <div 
          className="h-[200px] sm:h-[260px] w-full relative"
          style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.3)}, ${hexToRgba(accentDark, 0.1)})` }}
        >
          {programImageUrl ? (
            <Image
              src={programImageUrl}
              alt={displayHeadline}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(to bottom right, ${hexToRgba(accentLight, 0.2)}, ${hexToRgba(accentDark, 0.1)})` }}
            >
              {programType === 'group' ? (
                <Users className="w-16 h-16" style={{ color: hexToRgba(accentLight, 0.4) }} />
              ) : (
                <User className="w-16 h-16" style={{ color: hexToRgba(accentLight, 0.4) }} />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>

        {/* Type badge */}
        <div className="absolute top-4 right-4">
          <span 
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold flex items-center gap-1.5 backdrop-blur-md shadow-lg text-white"
            style={{ backgroundColor: hexToRgba(accentLight, 0.9) }}
          >
            {programType === 'group' ? (
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
                  Personal Coaching
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[28px] sm:text-[36px] lg:text-[42px] font-semibold text-text-primary dark:text-[#f5f5f8] leading-[1.1] tracking-[-2px] mb-4">
                {displayHeadline}
              </h1>

              {/* Meta Row */}
              <div className="flex flex-wrap items-center gap-4 mb-5">
                <div className="flex items-center gap-1.5 text-text-secondary dark:text-[#b2b6c2]">
                  <Clock className="w-4 h-4" />
                  <span className="font-albert text-[14px]">{durationDays} days</span>
                </div>
                {enrolledCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="font-albert font-semibold text-[14px]"
                      style={{ color: accentLight }}
                    >
                      {enrolledCount.toLocaleString()}
                    </span>
                    <span className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2]">
                      enrolled
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {displaySubheadline && (
                <p className="font-albert text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] mb-6">
                  {displaySubheadline}
                </p>
              )}

              {/* Coach Info Card */}
              {coachName && (
                <div className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]">
                  {coachImageUrl ? (
                    <Image
                      src={coachImageUrl}
                      alt={coachName}
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
                        {coachName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-[16px] text-text-primary dark:text-[#f5f5f8] font-albert">
                      {coachName}
                    </div>
                    <div className="text-[13px] text-text-secondary dark:text-[#b2b6c2] font-albert">
                      Your Coach
                    </div>
                  </div>
                </div>
              )}

              {/* Coach Bio */}
              {coachBio && (
                <div className="mt-6">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-2">
                    About Your Coach
                  </h3>
                  <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>
              )}

              {/* Key Outcomes / What You'll Learn */}
              {keyOutcomes.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] mb-4">
                    What you&apos;ll learn
                  </h3>
                  <motion.div 
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    {keyOutcomes.map((outcome, index) => (
                      <motion.div key={index} className="flex items-start gap-3" variants={staggerItem}>
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.1)}, ${hexToRgba(accentDark, 0.1)})` }}
                        >
                          <Check className="w-3.5 h-3.5" style={{ color: accentLight }} />
                        </div>
                        <span className="font-albert text-[15px] text-text-primary dark:text-[#f5f5f8] leading-[1.5]">
                          {outcome}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>
              )}

              {/* Single Testimonial Preview */}
              {showTestimonials && testimonials.length > 0 && (
                <div className="mt-8 bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= (testimonials[0].rating || 5)
                            ? 'text-[#FFB800] fill-[#FFB800]'
                            : 'text-[#d1ccc5]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] italic mb-4">
                    &quot;{testimonials[0].text}&quot;
                  </p>
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-albert font-semibold text-[13px]"
                      style={{ background: `linear-gradient(to bottom right, ${accentLight}, ${accentDark})` }}
                    >
                      {testimonials[0].author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-albert text-[13px] font-medium text-text-primary dark:text-[#f5f5f8]">
                        {testimonials[0].author}
                      </p>
                      {testimonials[0].role && (
                        <p className="font-albert text-[11px] text-text-secondary dark:text-[#7d8190]">
                          {testimonials[0].role}
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
                    {programType === 'group' ? (
                      <Users className="w-4 h-4" style={{ color: accentLight }} />
                    ) : (
                      <User className="w-4 h-4" style={{ color: accentLight }} />
                    )}
                    <span 
                      className="font-albert text-[13px] font-semibold"
                      style={{ color: accentLight }}
                    >
                      {programType === 'group' ? 'Group Program' : '1:1 Coaching'}
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[42px] font-bold text-text-primary dark:text-[#f5f5f8] tracking-[-2px]">
                      {formatPrice(priceInCents)}
                    </span>
                  </div>
                  {priceInCents > 0 && (
                    <p className="font-albert text-[13px] text-text-secondary dark:text-[#b2b6c2] mt-1">
                      one-time payment
                    </p>
                  )}
                </div>

                {/* Duration callout */}
                <div 
                  className="rounded-xl p-3 mb-6 text-center"
                  style={{ background: `linear-gradient(to right, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentDark, 0.08)})` }}
                >
                  <p className="font-albert text-[14px] text-text-primary dark:text-[#f5f5f8]">
                    <span className="font-semibold">{durationDays}-day</span> transformation program
                  </p>
                </div>

                {/* Start anytime info */}
                <div className="mb-6 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                  <div className="flex items-center gap-2 text-text-primary dark:text-[#f5f5f8]">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-semibold font-albert text-[14px]">Start anytime</span>
                  </div>
                  <p className="text-[13px] text-text-secondary dark:text-[#b2b6c2] mt-1 ml-7">
                    Work directly with your coach at your own pace.
                  </p>
                </div>

                {/* CTA Button */}
                <button
                  onClick={onCTA}
                  className="w-full py-4 text-[16px] text-white rounded-2xl font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
                  style={{ 
                    background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                    boxShadow: `0 8px 20px -4px ${hexToRgba(accentLight, 0.35)}`
                  }}
                >
                  {ctaText || (priceInCents === 0 ? 'Get Started Free' : `Enroll for ${formatPrice(priceInCents)}`)}
                </button>

                {ctaSubtext && (
                  <p className="text-center font-albert text-[13px] text-text-muted dark:text-[#7d8190] mt-3">
                    {ctaSubtext}
                  </p>
                )}

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
                  <div className="flex items-center gap-2 text-text-secondary dark:text-[#b2b6c2]">
                    <Shield className="w-4 h-4" />
                    <span className="font-albert text-[12px]">Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary dark:text-[#b2b6c2]">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-albert text-[12px]">Full access</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* What's Included Card */}
          {features.length > 0 && (
            <div className="mt-12 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary dark:text-[#f5f5f8] text-center mb-8 tracking-[-1px]">
                What&apos;s included
              </h2>
              <motion.div 
                className="grid sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {features.map((feature, index) => (
                  <motion.div 
                    key={index} 
                    className="flex items-start gap-4 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl"
                    variants={staggerItem}
                  >
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${hexToRgba(accentLight, 0.15)}, ${hexToRgba(accentDark, 0.1)})` }}
                    >
                      <span className="text-lg">
                        {feature.icon ? featureIconMap[feature.icon] || '⭐' : '⭐'}
                      </span>
                    </div>
                    <div>
                      <div className="font-albert font-semibold text-[15px] text-text-primary dark:text-[#f5f5f8]">
                        {feature.title}
                      </div>
                      {feature.description && (
                        <div className="font-albert text-[13px] text-text-secondary dark:text-[#b2b6c2] mt-1 leading-[1.5]">
                          {feature.description}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {/* All Testimonials Card */}
          {showTestimonials && testimonials.length > 1 && (
            <div className="mt-8 bg-white dark:bg-[#171b22] rounded-3xl p-6 sm:p-10 border border-[#e1ddd8] dark:border-[#262b35]">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary dark:text-[#f5f5f8] text-center mb-8 tracking-[-1px]">
                What others are saying
              </h2>
              <motion.div 
                className="grid sm:grid-cols-2 gap-4"
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
              >
                {testimonials.slice(1).map((testimonial, index) => (
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
                    <p className="font-albert text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6] italic mb-4">
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
                        <p className="font-albert text-[13px] font-medium text-text-primary dark:text-[#f5f5f8]">
                          {testimonial.author}
                        </p>
                        {testimonial.role && (
                          <p className="font-albert text-[11px] text-text-secondary dark:text-[#7d8190]">
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
          {showFAQ && faqs.length > 0 && (
            <div className="mt-12 max-w-[800px] mx-auto">
              <h2 className="font-albert text-[22px] sm:text-[26px] font-semibold text-text-primary dark:text-[#f5f5f8] text-center mb-8 tracking-[-1px]">
                Frequently asked questions
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, index) => {
                  const handleToggle = () => { setOpenFaqIndex(openFaqIndex === index ? null : index); };
                  return (
                    <div key={index}>
                      <FAQItem
                        faq={faq}
                        isOpen={openFaqIndex === index}
                        onToggle={handleToggle}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Floating CTA - Dark Card */}
      <div 
        className="bg-[#1a1a1a] pt-12 pb-24 md:pb-12 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8"
      >
        <div className="max-w-[600px] mx-auto px-4 text-center">
          <h2 className="font-albert text-[24px] sm:text-[28px] font-semibold text-white mb-3 tracking-[-1px]">
            Ready to start your transformation?
          </h2>
          <p className="font-albert text-[15px] text-white/70 mb-6">
            {enrolledCount > 0 
              ? `Join ${enrolledCount}+ members who are already on their growth journey.`
              : 'Join members who are already on their growth journey.'
            }
          </p>
          <button
            onClick={onCTA}
            className="inline-block py-4 px-8 rounded-3xl font-albert text-[16px] font-semibold transition-all duration-200 text-white"
            style={{ 
              background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
              boxShadow: `0 8px 25px -4px ${hexToRgba(accentLight, 0.4)}`
            }}
          >
            {ctaText || (priceInCents === 0 ? 'Get Started Free' : `Enroll for ${formatPrice(priceInCents)}`)}
          </button>
        </div>
      </div>
    </div>
  );
}
