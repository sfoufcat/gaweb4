'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Plus, Minus, Star, Mail, Phone, MapPin, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps, WebsiteProgram } from './types';

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

// Decorative dots pattern SVG component - grid of filled dots
function DecorativeDots({ className, color = '#029837', rows = 6, cols = 5 }: { className?: string; color?: string; rows?: number; cols?: number }) {
  return (
    <svg className={className} viewBox={`0 0 ${cols * 24} ${rows * 24}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {[...Array(rows)].map((_, row) => (
        [...Array(cols)].map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={col * 24 + 8}
            cy={row * 24 + 8}
            r="6"
            fill={color}
            opacity="0.25"
          />
        ))
      ))}
    </svg>
  );
}

// Success badge component inspired by Figma
function SuccessBadge({ percentage = 90, label = 'Success Result', accentColor = '#029837' }: { percentage?: number; label?: string; accentColor?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="absolute bottom-8 right-8 lg:bottom-12 lg:right-12 bg-white rounded-[18px] shadow-xl p-4 pr-6 flex items-center gap-4 z-20"
      style={{ boxShadow: `0 10px 25px rgba(2, 152, 55, 0.1)` }}
    >
      {/* Circular progress indicator */}
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="#e8f5e9"
            strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={accentColor}
            strokeWidth="3"
            strokeDasharray={`${percentage}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: 'Ubuntu, sans-serif' }}>
            {percentage}%
          </span>
        </div>
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-800 leading-tight" style={{ fontFamily: 'Ubuntu, sans-serif' }}>
          {label.split(' ').map((word, i) => (
            <span key={i} className="block">{word}</span>
          ))}
        </p>
      </div>
    </motion.div>
  );
}

// Line icon components for OPTIMINDS style services
function ServiceIcon({ icon, color }: { icon?: string; color: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    'users': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="12" cy="10" r="4" />
        <path d="M4 26c0-4.418 3.582-8 8-8s8 3.582 8 8" />
        <circle cx="22" cy="12" r="3" />
        <path d="M22 18c2.761 0 5 2.239 5 5v3" />
      </svg>
    ),
    'heart': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M16 28s-10-6.5-10-14c0-4 3-7 6.5-7 2.5 0 4.5 1.5 5.5 3.5 1-2 3-3.5 5.5-3.5 3.5 0 6.5 3 6.5 7 0 7.5-10 14-10 14z" />
      </svg>
    ),
    'target': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="16" cy="16" r="12" />
        <circle cx="16" cy="16" r="8" />
        <circle cx="16" cy="16" r="4" />
        <circle cx="16" cy="16" r="1" fill={color} />
      </svg>
    ),
    'zap': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M17 4L7 18h8l-2 10 10-14h-8l2-10z" />
      </svg>
    ),
    'book': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M4 6c4-2 8-2 12 0v20c-4-2-8-2-12 0V6z" />
        <path d="M28 6c-4-2-8-2-12 0v20c4-2 8-2 12 0V6z" />
      </svg>
    ),
    'star': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M16 4l3.5 7 7.5 1-5.5 5.5 1.5 7.5-7-3.5-7 3.5 1.5-7.5L5 12l7.5-1L16 4z" />
      </svg>
    ),
    'calendar': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="6" width="24" height="22" rx="2" />
        <path d="M4 12h24" />
        <path d="M10 4v4M22 4v4" />
      </svg>
    ),
    'message-circle': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M28 15c0 6.075-5.373 11-12 11-1.5 0-2.941-.232-4.282-.66L4 28l2.34-5.276C4.854 20.81 4 18.47 4 16c0-6.075 5.373-11 12-11s12 4.925 12 11z" />
      </svg>
    ),
    'trophy': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M8 4h16v10c0 4.418-3.582 8-8 8s-8-3.582-8-8V4z" />
        <path d="M8 8H4v4c0 2.209 1.791 4 4 4" />
        <path d="M24 8h4v4c0 2.209-1.791 4-4 4" />
        <path d="M16 22v4M10 28h12" />
      </svg>
    ),
    'video': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="8" width="18" height="16" rx="2" />
        <path d="M22 14l6-4v12l-6-4" />
      </svg>
    ),
    'rocket': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <path d="M16 4c-4 4-8 12-8 16h16c0-4-4-12-8-16z" />
        <circle cx="16" cy="14" r="2" />
        <path d="M12 20l-4 8M20 20l4 8" />
      </svg>
    ),
    'check-circle': (
      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.5">
        <circle cx="16" cy="16" r="12" />
        <path d="M10 16l4 4 8-8" />
      </svg>
    ),
  };

  return iconMap[icon || 'star'] || iconMap['star'];
}

