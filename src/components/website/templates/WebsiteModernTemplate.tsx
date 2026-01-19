'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Star, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8 } },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Dark gradient palette for service cards (purple/magenta theme)
const darkGradients = [
  'linear-gradient(135deg, #2d1b4e 0%, #1a1024 100%)', // Deep purple
  'linear-gradient(135deg, #1b2d4e 0%, #101a24 100%)', // Deep blue
  'linear-gradient(135deg, #4e1b3d 0%, #24101a 100%)', // Deep magenta
  'linear-gradient(135deg, #1b4e3d 0%, #10241a 100%)', // Deep teal
  'linear-gradient(135deg, #4e3d1b 0%, #241a10 100%)', // Deep amber
  'linear-gradient(135deg, #3d1b4e 0%, #1a1024 100%)', // Deep violet
];

/**
 * Modern Website Template - Dark Premium Aesthetic with Draftr Enhancements
 *
 * Features:
 * - Pure black background (#000000)
 * - Purple/magenta gradient accents
 * - Dark gradient service cards
 * - Transformation steps section (dark theme)
 * - Bento-style dark feature section
 * - Rich multi-column footer
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
  accentLight = '#814ac8',
  accentDark = '#df7afe',
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
    <div className="w-full overflow-x-hidden bg-black text-white">
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Main gradient orb */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-40"
            style={{
              background: `radial-gradient(circle, ${accentLight} 0%, ${accentDark}60 30%, transparent 70%)`,
              filter: 'blur(100px)',
            }}
          />
          {/* Secondary orb top-right */}
          <div
            className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-20"
            style={{
              backgroundColor: accentDark,
              filter: 'blur(120px)',
            }}
          />
          {/* Subtle overlay for better text contrast */}
          <div className="absolute inset-0 bg-black/40" />
        </div>

        {/* Hero Content */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-5xl mx-auto text-center"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="mb-10 flex justify-center">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border backdrop-blur-md"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: accentDark,
                  boxShadow: `0 0 10px ${accentDark}`,
                }}
              />
              Transform Your Life
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-[1.05]"
            style={{
              letterSpacing: '-0.04em',
            }}
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
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 0 40px ${accentLight}50`,
              }}
            >
              {ctaText}
              <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="#services"
              className="inline-flex items-center gap-2 px-6 py-4 text-base font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300"
            >
              Explore Services
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
                    className="w-11 h-11 rounded-full border-2 border-black flex items-center justify-center text-sm font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
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
                  Trusted by <span className="text-white font-medium">{testimonials.length * 50}+</span> clients
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Hero Image */}
        {heroImageUrl && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4 }}
            className="relative mt-20 w-full max-w-6xl mx-auto px-4"
          >
            <div
              className="relative rounded-2xl overflow-hidden border border-white/10"
              style={{
                boxShadow: `0 0 80px ${accentLight}30`,
              }}
            >
              <Image
                src={heroImageUrl}
                alt="Hero"
                width={1400}
                height={700}
                className="w-full object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            </div>
          </motion.div>
        )}
      </section>

      {/* ========== SERVICES SECTION - DARK GRADIENT CARDS ========== */}
      {services.length > 0 && (
        <section id="services" className="py-32 px-4 sm:px-6 lg:px-8 relative">
          {/* Background accent */}
          <div
            className="absolute top-1/2 left-0 w-[600px] h-[600px] rounded-full opacity-15"
            style={{
              backgroundColor: accentLight,
              filter: 'blur(150px)',
            }}
          />

          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-20"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-block text-sm font-medium uppercase tracking-wider mb-4"
                style={{ color: accentDark }}
              >
                Services
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold"
                style={{ letterSpacing: '-0.02em' }}
              >
                Everything you need to{' '}
                <span style={{ color: accentDark }}>succeed</span>
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
                    "group rounded-[1.5rem] overflow-hidden transition-all duration-300",
                    service.funnelId && "cursor-pointer hover:scale-[1.02]"
                  )}
                  style={{
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
                  }}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Dark gradient illustration area */}
                  <div
                    className="relative h-48 flex items-center justify-center overflow-hidden"
                    style={{ background: darkGradients[index % darkGradients.length] }}
                  >
                    {/* Glow effect */}
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, ${accentLight}40 0%, transparent 60%)`,
                      }}
                    />
                    {/* Decorative floating shapes */}
                    <div className="absolute top-4 right-4 w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-sm" />
                    <div className="absolute bottom-4 left-4 w-12 h-12 rounded-xl bg-white/5" />

                    {/* Large emoji icon */}
                    <span className="text-6xl transform group-hover:scale-110 transition-transform duration-300 relative z-10">
                      {getServiceIcon(service.icon)}
                    </span>
                  </div>

                  {/* Content */}
                  <div
                    className="p-8"
                    style={{ backgroundColor: '#0a0a0b' }}
                  >
                    <h3 className="text-xl font-bold text-white mb-3" style={{ letterSpacing: '-0.01em' }}>
                      {service.title}
                    </h3>
                    <p className="text-white/50 leading-relaxed mb-6">
                      {service.description}
                    </p>

                    {service.funnelId && (
                      <span
                        className="inline-flex items-center gap-2 font-semibold transition-all group-hover:gap-3"
                        style={{ color: accentDark }}
                      >
                        Learn more
                        <ArrowRight className="w-4 h-4" />
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
        <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
          <div
            className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full opacity-10"
            style={{
              backgroundColor: accentDark,
              filter: 'blur(120px)',
            }}
          />

          <div className="max-w-6xl mx-auto relative">
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
                  className="inline-block text-sm font-medium uppercase tracking-wider mb-2"
                  style={{ color: accentDark }}
                >
                  Your Journey
                </motion.span>
                <motion.h2
                  variants={fadeInUp}
                  className="text-4xl sm:text-5xl font-bold text-white mb-12"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {transformationHeadline || 'Simplify your transformation'}
                </motion.h2>

                <div className="space-y-8">
                  {transformationSteps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      variants={fadeInUp}
                      className="flex gap-6"
                    >
                      {/* Number badge */}
                      <div
                        className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${accentLight}25 0%, ${accentDark}15 100%)`,
                          color: accentDark,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">
                          {step.title}
                        </h3>
                        <p className="text-white/50 leading-relaxed">
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
                    className="relative rounded-2xl overflow-hidden border border-white/10"
                    style={{ boxShadow: `0 0 60px ${accentLight}20` }}
                  >
                    <Image
                      src={transformationImageUrl}
                      alt="Transformation"
                      width={600}
                      height={500}
                      className="w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                ) : (
                  <div
                    className="aspect-[5/4] rounded-2xl flex items-center justify-center border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}15 0%, ${accentDark}10 100%)`,
                    }}
                  >
                    <div className="text-center">
                      <span className="text-7xl">🚀</span>
                      <p className="mt-4 text-white/50 font-medium">Your transformation awaits</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== DARK FEATURE SECTION (BENTO STYLE) ========== */}
      {services.length >= 3 && (
        <section className="py-32 px-4 sm:px-6 lg:px-8 bg-[#050506]">
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
                className="text-4xl sm:text-5xl font-bold"
                style={{ letterSpacing: '-0.02em' }}
              >
                Power up your journey with
                <br />
                <span className="bg-clip-text text-transparent" style={{
                  backgroundImage: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                }}>
                  next-gen coaching
                </span>
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
                    "group rounded-[1.5rem] bg-[#0a0a0b] border border-white/[0.06] overflow-hidden",
                    service.funnelId && "cursor-pointer hover:border-white/10"
                  )}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Illustration area */}
                  <div
                    className="h-56 flex items-center justify-center relative overflow-hidden"
                    style={{
                      background: index === 0
                        ? `linear-gradient(135deg, ${accentLight}10 0%, transparent 100%)`
                        : `linear-gradient(135deg, ${accentDark}10 0%, transparent 100%)`,
                    }}
                  >
                    {/* Animated glow */}
                    <div
                      className="absolute inset-0 opacity-20"
                      style={{
                        backgroundImage: `radial-gradient(circle at 50% 50%, ${index === 0 ? accentLight : accentDark} 0%, transparent 70%)`,
                      }}
                    />
                    <span className="text-7xl transform group-hover:scale-110 transition-transform duration-300">
                      {getServiceIcon(service.icon)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-8">
                    <h3 className="text-xl font-bold text-white mb-3">
                      {service.title}
                    </h3>
                    <p className="text-white/50 leading-relaxed">
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
                      "group p-8 rounded-[1.5rem] bg-[#0a0a0b] border border-white/[0.06]",
                      service.funnelId && "cursor-pointer hover:border-white/10"
                    )}
                    onClick={() => service.funnelId && onServiceClick?.(service)}
                  >
                    {/* Icon */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight}25 0%, ${accentDark}15 100%)`,
                      }}
                    >
                      <span className="text-3xl">{getServiceIcon(service.icon)}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">
                      {service.title}
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {service.description}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </section>
      )}

      {/* ========== ABOUT/COACH SECTION ========== */}
      {(coachBio || credentials.length > 0) && (
        <section id="about" className="py-32 px-4 sm:px-6 lg:px-8 relative">
          <div
            className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full opacity-10"
            style={{
              backgroundColor: accentDark,
              filter: 'blur(120px)',
            }}
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
                      className="relative aspect-square rounded-2xl overflow-hidden border border-white/10"
                      style={{ boxShadow: `0 0 60px ${accentLight}20` }}
                    >
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="aspect-square rounded-2xl flex items-center justify-center border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}15 0%, ${accentDark}10 100%)`,
                    }}
                  >
                    <span className="text-9xl font-bold" style={{ color: accentDark }}>
                      {coachName.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Coach Info */}
              <motion.div variants={fadeInUp} className="space-y-8">
                <div>
                  <span
                    className="inline-block text-sm font-medium uppercase tracking-wider mb-4"
                    style={{ color: accentDark }}
                  >
                    {coachHeadline || 'Your Coach'}
                  </span>
                  <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6" style={{ letterSpacing: '-0.02em' }}>
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
                        className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                      >
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${accentLight}25 0%, ${accentDark}15 100%)`,
                          }}
                        >
                          <Check className="w-5 h-5" style={{ color: accentDark }} />
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

      {/* ========== TESTIMONIALS SECTION ========== */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
              className="mb-16"
            >
              <motion.span
                variants={fadeInUp}
                className="inline-block text-sm font-medium uppercase tracking-wider mb-4"
                style={{ color: accentDark }}
              >
                Testimonials
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold"
                style={{ letterSpacing: '-0.02em' }}
              >
                Real results, real stories
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
                  className="p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm"
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

      {/* ========== FAQ SECTION ========== */}
      {faqs.length > 0 && (
        <section id="faq" className="py-32 px-4 sm:px-6 lg:px-8">
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
                className="inline-block text-sm font-medium uppercase tracking-wider mb-4"
                style={{ color: accentDark }}
              >
                FAQ
              </motion.span>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl font-bold"
                style={{ letterSpacing: '-0.02em' }}
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
                    "rounded-xl overflow-hidden border transition-all duration-300",
                    openFaqIndex === index
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-white/[0.06] bg-transparent"
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
                        backgroundColor: openFaqIndex === index ? `${accentLight}25` : 'transparent',
                      }}
                    >
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 transition-transform duration-300",
                          openFaqIndex === index ? "rotate-180" : ""
                        )}
                        style={{ color: openFaqIndex === index ? accentDark : 'rgba(255,255,255,0.5)' }}
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

      {/* ========== BOTTOM CTA ========== */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${accentLight}20 0%, transparent 50%)`,
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
            style={{ letterSpacing: '-0.02em' }}
          >
            Ready to start your{' '}
            <span style={{ color: accentDark }}>journey</span>?
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
              className="group inline-flex items-center gap-3 px-10 py-5 text-lg font-semibold text-white rounded-xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                boxShadow: `0 0 60px ${accentLight}50`,
              }}
            >
              {ctaText}
              <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-16 px-4 sm:px-6 lg:px-8 border-t border-white/[0.06]">
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
                    className="h-10 w-auto object-contain brightness-0 invert"
                  />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {footerCompanyName || coachName}
                  </span>
                )}
              </div>
              {footerTagline && (
                <p className="text-white/50 leading-relaxed mb-6">
                  {footerTagline}
                </p>
              )}
            </div>

            {/* Quick Links Column */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Quick Links
              </h4>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-white/50 hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white/50 hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Contact
              </h4>
              <ul className="space-y-3">
                {footerEmail && (
                  <li className="flex items-center gap-3 text-white/50">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: accentDark }} />
                    <a href={`mailto:${footerEmail}`} className="hover:text-white transition-colors">
                      {footerEmail}
                    </a>
                  </li>
                )}
                {footerPhone && (
                  <li className="flex items-center gap-3 text-white/50">
                    <Phone className="w-4 h-4 flex-shrink-0" style={{ color: accentDark }} />
                    <a href={`tel:${footerPhone}`} className="hover:text-white transition-colors">
                      {footerPhone}
                    </a>
                  </li>
                )}
                {footerAddress && (
                  <li className="flex items-start gap-3 text-white/50">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accentDark }} />
                    <span>{footerAddress}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-white/[0.06]">
            <p className="text-center text-sm text-white/40">
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
