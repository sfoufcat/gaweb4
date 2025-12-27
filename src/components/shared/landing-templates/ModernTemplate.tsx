'use client';

import { Check, Star, ChevronDown, ArrowRight, Shield, CheckCircle, Clock, Users, User, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import type { LandingTemplateProps } from './ClassicTemplate';

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
      staggerChildren: 0.1,
      delayChildren: 0.15
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
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

export function ModernTemplate({
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
  showPrice = true,
  onCTA,
  priceInCents = 0,
  durationDays = 30,
  enrolledCount = 0,
  programType = 'individual',
  accentLight = '#a07855',
  accentDark = '#b8896a',
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Use headline/subheadline or fall back to program name/description
  const displayHeadline = headline || programName || 'Transform Your Life';
  const displaySubheadline = subheadline || programDescription;

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0a0c10]">
      {/* Bold Hero Section with Gradient */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div 
          className="absolute inset-0"
          style={{ 
            background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 50%, ${hexToRgba(accentLight, 0.8)} 100%)` 
          }}
        />
        
        {/* Geometric shapes overlay */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20"
            style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }}
          />
          <div 
            className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-10"
            style={{ background: `radial-gradient(circle, white 0%, transparent 70%)` }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Left: Text content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* Type badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full mb-6">
                {programType === 'group' ? (
                  <Users className="w-4 h-4 text-white" />
                ) : (
                  <User className="w-4 h-4 text-white" />
                )}
                <span className="text-white text-sm font-semibold uppercase tracking-wide">
                  {programType === 'group' ? 'Group Program' : '1:1 Coaching'}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6 leading-[1.1] tracking-tight">
                {displayHeadline}
              </h1>
              
              {displaySubheadline && (
                <p className="text-lg md:text-xl text-white/90 mb-8 max-w-xl leading-relaxed">
                  {displaySubheadline}
                </p>
              )}

              {/* Quick stats */}
              <div className="flex flex-wrap gap-6 mb-8">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-white/80" />
                  <span className="text-white font-medium">{durationDays} days</span>
                </div>
                {enrolledCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-white/80" />
                    <span className="text-white font-medium">{enrolledCount}+ enrolled</span>
                  </div>
                )}
              </div>

              <button
                onClick={onCTA}
                className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-lg font-bold rounded-2xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                style={{ color: accentLight }}
              >
                {ctaText}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
              
              {ctaSubtext && (
                <p className="mt-4 text-sm text-white/70">{ctaSubtext}</p>
              )}
            </motion.div>

            {/* Right: Program image or pricing card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              {programImageUrl ? (
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <div className="aspect-[4/3]">
                    <Image
                      src={programImageUrl}
                      alt={displayHeadline}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  {/* Pricing overlay badge */}
                  {showPrice && (
                    <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-lg">
                      <span className="text-2xl font-black" style={{ color: accentLight }}>
                        {formatPrice(priceInCents)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  className="rounded-3xl p-8 shadow-2xl"
                  style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)' }}
                >
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 text-white/80 mx-auto mb-4" />
                    {showPrice && (
                      <>
                        <div className="text-5xl font-black text-white mb-2">
                          {formatPrice(priceInCents)}
                        </div>
                        <p className="text-white/70 text-sm">one-time investment</p>
                      </>
                    )}
                    <div className="mt-6 pt-6 border-t border-white/20">
                      <p className="text-white font-semibold">{durationDays}-day program</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Two-column main content */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-5 gap-12">
          {/* Left column - Main content */}
          <div className="lg:col-span-3 space-y-16">
            {/* Key Outcomes */}
            {keyOutcomes.length > 0 && (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                <div className="mb-8">
                  <span 
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.15), color: accentLight }}
                  >
                    The Transformation
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-[#1a1a1a] dark:text-white">
                    What You&apos;ll Achieve
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {keyOutcomes.map((outcome, index) => (
                    <motion.div
                      key={index}
                      variants={staggerItem}
                      className="flex items-start gap-4 p-5 bg-[#faf8f6] dark:bg-[#171b22] rounded-2xl border-2 border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] transition-colors"
                    >
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                      >
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium leading-snug">
                        {outcome}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Features */}
            {features.length > 0 && (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                <div className="mb-8">
                  <span 
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.15), color: accentLight }}
                  >
                    What&apos;s Included
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-[#1a1a1a] dark:text-white">
                    Everything You Need
                  </h2>
                </div>
                <div className="space-y-4">
                  {features.map((feature, index) => (
                    <motion.div
                      key={index}
                      variants={staggerItem}
                      className="p-6 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] shadow-sm hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {feature.icon && (
                          <span className="text-3xl flex-shrink-0">
                            {featureIconMap[feature.icon] || '✨'}
                          </span>
                        )}
                        <div>
                          <h3 className="text-lg font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                            {feature.title}
                          </h3>
                          {feature.description && (
                            <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                              {feature.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Coach Bio */}
            {coachBio && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8">
                  <span 
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.15), color: accentLight }}
                  >
                    Meet Your Guide
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-[#1a1a1a] dark:text-white">
                    About Your Coach
                  </h2>
                </div>
                <div 
                  className="p-8 rounded-3xl"
                  style={{ background: `linear-gradient(135deg, ${hexToRgba(accentLight, 0.08)}, ${hexToRgba(accentDark, 0.05)})` }}
                >
                  <div className="flex flex-col sm:flex-row items-start gap-6">
                    {coachImageUrl ? (
                      <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg">
                        <Image
                          src={coachImageUrl}
                          alt={coachName || 'Coach'}
                          width={96}
                          height={96}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div 
                        className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                      >
                        <User className="w-10 h-10 text-white" />
                      </div>
                    )}
                    <div>
                      {coachName && (
                        <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                          {coachName}
                        </h3>
                      )}
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-4">Your Coach</p>
                      <p className="text-[#1a1a1a] dark:text-[#f5f5f8] leading-relaxed whitespace-pre-wrap">
                        {coachBio}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}

            {/* Testimonials */}
            {showTestimonials && testimonials.length > 0 && (
              <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
              >
                <div className="mb-8">
                  <span 
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.15), color: accentLight }}
                  >
                    Success Stories
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-[#1a1a1a] dark:text-white">
                    What Others Say
                  </h2>
                </div>
                <div className="space-y-6">
                  {testimonials.map((testimonial, index) => (
                    <motion.div
                      key={index}
                      variants={staggerItem}
                      className="p-6 bg-white dark:bg-[#171b22] rounded-2xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      {testimonial.rating && (
                        <div className="flex gap-1 mb-4">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= testimonial.rating!
                                  ? 'fill-[#FFB800] text-[#FFB800]'
                                  : 'text-[#d1ccc5] dark:text-[#7d8190]'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                      <p className="text-[#1a1a1a] dark:text-[#f5f5f8] text-lg leading-relaxed mb-4">
                        &ldquo;{testimonial.text}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                        >
                          <span className="text-white font-bold text-sm">
                            {testimonial.author.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                            {testimonial.author}
                          </p>
                          {testimonial.role && (
                            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                              {testimonial.role}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* FAQs */}
            {showFAQ && faqs.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8">
                  <span 
                    className="inline-block text-xs font-bold uppercase tracking-widest mb-2 px-3 py-1 rounded-full"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.15), color: accentLight }}
                  >
                    Got Questions?
                  </span>
                  <h2 className="text-3xl md:text-4xl font-black text-[#1a1a1a] dark:text-white">
                    FAQ
                  </h2>
                </div>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div
                      key={index}
                      className={`bg-[#faf8f6] dark:bg-[#171b22] rounded-2xl overflow-hidden transition-all ${
                        openFaqIndex === index ? 'shadow-lg ring-2' : ''
                      }`}
                      style={openFaqIndex === index ? { ['--tw-ring-color' as string]: hexToRgba(accentLight, 0.3) } : undefined}
                    >
                      <button
                        onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left"
                      >
                        <span className="font-bold text-[#1a1a1a] dark:text-[#f5f5f8] pr-4">
                          {faq.question}
                        </span>
                        <motion.div
                          animate={{ rotate: openFaqIndex === index ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown 
                            className="w-5 h-5 flex-shrink-0"
                            style={{ color: accentLight }}
                          />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <p className="px-6 pb-5 text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                              {faq.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          {/* Right column - Sticky pricing card */}
          <div className="lg:col-span-2">
            <div className="sticky top-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white dark:bg-[#171b22] rounded-3xl shadow-xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden"
              >
                {/* Card header with gradient */}
                <div 
                  className="p-6 text-center"
                  style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full mb-4">
                    {programType === 'group' ? (
                      <Users className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                    <span className="text-white text-xs font-semibold uppercase">
                      {programType === 'group' ? 'Group' : '1:1'}
                    </span>
                  </div>
                  
                  {showPrice && (
                    <>
                      <div className="text-4xl font-black text-white mb-1">
                        {formatPrice(priceInCents)}
                      </div>
                      <p className="text-white/80 text-sm">one-time payment</p>
                    </>
                  )}
                </div>

                {/* Card body */}
                <div className="p-6 space-y-6">
                  {/* Duration */}
                  <div 
                    className="rounded-xl p-4 text-center"
                    style={{ backgroundColor: hexToRgba(accentLight, 0.1) }}
                  >
                    <p className="text-[#1a1a1a] dark:text-[#f5f5f8] font-semibold">
                      <span className="text-xl font-black">{durationDays}</span>-day transformation
                    </p>
                  </div>

                  {/* Start anytime */}
                  <div className="flex items-start gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] text-sm">
                        Start anytime
                      </p>
                      <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-1">
                        Work at your own pace with your coach.
                      </p>
                    </div>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={onCTA}
                    className="w-full py-4 text-white font-bold text-lg rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    style={{ 
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                      boxShadow: `0 8px 24px -4px ${hexToRgba(accentLight, 0.4)}`
                    }}
                  >
                    {ctaText || (showPrice ? (priceInCents === 0 ? 'Get Started Free' : `Enroll for ${formatPrice(priceInCents)}`) : 'Continue')}
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  {ctaSubtext && (
                    <p className="text-center text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                      {ctaSubtext}
                    </p>
                  )}

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#7d8190]">
                      <Shield className="w-4 h-4" />
                      <span className="text-xs">Secure</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#7d8190]">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs">Full access</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div 
        className="py-16 px-6"
        style={{ background: `linear-gradient(135deg, ${accentLight}, ${accentDark})` }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            Ready to Transform?
          </h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            {enrolledCount > 0 
              ? `Join ${enrolledCount}+ others who have already started their journey.`
              : 'Start your transformation journey today.'
            }
          </p>
          <button
            onClick={onCTA}
            className="group inline-flex items-center gap-3 px-10 py-5 bg-white font-bold text-lg rounded-2xl transition-all hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
            style={{ color: accentLight }}
          >
            {ctaText || (showPrice ? (priceInCents === 0 ? 'Get Started Free' : `Enroll for ${formatPrice(priceInCents)}`) : 'Continue')}
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
          {ctaSubtext && (
            <p className="mt-4 text-sm text-white/70">{ctaSubtext}</p>
          )}
        </div>
      </div>
    </div>
  );
}
