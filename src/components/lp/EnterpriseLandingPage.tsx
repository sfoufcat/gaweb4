'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useSpring, useInView } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import {
  ArrowRight,
  Check,
  X,
  ChevronDown,
  Users,
  Zap,
  Target,
  BarChart3,
  MessageSquare,
  Video,
  Flame,
  Clock,
  Star,
  Sparkles,
  Play,
  Quote,
} from 'lucide-react';
import { CoachQuizModal } from './CoachQuizModal';

// ============================================================================
// CONSTANTS
// ============================================================================

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70';

const TRUST_LOGOS = [
  {
    name: 'ICF',
    logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo1.png?alt=media&token=7334b9b8-3373-4916-83ec-df92eb5e9332',
    className: 'h-full w-auto object-contain grayscale opacity-40 hover:opacity-100 transition-all duration-500 mix-blend-multiply dark:mix-blend-screen dark:invert'
  },
  { name: 'iPEC', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo2.png?alt=media&token=fac36442-711e-4e77-a089-f6b27c5cc74b' },
  { name: 'CTI', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo3.png?alt=media&token=51e99040-6b73-4c0e-9436-50bc5aeda615' },
  { name: 'Health Coach Institute', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo4.png?alt=media&token=5efc6eb5-6642-47a1-b83a-b98e6341be14' },
];

const STATS = [
  { value: '500+', label: 'Active Coaches', suffix: '' },
  { value: '85', label: 'Client Retention', suffix: '%' },
  { value: '10', label: 'Minute Setup', suffix: 'min' },
  { value: '4.9', label: 'Coach Rating', suffix: '/5' },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Alignment Scores',
    description: 'Real-time engagement metrics. See exactly who\'s doing the work.',
    color: '#8B5CF6',
  },
  {
    icon: Target,
    title: 'Daily Focus',
    description: 'Clients commit to 3 tasks every morning. You see completion rates.',
    color: '#10B981',
  },
  {
    icon: Flame,
    title: 'Habit Tracking',
    description: 'Custom frequencies, streaks, momentum. Consistency made visible.',
    color: '#F59E0B',
  },
  {
    icon: Users,
    title: 'Squad Pods',
    description: 'Accountability groups of 8-12. Peer pressure that works.',
    color: '#3B82F6',
  },
  {
    icon: MessageSquare,
    title: 'Integrated Chat',
    description: '1:1 and group messaging. Everything in one place.',
    color: '#EC4899',
  },
  {
    icon: Video,
    title: 'Video Sessions',
    description: 'Call clients directly. Notes, recordings, all included.',
    color: '#06B6D4',
  },
];

const TESTIMONIALS = [
  {
    quote: "I had 40 clients in a Circle community. 12 were active. I moved to Coachful. Now I can see exactly who's doing the work. My renewal rate went from 60% to 85%.",
    name: 'David L.',
    title: 'Executive Coach',
    metric: '85%',
    metricLabel: 'renewal rate',
  },
  {
    quote: "Skool was great for building an audience. But my PAID clients? They got lost in the noise. Coachful separates the two. My premium clients get accountability.",
    name: 'Jen T.',
    title: 'Business Coach',
    metric: '2x',
    metricLabel: 'premium focus',
  },
  {
    quote: "The Alignment Score changed everything. My clients actually compete to have the highest score. I've never seen this level of engagement.",
    name: 'Marcus W.',
    title: 'Fitness Coach',
    metric: '3x',
    metricLabel: 'engagement',
  },
];

const COMPARISON = [
  { feature: 'Community feed', skool: true, circle: true, coachful: true },
  { feature: 'Course hosting', skool: true, circle: true, coachful: true },
  { feature: 'Daily task commitments', skool: false, circle: false, coachful: true },
  { feature: 'Habit tracking + streaks', skool: false, circle: false, coachful: true },
  { feature: 'Alignment score', skool: false, circle: false, coachful: true },
  { feature: 'Squad accountability', skool: false, circle: false, coachful: true },
  { feature: 'Coach dashboard', skool: false, circle: false, coachful: true },
  { feature: 'Built-in video calls', skool: false, circle: false, coachful: true },
];

const PRICING = [
  {
    name: 'Starter',
    monthlyPrice: 49,
    annualPrice: 29,
    description: 'For coaches starting out',
    clients: 15,
    features: ['Check-ins + accountability', 'Tasks + habits', 'Chat + video', 'Payments'],
  },
  {
    name: 'Pro',
    monthlyPrice: 129,
    annualPrice: 76,
    description: 'For growing businesses',
    clients: 150,
    features: ['Everything in Starter', 'Custom domain', 'White labeling', 'Advanced funnels'],
    popular: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 299,
    annualPrice: 176,
    description: 'For established operations',
    clients: 500,
    features: ['Everything in Pro', 'Team roles', 'Multi-coach', 'AI Builder'],
  },
];

const FAQ = [
  { q: 'Can I migrate from Skool/Circle?', a: 'Yes. Invite via email or link. Bulk import available.' },
  { q: 'Do I need to stop using Skool?', a: 'No. Many coaches use Skool for free community and Coachful for paid clients.' },
  { q: 'What if clients don\'t log in?', a: 'Their Alignment Score drops. You catch disengagement before they churn.' },
  { q: 'Can I white-label?', a: 'Yes. Custom domain on Pro. Full brand customization on all plans.' },
  { q: 'Works for 1:1 coaching?', a: 'Perfect for both. Daily Focus and Habits work for 1:1. Squads optional.' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function EnterpriseLandingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [quizOpen, setQuizOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' });

  const { scrollYProgress } = useScroll();
  useSpring(scrollYProgress, { stiffness: 100, damping: 30 }); // Smooth scroll tracking

  // Mouse tracking for hero
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCTA = () => {
    if (user) {
      router.push('/coach');
    } else {
      setQuizOpen(true);
    }
  };

  return (
    <>
      {/* Critical Styles */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600;700&display=swap');

        .font-display { font-family: 'Fraunces', Georgia, serif; }
        .font-body { font-family: 'DM Sans', system-ui, sans-serif; }

        main { padding-left: 0 !important; }
        body[data-layout="with-sidebar"] main { padding-left: 0 !important; }
        html { scroll-behavior: smooth; }

        /* Noise overlay */
        .noise {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }
        .dark .noise { opacity: 0.04; }

        /* Gradient text animation */
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 4s ease infinite;
        }

        /* Glow effect */
        .glow {
          box-shadow: 0 0 60px -10px var(--brand-accent-light, #a07855);
        }
        .dark .glow {
          box-shadow: 0 0 60px -10px var(--brand-accent-dark, #b8896a);
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(160, 120, 85, 0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(160, 120, 85, 0.5); }

        /* Selection */
        ::selection { background: rgba(160, 120, 85, 0.3); }
      `}</style>

      {/* Noise */}
      <div className="noise" />

      {/* Background */}
      <div className="fixed inset-0 bg-[#FAF9F7] dark:bg-[#09090B] -z-20" />

      {/* Gradient mesh background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div
          className="absolute w-[800px] h-[800px] rounded-full opacity-30 dark:opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(160,120,85,0.4) 0%, transparent 70%)',
            top: '-20%',
            right: '-10%',
            transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 dark:opacity-10 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
            bottom: '10%',
            left: '-5%',
            transform: `translate(${mousePosition.x * -0.3}px, ${mousePosition.y * -0.3}px)`,
            transition: 'transform 0.3s ease-out',
          }}
        />
      </div>

      <div className="relative min-h-screen font-body text-[#1a1a1a] dark:text-[#fafafa]">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="fixed top-0 left-0 right-0 z-50 p-4"
        >
          <nav className="max-w-6xl mx-auto px-6 py-3 rounded-2xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-black/5 dark:border-white/10">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="relative w-9 h-9 rounded-xl overflow-hidden">
                  <Image src={LOGO_URL} alt="Coachful" fill className="object-cover" unoptimized />
                </div>
                <span className="font-display text-lg font-semibold tracking-tight">Coachful</span>
              </Link>

              <div className="hidden md:flex items-center gap-8">
                {['Features', 'Pricing', 'FAQ'].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="text-sm font-medium text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {item}
                  </a>
                ))}
              </div>

              <motion.button
                onClick={handleCTA}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-5 py-2 bg-[#1a1a1a] dark:bg-white text-white dark:text-black rounded-full text-sm font-semibold"
              >
                Start Free
              </motion.button>
            </div>
          </nav>
        </motion.header>

        {/* ================================================================ */}
        {/* HERO */}
        {/* ================================================================ */}
        <section ref={heroRef} className="relative min-h-screen flex flex-col justify-center pt-28 pb-20 px-4 overflow-hidden">
          {/* Floating elements */}
          <motion.div
            className="absolute top-32 right-[15%] w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20"
            animate={{
              y: [0, -15, 0],
              rotate: [0, 5, 0],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-40 left-[10%] w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20"
            animate={{
              y: [0, 20, 0],
              rotate: [0, -8, 0],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          />
          <motion.div
            className="absolute top-1/2 right-[8%] w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20"
            animate={{
              y: [0, 12, 0],
              x: [0, -8, 0],
            }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />

          <div className="max-w-5xl mx-auto text-center relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-accent/10 border border-brand-accent/20 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
              </span>
              <span className="text-sm font-medium text-brand-accent">500+ coaches trust Coachful</span>
            </motion.div>

            {/* Headline */}
            <div className="mb-8">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight leading-[1.05] mb-4"
              >
                Finally, Proof
              </motion.h1>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-semibold tracking-tight leading-[1.05]"
              >
                <span className="bg-gradient-to-r from-brand-accent via-[#c9956d] to-brand-accent bg-clip-text text-transparent animate-gradient">
                  Your Coaching Works.
                </span>
              </motion.h1>
            </div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="text-lg sm:text-xl text-black/60 dark:text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              The only coaching platform where clients don't just listen—they{' '}
              <span className="text-black dark:text-white font-semibold">do</span>. Track habits,
              daily commitments, and accountability scores.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10"
            >
              <motion.button
                onClick={handleCTA}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative px-8 py-4 bg-brand-accent text-white rounded-full text-lg font-semibold overflow-hidden glow"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start 7-Day Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </motion.button>

              <a
                href="https://demo.coachful.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-4 text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white font-medium transition-colors group"
              >
                <div className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center group-hover:bg-black/10 dark:group-hover:bg-white/20 transition-colors">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
                Watch Demo
              </a>
            </motion.div>

            {/* Trust logos */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="flex flex-wrap items-center justify-center gap-8 sm:gap-12"
            >
              {TRUST_LOGOS.map((logo) => (
                <div key={logo.name} className="h-8 sm:h-10">
                  <Image
                    src={logo.logo}
                    alt={logo.name}
                    width={100}
                    height={40}
                    className={logo.className || "h-full w-auto object-contain grayscale opacity-40 hover:opacity-100 transition-all duration-500 dark:brightness-0 dark:invert"}
                    unoptimized
                  />
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-6xl mx-auto mt-20 px-4"
            style={{ perspective: '2000px' }}
          >
            <motion.div
              className="relative"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${mousePosition.y * 0.1}deg) rotateY(${mousePosition.x * -0.1}deg)`,
                transition: 'transform 0.1s ease-out',
              }}
            >
              {/* Glow */}
              <div className="absolute -inset-8 bg-gradient-to-r from-brand-accent/30 via-purple-500/20 to-brand-accent/30 rounded-3xl blur-3xl opacity-50" />

              {/* Browser frame */}
              <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden">
                {/* Chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#f5f5f5] dark:bg-[#0f0f0f] border-b border-black/5 dark:border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 bg-white dark:bg-black/50 rounded-lg text-xs text-black/50 dark:text-white/50 font-mono">
                      yourname.coachful.co
                    </div>
                  </div>
                </div>

                {/* Screenshot */}
                <div className="relative aspect-[16/9]">
                  <Image
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcoachdash.png?alt=media&token=ef410083-561e-4594-9381-aa604d04a490"
                    alt="Coach Dashboard"
                    fill
                    className="object-cover object-top dark:hidden"
                    unoptimized
                    priority
                  />
                  <Image
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcoachdashdark.png?alt=media&token=8fd12376-9f03-4a85-9033-03eec00ae1fa"
                    alt="Coach Dashboard"
                    fill
                    className="object-cover object-top hidden dark:block"
                    unoptimized
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* ================================================================ */}
        {/* STATS */}
        {/* ================================================================ */}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative p-6 md:p-8 text-center">
                    <div className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
                      {stat.value}
                      <span className="text-brand-accent">{stat.suffix}</span>
                    </div>
                    <div className="text-sm text-black/50 dark:text-white/50 mt-2">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PROBLEM */}
        {/* ================================================================ */}
        <section className="py-24 px-4">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
                <X className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">The Problem</span>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                You've Tried the Alternatives
              </h2>
              <p className="text-lg text-black/50 dark:text-white/50">
                Community isn't accountability. Here's what you're experiencing.
              </p>
            </motion.div>

            {/* Problem cards - asymmetric layout */}
            <div className="grid md:grid-cols-12 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:col-span-7 p-8 bg-white dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <X className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">Skool / Circle</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    'Community is "active" but clients aren\'t changing',
                    '60%+ are lurkers who never post',
                    'Can\'t track who\'s implementing',
                    'No way to prove ROI',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-black/60 dark:text-white/60">
                      <X className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="md:col-span-5 p-8 bg-white dark:bg-white/5 rounded-3xl border border-black/5 dark:border-white/10 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <X className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="font-display text-xl font-semibold">DIY Tools</h3>
                </div>
                <ul className="space-y-3">
                  {[
                    'Notion/Docs — a scattered mess',
                    'Clients "forget" to update',
                    'No streaks or accountability',
                    'Looks unprofessional',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-black/60 dark:text-white/60">
                      <X className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Callout */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="mt-12 text-center"
            >
              <div className="inline-block px-8 py-5 bg-gradient-to-r from-brand-accent/5 via-brand-accent/10 to-brand-accent/5 rounded-2xl border border-brand-accent/20">
                <p className="font-display text-xl sm:text-2xl font-semibold">
                  The problem isn't your clients.{' '}
                  <span className="bg-gradient-to-r from-brand-accent to-[#c9956d] bg-clip-text text-transparent">
                    It's your tools.
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SOLUTION - BEFORE/AFTER */}
        {/* ================================================================ */}
        <section className="py-24 px-4 bg-[#f5f4f2] dark:bg-white/[0.02]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">The Solution</span>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                Accountability That Scales
              </h2>
              <p className="text-lg text-black/50 dark:text-white/50">
                One platform built for results, not vanity metrics.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Before */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="p-8 bg-red-50 dark:bg-red-950/20 rounded-3xl border border-red-200/50 dark:border-red-900/30"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-red-500" />
                  <span className="font-display text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                    Your typical Monday
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Check Slack for client messages',
                    'Text 5 quiet clients',
                    'Update Notion tracker',
                    'Scroll community for engagement',
                    'Prep for calls you\'re dreading',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-red-700 dark:text-red-300 text-sm">
                      <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-6 border-t border-red-200/50 dark:border-red-900/30">
                  <span className="font-display text-4xl font-semibold text-red-600 dark:text-red-400">3-4h</span>
                  <span className="text-red-500 ml-2 text-sm">admin work</span>
                </div>
              </motion.div>

              {/* After */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-3xl border border-emerald-200/50 dark:border-emerald-900/30"
              >
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-5 h-5 text-emerald-500" />
                  <span className="font-display text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    With Coachful
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Open dashboard — see all 24 clients',
                    'Sarah: 94 alignment, 18-day streak',
                    'Mike: 41 — quick DM check-in',
                    'Squad Alpha: 78% Daily Focus',
                    '2 calls with prepared clients',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="pt-6 border-t border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="font-display text-4xl font-semibold text-emerald-600 dark:text-emerald-400">10min</span>
                  <span className="text-emerald-500 ml-2 text-sm">and done</span>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FEATURES */}
        {/* ================================================================ */}
        <section id="features" ref={featuresRef} className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                <span className="text-xs font-semibold text-brand-accent uppercase tracking-wider">Features</span>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                Everything You Need
              </h2>
              <p className="text-lg text-black/50 dark:text-white/50">
                Built for coaches who want transformation, not just community.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="group relative p-6 bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 hover:border-brand-accent/30 transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${feature.color}15` }}
                  >
                    <feature.icon className="w-6 h-6" style={{ color: feature.color }} />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-black/50 dark:text-white/50 leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* TESTIMONIALS */}
        {/* ================================================================ */}
        <section className="py-24 px-4 bg-[#f5f4f2] dark:bg-white/[0.02]">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 mb-6">
                <Star className="w-3.5 h-3.5 text-brand-accent" />
                <span className="text-xs font-semibold text-brand-accent uppercase tracking-wider">Testimonials</span>
              </div>
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight">
                Coaches Who Switched
              </h2>
            </motion.div>

            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTestimonial}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="bg-white dark:bg-white/5 rounded-3xl p-8 md:p-12 border border-black/5 dark:border-white/10"
                >
                  <Quote className="w-10 h-10 text-brand-accent/30 mb-6" />

                  <blockquote className="font-display text-xl sm:text-2xl leading-relaxed mb-8">
                    "{TESTIMONIALS[activeTestimonial].quote}"
                  </blockquote>

                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-brand-accent/70 flex items-center justify-center text-white font-semibold">
                        {TESTIMONIALS[activeTestimonial].name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold">{TESTIMONIALS[activeTestimonial].name}</p>
                        <p className="text-sm text-black/50 dark:text-white/50">{TESTIMONIALS[activeTestimonial].title}</p>
                      </div>
                    </div>
                    <div className="px-4 py-2 bg-emerald-500/10 rounded-full">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {TESTIMONIALS[activeTestimonial].metric} {TESTIMONIALS[activeTestimonial].metricLabel}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Dots */}
              <div className="flex justify-center gap-2 mt-8">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === activeTestimonial ? 'w-8 bg-brand-accent' : 'w-2 bg-black/20 dark:bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* COMPARISON */}
        {/* ================================================================ */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                Why Coaches Switch
              </h2>
              <p className="text-lg text-black/50 dark:text-white/50">
                They track community. We track transformation.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden"
            >
              {/* Header */}
              <div className="grid grid-cols-4 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="p-4 md:p-5 font-semibold text-sm">Feature</div>
                <div className="p-4 md:p-5 text-center text-sm text-black/50 dark:text-white/50">Skool</div>
                <div className="p-4 md:p-5 text-center text-sm text-black/50 dark:text-white/50">Circle</div>
                <div className="p-4 md:p-5 text-center bg-brand-accent/5">
                  <Image src={LOGO_URL} alt="Coachful" width={24} height={24} className="mx-auto rounded" unoptimized />
                </div>
              </div>

              {/* Rows */}
              {COMPARISON.map((row, i) => (
                <div key={i} className="grid grid-cols-4 border-t border-black/5 dark:border-white/5">
                  <div className="p-4 md:p-5 text-sm">{row.feature}</div>
                  <div className="p-4 md:p-5 flex justify-center">
                    {row.skool ? <Check className="w-5 h-5 text-emerald-500" /> : <X className="w-5 h-5 text-black/20 dark:text-white/20" />}
                  </div>
                  <div className="p-4 md:p-5 flex justify-center">
                    {row.circle ? <Check className="w-5 h-5 text-emerald-500" /> : <X className="w-5 h-5 text-black/20 dark:text-white/20" />}
                  </div>
                  <div className="p-4 md:p-5 flex justify-center bg-brand-accent/5">
                    {row.coachful ? <Check className="w-5 h-5 text-brand-accent" /> : <X className="w-5 h-5 text-black/20 dark:text-white/20" />}
                  </div>
                </div>
              ))}

              {/* Pricing row */}
              <div className="grid grid-cols-4 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="p-4 md:p-5 font-semibold text-sm">Starting price</div>
                <div className="p-4 md:p-5 text-center text-sm text-black/50 dark:text-white/50">$99/mo</div>
                <div className="p-4 md:p-5 text-center text-sm text-black/50 dark:text-white/50">$89/mo</div>
                <div className="p-4 md:p-5 text-center font-bold text-brand-accent bg-brand-accent/5">$49/mo</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* PRICING */}
        {/* ================================================================ */}
        <section id="pricing" className="py-24 px-4 bg-[#f5f4f2] dark:bg-white/[0.02]">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                Simple Pricing
              </h2>
              <p className="text-lg text-black/50 dark:text-white/50">
                7-day free trial. Cancel anytime.
              </p>
            </motion.div>

            {/* Toggle */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center p-1 bg-white dark:bg-white/5 rounded-full border border-black/5 dark:border-white/10">
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                    billingPeriod === 'annual' ? 'text-white' : 'text-black/50 dark:text-white/50'
                  }`}
                >
                  {billingPeriod === 'annual' && (
                    <motion.div layoutId="billing" className="absolute inset-0 bg-black dark:bg-white rounded-full" />
                  )}
                  <span className="relative">Annual</span>
                </button>
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                    billingPeriod === 'monthly' ? 'text-white dark:text-black' : 'text-black/50 dark:text-white/50'
                  }`}
                >
                  {billingPeriod === 'monthly' && (
                    <motion.div layoutId="billing" className="absolute inset-0 bg-black dark:bg-white rounded-full" />
                  )}
                  <span className="relative">Monthly</span>
                </button>
                <AnimatePresence>
                  {billingPeriod === 'annual' && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto', marginLeft: 8 }}
                      exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                      className="px-2 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full overflow-hidden"
                    >
                      -41%
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              {PRICING.map((plan, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-3 py-1 bg-brand-accent text-white text-xs font-bold rounded-full">
                        Popular
                      </span>
                    </div>
                  )}

                  <div className={`h-full p-6 bg-white dark:bg-white/5 rounded-2xl border ${
                    plan.popular ? 'border-brand-accent glow' : 'border-black/5 dark:border-white/10'
                  }`}>
                    <div className="mb-4">
                      <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                      <p className="text-sm text-black/50 dark:text-white/50">{plan.description}</p>
                    </div>

                    <div className="mb-1">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={billingPeriod}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="font-display text-4xl font-semibold"
                        >
                          ${billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-black/50 dark:text-white/50">/mo</span>
                    </div>
                    <p className="text-xs text-red-500 font-medium mb-6">Free for 7 days</p>

                    <div className="py-4 border-y border-black/5 dark:border-white/5 mb-6">
                      <span className="text-2xl font-semibold">{plan.clients}</span>
                      <span className="text-sm text-black/50 dark:text-white/50 ml-1">clients</span>
                    </div>

                    <ul className="space-y-2 mb-6">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-black/60 dark:text-white/60">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <motion.button
                      onClick={handleCTA}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3 rounded-full text-sm font-semibold ${
                        plan.popular
                          ? 'bg-brand-accent text-white'
                          : 'bg-black dark:bg-white text-white dark:text-black'
                      }`}
                    >
                      Start free trial
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FAQ */}
        {/* ================================================================ */}
        <section id="faq" className="py-24 px-4">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight mb-4">
                Questions?
              </h2>
            </motion.div>

            <div className="space-y-3">
              {FAQ.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="font-medium pr-4">{item.q}</span>
                    <ChevronDown className={`w-5 h-5 text-black/30 dark:text-white/30 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 text-sm text-black/60 dark:text-white/60">{item.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FINAL CTA */}
        {/* ================================================================ */}
        <section className="py-24 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl bg-[#1a1a1a] dark:bg-white/5 p-12 md:p-20 text-center"
            >
              {/* Glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-brand-accent/30 rounded-full blur-[100px]" />

              <div className="relative">
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-6 leading-tight">
                  Your Clients Are Waiting
                  <br />
                  <span className="text-brand-accent">to Be Held Accountable.</span>
                </h2>

                <p className="text-white/60 max-w-lg mx-auto mb-10">
                  Stop guessing. Start delivering. Set up in 10 minutes.
                </p>

                <motion.button
                  onClick={handleCTA}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-brand-accent text-white rounded-full text-lg font-semibold glow"
                >
                  Start Your 7-Day Trial
                  <ArrowRight className="w-5 h-5" />
                </motion.button>

                <p className="text-white/40 text-sm mt-6">Cancel anytime • No credit card required</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER */}
        {/* ================================================================ */}
        <footer className="py-12 px-4 border-t border-black/5 dark:border-white/5">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                <Image src={LOGO_URL} alt="Coachful" fill className="object-cover" unoptimized />
              </div>
              <span className="font-display text-lg font-semibold">Coachful</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-black/50 dark:text-white/50">
              <Link href="/privacy" className="hover:text-black dark:hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-black dark:hover:text-white transition-colors">Terms</Link>
              <a href="mailto:support@coachful.co" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
            </div>

            <p className="text-sm text-black/40 dark:text-white/40">
              © 2025 Coachful
            </p>
          </div>
        </footer>
      </div>

      <CoachQuizModal isOpen={quizOpen} onClose={() => setQuizOpen(false)} />
    </>
  );
}
