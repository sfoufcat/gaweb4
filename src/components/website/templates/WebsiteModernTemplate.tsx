'use client';

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1 } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

/**
 * Modern Website Template - 2026 Dark SaaS Design
 *
 * Inspired by Xtract/Fluence Framer templates:
 * - Dark theme with gradient orbs
 * - Glowing accent elements
 * - Large typography with gradient text
 * - Full-width sections with generous spacing
 * - Animated gradient backgrounds
 */
export function WebsiteModernTemplate({
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
  accentLight = '#8b5cf6',
  accentDark = '#6d28d9',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  return (
    <div className="w-full overflow-x-hidden bg-[#030014] text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Main gradient orb */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] opacity-30"
            style={{
              background: `radial-gradient(circle, ${accentLight} 0%, ${accentDark} 40%, transparent 70%)`,
            }}
          />
          {/* Secondary orbs */}
          <div
            className="absolute top-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
            style={{ backgroundColor: accentLight }}
          />
          <div
            className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full blur-[80px] opacity-15"
            style={{ backgroundColor: accentDark }}
          />
          {/* Star field */}
          <div className="absolute inset-0 opacity-50">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-0.5 h-0.5 bg-white rounded-full"
                style={{
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5 + 0.2,
                }}
              />
            ))}
          </div>
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(to right, #fff 1px, transparent 1px),
                linear-gradient(to bottom, #fff 1px, transparent 1px)
              `,
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-md"
              style={{
                backgroundColor: `${accentLight}10`,
                borderColor: `${accentLight}30`,
                boxShadow: `0 0 20px ${accentLight}20`,
              }}
            >
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: accentLight }}
              />
              Transform Your Life
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight mb-8 leading-[1.05]"
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, #fff 0%, ${accentLight} 50%, ${accentDark} 100%)`,
              }}
            >
              {headline}
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 0 40px ${accentLight}40`,
              }}
            >
              {ctaText}
              <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#services"
              className="inline-flex items-center gap-2 px-6 py-4 text-base font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-2xl transition-all duration-300 backdrop-blur-sm"
            >
              View Services
            </a>
          </motion.div>

          {/* Floating Testimonial Preview */}
          {testimonials.length > 0 && (
            <motion.div
              variants={fadeIn}
              className="mt-20 flex items-center justify-center gap-4"
            >
              <div className="flex -space-x-3">
                {testimonials.slice(0, 4).map((t, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-[#030014] flex items-center justify-center text-sm font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}${80 - i * 15} 0%, ${accentDark} 100%)`,
                    }}
                  >
                    {t.author.charAt(0)}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-white/50">
                  Trusted by <span className="text-white">{testimonials.length * 50}+</span> clients
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-6xl px-4"
          >
            <div
              className="relative rounded-t-3xl overflow-hidden border border-white/10"
              style={{ boxShadow: `0 -20px 80px ${accentLight}20` }}
            >
              <Image
                src={heroImageUrl}
                alt="Hero"
                width={1400}
                height={700}
                className="w-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#030014] via-transparent to-transparent" />
            </div>
          </motion.div>
        )}
      </section>

      {/* Services Section */}
      {services.length > 0 && (
        <section id="services" className="py-32 px-4 sm:px-6 lg:px-8 relative">
          {/* Background glow */}
          <div
            className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10"
            style={{ backgroundColor: accentLight }}
          />

          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-20"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm mb-6"
                style={{
                  backgroundColor: `${accentLight}08`,
                  borderColor: `${accentLight}20`,
                }}
              >
                <Sparkles className="w-4 h-4" style={{ color: accentLight }} />
                Services
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold max-w-3xl"
              >
                Everything you need to{' '}
                <span style={{ color: accentLight }}>succeed</span>
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {services.map((service, index) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className={cn(
                    "group relative p-8 rounded-3xl cursor-pointer transition-all duration-300 border border-white/5 hover:border-white/10 backdrop-blur-sm",
                    "bg-gradient-to-b from-white/[0.03] to-transparent",
                    index === 0 && services.length > 2 ? "md:col-span-2 md:row-span-2" : ""
                  )}
                  onClick={() => onServiceClick?.(service)}
                  style={{
                    boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.03)`,
                  }}
                >
                  {/* Glow effect on hover */}
                  <div
                    className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 0%, ${accentLight}10, transparent 50%)`,
                    }}
                  />

                  <div className="relative z-10">
                    <div
                      className={cn(
                        "rounded-2xl flex items-center justify-center mb-6",
                        index === 0 && services.length > 2 ? "w-16 h-16" : "w-14 h-14"
                      )}
                      style={{
                        background: `linear-gradient(135deg, ${accentLight}20 0%, ${accentDark}10 100%)`,
                        boxShadow: `0 0 20px ${accentLight}10`,
                      }}
                    >
                      <span className={index === 0 && services.length > 2 ? "text-3xl" : "text-2xl"}>
                        {getServiceIcon(service.icon)}
                      </span>
                    </div>

                    <h3 className={cn(
                      "font-bold text-white mb-3",
                      index === 0 && services.length > 2 ? "text-2xl lg:text-3xl" : "text-xl"
                    )}>
                      {service.title}
                    </h3>
                    <p className={cn(
                      "text-white/50 leading-relaxed",
                      index === 0 && services.length > 2 ? "text-lg" : ""
                    )}>
                      {service.description}
                    </p>

                    <div className="mt-6 flex items-center gap-2 font-semibold" style={{ color: accentLight }}>
                      <span>Learn more</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* About/Coach Section */}
      {(coachBio || credentials.length > 0) && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
          <div
            className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10"
            style={{ backgroundColor: accentDark }}
          />

          <div className="max-w-6xl mx-auto relative">
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
                  <div className="relative">
                    <div
                      className="relative aspect-square rounded-3xl overflow-hidden border border-white/10"
                      style={{ boxShadow: `0 0 60px ${accentLight}15` }}
                    >
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#030014]/80 via-transparent to-transparent" />
                    </div>
                    {/* Decorative ring */}
                    <div
                      className="absolute -inset-4 rounded-[2rem] border opacity-20 -z-10"
                      style={{ borderColor: accentLight }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-square rounded-3xl flex items-center justify-center border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}10 0%, ${accentDark}05 100%)`,
                    }}
                  >
                    <span className="text-9xl font-bold" style={{ color: accentLight }}>
                      {coachName.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Coach Info */}
              <motion.div variants={fadeInUp} className="space-y-8">
                <div>
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm mb-6"
                    style={{
                      backgroundColor: `${accentLight}08`,
                      borderColor: `${accentLight}20`,
                    }}
                  >
                    {coachHeadline || 'Your Coach'}
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                    Meet {coachName}
                  </h2>
                  <p className="text-lg text-white/60 leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="grid gap-4">
                    {credentials.map((credential, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02]"
                      >
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${accentLight}20 0%, ${accentDark}10 100%)`,
                          }}
                        >
                          <Check className="w-5 h-5" style={{ color: accentLight }} />
                        </div>
                        <span className="text-white/80">{credential}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials Section */}
      {testimonials.length > 0 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="mb-16"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm mb-6"
                style={{
                  backgroundColor: `${accentLight}08`,
                  borderColor: `${accentLight}20`,
                }}
              >
                Testimonials
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold"
              >
                Real stories, real results
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-sm"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < (testimonial.rating || 5) ? "fill-amber-400 text-amber-400" : "text-white/20"
                        )}
                      />
                    ))}
                  </div>

                  <p className="text-white/80 leading-relaxed mb-6">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                      }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-white/50">{testimonial.role}</p>
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
        <section className="py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-sm mb-6"
                style={{
                  backgroundColor: `${accentLight}08`,
                  borderColor: `${accentLight}20`,
                }}
              >
                FAQ
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl font-bold"
              >
                Got questions?
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
                  className={cn(
                    "rounded-2xl overflow-hidden border transition-all duration-300",
                    openFaqIndex === index
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-white/5 bg-transparent"
                  )}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-white pr-4">
                      {faq.question}
                    </span>
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
                      style={{
                        backgroundColor: openFaqIndex === index ? `${accentLight}20` : 'transparent',
                      }}
                    >
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 transition-transform duration-300",
                          openFaqIndex === index ? "rotate-180" : ""
                        )}
                        style={{ color: openFaqIndex === index ? accentLight : 'rgba(255,255,255,0.5)' }}
                      />
                    </div>
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
                    <p className="px-6 pb-6 text-white/60 leading-relaxed">
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
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${accentLight}15 0%, transparent 50%)`,
          }}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-4xl mx-auto text-center relative"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6"
          >
            Ready to start your{' '}
            <span style={{ color: accentLight }}>journey</span>?
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-xl text-white/60 mb-12 max-w-2xl mx-auto"
          >
            Join hundreds of others who have transformed their lives. Your success story starts here.
          </motion.p>
          <motion.div variants={fadeInUp}>
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-10 py-5 text-lg font-semibold text-white rounded-2xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 0 60px ${accentLight}40`,
              }}
            >
              {ctaText}
              <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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