/**
 * Minimal Website Template - OPTIMINDS Style
 *
 * Features:
 * - Clean beige/cream backgrounds
 * - Line icons for services (no boxes)
 * - 4-column service layout
 * - 2-column testimonials with stars
 * - Programs/insights section with image cards
 * - Dark navy footer
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
  servicesHeadline,
  servicesSubheadline,
  programs,
  programsHeadline,
  programsSubheadline,
  transformationHeadline,
  transformationSteps,
  transformationImageUrl,
  testimonials,
  testimonialsHeadline,
  faqs,
  ctaText,
  ctaUrl,
  footerCompanyName,
  footerTagline,
  footerEmail,
  footerPhone,
  footerAddress,
  logoUrl,
  accentLight = '#6b5c4c',
  accentDark = '#4a3f35',
  onServiceClick,
  onProgramClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);

  // Warm beige color palette (OPTIMINDS style)
  const warmBg = '#f5f0e8';
  const warmBgDark = '#ebe5db';

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
    <div className="w-full overflow-x-hidden bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center pt-20 pb-16 lg:pb-24 px-4 sm:px-6 lg:px-8">
        {/* Background */}
        <div className="absolute inset-0 bg-white" />
        
        {/* Decorative dots - top right */}
        <div className="absolute top-32 right-0 hidden lg:block">
          <DecorativeDots className="w-32 h-40" color={accentLight} rows={7} cols={5} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="order-2 lg:order-1"
            >
              <motion.h1
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-[50px] font-bold text-[#2d2a26] leading-[1.25] mb-6"
              >
                {headline}
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-base lg:text-lg text-[#5c5650] leading-relaxed mb-8 max-w-lg"
              >
                {subheadline}
              </motion.p>

              <motion.div variants={fadeInUp}>
                <a
                  href={ctaUrl}
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-medium text-white rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg"
                  style={{
                    backgroundColor: accentLight,
                    boxShadow: `0 8px 20px ${accentLight}35`,
                  }}
                >
                  {ctaText || 'Get Started'}
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </motion.div>

            {/* Right - Hero Image with organic shape */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative order-1 lg:order-2"
            >
              {/* Decorative dots behind image */}
              <div className="absolute -top-4 -left-4 hidden lg:block">
                <DecorativeDots className="w-28 h-36" color={accentLight} rows={6} cols={5} />
              </div>

              {/* Main Image with organic shape - Hero image only */}
              {heroImageUrl ? (
                <div className="relative">
                  <div
                    className="relative aspect-[4/5] max-w-md mx-auto lg:max-w-none overflow-hidden"
                    style={{
                      borderRadius: '213px 219px 219px 216px',
                      boxShadow: `0 11px 19px rgba(0, 0, 0, 0.05)`,
                    }}
                  >
                    <Image
                      src={heroImageUrl}
                      alt="Hero"
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>

                  {/* Success Badge */}
                  <SuccessBadge percentage={90} label="Success Result" accentColor={accentLight} />
                </div>
              ) : (
                /* No hero image - show decorative placeholder with success badge */
                <div className="relative">
                  <div
                    className="aspect-[4/5] max-w-md mx-auto lg:max-w-none flex items-center justify-center"
                    style={{
                      borderRadius: '213px 219px 219px 216px',
                      backgroundColor: warmBg,
                    }}
                  >
                    <span className="text-9xl font-bold" style={{ color: accentLight }}>
                      {coachName?.charAt(0) || '?'}
                    </span>
                  </div>
                  {/* Success Badge */}
                  <SuccessBadge percentage={90} label="Success Result" accentColor={accentLight} />
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== ABOUT/COACH SECTION ========== */}
      {(coachBio || credentials.length > 0) && (
        <section id="about" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: warmBg }}>
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              {/* Left - Image with organic shape */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={fadeInUp}
                className="relative"
              >
                {/* Decorative dots */}
                <div className="absolute -top-4 -left-4 hidden lg:block">
                  <DecorativeDots className="w-28 h-36" color={accentLight} rows={6} cols={5} />
                </div>

                {coachImageUrl ? (
                  <div
                    className="relative aspect-[4/5] max-w-md mx-auto lg:max-w-lg overflow-hidden"
                    style={{
                      borderRadius: '213px 219px 219px 216px',
                    }}
                  >
                    <Image
                      src={coachImageUrl}
                      alt={coachName}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/5] max-w-md mx-auto lg:max-w-lg flex items-center justify-center"
                    style={{
                      borderRadius: '213px 219px 219px 216px',
                      backgroundColor: warmBgDark,
                    }}
                  >
                    <span className="text-8xl font-bold" style={{ color: accentLight }}>
                      {coachName?.charAt(0) || '?'}
                    </span>
                  </div>
                )}
              </motion.div>

              {/* Right - Content */}
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={stagger}
                className="space-y-6"
              >
                <motion.h2
                  variants={fadeInUp}
                  className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] leading-tight"
                >
                  {coachHeadline || `About ${coachName}`}
                </motion.h2>

                {coachBio && (
                  <motion.p
                    variants={fadeInUp}
                    className="text-base text-[#5c5650] leading-relaxed whitespace-pre-line"
                  >
                    {coachBio}
                  </motion.p>
                )}

                {/* Credentials */}
                {credentials.length > 0 && (
                  <motion.div variants={fadeInUp} className="space-y-3 pt-4">
                    {credentials.map((credential, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: accentLight }}
                        >
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-base text-[#2d2a26]">{credential}</span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ========== SERVICES SECTION - OPTIMINDS STYLE ========== */}
      {services.length > 0 && (
        <section id="services" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: warmBg }}>
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-12 lg:mb-16"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] mb-4"
              >
                {servicesHeadline || 'Service we offer'}
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-base text-[#5c5650] max-w-2xl mx-auto"
              >
                {servicesSubheadline || 'Personalized coaching programs designed to help you achieve your biggest goals.'}
              </motion.p>
            </motion.div>

            {/* Services Grid - OPTIMINDS 4-column horizontal style */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-[#d4cdc3]"
            >
              {services.slice(0, 4).map((service, index) => (
                <motion.div
                  key={service.id}
                  variants={fadeInUp}
                  className={cn(
                    "p-6 lg:p-8 border-b border-[#d4cdc3]",
                    index < 3 && "lg:border-r",
                    service.funnelId && "cursor-pointer hover:bg-white/50 transition-colors"
                  )}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Line Icon */}
                  <div className="mb-4">
                    <ServiceIcon icon={service.icon} color={accentLight} />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-[#2d2a26] mb-2">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#5c5650] leading-relaxed">
                    {service.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== TESTIMONIALS SECTION - OPTIMINDS STYLE ========== */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] mb-4"
              >
                {testimonialsHeadline || 'Success Stories'}
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-base text-[#5c5650]"
              >
                Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </motion.p>
            </motion.div>

            {/* Testimonials Grid - 2-column OPTIMINDS style */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 gap-8 lg:gap-12"
            >
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="space-y-6"
                >
                  {/* Star Rating */}
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-5 h-5",
                          i < (testimonial.rating || 5) ? "fill-[#2d2a26] text-[#2d2a26]" : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-base text-[#2d2a26] leading-relaxed italic">
                    "{testimonial.text}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-3 pt-2">
                    {/* Avatar */}
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{ backgroundColor: accentLight }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-[#2d2a26]">{testimonial.author}</p>
                      {testimonial.role && (
                        <p className="text-sm text-[#5c5650]">{testimonial.role}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== PROGRAMS/INSIGHTS SECTION - OPTIMINDS STYLE ========== */}
      {programs && programs.length > 0 && (
        <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: warmBg }}>
          <div className="max-w-6xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] mb-4"
              >
                {programsHeadline || 'Some insight from us'}
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-base text-[#5c5650]"
              >
                {programsSubheadline || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros.'}
              </motion.p>
            </motion.div>

            {/* Programs Grid - 3-column cards with images */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {programs.slice(0, 6).map((program) => (
                <motion.div
                  key={program.id}
                  variants={fadeInUp}
                  className={cn(
                    "group",
                    "cursor-pointer"
                  )}
                  onClick={() => onProgramClick?.(program)}
                >
                  {/* Image */}
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-4 bg-[#e8e2d8]">
                    {program.coverImageUrl ? (
                      <Image
                        src={program.coverImageUrl}
                        alt={program.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-bold" style={{ color: accentLight }}>
                          {program.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-[#2d2a26] mb-2 group-hover:underline">
                    {program.name}
                  </h3>
                  {program.description && (
                    <p className="text-sm text-[#5c5650] leading-relaxed line-clamp-3">
                      {program.description}
                    </p>
                  )}

                  {/* Program type badge */}
                  <div className="flex items-center gap-2 mt-3">
                    {program.type === 'group' ? (
                      <Users className="w-4 h-4 text-[#5c5650]" />
                    ) : (
                      <User className="w-4 h-4 text-[#5c5650]" />
                    )}
                    <span className="text-xs text-[#5c5650] capitalize">{program.type} Program</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== FAQ SECTION ========== */}
      {faqs.length > 0 && (
        <section id="faq" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] mb-4"
              >
                Frequently asked questions
              </motion.h2>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="divide-y divide-[#d4cdc3]"
            >
              {faqs.map((faq, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  className="py-6"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-start justify-between text-left gap-4"
                  >
                    <span className="text-base font-medium text-[#2d2a26]">
                      {faq.question}
                    </span>
                    <div
                      className={cn(
                        "flex-shrink-0 transition-transform duration-300",
                        openFaqIndex === index && "rotate-45"
                      )}
                    >
                      <Plus className="w-5 h-5 text-[#5c5650]" />
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
                    <p className="pt-4 text-[#5c5650] leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== NEWSLETTER SECTION ========== */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: warmBg }}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-semibold text-[#2d2a26] mb-4"
          >
            Join our newsletter
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base text-[#5c5650] mb-8"
          >
            Subscribe to get the latest updates, tips, and insights delivered to your inbox.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
            <div className="relative flex-1 w-full">
              <input
                type="email"
                placeholder="Enter your email address"
                className="w-full px-5 py-4 rounded-lg text-sm outline-none border border-[#d4cdc3] bg-white text-[#2d2a26] focus:border-[#5c5650] transition-colors"
              />
            </div>
            <a
              href={ctaUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white rounded-lg transition-all duration-300 hover:scale-[1.02] shadow-lg whitespace-nowrap"
              style={{
                backgroundColor: accentLight,
              }}
            >
              Subscribe
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8 bg-[#2d2a26]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={footerCompanyName || coachName}
                  width={160}
                  height={40}
                  className="h-10 w-auto object-contain mb-4"
                />
              ) : (
                <span className="text-2xl font-bold text-white mb-4 block">
                  {footerCompanyName || coachName}
                </span>
              )}
              {footerAddress && (
                <p className="text-white/70 text-sm leading-relaxed max-w-[200px]">
                  {footerAddress}
                </p>
              )}
            </div>

            {/* Quick Links Column 1 */}
            <div>
              <ul className="space-y-4">
                <li>
                  <Link href="#" className="text-white/70 text-sm hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="#about" className="text-white/70 text-sm hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="text-white/70 text-sm hover:text-white transition-colors">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            {/* Quick Links Column 2 */}
            <div>
              <ul className="space-y-4">
                <li>
                  <Link href="#services" className="text-white/70 text-sm hover:text-white transition-colors">
                    Services
                  </Link>
                </li>
                {footerEmail && (
                  <li>
                    <a href={`mailto:${footerEmail}`} className="text-white/70 text-sm hover:text-white transition-colors">
                      Contact
                    </a>
                  </li>
                )}
                <li>
                  <Link href="#" className="text-white/70 text-sm hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social Links Column */}
            <div>
              <h4 className="text-white text-sm font-medium mb-4">
                Connect With Us
              </h4>
              <div className="flex items-center gap-3">
                {/* Twitter/X */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* Facebook */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                {/* Instagram */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                {/* LinkedIn */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-white/10">
            <p className="text-center text-sm text-white/50">
              © {new Date().getFullYear()} {footerCompanyName || coachName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
