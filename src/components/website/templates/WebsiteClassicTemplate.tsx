'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Star, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

/**
 * Classic Website Template - Inspired by Draftr Framer Template
 *
 * Features:
 * - Deep purple accent with light backgrounds (#f0f2f6)
 * - Inter font family
 * - Clean, modern SaaS aesthetic
 * - Large hero with app preview
 * - Generous whitespace
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
  accentLight = '#5235ef',
  accentDark = '#3d28b8',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full overflow-x-hidden bg-[#f7f8fa] dark:bg-[#0a0a0b]">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -10%, ${accentLight}12 0%, transparent 60%),
              radial-gradient(ellipse 50% 40% at 90% 20%, ${accentLight}08 0%, transparent 50%),
              radial-gradient(ellipse 40% 30% at 10% 80%, ${accentDark}06 0%, transparent 40%)
            `,
          }}
        />

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto text-center pt-12"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm"
              style={{
                background: `linear-gradient(135deg, ${accentLight}15 0%, ${accentLight}08 100%)`,
                border: `1px solid ${accentLight}20`,
                color: accentLight,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accentLight }}
              />
              Welcome to your transformation
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-[#101011] dark:text-white mb-6 leading-[1.1]"
          >
            {headline}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-[#606266] dark:text-[#a7a7a7] mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                backgroundColor: accentLight,
                boxShadow: `0 4px 24px ${accentLight}40`,
              }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#about"
              className="group inline-flex items-center gap-2 px-6 py-4 text-base font-medium text-[#606266] dark:text-[#a7a7a7] hover:text-[#101011] dark:hover:text-white transition-colors"
            >
              <Play className="w-5 h-5" />
              Learn more
            </a>
          </motion.div>

          {/* Social proof */}
          {testimonials.length > 0 && (
            <motion.div
              variants={fadeIn}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <div className="flex -space-x-2">
                {testimonials.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-[#f7f8fa] dark:border-[#0a0a0b] flex items-center justify-center text-sm font-semibold text-white"
                    style={{
                      backgroundColor: accentLight,
                      opacity: 1 - (i * 0.15),
                    }}
                  >
                    {t.author.charAt(0)}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-[#606266] dark:text-[#a7a7a7]">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span>Loved by <span className="font-semibold text-[#101011] dark:text-white">{testimonials.length * 50}+</span> clients</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image / App Preview */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="relative mt-16 w-full max-w-5xl mx-auto px-4"
          >
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                boxShadow: `0 25px 80px -20px ${accentLight}30, 0 0 0 1px rgba(0,0,0,0.05)`,
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
              {/* Gradient overlay at bottom */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f7f8fa] dark:from-[#0a0a0b] to-transparent" />
            </div>
          </motion.div>
        )}
      </section>

      {/* About/Coach Section */}
      {(coachBio || credentials.length > 0) && (
        <section id="about" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#111113]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center"
            >
              {/* Coach Image */}
              <motion.div variants={fadeInUp} className="relative order-2 lg:order-1">
                {coachImageUrl ? (
                  <div className="relative">
                    <div
                      className="relative aspect-[4/5] rounded-2xl overflow-hidden"
                      style={{ boxShadow: `0 30px 60px -20px ${accentLight}25` }}
                    >
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {/* Decorative accent */}
                    <div
                      className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl -z-10"
                      style={{ backgroundColor: `${accentLight}15` }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${accentLight}10` }}
                  >
                    <span className="text-8xl font-bold" style={{ color: accentLight }}>
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
                    {coachHeadline || 'Meet Your Coach'}
                  </p>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#101011] dark:text-white mb-6 leading-tight">
                    Hi, I'm {coachName}
                  </h2>
                  <p className="text-lg text-[#606266] dark:text-[#a7a7a7] leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-3">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div
                          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5"
                          style={{ backgroundColor: `${accentLight}15` }}
                        >
                          <Check className="w-4 h-4" style={{ color: accentLight }} />
                        </div>
                        <span className="text-[#101011] dark:text-[#e5e5e5]">
                          {credential}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <a
                  href={ctaUrl}
                  className="inline-flex items-center gap-2 font-semibold transition-colors"
                  style={{ color: accentLight }}
                >
                  Work with me
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Services Section */}
      {services.length > 0 && (
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
                Services
              </motion.p>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#101011] dark:text-white"
              >
                How I Can Help You
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
                  className="group p-8 rounded-2xl bg-white dark:bg-[#111113] border border-[#e5e7eb] dark:border-[#222225] hover:border-[#d1d5db] dark:hover:border-[#333338] transition-all duration-300 cursor-pointer hover:shadow-xl"
                  onClick={() => onServiceClick?.(service)}
                >
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${accentLight}10` }}
                  >
                    <span className="text-2xl">{getServiceIcon(service.icon)}</span>
                  </div>

                  <h3 className="text-xl font-bold text-[#101011] dark:text-white mb-3">
                    {service.title}
                  </h3>
                  <p className="text-[#606266] dark:text-[#a7a7a7] leading-relaxed mb-6">
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
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#111113]">
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
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#101011] dark:text-white"
              >
                What My Clients Say
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
                  className="p-8 rounded-2xl bg-[#f7f8fa] dark:bg-[#0a0a0b] border border-[#e5e7eb] dark:border-[#222225]"
                >
                  {/* Rating */}
                  {testimonial.rating && (
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-4 h-4",
                            i < testimonial.rating! ? "fill-amber-400 text-amber-400" : "text-gray-200 dark:text-gray-700"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-[#101011] dark:text-[#e5e5e5] leading-relaxed mb-6">
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
                      <p className="font-semibold text-[#101011] dark:text-white">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-sm text-[#606266] dark:text-[#a7a7a7]">
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
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
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
                className="text-3xl sm:text-4xl font-bold text-[#101011] dark:text-white"
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
                  className="rounded-xl overflow-hidden bg-white dark:bg-[#111113] border border-[#e5e7eb] dark:border-[#222225]"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-[#101011] dark:text-white pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-300 text-[#606266] dark:text-[#a7a7a7]",
                        openFaqIndex === index ? "rotate-180" : ""
                      )}
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
                    <p className="px-6 pb-6 text-[#606266] dark:text-[#a7a7a7] leading-relaxed">
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
      <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.div
            variants={fadeInUp}
            className="relative rounded-3xl p-12 lg:p-16 text-center overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl" />

            <motion.h2
              variants={fadeInUp}
              className="relative text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
            >
              Ready to Transform?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="relative text-xl text-white/90 mb-10 max-w-xl mx-auto"
            >
              Take the first step towards achieving your goals. Let's work together to create lasting change.
            </motion.p>
            <motion.div variants={fadeInUp} className="relative">
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold rounded-xl bg-white transition-all duration-300 hover:scale-[1.02] group"
                style={{ color: accentDark }}
              >
                {ctaText}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
            </motion.div>
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
