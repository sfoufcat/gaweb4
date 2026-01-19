'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Plus, Minus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

/**
 * Minimal Website Template - 2026 Clean SaaS Design
 *
 * Inspired by Draftr Framer template:
 * - Light, airy design with subtle gradients
 * - Clean typography with excellent readability
 * - Lots of whitespace
 * - Soft shadows and rounded corners
 * - Pastel accent gradients
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
  accentLight = '#6366f1',
  accentDark = '#4f46e5',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full overflow-x-hidden bg-white dark:bg-[#0f0f0f]">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 80% at 50% 0%, ${accentLight}08 0%, transparent 50%),
                radial-gradient(ellipse 80% 60% at 100% 50%, ${accentLight}05 0%, transparent 40%),
                radial-gradient(ellipse 60% 50% at 0% 80%, ${accentDark}04 0%, transparent 40%)
              `,
            }}
          />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border"
              style={{
                backgroundColor: `${accentLight}08`,
                borderColor: `${accentLight}15`,
                color: accentLight,
              }}
            >
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: accentLight }}
              >
                New
              </span>
              Transform Your Life Today
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#111] dark:text-white mb-6 leading-[1.1]"
            style={{ fontFamily: 'var(--font-albert), system-ui, sans-serif' }}
          >
            {headline.split(' ').map((word, i, arr) => (
              <span key={i}>
                {i === arr.length - 1 ? (
                  <span className="italic">{word}</span>
                ) : (
                  word + ' '
                )}
              </span>
            ))}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-[#666] dark:text-[#999] mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-7 py-3.5 text-base font-medium text-white rounded-full transition-all duration-300 hover:opacity-90 shadow-lg"
              style={{
                backgroundColor: accentLight,
                boxShadow: `0 4px 20px ${accentLight}40`,
              }}
            >
              {ctaText}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>

          {/* Trusted by */}
          {testimonials.length > 0 && (
            <motion.div
              variants={fadeIn}
              className="mt-12 flex items-center justify-center gap-4"
            >
              <div className="flex -space-x-2">
                {testimonials.slice(0, 3).map((t, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-[#0f0f0f] flex items-center justify-center text-xs font-semibold text-white"
                    style={{ backgroundColor: accentLight }}
                  >
                    {t.author.charAt(0)}
                  </div>
                ))}
              </div>
              <p className="text-sm text-[#666] dark:text-[#888]">
                Trusted by <span className="font-semibold text-[#111] dark:text-white">{testimonials.length * 100}+</span> clients
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image / App Preview */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative mt-16 w-full max-w-5xl mx-auto px-4"
          >
            <div
              className="relative rounded-2xl overflow-hidden border border-[#e5e5e5] dark:border-[#262626] shadow-2xl"
              style={{
                boxShadow: `0 25px 50px -12px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.02)`,
              }}
            >
              <Image
                src={heroImageUrl}
                alt="Hero"
                width={1200}
                height={675}
                className="w-full object-cover"
                priority
              />
            </div>
            {/* Floating cards decoration */}
            <div
              className="absolute -right-8 top-1/4 w-48 h-32 rounded-xl border border-[#e5e5e5] dark:border-[#262626] bg-white dark:bg-[#1a1a1a] shadow-lg p-4 hidden lg:block"
              style={{ transform: 'rotate(6deg)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: `${accentLight}20` }} />
                <div className="h-3 w-20 rounded bg-[#eee] dark:bg-[#333]" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-[#f5f5f5] dark:bg-[#262626]" />
                <div className="h-2 w-3/4 rounded bg-[#f5f5f5] dark:bg-[#262626]" />
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* About/Coach Section */}
      {(coachBio || credentials.length > 0) && (
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-16 items-center"
            >
              {/* Coach Image */}
              <motion.div variants={fadeInUp} className="relative order-2 lg:order-1">
                {coachImageUrl ? (
                  <div className="relative">
                    <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {/* Badge overlay */}
                    <div
                      className="absolute -bottom-4 -right-4 px-4 py-2 rounded-xl bg-white dark:bg-[#1a1a1a] shadow-lg border border-[#e5e5e5] dark:border-[#262626]"
                    >
                      <div className="flex items-center gap-2">
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-[#111] dark:text-white">4.9</span>
                        <span className="text-sm text-[#666] dark:text-[#888]">rating</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] rounded-3xl flex items-center justify-center"
                    style={{ backgroundColor: `${accentLight}08` }}
                  >
                    <span className="text-8xl font-semibold" style={{ color: accentLight }}>
                      {coachName.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Coach Info */}
              <motion.div variants={fadeInUp} className="space-y-8 order-1 lg:order-2">
                <div>
                  <p
                    className="text-sm font-semibold tracking-wider uppercase mb-4"
                    style={{ color: accentLight }}
                  >
                    {coachHeadline || 'About'}
                  </p>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#111] dark:text-white mb-6 leading-tight">
                    Meet {coachName}
                  </h2>
                  <p className="text-lg text-[#666] dark:text-[#999] leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-3">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                          style={{ backgroundColor: `${accentLight}15` }}
                        >
                          <Check className="w-3 h-3" style={{ color: accentLight }} />
                        </div>
                        <span className="text-[#444] dark:text-[#bbb]">{credential}</span>
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
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafafa] dark:bg-[#0a0a0a]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentLight }}
              >
                Services
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#111] dark:text-white"
              >
                What I Offer
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {services.map((service) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="group p-8 rounded-2xl bg-white dark:bg-[#141414] border border-[#e5e5e5] dark:border-[#262626] hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => onServiceClick?.(service)}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${accentLight}10` }}
                  >
                    <span className="text-xl">{getServiceIcon(service.icon)}</span>
                  </div>

                  <h3 className="text-xl font-semibold text-[#111] dark:text-white mb-3">
                    {service.title}
                  </h3>
                  <p className="text-[#666] dark:text-[#999] leading-relaxed mb-6">
                    {service.description}
                  </p>

                  <span
                    className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
                    style={{ color: accentLight }}
                  >
                    Learn more
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentLight }}
              >
                Testimonials
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#111] dark:text-white"
              >
                What Clients Say
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-8 rounded-2xl bg-[#fafafa] dark:bg-[#141414] border border-[#e5e5e5] dark:border-[#262626]"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < (testimonial.rating || 5) ? "fill-amber-400 text-amber-400" : "text-[#ddd] dark:text-[#333]"
                        )}
                      />
                    ))}
                  </div>

                  <p className="text-[#444] dark:text-[#bbb] leading-relaxed mb-6">
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
                      <p className="font-semibold text-[#111] dark:text-white">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-[#666] dark:text-[#888]">{testimonial.role}</p>
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
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[#fafafa] dark:bg-[#0a0a0a]">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p
                variants={fadeInUp}
                className="text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentLight }}
              >
                FAQ
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-semibold text-[#111] dark:text-white"
              >
                Questions & Answers
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="space-y-3"
            >
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="rounded-xl overflow-hidden bg-white dark:bg-[#141414] border border-[#e5e5e5] dark:border-[#262626]"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-medium text-[#111] dark:text-white pr-4">
                      {faq.question}
                    </span>
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: openFaqIndex === index ? `${accentLight}15` : 'transparent' }}
                    >
                      {openFaqIndex === index ? (
                        <Minus className="w-4 h-4" style={{ color: accentLight }} />
                      ) : (
                        <Plus className="w-4 h-4 text-[#666] dark:text-[#888]" />
                      )}
                    </div>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openFaqIndex === index ? 'auto' : 0,
                      opacity: openFaqIndex === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-[#666] dark:text-[#999] leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto text-center"
        >
          <motion.div
            variants={fadeInUp}
            className="relative rounded-3xl p-12 lg:p-16 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accentLight}08 0%, ${accentDark}05 100%)`,
              border: `1px solid ${accentLight}15`,
            }}
          >
            {/* Decorative gradient */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-30"
              style={{ backgroundColor: accentLight }}
            />

            <motion.h2
              variants={fadeInUp}
              className="relative text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#111] dark:text-white mb-6"
            >
              Ready to get started?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="relative text-lg text-[#666] dark:text-[#999] mb-10 max-w-xl mx-auto"
            >
              Take the first step towards transformation. Schedule a free consultation today.
            </motion.p>
            <motion.div variants={fadeInUp} className="relative">
              <a
                href={ctaUrl}
                className="group inline-flex items-center gap-3 px-8 py-4 text-base font-medium text-white rounded-full transition-all duration-300 hover:opacity-90 shadow-lg"
                style={{
                  backgroundColor: accentLight,
                  boxShadow: `0 4px 20px ${accentLight}40`,
                }}
              >
                {ctaText}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </a>
            </motion.div>

            <motion.p
              variants={fadeIn}
              className="relative mt-6 text-sm text-[#888] dark:text-[#666]"
            >
              Free consultation • No commitment required
            </motion.p>
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
