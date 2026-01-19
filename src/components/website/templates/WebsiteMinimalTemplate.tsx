'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Plus, Minus, Star, Sparkles, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// Soft pastel gradient palette for minimal aesthetic
const softGradients = [
  'linear-gradient(135deg, #F0F4FF 0%, #F8FAFF 50%, #FFFFFF 100%)', // Soft Blue
  'linear-gradient(135deg, #FFF0F5 0%, #FFF8FA 50%, #FFFFFF 100%)', // Soft Pink
  'linear-gradient(135deg, #F0FFF4 0%, #F8FFFA 50%, #FFFFFF 100%)', // Soft Mint
  'linear-gradient(135deg, #FFF8F0 0%, #FFFAF8 50%, #FFFFFF 100%)', // Soft Peach
  'linear-gradient(135deg, #F5F0FF 0%, #FAF8FF 50%, #FFFFFF 100%)', // Soft Lavender
  'linear-gradient(135deg, #FFFFF0 0%, #FFFFF8 50%, #FFFFFF 100%)', // Soft Cream
];

/**
 * Minimal Website Template - Clean & Elegant with Draftr Enhancements
 *
 * Features:
 * - Light backgrounds with soft gradients
 * - Inter/General Sans typography
 * - Frosted glass cards with backdrop blur
 * - Soft shadows and large rounded corners
 * - Pastel accent colors
 * - Premium SaaS aesthetic with glassmorphism
 * - Enhanced sections: Services, Transformation, Dark Features, Footer
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
  transformationHeadline,
  transformationSteps,
  transformationImageUrl,
  testimonials,
  faqs,
  ctaText,
  ctaUrl,
  footerCompanyName,
  footerTagline,
  footerEmail,
  footerPhone,
  footerAddress,
  logoUrl,
  accentLight = '#80aafd',
  accentDark = '#5b8def',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  // Build navigation links based on available sections
  const navLinks = React.useMemo(() => {
    const links: { label: string; href: string }[] = [];
    if (coachBio || credentials.length > 0) links.push({ label: 'About', href: '#about' });
    if (services.length > 0) links.push({ label: 'Services', href: '#services' });
    if (testimonials.length > 0) links.push({ label: 'Testimonials', href: '#testimonials' });
    if (faqs.length > 0) links.push({ label: 'FAQ', href: '#faq' });
    return links;
  }, [coachBio, credentials.length, services.length, testimonials.length, faqs.length]);

  return (
    <div className="w-full overflow-x-hidden bg-white dark:bg-[#0d0d0f]">
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {/* Background gradient */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 60% at 50% 0%, ${accentLight}15 0%, transparent 50%),
                radial-gradient(ellipse 50% 40% at 100% 0%, ${accentDark}08 0%, transparent 40%),
                linear-gradient(to bottom, white, #f8fafc)
              `,
            }}
          />
          <div
            className="dark:block hidden absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 100% 60% at 50% 0%, ${accentLight}10 0%, transparent 50%),
                radial-gradient(ellipse 50% 40% at 100% 0%, ${accentDark}05 0%, transparent 40%),
                linear-gradient(to bottom, #0d0d0f, #111113)
              `,
            }}
          />
        </div>

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-8 flex justify-center">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border shadow-sm"
              style={{
                backgroundColor: 'rgba(255,255,255,0.9)',
                borderColor: `${accentLight}30`,
                color: accentDark,
              }}
            >
              <Sparkles className="w-4 h-4" />
              Start your transformation today
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 dark:text-white mb-6 leading-[1.1]"
          >
            {headline.split(' ').map((word, i, arr) => (
              <span key={i}>
                {i === arr.length - 1 ? (
                  <span className="italic" style={{ color: accentDark }}>{word}</span>
                ) : (
                  word + ' '
                )}
              </span>
            ))}
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            {subheadline}
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaUrl}
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 8px 32px ${accentLight}35`,
              }}
            >
              {ctaText}
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-6 py-4 text-base font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Learn more
              <ChevronDown className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Floating social proof */}
          {testimonials.length > 0 && (
            <motion.div
              variants={fadeIn}
              className="mt-16"
            >
              <div
                className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl border shadow-lg backdrop-blur-sm"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderColor: 'rgba(0,0,0,0.05)',
                }}
              >
                <div className="flex -space-x-2">
                  {testimonials.slice(0, 4).map((t, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-sm font-semibold text-white shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                      }}
                    >
                      {t.author.charAt(0)}
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="flex gap-0.5 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{testimonials.length * 50}+</span> happy clients
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image with floating card effect */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative mt-16 w-full max-w-5xl mx-auto px-4"
          >
            <div
              className="relative rounded-3xl overflow-hidden border shadow-2xl"
              style={{
                borderColor: 'rgba(0,0,0,0.08)',
                boxShadow: `0 25px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)`,
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
              {/* Bottom fade */}
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white dark:from-[#0d0d0f] to-transparent" />
            </div>
          </motion.div>
        )}
      </section>

      {/* ========== ABOUT/COACH SECTION ========== */}
      {(coachBio || credentials.length > 0) && (
        <section id="about" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-[#111113]">
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
                      className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl"
                      style={{ boxShadow: `0 25px 50px -12px rgba(0,0,0,0.15)` }}
                    >
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {/* Decorative elements */}
                    <div
                      className="absolute -top-4 -right-4 w-32 h-32 rounded-3xl -z-10"
                      style={{ backgroundColor: `${accentLight}15` }}
                    />
                    <div
                      className="absolute -bottom-6 -left-6 w-24 h-24 rounded-2xl -z-10"
                      style={{ backgroundColor: `${accentDark}10` }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] rounded-3xl flex items-center justify-center shadow-xl"
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
                  <span
                    className="inline-block text-sm font-semibold tracking-wider uppercase mb-4"
                    style={{ color: accentDark }}
                  >
                    {coachHeadline || 'About Me'}
                  </span>
                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
                    Hi, I'm <span style={{ color: accentDark }}>{coachName}</span>
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="space-y-3">
                    {credentials.map((credential, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 shadow-sm"
                      >
                        <div
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${accentLight}15` }}
                        >
                          <Check className="w-4 h-4" style={{ color: accentDark }} />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{credential}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== SERVICES SECTION - SOFT GRADIENT CARDS ========== */}
      {services.length > 0 && (
        <section id="services" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-block text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentDark }}
              >
                What I Offer
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
              >
                Services designed for <span className="italic" style={{ color: accentDark }}>you</span>
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
                  className={cn(
                    "group rounded-[1.75rem] bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300",
                    service.funnelId && "cursor-pointer hover:-translate-y-2 hover:shadow-xl"
                  )}
                  style={{
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
                  }}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Soft gradient illustration area */}
                  <div
                    className="relative h-44 flex items-center justify-center overflow-hidden"
                    style={{ background: softGradients[index % softGradients.length] }}
                  >
                    {/* Decorative floating shapes */}
                    <div className="absolute top-3 right-3 w-12 h-12 rounded-xl bg-white/50 dark:bg-white/10" />
                    <div className="absolute bottom-3 left-3 w-8 h-8 rounded-lg bg-white/40 dark:bg-white/5" />

                    {/* Large emoji icon */}
                    <span className="text-5xl transform group-hover:scale-110 transition-transform duration-300">
                      {getServiceIcon(service.icon)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {service.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                      {service.description}
                    </p>

                    {service.funnelId && (
                      <span
                        className="inline-flex items-center gap-2 font-semibold transition-all group-hover:gap-3"
                        style={{ color: accentDark }}
                      >
                        Learn more
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== TRANSFORMATION STEPS SECTION ========== */}
      {transformationSteps && transformationSteps.length > 0 && (
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-[#111113]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center"
            >
              {/* Steps */}
              <div className="space-y-4">
                <motion.span
                  variants={fadeInUp}
                  className="inline-block text-sm font-semibold tracking-wider uppercase mb-2"
                  style={{ color: accentDark }}
                >
                  Your Journey
                </motion.span>
                <motion.h2
                  variants={fadeInUp}
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-12 leading-tight"
                >
                  {transformationHeadline || 'Simplify your transformation'}
                </motion.h2>

                <div className="space-y-6">
                  {transformationSteps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      variants={fadeInUp}
                      className="flex gap-5"
                    >
                      {/* Number badge */}
                      <div
                        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                        style={{
                          backgroundColor: `${accentLight}15`,
                          color: accentDark,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                          {step.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Image */}
              <motion.div variants={fadeInUp} className="relative">
                {transformationImageUrl ? (
                  <div
                    className="relative rounded-3xl overflow-hidden"
                    style={{
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    <Image
                      src={transformationImageUrl}
                      alt="Transformation"
                      width={600}
                      height={500}
                      className="w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[5/4] rounded-3xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}10 0%, ${accentDark}05 100%)`,
                    }}
                  >
                    <div className="text-center">
                      <span className="text-6xl">🚀</span>
                      <p className="mt-4 text-gray-500 dark:text-gray-400 font-medium">Your transformation awaits</p>
                    </div>
                  </div>
                )}
                {/* Decorative element */}
                <div
                  className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl -z-10"
                  style={{ backgroundColor: `${accentLight}10` }}
                />
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== DARK FEATURE SECTION ========== */}
      {services.length >= 3 && (
        <section className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-[#0d0d0f]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white"
              >
                Power up your journey with
                <br />
                <span className="italic" style={{ color: accentLight }}>next-gen coaching</span>
              </motion.h2>
            </motion.div>

            {/* Large feature cards - first 2 services */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 gap-6 mb-6"
            >
              {services.slice(0, 2).map((service, index) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  className={cn(
                    "group rounded-2xl bg-[#18181b] border border-gray-800 overflow-hidden",
                    service.funnelId && "cursor-pointer hover:border-gray-700"
                  )}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Illustration area */}
                  <div
                    className="h-48 flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: index === 0
                        ? `linear-gradient(135deg, ${accentLight}08 0%, transparent 100%)`
                        : `linear-gradient(135deg, ${accentDark}08 0%, transparent 100%)`,
                    }}
                  >
                    {/* Subtle glow */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `radial-gradient(circle at 50% 50%, ${index === 0 ? accentLight : accentDark} 0%, transparent 70%)`,
                      }}
                    />
                    <span className="text-6xl transform group-hover:scale-110 transition-transform duration-300">
                      {getServiceIcon(service.icon)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-white mb-3">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Small feature cards - next 3 services */}
            {services.length > 2 && (
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={stagger}
                className="grid md:grid-cols-3 gap-6"
              >
                {services.slice(2, 5).map((service) => (
                  <motion.div
                    key={service.id}
                    variants={fadeInUp}
                    className={cn(
                      "group p-6 rounded-2xl bg-[#18181b] border border-gray-800",
                      service.funnelId && "cursor-pointer hover:border-gray-700"
                    )}
                    onClick={() => service.funnelId && onServiceClick?.(service)}
                  >
                    {/* Icon */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                      style={{ backgroundColor: `${accentLight}15` }}
                    >
                      <span className="text-2xl">{getServiceIcon(service.icon)}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      {service.title}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ========== TESTIMONIALS SECTION ========== */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8 bg-gray-50/50 dark:bg-[#111113]">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-block text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentDark }}
              >
                Testimonials
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white"
              >
                Hear from my <span className="italic" style={{ color: accentDark }}>clients</span>
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
                  className="p-8 rounded-3xl bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 shadow-lg"
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-5 h-5",
                          i < (testimonial.rating || 5) ? "fill-amber-400 text-amber-400" : "text-gray-200 dark:text-gray-700"
                        )}
                      />
                    ))}
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white shadow-md"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                      }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-gray-500 dark:text-gray-500">{testimonial.role}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== FAQ SECTION ========== */}
      {faqs.length > 0 && (
        <section id="faq" className="py-24 lg:py-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-block text-sm font-semibold tracking-wider uppercase mb-4"
                style={{ color: accentDark }}
              >
                FAQ
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white"
              >
                Common questions
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
                  className="rounded-2xl overflow-hidden bg-white dark:bg-[#18181b] border border-gray-100 dark:border-gray-800 shadow-md"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-gray-900 dark:text-white pr-4">
                      {faq.question}
                    </span>
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      )}
                      style={{
                        backgroundColor: openFaqIndex === index ? `${accentLight}20` : 'transparent',
                      }}
                    >
                      {openFaqIndex === index ? (
                        <Minus className="w-4 h-4" style={{ color: accentDark }} />
                      ) : (
                        <Plus className="w-4 h-4 text-gray-400" />
                      )}
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
                    <p className="px-6 pb-6 text-gray-600 dark:text-gray-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== BOTTOM CTA SECTION ========== */}
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
            className="relative rounded-[2.5rem] p-12 lg:p-16 text-center overflow-hidden border shadow-2xl"
            style={{
              background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/15 rounded-full blur-2xl" />

            <motion.h2
              variants={fadeInUp}
              className="relative text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
            >
              Ready to begin?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="relative text-xl text-white/90 mb-10 max-w-xl mx-auto"
            >
              Take the first step today. Your transformation awaits.
            </motion.p>
            <motion.div variants={fadeInUp} className="relative">
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-3 px-10 py-5 text-lg font-semibold rounded-2xl bg-white transition-all duration-300 hover:scale-[1.02] shadow-lg group"
                style={{ color: accentDark }}
              >
                {ctaText}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-[#111113] border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            {/* Brand Column */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={footerCompanyName || coachName}
                    width={140}
                    height={40}
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {footerCompanyName || coachName}
                  </span>
                )}
              </div>
              {footerTagline && (
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                  {footerTagline}
                </p>
              )}
            </div>

            {/* Quick Links Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Quick Links
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-4">
                Contact
              </h4>
              <ul className="space-y-3">
                {footerEmail && (
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: accentDark }} />
                    <a href={`mailto:${footerEmail}`} className="hover:text-gray-900 dark:hover:text-white transition-colors">
                      {footerEmail}
                    </a>
                  </li>
                )}
                {footerPhone && (
                  <li className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4 flex-shrink-0" style={{ color: accentDark }} />
                    <a href={`tel:${footerPhone}`} className="hover:text-gray-900 dark:hover:text-white transition-colors">
                      {footerPhone}
                    </a>
                  </li>
                )}
                {footerAddress && (
                  <li className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentDark }} />
                    <span>{footerAddress}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-center text-sm text-gray-500 dark:text-gray-500">
              © {new Date().getFullYear()} {footerCompanyName || coachName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
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
