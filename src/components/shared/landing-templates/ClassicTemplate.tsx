'use client';

import { Check, Star, ChevronDown, Shield, Sparkles } from 'lucide-react';
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
}: LandingTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Use headline/subheadline or fall back to program name/description
  const displayHeadline = headline || programName;
  const displaySubheadline = subheadline || programDescription;

  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#0a0c10]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#f5f2ee] via-[#faf8f6] to-[#faf8f6] dark:from-[#11141b] dark:via-[#0a0c10] dark:to-[#0a0c10]" />
        
        {/* Decorative orb */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-20 blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(160, 120, 85, 0.4) 0%, rgba(160, 120, 85, 0) 70%)',
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 py-16 lg:py-24">
          <div className="text-center">
            {/* Program Image */}
            {programImageUrl && (
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative w-full max-w-2xl mx-auto h-[200px] md:h-[280px] rounded-[20px] overflow-hidden shadow-xl">
                  <Image
                    src={programImageUrl}
                    alt={displayHeadline || 'Program'}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                </div>
              </motion.div>
            )}

            {/* Headline */}
            {displayHeadline && (
              <motion.h1 
                className="font-albert text-[32px] md:text-[44px] lg:text-[52px] text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.1] mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                {displayHeadline}
              </motion.h1>
            )}

            {/* Subheadline */}
            {displaySubheadline && (
              <motion.p 
                className="font-sans text-[16px] md:text-[18px] text-text-secondary dark:text-[#b2b6c2] max-w-2xl mx-auto mb-8 leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                {displaySubheadline}
              </motion.p>
            )}

            {/* CTA Button */}
            {ctaText && (
              <motion.div 
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <button
                  onClick={onCTA}
                  className="px-10 py-4 bg-[#a07855] hover:bg-[#8c6245] text-white font-sans font-bold text-[16px] rounded-[32px] transition-all shadow-lg shadow-[#a07855]/25 hover:shadow-xl hover:shadow-[#a07855]/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {ctaText}
                </button>
                {ctaSubtext && (
                  <p className="font-sans text-[13px] text-text-muted dark:text-[#7d8190]">{ctaSubtext}</p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Key Outcomes / What You'll Learn */}
      {keyOutcomes.length > 0 && (
        <section className="py-16 lg:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[28px] md:text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center mb-4">
                What You&apos;ll Learn
              </h2>
              <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] text-center mb-10 max-w-xl mx-auto">
                Transform your journey with these key outcomes
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-4">
              {keyOutcomes.map((outcome, index) => (
                <motion.div 
                  key={index}
                  className="flex items-start gap-4 p-5 bg-white dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] shadow-sm hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-[#22c55e]" strokeWidth={2.5} />
                  </div>
                  <span className="font-sans text-[15px] text-text-primary dark:text-[#f5f5f8] leading-relaxed pt-1">
                    {outcome}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features / What's Included */}
      {features.length > 0 && (
        <section className="py-16 lg:py-20 px-4 bg-white dark:bg-[#11141b]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[28px] md:text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center mb-4">
                What&apos;s Included
              </h2>
              <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] text-center mb-10 max-w-xl mx-auto">
                Everything you need to succeed
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((feature, index) => (
                <motion.div 
                  key={index}
                  className="p-6 bg-[#faf8f6] dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35] hover:border-[#a07855]/30 transition-all"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                >
                  {feature.icon && (
                    <div className="w-12 h-12 rounded-2xl bg-[#a07855]/10 dark:bg-[#a07855]/20 flex items-center justify-center mb-4">
                      <span className="text-2xl">
                        {feature.icon === 'video' && '📹'}
                        {feature.icon === 'users' && '👥'}
                        {feature.icon === 'message-circle' && '💬'}
                        {feature.icon === 'book' && '📚'}
                        {feature.icon === 'target' && '🎯'}
                        {feature.icon === 'calendar' && '📅'}
                        {feature.icon === 'check-circle' && '✅'}
                        {feature.icon === 'zap' && '⚡'}
                        {feature.icon === 'heart' && '❤️'}
                        {feature.icon === 'star' && '⭐'}
                      </span>
                    </div>
                  )}
                  <h3 className="font-albert text-[18px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.5px] mb-2">
                    {feature.title}
                  </h3>
                  {feature.description && (
                    <p className="font-sans text-[14px] text-text-secondary dark:text-[#b2b6c2] leading-relaxed">
                      {feature.description}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Coach Bio Section */}
      {(coachBio || coachName) && (
        <section className="py-16 lg:py-20 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="bg-white dark:bg-[#171b22] rounded-[24px] border border-[#e1ddd8] dark:border-[#262b35] p-8 md:p-10 shadow-sm"
            >
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Coach Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#a07855] to-[#c9a07a] flex items-center justify-center shadow-lg">
                    {coachImageUrl ? (
                      <Image
                        src={coachImageUrl}
                        alt={coachName || 'Coach'}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl text-white font-albert font-bold">
                        {coachName ? coachName.charAt(0).toUpperCase() : '👤'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Coach Info */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-[#a07855]" />
                    <span className="font-sans text-[12px] font-medium text-[#a07855] uppercase tracking-wider">
                      Your Guide
                    </span>
                  </div>
                  {coachName && (
                    <h3 className="font-albert text-[24px] md:text-[28px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-1px] mb-3">
                      {coachName}
                    </h3>
                  )}
                  {coachBio && (
                    <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.7] whitespace-pre-wrap">
                      {coachBio}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {showTestimonials && testimonials.length > 0 && (
        <section className="py-16 lg:py-20 px-4 bg-white dark:bg-[#11141b]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[28px] md:text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center mb-4">
                What Others Say
              </h2>
              <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] text-center mb-10 max-w-xl mx-auto">
                Real stories from real participants
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.map((testimonial, index) => (
                <motion.div 
                  key={index}
                  className="p-6 bg-[#faf8f6] dark:bg-[#171b22] rounded-[20px] border border-[#e1ddd8] dark:border-[#262b35]"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  {/* Star Rating */}
                  {testimonial.rating && (
                    <div className="flex gap-0.5 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= testimonial.rating!
                              ? 'text-[#FFB800] fill-[#FFB800]'
                              : 'text-[#e1ddd8] dark:text-[#262b35]'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Quote */}
                  <p className="font-sans text-[15px] text-text-primary dark:text-[#f5f5f8] leading-[1.6] mb-5">
                    &ldquo;{testimonial.text}&rdquo;
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a07855] to-[#c9a07a] flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-albert font-semibold text-[14px]">
                        {testimonial.author.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-sans text-[14px] font-semibold text-text-primary dark:text-[#f5f5f8]">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="font-sans text-[12px] text-text-secondary dark:text-[#7d8190]">
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQs */}
      {showFAQ && faqs.length > 0 && (
        <section className="py-16 lg:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[28px] md:text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] text-center mb-4">
                Frequently Asked Questions
              </h2>
              <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] text-center mb-10 max-w-xl mx-auto">
                Everything you need to know
              </p>
            </motion.div>

            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <motion.div 
                  key={index}
                  className="bg-white dark:bg-[#171b22] rounded-[16px] border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-[#faf8f6] dark:hover:bg-[#1a1f28] transition-colors"
                  >
                    <span className="font-albert text-[16px] font-semibold text-text-primary dark:text-[#f5f5f8] tracking-[-0.3px] pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown 
                      className={`w-5 h-5 text-text-secondary dark:text-[#7d8190] flex-shrink-0 transition-transform duration-200 ${
                        openFaqIndex === index ? 'rotate-180' : ''
                      }`}
                    />
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
                        <div className="px-6 pb-5">
                          <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] leading-[1.6]">
                            {faq.answer}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Bottom CTA Section */}
      {ctaText && (
        <section className="py-20 lg:py-24 px-4 bg-gradient-to-t from-[#f5f2ee] to-[#faf8f6] dark:from-[#11141b] dark:to-[#0a0c10]">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <Shield className="w-5 h-5 text-[#22c55e]" />
                <span className="font-sans text-[13px] font-medium text-[#22c55e]">
                  Trusted by thousands of participants
                </span>
              </div>

              <h2 className="font-albert text-[28px] md:text-[36px] text-text-primary dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Ready to Get Started?
              </h2>
              
              <p className="font-sans text-[15px] text-text-secondary dark:text-[#b2b6c2] mb-8 max-w-md mx-auto">
                Join today and take the first step towards transformation.
              </p>

              <button
                onClick={onCTA}
                className="px-12 py-5 bg-[#a07855] hover:bg-[#8c6245] text-white font-sans font-bold text-[17px] rounded-[32px] transition-all shadow-lg shadow-[#a07855]/25 hover:shadow-xl hover:shadow-[#a07855]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {ctaText}
              </button>

              {ctaSubtext && (
                <p className="mt-4 font-sans text-[13px] text-text-muted dark:text-[#7d8190]">
                  {ctaSubtext}
                </p>
              )}

              {/* Guarantee Badge */}
              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#171b22] rounded-full border border-[#e1ddd8] dark:border-[#262b35]">
                <svg className="w-4 h-4 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="font-sans text-[12px] font-medium text-text-secondary dark:text-[#b2b6c2]">
                  100% satisfaction guaranteed
                </span>
              </div>
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
}
