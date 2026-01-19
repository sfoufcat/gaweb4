'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Star, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/**
 * Classic Website Template
 *
 * Elegant, warm, and sophisticated design with:
 * - Full-width hero with centered content
 * - Gradient overlays and soft shadows
 * - Two-column about section
 * - Card-based services grid
 * - Testimonial carousel/grid
 * - Expandable FAQ accordion
 */
export function WebsiteClassicTemplate({
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
  accentLight = '#a07855',
  accentDark = '#8b6544',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full">
      {/* Hero Section - Full Width */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        {heroImageUrl ? (
          <>
            <div className="absolute inset-0">
              <Image
                src={heroImageUrl}
                alt="Hero background"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${accentLight}15 0%, transparent 50%, ${accentDark}10 100%)`,
            }}
          />
        )}

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        >
          <motion.h1
            variants={fadeInUp}
            className={cn(
              "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6",
              heroImageUrl ? "text-white" : "text-[#1a1a1a] dark:text-white"
            )}
            style={{ fontFamily: 'var(--font-albert), system-ui, sans-serif' }}
          >
            {headline}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className={cn(
              "text-lg sm:text-xl md:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed",
              heroImageUrl ? "text-white/90" : "text-[#5f5a55] dark:text-[#b2b6c2]"
            )}
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp}>
            <a
              href={ctaUrl}
              className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold text-white rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              style={{ backgroundColor: accentLight }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className={cn(
              "w-6 h-10 rounded-full border-2 flex items-start justify-center p-2",
              heroImageUrl ? "border-white/50" : "border-[#5f5a55]/30 dark:border-white/30"
            )}
          >
            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                heroImageUrl ? "bg-white/70" : "bg-[#5f5a55]/50 dark:bg-white/50"
              )}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* About/Coach Section */}
      {(coachBio || credentials.length > 0) && (
        <section className="py-24 lg:py-32 bg-white dark:bg-[#0a0c10]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-16 items-center"
            >
              {/* Coach Image */}
              <motion.div variants={fadeInUp} className="relative">
                {coachImageUrl ? (
                  <div className="relative aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl">
                    <Image
                      src={coachImageUrl}
                      alt={coachName}
                      fill
                      className="object-cover"
                    />
                    {/* Decorative element */}
                    <div
                      className="absolute -bottom-4 -right-4 w-32 h-32 rounded-2xl -z-10"
                      style={{ backgroundColor: `${accentLight}30` }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${accentLight}15` }}
                  >
                    <span className="text-8xl font-bold" style={{ color: accentLight }}>
                      {coachName.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Coach Info */}
              <motion.div variants={fadeInUp} className="space-y-8">
                <div>
                  <p
                    className="text-sm font-semibold tracking-wider uppercase mb-3"
                    style={{ color: accentLight }}
                  >
                    {coachHeadline || 'About Your Coach'}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] dark:text-white mb-6">
                    Meet {coachName}
                  </h2>
                  <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-4">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                          style={{ backgroundColor: `${accentLight}20` }}
                        >
                          <Check className="w-4 h-4" style={{ color: accentLight }} />
                        </div>
                        <span className="text-[#1a1a1a] dark:text-[#e5e5e5] font-medium">
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

      {/* Services Section */}
      {services.length > 0 && (
        <section className="py-24 lg:py-32 bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-3"
                style={{ color: accentLight }}
              >
                Services
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a1a1a] dark:text-white"
              >
                How I Can Help You
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {services.map((service, index) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="group bg-white dark:bg-[#0a0c10] rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35]"
                  onClick={() => onServiceClick?.(service)}
                >
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${accentLight}15` }}
                  >
                    <span className="text-2xl">{getServiceIcon(service.icon)}</span>
                  </div>

                  <h3 className="text-xl font-bold text-[#1a1a1a] dark:text-white mb-3">
                    {service.title}
                  </h3>
                  <p className="text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-6">
                    {service.description}
                  </p>

                  <span
                    className="inline-flex items-center gap-2 font-semibold transition-colors"
                    style={{ color: accentLight }}
                  >
                    Learn more
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="py-24 lg:py-32 bg-white dark:bg-[#0a0c10]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-3"
                style={{ color: accentLight }}
              >
                Testimonials
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a1a1a] dark:text-white"
              >
                What My Clients Say
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-[#faf8f6] dark:bg-[#05070b] rounded-2xl p-8 relative"
                >
                  {/* Quote Icon */}
                  <Quote
                    className="w-10 h-10 mb-6 opacity-20"
                    style={{ color: accentLight }}
                  />

                  {/* Rating */}
                  {testimonial.rating && (
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-4 h-4",
                            i < testimonial.rating! ? "fill-amber-400 text-amber-400" : "text-gray-300"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-[#1a1a1a] dark:text-[#e5e5e5] leading-relaxed mb-6 text-lg">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white"
                      style={{ backgroundColor: accentLight }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#1a1a1a] dark:text-white">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#7d8190]">
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="py-24 lg:py-32 bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-3"
                style={{ color: accentLight }}
              >
                FAQ
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] dark:text-white"
              >
                Frequently Asked Questions
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="space-y-4"
            >
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="bg-white dark:bg-[#0a0c10] rounded-xl overflow-hidden border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-[#1a1a1a] dark:text-white pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-300",
                        openFaqIndex === index ? "rotate-180" : ""
                      )}
                      style={{ color: accentLight }}
                    />
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openFaqIndex === index ? 'auto' : 0,
                      opacity: openFaqIndex === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Bottom CTA Section */}
      <section
        className="py-24 lg:py-32 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${accentDark} 0%, ${accentLight} 100%)`
        }}
      >
        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
          >
            Ready to Transform Your Life?
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-xl text-white/90 mb-10 max-w-2xl mx-auto"
          >
            Take the first step towards achieving your goals. Let's work together to create lasting change.
          </motion.p>
          <motion.div variants={fadeInUp}>
            <a
              href={ctaUrl}
              className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold rounded-full bg-white transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              style={{ color: accentDark }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>
        </motion.div>
      </section>
    </div>
  );
}

function getServiceIcon(icon?: string): string {
  const iconMap: Record<string, string> = {
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
    'rocket': '🚀',
    'trophy': '🏆',
    'brain': '🧠',
    'lightbulb': '💡',
    'compass': '🧭',
    'mountain': '⛰️',
  };
  return iconMap[icon || 'star'] || '⭐';
}
