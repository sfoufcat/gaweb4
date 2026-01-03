'use client';

import { Check, Star, Plus, Minus, Clock, Users, User, Shield, CheckCircle } from 'lucide-react';
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

// Subtle fade animation
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

export function MinimalTemplate({
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
  subscriptionEnabled,
  billingInterval,
  durationDays = 30,
  enrolledCount = 0,
  programType = 'individual',
  accentLight = 'var(--brand-accent-light)',
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Use headline/subheadline or fall back to program name/description
  const displayHeadline = headline || programName || 'Transform Your Life';
  const displaySubheadline = subheadline || programDescription;

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    const price = `$${(cents / 100).toFixed(2)}`;
    if (subscriptionEnabled && billingInterval) {
      const intervalSuffix = billingInterval === 'monthly' ? '/mo' : billingInterval === 'quarterly' ? '/qtr' : '/yr';
      return `${price}${intervalSuffix}`;
    }
    return price;
  };

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-[#0a0c10]">
      {/* Elegant Hero - Single Column Centered */}
      <section className="relative">
        {/* Optional background image with overlay */}
        {programImageUrl && (
          <div className="absolute inset-0 h-[400px]">
            <Image
              src={programImageUrl}
              alt={displayHeadline}
              fill
              className="object-cover opacity-10 dark:opacity-5"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white to-white dark:from-[#0a0c10]/50 dark:via-[#0a0c10] dark:to-[#0a0c10]" />
          </div>
        )}

        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Type badge - minimal pill */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <span 
              className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] px-4 py-2 rounded-full border"
              style={{ 
                borderColor: hexToRgba(accentLight, 0.3),
                color: accentLight
              }}
            >
              {programType === 'group' ? (
                <>
                  <Users className="w-3.5 h-3.5" />
                  Group Program
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5" />
                  Personal Coaching
                </>
              )}
            </span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-light text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 leading-[1.15] tracking-tight"
          >
            {displayHeadline}
          </motion.h1>

          {displaySubheadline && (
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-[#5f5a55] dark:text-[#b2b6c2] mb-10 leading-relaxed max-w-2xl mx-auto"
            >
              {displaySubheadline}
            </motion.p>
          )}

          {/* Inline pricing banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 mb-10 py-6 border-y border-[#e1ddd8] dark:border-[#262b35]"
          >
            {showPrice && (
              <div className="text-center">
                <p className="text-3xl md:text-4xl font-light text-[#1a1a1a] dark:text-[#f5f5f8]">
                  {formatPrice(priceInCents)}
                </p>
                <p className="text-xs uppercase tracking-widest text-[#5f5a55] dark:text-[#7d8190] mt-1">
                  {subscriptionEnabled && billingInterval ? billingInterval : 'one-time'}
                </p>
              </div>
            )}
            <div className="hidden sm:block w-px h-12 bg-[#e1ddd8] dark:bg-[#262b35]" />
            <div className="text-center">
              <p className="text-3xl md:text-4xl font-light text-[#1a1a1a] dark:text-[#f5f5f8]">
                {durationDays}
              </p>
              <p className="text-xs uppercase tracking-widest text-[#5f5a55] dark:text-[#7d8190] mt-1">
                days
              </p>
            </div>
            {enrolledCount > 0 && (
              <>
                <div className="hidden sm:block w-px h-12 bg-[#e1ddd8] dark:bg-[#262b35]" />
                <div className="text-center">
                  <p className="text-3xl md:text-4xl font-light text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {enrolledCount}+
                  </p>
                  <p className="text-xs uppercase tracking-widest text-[#5f5a55] dark:text-[#7d8190] mt-1">
                    enrolled
                  </p>
                </div>
              </>
            )}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col items-center gap-4"
          >
            <button
              onClick={onCTA}
              className="px-10 py-4 font-medium rounded-full transition-all duration-300 hover:opacity-90 hover:shadow-lg"
              style={{ 
                backgroundColor: accentLight,
                color: 'white'
              }}
            >
              {ctaText || (showPrice ? (priceInCents === 0 ? 'Begin Your Journey' : 'Enroll Now') : 'Continue')}
            </button>
            {ctaSubtext && (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">{ctaSubtext}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* Thin divider */}
      <div className="max-w-16 mx-auto border-t border-[#e1ddd8] dark:border-[#262b35]" />

      {/* Key Outcomes - Elegant List */}
      {keyOutcomes.length > 0 && (
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="py-20 px-6"
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-[0.2em] mb-10 text-center">
              What You&apos;ll Learn
            </h2>
            <div className="space-y-0">
              {keyOutcomes.map((outcome, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 py-5 border-b border-[#f0ede9] dark:border-[#1d222b] last:border-0"
                >
                  <Check className="w-4 h-4 flex-shrink-0" style={{ color: accentLight }} />
                  <span className="text-[#1a1a1a] dark:text-[#f5f5f8] leading-relaxed">
                    {outcome}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Thin divider */}
      {features.length > 0 && (
        <div className="max-w-16 mx-auto border-t border-[#e1ddd8] dark:border-[#262b35]" />
      )}

      {/* Features - Text Focus with subtle cards */}
      {features.length > 0 && (
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]"
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-[0.2em] mb-10 text-center">
              What&apos;s Included
            </h2>
            <div className="space-y-6">
              {features.map((feature, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="p-6 bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  <h3 className="text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    {feature.title}
                  </h3>
                  {feature.description && (
                    <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                      {feature.description}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Coach Section - Simple and Elegant */}
      {coachBio && (
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="py-20 px-6"
        >
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-[0.2em] mb-8">
              Your Guide
            </h2>
            
            {/* Coach avatar */}
            <div className="mb-6">
              {coachImageUrl ? (
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-[#e1ddd8] dark:border-[#262b35]">
                  <Image
                    src={coachImageUrl}
                    alt={coachName || 'Coach'}
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div 
                  className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                  style={{ backgroundColor: hexToRgba(accentLight, 0.1) }}
                >
                  <User className="w-8 h-8" style={{ color: accentLight }} />
                </div>
              )}
            </div>

            {coachName && (
              <h3 className="text-xl font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                {coachName}
              </h3>
            )}
            
            <p className="text-lg text-[#1a1a1a] dark:text-[#f5f5f8] leading-relaxed whitespace-pre-wrap italic max-w-xl mx-auto">
              &ldquo;{coachBio}&rdquo;
            </p>
          </div>
        </motion.section>
      )}

      {/* Thin divider */}
      {showTestimonials && testimonials.length > 0 && (
        <div className="max-w-16 mx-auto border-t border-[#e1ddd8] dark:border-[#262b35]" />
      )}

      {/* Testimonials - Simple Quote Style */}
      {showTestimonials && testimonials.length > 0 && (
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="py-20 px-6"
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-[0.2em] mb-12 text-center">
              Kind Words
            </h2>
            <div className="space-y-12">
              {testimonials.map((testimonial, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  {testimonial.rating && (
                    <div className="flex gap-1 justify-center mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= testimonial.rating!
                              ? ''
                              : 'text-[#e1ddd8] dark:text-[#262b35]'
                          }`}
                          style={star <= testimonial.rating! ? { color: accentLight, fill: accentLight } : undefined}
                        />
                      ))}
                    </div>
                  )}
                  <p className="text-xl text-[#1a1a1a] dark:text-[#f5f5f8] mb-6 leading-relaxed font-light italic">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>
                  <div>
                    <p className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {testimonial.author}
                    </p>
                    {testimonial.role && (
                      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                        {testimonial.role}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* FAQs - Clean Accordion */}
      {showFAQ && faqs.length > 0 && (
        <motion.section 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="py-20 px-6 bg-[#faf8f6] dark:bg-[#11141b]"
        >
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-[0.2em] mb-12 text-center">
              Questions
            </h2>
            <div className="divide-y divide-[#e1ddd8] dark:divide-[#262b35]">
              {faqs.map((faq, index) => (
                <div key={index} className="py-6">
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between text-left group"
                  >
                    <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] pr-4 group-hover:opacity-70 transition-opacity">
                      {faq.question}
                    </span>
                    <motion.div
                      animate={{ rotate: openFaqIndex === index ? 45 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {openFaqIndex === index ? (
                        <Minus className="w-4 h-4 flex-shrink-0" style={{ color: accentLight }} />
                      ) : (
                        <Plus className="w-4 h-4 text-[#5f5a55] flex-shrink-0" />
                      )}
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
                        <p className="mt-4 text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                          {faq.answer}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* Bottom CTA - Minimal and Clean */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] mb-2">
              Ready to begin?
            </p>
            
            {showPrice && priceInCents > 0 && (
              <p className="text-3xl font-light text-[#1a1a1a] dark:text-[#f5f5f8] mb-8">
                {formatPrice(priceInCents)}
              </p>
            )}

            <button
              onClick={onCTA}
              className="px-12 py-4 font-medium rounded-full transition-all duration-300 hover:opacity-90 hover:shadow-lg mb-6"
              style={{ 
                backgroundColor: accentLight,
                color: 'white'
              }}
            >
              {ctaText || (showPrice ? (priceInCents === 0 ? 'Begin Your Journey' : 'Enroll Now') : 'Continue')}
            </button>

            {ctaSubtext && (
              <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] mb-6">{ctaSubtext}</p>
            )}

            {/* Trust indicators - subtle */}
            <div className="flex items-center justify-center gap-6 text-[#b2b6c2] dark:text-[#5f5a55]">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span className="text-xs">Secure checkout</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs">Full access</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
