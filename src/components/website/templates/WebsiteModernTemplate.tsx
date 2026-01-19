'use client';

import React from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Check, ChevronDown, Star, Sparkles, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WebsiteTemplateProps } from './types';

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeInLeft = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const fadeInRight = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

/**
 * Modern Website Template
 *
 * Bold, contemporary design with:
 * - Split-screen two-column hero
 * - Geometric shapes and gradients
 * - Large typography with strong contrast
 * - Horizontal scrolling testimonials
 * - Modern card designs with glassmorphism
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
  accentLight = '#6366f1',
  accentDark = '#4f46e5',
  onServiceClick,
}: WebsiteTemplateProps) {
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(null);
  const heroRef = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const heroImageY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const heroTextY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <div className="w-full overflow-x-hidden">
      {/* Hero Section - Two Column Split */}
      <section ref={heroRef} className="relative min-h-screen flex items-stretch overflow-hidden">
        {/* Left Column - Content */}
        <div className="relative z-10 w-full lg:w-1/2 flex items-center bg-white dark:bg-[#0a0c10]">
          {/* Decorative gradient blob */}
          <div
            className="absolute top-20 -left-20 w-80 h-80 rounded-full blur-3xl opacity-30"
            style={{ background: `radial-gradient(circle, ${accentLight}50, transparent 70%)` }}
          />

          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            style={{ y: heroTextY }}
            className="relative px-8 lg:px-16 xl:px-24 py-16 max-w-2xl"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-medium"
              style={{
                backgroundColor: `${accentLight}15`,
                color: accentLight
              }}
            >
              <Sparkles className="w-4 h-4" />
              Transform Your Life Today
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black tracking-tight text-[#1a1a1a] dark:text-white mb-6 leading-[1.1]"
            >
              {headline}
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl text-[#5f5a55] dark:text-[#b2b6c2] mb-10 leading-relaxed"
            >
              {subheadline}
            </motion.p>

            <motion.div variants={fadeInUp} className="flex flex-wrap gap-4">
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-3 px-8 py-4 text-lg font-bold text-white rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
                style={{
                  background: `linear-gradient(135deg, ${accentLight} 0%, ${accentDark} 100%)`,
                }}
              >
                {ctaText}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
              <button
                className="inline-flex items-center gap-3 px-6 py-4 text-lg font-semibold text-[#1a1a1a] dark:text-white rounded-xl border-2 border-[#e1ddd8] dark:border-[#262b35] hover:border-[#5f5a55] dark:hover:border-[#5f5a55] transition-all duration-300"
              >
                <Play className="w-5 h-5" style={{ color: accentLight }} />
                Watch Video
              </button>
            </motion.div>

            {/* Social Proof Mini */}
            {testimonials.length > 0 && (
              <motion.div variants={fadeInUp} className="mt-12 flex items-center gap-4">
                <div className="flex -space-x-3">
                  {testimonials.slice(0, 4).map((t, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-white dark:border-[#0a0c10] flex items-center justify-center text-white text-sm font-semibold"
                      style={{
                        backgroundColor: `hsl(${(i * 60 + 200) % 360}, 70%, 50%)`,
                        zIndex: 4 - i
                      }}
                    >
                      {t.author.charAt(0)}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-[#5f5a55] dark:text-[#7d8190]">
                    Loved by <span className="font-semibold text-[#1a1a1a] dark:text-white">{testimonials.length * 50}+</span> clients
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Right Column - Image */}
        <motion.div
          className="hidden lg:block w-1/2 relative"
          style={{ y: heroImageY }}
        >
          {heroImageUrl ? (
            <Image
              src={heroImageUrl}
              alt="Hero"
              fill
              className="object-cover"
              priority
            />
          ) : coachImageUrl ? (
            <Image
              src={coachImageUrl}
              alt={coachName}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${accentLight}30 0%, ${accentDark}50 100%)`,
              }}
            >
              {/* Decorative geometric shapes */}
              <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full border-4 opacity-20" style={{ borderColor: accentLight }} />
              <div className="absolute bottom-1/3 right-1/4 w-60 h-60 rounded-3xl rotate-12 opacity-15" style={{ backgroundColor: accentDark }} />
              <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-lg -rotate-12 opacity-20" style={{ backgroundColor: accentLight }} />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-white/20 dark:to-[#0a0c10]/20" />
        </motion.div>
      </section>

      {/* Stats/Trust Bar */}
      <section className="py-12 border-y border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#0a0c10]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '500+', label: 'Clients Transformed' },
              { value: '10+', label: 'Years Experience' },
              { value: '98%', label: 'Success Rate' },
              { value: '4.9', label: 'Average Rating' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <p
                  className="text-3xl md:text-4xl font-black mb-1"
                  style={{ color: accentLight }}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-[#5f5a55] dark:text-[#7d8190]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About/Coach Section - Reversed Layout */}
      {(coachBio || credentials.length > 0) && (
        <section className="py-24 lg:py-32 bg-[#faf8f6] dark:bg-[#05070b]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="grid lg:grid-cols-2 gap-16 items-center"
            >
              {/* Coach Info - Left */}
              <motion.div variants={fadeInLeft} className="order-2 lg:order-1 space-y-8">
                <div>
                  <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium"
                    style={{
                      backgroundColor: `${accentLight}15`,
                      color: accentLight
                    }}
                  >
                    {coachHeadline || 'Your Coach'}
                  </motion.div>
                  <h2 className="text-4xl sm:text-5xl font-black text-[#1a1a1a] dark:text-white mb-6">
                    Hi, I'm {coachName}
                  </h2>
                  <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed whitespace-pre-line">
                    {coachBio}
                  </p>
                </div>

                {credentials.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {credentials.map((credential, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-[#0a0c10] border border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${accentLight}15` }}
                        >
                          <Check className="w-5 h-5" style={{ color: accentLight }} />
                        </div>
                        <span className="text-sm font-medium text-[#1a1a1a] dark:text-[#e5e5e5]">
                          {credential}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Coach Image - Right */}
              <motion.div variants={fadeInRight} className="order-1 lg:order-2 relative">
                {coachImageUrl ? (
                  <div className="relative">
                    <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
                      <Image
                        src={coachImageUrl}
                        alt={coachName}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {/* Decorative elements */}
                    <div
                      className="absolute -top-6 -right-6 w-24 h-24 rounded-2xl -z-10"
                      style={{ backgroundColor: `${accentLight}30` }}
                    />
                    <div
                      className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full -z-10"
                      style={{ backgroundColor: `${accentDark}20` }}
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-square rounded-3xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}20 0%, ${accentDark}30 100%)`
                    }}
                  >
                    <span className="text-9xl font-black" style={{ color: accentLight }}>
                      {coachName.charAt(0)}
                    </span>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Services Section - Bento Grid Style */}
      {services.length > 0 && (
        <section className="py-24 lg:py-32 bg-white dark:bg-[#0a0c10]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="mb-16"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium"
                style={{
                  backgroundColor: `${accentLight}15`,
                  color: accentLight
                }}
              >
                Services
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1a1a1a] dark:text-white max-w-3xl"
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
                    "group relative p-8 rounded-3xl cursor-pointer transition-all duration-300",
                    "bg-[#faf8f6] dark:bg-[#05070b]",
                    "hover:shadow-2xl",
                    index === 0 && services.length > 2 ? "lg:col-span-2 lg:row-span-2" : ""
                  )}
                  onClick={() => onServiceClick?.(service)}
                >
                  {/* Gradient border on hover */}
                  <div
                    className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                    style={{
                      padding: '2px',
                      background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
                    }}
                  />

                  {/* Icon */}
                  <div
                    className={cn(
                      "rounded-2xl flex items-center justify-center mb-6",
                      index === 0 && services.length > 2 ? "w-20 h-20" : "w-14 h-14"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${accentLight}20, ${accentDark}20)`
                    }}
                  >
                    <span className={index === 0 && services.length > 2 ? "text-4xl" : "text-2xl"}>
                      {getServiceIcon(service.icon)}
                    </span>
                  </div>

                  <h3 className={cn(
                    "font-bold text-[#1a1a1a] dark:text-white mb-3",
                    index === 0 && services.length > 2 ? "text-2xl lg:text-3xl" : "text-xl"
                  )}>
                    {service.title}
                  </h3>
                  <p className={cn(
                    "text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed",
                    index === 0 && services.length > 2 ? "text-lg" : ""
                  )}>
                    {service.description}
                  </p>

                  <div className="mt-6 flex items-center gap-2 font-semibold" style={{ color: accentLight }}>
                    <span>Learn more</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Testimonials - Horizontal Scroll Cards */}
      {testimonials.length > 0 && (
        <section className="py-24 lg:py-32 bg-[#faf8f6] dark:bg-[#05070b] overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 mb-12">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium"
                style={{
                  backgroundColor: `${accentLight}15`,
                  color: accentLight
                }}
              >
                Testimonials
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1a1a1a] dark:text-white"
              >
                Real stories, real results
              </motion.h2>
            </motion.div>
          </div>

          <div className="relative">
            <motion.div
              initial={{ x: 0 }}
              animate={{ x: '-50%' }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
              className="flex gap-6 w-max"
            >
              {[...testimonials, ...testimonials].map((testimonial, index) => (
                <div
                  key={index}
                  className="w-[400px] flex-shrink-0 bg-white dark:bg-[#0a0c10] rounded-3xl p-8 border border-[#e1ddd8] dark:border-[#262b35]"
                >
                  {/* Rating */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-5 h-5",
                          i < (testimonial.rating || 5) ? "fill-amber-400 text-amber-400" : "text-gray-300"
                        )}
                      />
                    ))}
                  </div>

                  <p className="text-[#1a1a1a] dark:text-[#e5e5e5] text-lg leading-relaxed mb-6">
                    "{testimonial.text}"
                  </p>

                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`
                      }}
                    >
                      {testimonial.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-[#1a1a1a] dark:text-white">
                        {testimonial.author}
                      </p>
                      {testimonial.role && (
                        <p className="text-sm text-[#5f5a55] dark:text-[#7d8190]">
                          {testimonial.role}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="py-24 lg:py-32 bg-white dark:bg-[#0a0c10]">
          <div className="max-w-4xl mx-auto px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 text-sm font-medium"
                style={{
                  backgroundColor: `${accentLight}15`,
                  color: accentLight
                }}
              >
                FAQ
              </motion.div>
              <motion.h2
                variants={fadeInUp}
                className="text-4xl sm:text-5xl font-black text-[#1a1a1a] dark:text-white"
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
                    "rounded-2xl overflow-hidden transition-all duration-300",
                    openFaqIndex === index
                      ? "bg-gradient-to-r shadow-lg"
                      : "bg-[#faf8f6] dark:bg-[#05070b]"
                  )}
                  style={openFaqIndex === index ? {
                    background: `linear-gradient(135deg, ${accentLight}10, ${accentDark}10)`
                  } : {}}
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-6 text-left"
                  >
                    <span className="text-lg font-bold text-[#1a1a1a] dark:text-white pr-4">
                      {faq.question}
                    </span>
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                        openFaqIndex === index ? "" : ""
                      )}
                      style={{ backgroundColor: `${accentLight}20` }}
                    >
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 transition-transform duration-300",
                          openFaqIndex === index ? "rotate-180" : ""
                        )}
                        style={{ color: accentLight }}
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
                    <p className="px-6 pb-6 text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed text-lg">
                      {faq.answer}
                    </p>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}

      {/* Bottom CTA - Glassmorphism Card */}
      <section className="py-24 lg:py-32 relative overflow-hidden">
        {/* Background with mesh gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 20% 50%, ${accentLight}20 0%, transparent 50%),
              radial-gradient(circle at 80% 50%, ${accentDark}20 0%, transparent 50%),
              linear-gradient(180deg, #faf8f6 0%, #fff 100%)
            `,
          }}
        />
        <div
          className="absolute inset-0 dark:block hidden"
          style={{
            background: `
              radial-gradient(circle at 20% 50%, ${accentLight}10 0%, transparent 50%),
              radial-gradient(circle at 80% 50%, ${accentDark}10 0%, transparent 50%),
              linear-gradient(180deg, #05070b 0%, #0a0c10 100%)
            `,
          }}
        />

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={stagger}
          className="relative z-10 max-w-5xl mx-auto px-6"
        >
          <motion.div
            variants={fadeInUp}
            className="rounded-[2rem] p-12 lg:p-16 text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accentLight}, ${accentDark})`,
            }}
          >
            {/* Decorative shapes */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl" />

            <motion.h2
              variants={fadeInUp}
              className="relative text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-6"
            >
              Ready to start your journey?
            </motion.h2>
            <motion.p
              variants={fadeInUp}
              className="relative text-xl text-white/90 mb-10 max-w-2xl mx-auto"
            >
              Join hundreds of others who have transformed their lives. Your success story starts here.
            </motion.p>
            <motion.div variants={fadeInUp} className="relative">
              <a
                href={ctaUrl}
                className="inline-flex items-center gap-3 px-10 py-5 text-lg font-bold rounded-2xl bg-white transition-all duration-300 hover:scale-105 hover:shadow-2xl group"
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
