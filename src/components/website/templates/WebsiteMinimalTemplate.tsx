'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Plus, Minus, Star, Mail, Phone, MapPin } from 'lucide-react';
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

// Decorative ring pattern SVG component
function DecorativeRings({ className, color = '#029837' }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 154 337" fill="none" xmlns="http://www.w3.org/2000/svg">
      {[0, 22, 44, 66, 88, 110, 132].map((x, i) => (
        <g key={i} opacity={0.15 - i * 0.015}>
          {[...Array(15)].map((_, j) => (
            <circle
              key={j}
              cx={x + 6.5}
              cy={j * 22 + 11}
              r="5"
              stroke={color}
              strokeWidth="1.5"
              fill="none"
            />
          ))}
        </g>
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

/**
 * Minimal Website Template - Inspired by Figma Coaching Design
 *
 * Features:
 * - Clean white backgrounds with soft green accents
 * - Ubuntu typography for headings
 * - Organic rounded shapes for images
 * - Decorative ring patterns
 * - Green (#029837) as primary accent
 * - Success badge/stat component
 * - Newsletter subscription section
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
  accentLight = '#029837',
  accentDark = '#027a2d',
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
    <div className="w-full overflow-x-hidden bg-white" style={{ fontFamily: 'Ubuntu, system-ui, sans-serif' }}>
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen flex items-center pt-20 pb-16 lg:pb-24 px-4 sm:px-6 lg:px-8">
        {/* Background */}
        <div className="absolute inset-0 bg-white" />
        
        {/* Decorative rings - top right */}
        <div className="absolute top-32 right-0 opacity-30 hidden lg:block">
          <DecorativeRings className="w-40 h-80" color={accentLight} />
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
                className="text-4xl sm:text-5xl lg:text-[50px] font-bold text-[#000033] leading-[1.25] mb-6"
                style={{ fontFamily: 'Ubuntu, sans-serif' }}
              >
                {headline}
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="text-base lg:text-lg text-[#000033] leading-relaxed mb-8 max-w-lg font-light"
              >
                {subheadline}
              </motion.p>

              <motion.div variants={fadeInUp}>
                <a
                  href={ctaUrl}
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-medium text-white rounded-[20px] transition-all duration-300 hover:scale-[1.02] shadow-lg"
                  style={{
                    backgroundColor: accentLight,
                    boxShadow: `0 8px 20px ${accentLight}35`,
                  }}
                >
                  {ctaText || 'Book Now'}
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
              {/* Decorative rings behind image */}
              <div className="absolute -top-8 -left-8 opacity-20 hidden lg:block">
                <DecorativeRings className="w-36 h-72" color={accentLight} />
              </div>

              {/* Main Image with organic shape */}
              {heroImageUrl || coachImageUrl ? (
                <div className="relative">
                  <div
                    className="relative aspect-[4/5] max-w-md mx-auto lg:max-w-none overflow-hidden"
                    style={{
                      borderRadius: '213px 219px 219px 216px',
                      boxShadow: `0 11px 19px rgba(2, 147, 52, 0.05)`,
                    }}
                  >
                    <Image
                      src={heroImageUrl || coachImageUrl || ''}
                      alt={coachName || 'Coach'}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>

                  {/* Success Badge */}
                  <SuccessBadge percentage={90} label="Success Result" accentColor={accentLight} />
                </div>
              ) : (
                <div
                  className="aspect-[4/5] max-w-md mx-auto lg:max-w-none flex items-center justify-center"
                  style={{
                    borderRadius: '213px 219px 219px 216px',
                    backgroundColor: `${accentLight}08`,
                  }}
                >
                  <span className="text-9xl font-bold" style={{ color: accentLight }}>
                    {coachName?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== ABOUT/SERVICES OVERVIEW SECTION ========== */}
      {(coachBio || services.length > 0) && (
        <section id="about" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7fff6' }}>
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
                {/* Decorative rings */}
                <div className="absolute -top-4 -left-4 opacity-20 hidden lg:block">
                  <DecorativeRings className="w-32 h-64" color={accentLight} />
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
                      backgroundColor: `${accentLight}08`,
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
                  className="text-2xl sm:text-3xl font-bold text-[#000033] leading-tight"
                  style={{ fontFamily: 'Ubuntu, sans-serif' }}
                >
                  {coachHeadline || 'We offer the best services'}
                </motion.h2>

                {coachBio && (
                  <motion.p
                    variants={fadeInUp}
                    className="text-base text-[#000033]/95 leading-relaxed"
                  >
                    {coachBio}
                  </motion.p>
                )}

                {/* Service checklist - like Figma */}
                {services.length > 0 && (
                  <motion.div variants={fadeInUp} className="space-y-3 pt-4">
                    {services.slice(0, 3).map((service) => (
                      <div key={service.id} className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 w-[17px] h-[17px] rounded-full flex items-center justify-center"
                          style={{ backgroundColor: accentLight }}
                        >
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-base text-[#000033]/90">{service.title}</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                <motion.div variants={fadeInUp} className="pt-4">
                  <a
                    href={ctaUrl}
                    className="inline-flex items-center gap-2 px-6 py-3.5 text-base font-medium rounded-[20px] border-2 transition-all duration-300 hover:bg-opacity-10"
                    style={{
                      borderColor: accentLight,
                      color: accentLight,
                    }}
                  >
                    {ctaText || 'Book Now'}
                  </a>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ========== SERVICES CARDS SECTION ========== */}
      {services.length > 0 && (
        <section id="services" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-12 lg:mb-16"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-[#000033] mb-4"
                style={{ fontFamily: 'Ubuntu, sans-serif' }}
              >
                The Perfect Solution to your
                <br className="hidden sm:block" />
                <span className="block sm:inline"> Relationship Issues</span>
              </motion.h2>
              <motion.p
                variants={fadeInUp}
                className="text-base text-[#000033]/95 max-w-xl mx-auto font-light"
              >
                {transformationHeadline || 'Personalized coaching programs designed to help you achieve your biggest goals.'}
              </motion.p>
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
                  className={cn(
                    "group bg-white rounded-[20px] overflow-hidden transition-all duration-300",
                    service.funnelId && "cursor-pointer hover:-translate-y-2"
                  )}
                  style={{
                    boxShadow: '0 10px 25px rgba(0, 0, 51, 0.08)',
                  }}
                  onClick={() => service.funnelId && onServiceClick?.(service)}
                >
                  {/* Icon area */}
                  <div className="p-8 pb-0">
                    <div
                      className="w-16 h-14 rounded-lg flex items-center justify-center mb-6"
                      style={{ backgroundColor: `rgba(2, 152, 55, 0.1)` }}
                    >
                      <span className="text-2xl">{getServiceIcon(service.icon)}</span>
                    </div>

                    <h3 className="text-xl font-bold text-[#000033] mb-3" style={{ fontFamily: 'Ubuntu, sans-serif' }}>
                      {service.title}
                    </h3>
                  </div>

                  {/* Content */}
                  <div className="px-8 pb-8">
                    <p className="text-[13px] text-[#000033]/95 leading-relaxed mb-6 font-light">
                      {service.description}
                    </p>

                    {service.funnelId && (
                      <a
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium rounded-[16px] border-[1.6px] transition-all duration-300"
                        style={{
                          borderColor: accentLight,
                          color: accentLight,
                        }}
                      >
                        Learn More
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* ========== TESTIMONIALS SECTION ========== */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7fff6' }}>
          {/* Decorative rings - top right */}
          <div className="absolute right-0 -translate-y-32 opacity-20 hidden lg:block">
            <DecorativeRings className="w-36 h-72" color={accentLight} />
          </div>

          <div className="max-w-6xl mx-auto relative">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-12 lg:mb-16"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-[#000033]"
                style={{ fontFamily: 'Ubuntu, sans-serif' }}
              >
                What our customers say
                <br className="hidden sm:block" />
                <span className="block sm:inline"> about us</span>
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
                  className="bg-white rounded-[20px] p-6 lg:p-8"
                  style={{
                    boxShadow: '0 10px 25px rgba(0, 0, 51, 0.08)',
                  }}
                >
                  {/* Author info with quote mark */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center font-semibold text-white text-lg"
                        style={{
                          background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                        }}
                      >
                        {testimonial.author.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-[#000033]" style={{ fontFamily: 'Mulish, sans-serif' }}>
                          {testimonial.author}
                        </p>
                        {testimonial.role && (
                          <p className="text-[13px] text-[#000033]/95 font-extralight" style={{ fontFamily: 'Mulish, sans-serif' }}>
                            {testimonial.role}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Quote mark */}
                    <span
                      className="text-5xl font-bold leading-none rotate-180"
                      style={{ color: accentLight, fontFamily: 'Mulish, sans-serif' }}
                    >
                      "
                    </span>
                  </div>

                  {/* Testimonial text */}
                  <p className="text-[13px] text-[#000033]/95 leading-relaxed font-light">
                    {testimonial.text}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* Decorative rings - bottom left */}
            <div className="absolute -bottom-32 -left-16 opacity-20 hidden lg:block">
              <DecorativeRings className="w-36 h-72" color={accentLight} />
            </div>
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
              className="text-center mb-12"
            >
              <motion.h2
                variants={fadeInUp}
                className="text-3xl sm:text-4xl font-bold text-[#000033]"
                style={{ fontFamily: 'Ubuntu, sans-serif' }}
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
                  className="rounded-[20px] overflow-hidden bg-white"
                  style={{
                    boxShadow: '0 10px 25px rgba(0, 0, 51, 0.08)',
                  }}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-semibold text-[#000033] pr-4" style={{ fontFamily: 'Ubuntu, sans-serif' }}>
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
                        <Minus className="w-4 h-4" style={{ color: accentLight }} />
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
                    <p className="px-6 pb-6 text-[#000033]/95 leading-relaxed font-light">
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
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 bg-white">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold text-[#000033] mb-4"
            style={{ fontFamily: 'Ubuntu, sans-serif' }}
          >
            Subscribe to our newsletter
          </motion.h2>
          <motion.p
            variants={fadeInUp}
            className="text-base text-[#000033]/95 mb-8 font-light"
          >
            We recommend you to subscribe to our newsletter, drop
            <br className="hidden sm:block" />
            your email below to get daily updates about us
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
            <div className="relative flex-1 w-full">
              <input
                type="email"
                placeholder="Enter your email address"
                className="w-full px-6 py-4 rounded-[23px] text-[13px] font-light outline-none transition-all"
                style={{
                  backgroundColor: '#f2f1f1',
                  color: '#000033',
                }}
              />
            </div>
            <a
              href={ctaUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white rounded-[20px] transition-all duration-300 hover:scale-[1.02] shadow-lg whitespace-nowrap"
              style={{
                backgroundColor: accentLight,
                boxShadow: `0 8px 20px ${accentLight}35`,
              }}
            >
              Subscribe
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="py-16 lg:py-20 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'rgba(0, 0, 51, 0.95)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={footerCompanyName || coachName}
                  width={200}
                  height={200}
                  className="w-48 h-48 object-contain rounded-full mb-4"
                />
              ) : (
                <div
                  className="w-48 h-48 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <span className="text-5xl font-bold text-white">
                    {(footerCompanyName || coachName)?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {footerAddress && (
                <p className="text-white text-base leading-relaxed max-w-[200px]" style={{ fontFamily: 'Mulish, sans-serif' }}>
                  {footerAddress}
                </p>
              )}
            </div>

            {/* Quick Links Column 1 */}
            <div>
              <ul className="space-y-8">
                <li>
                  <Link href="#" className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="#about" className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/sign-in" className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            {/* Quick Links Column 2 */}
            <div>
              <ul className="space-y-8">
                <li>
                  <Link href="#services" className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                    Services
                  </Link>
                </li>
                {footerEmail && (
                  <li>
                    <a href={`mailto:${footerEmail}`} className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                      Contact
                    </a>
                  </li>
                )}
                <li>
                  <Link href="#" className="text-white text-base hover:opacity-80 transition-opacity" style={{ fontFamily: 'Mulish, sans-serif' }}>
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Social Links Column */}
            <div>
              <h4 className="text-white text-base mb-6" style={{ fontFamily: 'Mulish, sans-serif' }}>
                Connect With Us
              </h4>
              <div className="flex items-center gap-4">
                {/* Twitter/X */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                {/* Facebook */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                {/* Instagram */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                {/* LinkedIn */}
                <a
                  href="#"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="pt-8 border-t border-white/10">
            <p className="text-center text-sm text-white/70" style={{ fontFamily: 'Mulish, sans-serif' }}>
              © {footerCompanyName || coachName}. All rights reserved.
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
    'ring': '💍',
  };
  return iconMap[icon || 'star'] || '⭐';
}
