'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

/**
 * Minimal Website Template
 *
 * Clean, airy design with:
 * - Lots of whitespace
 * - Subtle typography hierarchy
 * - Thin lines and minimal decorations
 * - Single-color accent
 * - Focus on content over decoration
 */
export function WebsiteMinimalTemplate({
  headline,
  subheadline,
  heroImageUrl,
  coachName,
  coachImageUrl,
  coachBio,
  coachHeadline,
  credentials,
  services,
  testimonials,
  faqs,
  ctaText,
  ctaUrl,
  accentLight = '#1a1a1a',
  accentDark = '#0a0a0a',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full bg-white dark:bg-[#0a0c10]">
      {/* Hero Section - Clean and Centered */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center px-6 lg:px-8 relative">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#faf8f6] via-white to-white dark:from-[#0a0c10] dark:via-[#0a0c10] dark:to-[#0a0c10] -z-10" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Optional small image/avatar */}
          {(heroImageUrl || coachImageUrl) && (
            <motion.div variants={fadeIn} className="mb-12">
              <div className="relative w-24 h-24 mx-auto rounded-full overflow-hidden ring-1 ring-[#e1ddd8] dark:ring-[#262b35]">
                <Image
                  src={heroImageUrl || coachImageUrl || ''}
                  alt={coachName}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </motion.div>
          )}

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light tracking-tight text-[#1a1a1a] dark:text-white mb-8 leading-[1.15]"
            style={{ fontFamily: 'var(--font-albert), system-ui, sans-serif' }}
          >
            {headline}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-[#5f5a55] dark:text-[#b2b6c2] mb-12 max-w-2xl mx-auto leading-relaxed font-light"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp}>
            <a
              href={ctaUrl}
              className="inline-flex items-center gap-3 px-8 py-4 text-base font-medium text-white rounded-full transition-all duration-500 hover:opacity-80 group"
              style={{ backgroundColor: accentLight }}
            >
              {ctaText}
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
            </a>
          </motion.div>
        </motion.div>

        {/* Minimal scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="w-px h-12 bg-gradient-to-b from-[#5f5a55]/50 to-transparent dark:from-[#7d8190]/50"
          />
        </motion.div>
      </section>

      {/* Thin Divider */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-[#e1ddd8] dark:via-[#262b35] to-transparent" />
      </div>

      {/* About Section - Simple two-column */}
      {(coachBio || credentials.length > 0) && (
        <section className="py-32 lg:py-40">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-12 gap-16 lg:gap-24 items-start"
            >
              {/* Label */}
              <motion.div variants={fadeIn} className="lg:col-span-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5f5a55] dark:text-[#7d8190] font-medium">
                  {coachHeadline || 'About'}
                </p>
              </motion.div>

              {/* Content */}
              <motion.div variants={fadeInUp} className="lg:col-span-9 space-y-12">
                <div className="grid md:grid-cols-2 gap-16 items-start">
                  {/* Bio */}
                  <div>
                    <h2 className="text-3xl sm:text-4xl font-light text-[#1a1a1a] dark:text-white mb-8 leading-tight">
                      {coachName}
                    </h2>
                    <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-[1.8] whitespace-pre-line">
                      {coachBio}
                    </p>
                  </div>

                  {/* Image or Credentials */}
                  <div>
                    {coachImageUrl ? (
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={coachImageUrl}
                          alt={coachName}
                          fill
                          className="object-cover grayscale hover:grayscale-0 transition-all duration-700"
                        />
                      </div>
                    ) : credentials.length > 0 ? (
                      <div className="space-y-6 pt-4">
                        {credentials.map((credential, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-4 pb-6 border-b border-[#e1ddd8] dark:border-[#262b35] last:border-0"
                          >
                            <Check className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: accentLight }} />
                            <span className="text-[#1a1a1a] dark:text-[#e5e5e5]">
                              {credential}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Credentials below image if both exist */}
                {coachImageUrl && credentials.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 pt-8 border-t border-[#e1ddd8] dark:border-[#262b35]">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div
                          className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                          style={{ backgroundColor: accentLight }}
                        />
                        <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                          {credential}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Services Section - List Style */}
      {services.length > 0 && (
        <section className="py-32 lg:py-40 bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-12 gap-16 lg:gap-24"
            >
              {/* Label */}
              <motion.div variants={fadeIn} className="lg:col-span-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5f5a55] dark:text-[#7d8190] font-medium sticky top-24">
                  Services
                </p>
              </motion.div>

              {/* Services List */}
              <motion.div variants={stagger} className="lg:col-span-9">
                {services.map((service, index) => (
                  <motion.div
                    key={service.id}
                    variants={fadeInUp}
                    className="group border-b border-[#e1ddd8] dark:border-[#262b35] last:border-0"
                  >
                    <div
                      className="py-10 lg:py-12 cursor-pointer"
                      onClick={() => onServiceClick?.(service)}
                    >
                      <div className="flex items-start justify-between gap-8">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-6 mb-4">
                            <span className="text-xs text-[#5f5a55] dark:text-[#7d8190] font-mono">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <h3 className="text-2xl sm:text-3xl font-light text-[#1a1a1a] dark:text-white group-hover:translate-x-2 transition-transform duration-500">
                              {service.title}
                            </h3>
                          </div>
                          <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed max-w-2xl ml-12">
                            {service.description}
                          </p>
                        </div>
                        <ArrowRight
                          className="w-5 h-5 mt-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500"
                          style={{ color: accentLight }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials Section - Quote Style */}
      {testimonials.length > 0 && (
        <section className="py-32 lg:py-40">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-12 gap-16 lg:gap-24"
            >
              {/* Label */}
              <motion.div variants={fadeIn} className="lg:col-span-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5f5a55] dark:text-[#7d8190] font-medium">
                  Testimonials
                </p>
              </motion.div>

              {/* Testimonials */}
              <motion.div variants={stagger} className="lg:col-span-9 space-y-24">
                {testimonials.map((testimonial, index) => (
                  <motion.blockquote
                    key={index}
                    variants={fadeInUp}
                    className="relative"
                  >
                    <p className="text-2xl sm:text-3xl lg:text-4xl font-light text-[#1a1a1a] dark:text-white leading-[1.4] mb-8">
                      "{testimonial.text}"
                    </p>
                    <footer className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: accentLight }}
                      >
                        {testimonial.author.charAt(0)}
                      </div>
                      <div>
                        <cite className="not-italic font-medium text-[#1a1a1a] dark:text-white">
                          {testimonial.author}
                        </cite>
                        {testimonial.role && (
                          <p className="text-sm text-[#5f5a55] dark:text-[#7d8190]">
                            {testimonial.role}
                          </p>
                        )}
                      </div>
                    </footer>
                  </motion.blockquote>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* FAQ Section - Expandable List */}
      {faqs.length > 0 && (
        <section className="py-32 lg:py-40 bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-12 gap-16 lg:gap-24"
            >
              {/* Label */}
              <motion.div variants={fadeIn} className="lg:col-span-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#5f5a55] dark:text-[#7d8190] font-medium sticky top-24">
                  FAQ
                </p>
              </motion.div>

              {/* FAQs */}
              <motion.div variants={stagger} className="lg:col-span-9">
                {faqs.map((faq, index) => (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className="border-b border-[#e1ddd8] dark:border-[#262b35] last:border-0"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                      className="w-full py-8 flex items-start justify-between gap-8 text-left group"
                    >
                      <span className="text-lg sm:text-xl text-[#1a1a1a] dark:text-white font-light pr-4 group-hover:translate-x-1 transition-transform duration-300">
                        {faq.question}
                      </span>
                      <div className="flex-shrink-0 mt-1">
                        {openFaqIndex === index ? (
                          <Minus className="w-5 h-5" style={{ color: accentLight }} />
                        ) : (
                          <Plus className="w-5 h-5 text-[#5f5a55] dark:text-[#7d8190]" />
                        )}
                      </div>
                    </button>
                    <motion.div
                      initial={false}
                      animate={{
                        height: openFaqIndex === index ? 'auto' : 0,
                        opacity: openFaqIndex === index ? 1 : 0,
                      }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-8 text-[#5f5a55] dark:text-[#b2b6c2] leading-[1.8] max-w-2xl">
                        {faq.answer}
                      </p>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Bottom CTA - Simple and Clean */}
      <section className="py-32 lg:py-40">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto px-6 text-center"
        >
          <motion.div
            variants={fadeIn}
            className="w-16 h-px mx-auto mb-16 bg-[#e1ddd8] dark:bg-[#262b35]"
          />

          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-light text-[#1a1a1a] dark:text-white mb-8 leading-tight"
          >
            Start your transformation today
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] mb-12 max-w-xl mx-auto"
          >
            Take the first step toward the change you've been seeking.
          </motion.p>

          <motion.div variants={fadeInUp}>
            <a
              href={ctaUrl}
              className="inline-flex items-center gap-3 px-10 py-5 text-base font-medium text-white rounded-full transition-all duration-500 hover:opacity-80 group"
              style={{ backgroundColor: accentLight }}
            >
              {ctaText}
              <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
            </a>
          </motion.div>

          <motion.div
            variants={fadeIn}
            className="mt-16 text-sm text-[#5f5a55] dark:text-[#7d8190]"
          >
            Free consultation • No commitment required
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}
