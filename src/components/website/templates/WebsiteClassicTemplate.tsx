'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const float = {
  initial: { y: 0 },
  animate: {
    y: [-8, 8, -8],
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
  },
};

const floatDelayed = {
  initial: { y: 0 },
  animate: {
    y: [8, -8, 8],
    transition: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
  },
};

/**
 * Classic Website Template - 2026 Framer/Draftr Style
 *
 * Features:
 * - Floating glassmorphism nav
 * - Large hero with gradient mesh background
 * - Floating decorative cards
 * - 24px+ rounded corners everywhere
 * - Soft shadows and glow effects
 * - Modern SaaS aesthetic
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
  accentLight = '#6366f1',
  accentDark = '#4f46e5',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full overflow-x-hidden bg-[#fafafa]">
      {/* Hero Section - Full viewport with gradient mesh */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Main gradient */}
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 80% at 50% 0%, ${accentLight}15 0%, transparent 50%),
                radial-gradient(ellipse 80% 60% at 80% 20%, ${accentLight}10 0%, transparent 40%),
                radial-gradient(ellipse 60% 50% at 20% 80%, ${accentDark}08 0%, transparent 40%),
                linear-gradient(180deg, #fafafa 0%, #f5f5f5 100%)
              `,
            }}
          />
          {/* Animated gradient orbs */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-20 right-20 w-96 h-96 rounded-full blur-3xl"
            style={{ backgroundColor: `${accentLight}20` }}
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-40 left-10 w-80 h-80 rounded-full blur-3xl"
            style={{ backgroundColor: `${accentDark}15` }}
          />
        </div>

        {/* Floating decorative elements */}
        <motion.div
          variants={float}
          initial="initial"
          animate="animate"
          className="absolute top-32 right-[15%] hidden lg:block"
        >
          <div
            className="px-4 py-2 rounded-2xl backdrop-blur-xl border border-white/50 shadow-xl"
            style={{ background: 'rgba(255, 255, 255, 0.8)' }}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentLight}15` }}>
                <Sparkles className="w-4 h-4" style={{ color: accentLight }} />
              </div>
              <span className="text-sm font-medium text-gray-700">Transform Today</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={floatDelayed}
          initial="initial"
          animate="animate"
          className="absolute bottom-48 left-[10%] hidden lg:block"
        >
          <div
            className="px-4 py-3 rounded-2xl backdrop-blur-xl border border-white/50 shadow-xl"
            style={{ background: 'rgba(255, 255, 255, 0.8)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-semibold text-white"
                    style={{ backgroundColor: accentLight, opacity: 1 - i * 0.2 }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-xs">
                <div className="font-semibold text-gray-800">500+ Clients</div>
                <div className="text-gray-500">Trust this coach</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto text-center pt-24 pb-12"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8">
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium backdrop-blur-xl border"
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                borderColor: 'rgba(255, 255, 255, 0.5)',
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
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-gray-900 mb-8 leading-[1.1]"
          >
            {headline}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-xl sm:text-2xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed font-light"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white rounded-full transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 8px 32px ${accentLight}40, 0 0 0 1px rgba(255,255,255,0.1) inset`,
              }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-6 py-4 text-base font-medium text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-white/60"
            >
              Learn more
              <ChevronDown className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Social proof */}
          {testimonials.length > 0 && (
            <motion.div
              variants={fadeIn}
              className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <div className="flex -space-x-3">
                {testimonials.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-full border-3 border-white flex items-center justify-center text-sm font-semibold text-white shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                    }}
                  >
                    {t.author.charAt(0)}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span>Loved by <span className="font-semibold text-gray-900">{testimonials.length * 50}+</span> clients</span>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image / App Preview */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-5xl mx-auto px-4"
          >
            <div
              className="relative rounded-3xl overflow-hidden"
              style={{
                boxShadow: `0 40px 100px -30px ${accentLight}30, 0 0 0 1px rgba(0,0,0,0.03)`,
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
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#fafafa] to-transparent" />
            </div>
          </motion.div>
        )}

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-gray-300 flex justify-center pt-2"
          >
            <div className="w-1.5 h-3 rounded-full bg-gray-400" />
          </motion.div>
        </motion.div>
      </section>

      {/* About/Coach Section */}
      {(coachBio || credentials.length > 0) && (
        <section id="about" className="py-32 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center"
            >
              {/* Coach Image */}
              <motion.div variants={fadeInUp} className="relative order-2 lg:order-1">
                {coachImageUrl ? (
                  <div className="relative">
                    <div
                      className="relative aspect-[4/5] rounded-[2rem] overflow-hidden"
                      style={{ boxShadow: `0 40px 80px -30px ${accentLight}25` }}
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
                      className="absolute -bottom-6 -right-6 w-32 h-32 rounded-3xl -z-10"
                      style={{ backgroundColor: `${accentLight}10` }}
                    />
                    <div
                      className="absolute -top-4 -left-4 w-20 h-20 rounded-2xl -z-10"
                      style={{ backgroundColor: `${accentDark}08` }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] rounded-[2rem] flex items-center justify-center"
                    style={{ backgroundColor: `${accentLight}08` }}
                  >
                    <span className="text-9xl font-bold" style={{ color: accentLight }}>
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
                  <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 leading-tight">
                    Hi, I'm {coachName}
                  </h2>
                  <p className="text-lg text-gray-600 leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-4 pt-4">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${accentLight}10` }}
                        >
                          <Check className="w-5 h-5" style={{ color: accentLight }} />
                        </div>
                        <span className="text-gray-700 pt-1">
                          {credential}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <a
                  href={ctaUrl}
                  className="inline-flex items-center gap-2 text-base font-semibold transition-all hover:gap-3"
                  style={{ color: accentLight }}
                >
                  Work with me
                  <ArrowRight className="w-5 h-5" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Services Section */}
      {services.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 bg-[#fafafa]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-20"
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
                className="text-4xl sm:text-5xl font-bold text-gray-900"
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
              {services.map((service) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="group p-8 rounded-[1.5rem] bg-white border border-gray-100 hover:border-gray-200 transition-all duration-300 cursor-pointer"
                  style={{
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 20px 50px -15px ${accentLight}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.04)';
                  }}
                  onClick={() => onServiceClick?.(service)}
                >
                  {/* Icon */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                    style={{ backgroundColor: `${accentLight}08` }}
                  >
                    <span className="text-3xl">{getServiceIcon(service.icon)}</span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {service.description}
                  </p>

                  <span
                    className="inline-flex items-center gap-2 font-semibold transition-all group-hover:gap-3"
                    style={{ color: accentLight }}
                  >
                    Learn more
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-20"
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
                className="text-4xl sm:text-5xl font-bold text-gray-900"
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
                  className="p-8 rounded-[1.5rem] bg-[#fafafa] border border-gray-100"
                >
                  {/* Rating */}
                  {testimonial.rating && (
                    <div className="flex gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "w-5 h-5",
                            i < testimonial.rating! ? "fill-amber-400 text-amber-400" : "text-gray-200"
                          )}
                        />
                      ))}
                    </div>
                  )}

                  <p className="text-gray-700 leading-relaxed mb-8 text-lg">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                      }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-sm text-gray-500">
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
        <section className="py-32 px-4 sm:px-6 lg:px-8 bg-[#fafafa]">
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
                className="text-4xl sm:text-5xl font-bold text-gray-900"
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
                  className="rounded-2xl overflow-hidden bg-white border border-gray-100"
                  style={{
                    boxShadow: openFaqIndex === index ? `0 8px 30px ${accentLight}10` : 'none',
                  }}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-gray-900 pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-transform duration-300 text-gray-400",
                        openFaqIndex === index ? "rotate-180" : ""
                      )}
                      style={{ color: openFaqIndex === index ? accentLight : undefined }}
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
                    <p className="px-6 pb-6 text-gray-600 leading-relaxed">
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
      <section className="py-32 px-4 sm:px-6 lg:px-8 bg-white">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto"
        >
          <motion.div
            variants={fadeInUp}
            className="relative rounded-[2rem] p-12 lg:p-20 text-center overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

            <motion.h2
              variants={fadeInUp}
              className="relative text-4xl sm:text-5xl font-bold text-white mb-6"
            >
              Ready to Transform?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="relative text-xl text-white/90 mb-12 max-w-xl mx-auto leading-relaxed"
            >
              Take the first step towards achieving your goals. Let's work together to create lasting change.
            </motion.p>
            <motion.div variants={fadeInUp} className="relative">
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-3 px-10 py-5 text-lg font-semibold rounded-full bg-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] group"
                style={{
                  color: accentDark,
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.15)',
                }}
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
