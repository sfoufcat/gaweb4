'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
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
  TrendingUp,
  Shield,
  Globe,
  Play,
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
    className: 'h-full w-auto object-contain grayscale opacity-50 hover:opacity-100 transition-opacity mix-blend-multiply dark:mix-blend-screen dark:invert'
  },
  { name: 'iPEC', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo2.png?alt=media&token=fac36442-711e-4e77-a089-f6b27c5cc74b' },
  { name: 'CTI', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo3.png?alt=media&token=51e99040-6b73-4c0e-9436-50bc5aeda615' },
  { name: 'Health Coach Institute', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo4.png?alt=media&token=5efc6eb5-6642-47a1-b83a-b98e6341be14' },
];

const STATS = [
  { value: '500+', label: 'Active Coaches', icon: Users },
  { value: '85%', label: 'Client Retention', icon: TrendingUp },
  { value: '10min', label: 'Setup Time', icon: Clock },
  { value: '4.9/5', label: 'Coach Rating', icon: Star },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Alignment Scores',
    description: 'Real-time engagement metrics that show exactly who\'s doing the work. No more guessing.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: Target,
    title: 'Daily Focus',
    description: 'Clients commit to 3 high-impact tasks every morning. You see completion rates instantly.',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Flame,
    title: 'Habit Tracking',
    description: 'Custom frequencies, streak tracking, and momentum visualization. Consistency made visible.',
    gradient: 'from-orange-500 to-amber-600',
  },
  {
    icon: Users,
    title: 'Squad Pods',
    description: 'Small accountability groups of 8-12. Peer pressure that works. Collective momentum.',
    gradient: 'from-blue-500 to-indigo-600',
  },
  {
    icon: MessageSquare,
    title: 'Integrated Chat',
    description: '1:1 and group messaging built-in. No more scattered conversations across platforms.',
    gradient: 'from-pink-500 to-rose-600',
  },
  {
    icon: Video,
    title: 'Video Sessions',
    description: 'Call clients directly from the platform. Session notes, recordings, everything in one place.',
    gradient: 'from-cyan-500 to-blue-600',
  },
];

const TESTIMONIALS = [
  {
    quote: "I had 40 clients in a Circle community. 12 were active. I moved to Coachful. Now I can see exactly who's doing the work. My renewal rate went from 60% to 85%.",
    name: 'David L.',
    title: 'Executive Coach',
    metric: '85% renewal rate',
    avatar: 'DL',
  },
  {
    quote: "Skool was great for building an audience. But my PAID clients? They got lost in the noise. Coachful separates the two. My premium clients get accountability.",
    name: 'Jen T.',
    title: 'Business Coach',
    metric: 'Premium client focus',
    avatar: 'JT',
  },
  {
    quote: "The Alignment Score changed everything. My clients actually compete to have the highest score. I've never seen this level of engagement with any other tool.",
    name: 'Marcus W.',
    title: 'Fitness Coach',
    metric: '3x engagement',
    avatar: 'MW',
  },
];

const COMPARISON = [
  { feature: 'Community feed', skool: true, circle: true, coachful: true },
  { feature: 'Course hosting', skool: true, circle: true, coachful: true },
  { feature: 'Group chat', skool: true, circle: true, coachful: true },
  { feature: 'Daily task commitments', skool: false, circle: false, coachful: true },
  { feature: 'Habit tracking with streaks', skool: false, circle: false, coachful: true },
  { feature: 'Alignment/engagement score', skool: false, circle: false, coachful: true },
  { feature: 'Squad accountability pods', skool: false, circle: false, coachful: true },
  { feature: 'Coach dashboard overview', skool: false, circle: false, coachful: true },
  { feature: 'Built-in video calls', skool: false, circle: false, coachful: true },
];

const PRICING = [
  {
    name: 'Starter',
    monthlyPrice: 49,
    annualPrice: 29,
    description: 'For coaches just starting out',
    clients: 15,
    programs: 2,
    squads: 3,
    features: ['Check-ins + accountability', 'Tasks + habits', 'Chat + video calls', 'Stripe payments'],
    popular: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 129,
    annualPrice: 76,
    description: 'For growing coaching businesses',
    clients: 150,
    programs: 10,
    squads: 25,
    features: ['Everything in Starter', 'Custom domain', 'Email white labeling', 'Advanced funnels', 'Upsells + downsells'],
    popular: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 299,
    annualPrice: 176,
    description: 'For established operations',
    clients: 500,
    programs: 50,
    squads: 100,
    features: ['Everything in Pro', 'Team roles', 'Multi-coach support', 'AI Builder / AI Helper'],
    popular: false,
  },
];

const FAQ = [
  {
    q: 'Can I migrate my clients from Skool/Circle?',
    a: 'Yes. Invite them via email or link. They sign up and you assign them to a program or squad. Bulk import available.',
  },
  {
    q: 'Do I need to stop using Skool/Circle?',
    a: 'No. Many coaches use Skool for free community and Coachful for paid clients who need accountability.',
  },
  {
    q: 'What if my clients don\'t log in?',
    a: 'You\'ll know immediately—their Alignment Score drops. That\'s the point. Catch disengagement before they churn.',
  },
  {
    q: 'Can I white-label this as my own platform?',
    a: 'Yes. Custom domain (yourname.com) on Pro tier. Full brand customization on all plans.',
  },
  {
    q: 'What about 1:1 coaching?',
    a: 'Perfect for both. Daily Focus and Habits work for 1:1. Squads are optional. Many coaches do hybrid.',
  },
  {
    q: 'How is this different from CoachAccountable?',
    a: 'They\'re CRM/scheduling tools. We\'re a transformation platform. We track what clients DO between sessions.',
  },
];

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function AnimatedText({ children, className, delay = 0 }: { children: string; className?: string; delay?: number }) {
  const words = children.split(' ');
  return (
    <motion.span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.08,
            ease: [0.25, 0.4, 0.25, 1],
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

function GlowOrb({ className, color }: { className?: string; color: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{ background: color }}
      animate={{
        scale: [1, 1.1, 1],
        opacity: [0.3, 0.5, 0.3],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function FloatingCard({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ badge, title, subtitle }: { badge?: string; title: string; subtitle: string }) {
  return (
    <div className="text-center mb-16 md:mb-20">
      {badge && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-accent/10 border border-brand-accent/20 mb-6"
        >
          <Sparkles className="w-4 h-4 text-brand-accent" />
          <span className="text-sm font-medium text-brand-accent">{badge}</span>
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto"
      >
        {subtitle}
      </motion.p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EnterpriseLandingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [quizOpen, setQuizOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const heroOpacity = useTransform(smoothProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(smoothProgress, [0, 0.15], [1, 0.95]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 5000);
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
      {/* Google Fonts */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        .font-display {
          font-family: 'Instrument Serif', Georgia, serif;
        }
        .font-body {
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        /* Hide main layout padding */
        main { padding-left: 0 !important; transition: none !important; }
        body[data-layout="with-sidebar"] main { padding-left: 0 !important; }

        /* Smooth scrolling */
        html { scroll-behavior: smooth; }

        /* Custom scrollbar */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb {
          background: var(--brand-accent-light, #a07855);
          border-radius: 4px;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: var(--brand-accent-dark, #b8896a);
        }

        /* Noise texture overlay */
        .noise-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.015;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
        }
        .dark .noise-overlay { opacity: 0.03; }

        /* Gradient text */
        .gradient-text {
          background: linear-gradient(135deg, var(--brand-accent-light, #a07855) 0%, #d4a574 50%, var(--brand-accent-light, #a07855) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .dark .gradient-text {
          background: linear-gradient(135deg, var(--brand-accent-dark, #b8896a) 0%, #e8c9a8 50%, var(--brand-accent-dark, #b8896a) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Noise texture overlay */}
      <div className="noise-overlay" />

      {/* Fixed background */}
      <div className="fixed inset-0 bg-[#FAFAF8] dark:bg-[#0A0A0B] -z-20" />

      {/* Animated gradient orbs */}
      <GlowOrb
        className="w-[600px] h-[600px] -top-48 -right-48"
        color="radial-gradient(circle, rgba(160, 120, 85, 0.15) 0%, transparent 70%)"
      />
      <GlowOrb
        className="w-[500px] h-[500px] top-1/3 -left-64"
        color="radial-gradient(circle, rgba(160, 120, 85, 0.1) 0%, transparent 70%)"
      />
      <GlowOrb
        className="w-[400px] h-[400px] bottom-1/4 right-1/4"
        color="radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)"
      />

      <div className="relative min-h-screen font-body">
        {/* ================================================================== */}
        {/* HEADER */}
        {/* ================================================================== */}
        <header className="fixed top-0 left-0 right-0 z-50">
          <div className="mx-4 mt-4">
            <motion.nav
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-6xl mx-auto px-6 py-4 rounded-2xl bg-background/70 dark:bg-background/60 backdrop-blur-xl border border-border/50 shadow-lg shadow-black/5"
            >
              <div className="flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3 group">
                  <div className="relative w-10 h-10 rounded-xl overflow-hidden ring-2 ring-transparent group-hover:ring-brand-accent/30 transition-all">
                    <Image src={LOGO_URL} alt="Coachful" fill className="object-cover" unoptimized />
                  </div>
                  <span className="hidden sm:block font-display text-xl font-semibold text-foreground">
                    Coachful
                  </span>
                </Link>

                {/* Nav Links */}
                <nav className="hidden md:flex items-center gap-8">
                  {['Features', 'Pricing', 'FAQ'].map((item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase()}`}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative group"
                    >
                      {item}
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-brand-accent group-hover:w-full transition-all duration-300" />
                    </a>
                  ))}
                </nav>

                {/* CTA Button */}
                <motion.button
                  onClick={handleCTA}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.nav>
          </div>
        </header>

        {/* ================================================================== */}
        {/* HERO SECTION */}
        {/* ================================================================== */}
        <motion.section
          ref={heroRef}
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="relative min-h-screen flex items-center justify-center pt-32 pb-20 px-4 overflow-hidden"
        >
          {/* Background grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(160,120,85,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(160,120,85,0.03)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

          <div className="max-w-6xl mx-auto text-center relative z-10">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-accent/10 border border-brand-accent/20 mb-8"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
              </span>
              <span className="text-sm font-medium text-brand-accent">
                Trusted by 500+ coaches worldwide
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground mb-8 leading-[1.1]">
              <AnimatedText delay={0.4}>Finally, Proof</AnimatedText>
              <br />
              <span className="gradient-text">
                <AnimatedText delay={0.7}>Your Coaching Works.</AnimatedText>
              </span>
            </h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              The only coaching platform where clients don't just listen—they{' '}
              <span className="text-foreground font-semibold">do</span>. Track habits, daily commitments,
              and accountability scores. Deliver proof, not promises.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <motion.button
                onClick={handleCTA}
                whileHover={{ scale: 1.03, boxShadow: '0 20px 40px -10px rgba(160, 120, 85, 0.3)' }}
                whileTap={{ scale: 0.98 }}
                className="group relative flex items-center gap-3 px-8 py-4 bg-brand-accent text-white rounded-full text-lg font-semibold overflow-hidden shadow-xl shadow-brand-accent/25"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative">Start 7-Day Trial</span>
                <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <a
                href="https://demo.coachful.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-4 text-muted-foreground hover:text-foreground font-medium transition-colors group"
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Watch Demo</span>
              </a>
            </motion.div>

            {/* Trust text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.4 }}
              className="text-sm text-muted-foreground mb-16"
            >
              Cancel anytime • Set up in 10 minutes • No credit card required
            </motion.p>

            {/* Trust logos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Trusted by coaches from
              </span>
              <div className="flex items-center gap-8">
                {TRUST_LOGOS.map((logo) => (
                  <div key={logo.name} className="h-8 sm:h-10 opacity-50 hover:opacity-100 transition-opacity">
                    <Image
                      src={logo.logo}
                      alt={logo.name}
                      width={100}
                      height={40}
                      className={logo.className || "h-full w-auto object-contain grayscale dark:brightness-0 dark:invert"}
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2"
            >
              <motion.div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
            </motion.div>
          </motion.div>
        </motion.section>

        {/* ================================================================== */}
        {/* DASHBOARD PREVIEW */}
        {/* ================================================================== */}
        <section className="relative py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <FloatingCard className="relative">
              {/* Glow effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-brand-accent/20 via-purple-500/10 to-brand-accent/20 rounded-3xl blur-2xl opacity-50" />

              {/* Browser frame */}
              <div className="relative bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 bg-background rounded-lg border border-border">
                      <span className="text-xs text-muted-foreground font-mono">
                        yourname.coachful.co/coach
                      </span>
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
            </FloatingCard>
          </div>
        </section>

        {/* ================================================================== */}
        {/* STATS SECTION */}
        {/* ================================================================== */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6"
            >
              {STATS.map((stat, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-accent/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative p-6 md:p-8 text-center">
                    <stat.icon className="w-6 h-6 text-brand-accent mx-auto mb-4" />
                    <div className="font-display text-4xl md:text-5xl font-bold text-foreground mb-2">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                      {stat.label}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* PROBLEM SECTION */}
        {/* ================================================================== */}
        <section className="py-20 md:py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              badge="The Problem"
              title="You've Tried the Alternatives."
              subtitle="Community isn't accountability. Here's what you're probably experiencing right now."
            />

            <div className="grid md:grid-cols-2 gap-8">
              {/* Skool/Circle */}
              <FloatingCard delay={0.1}>
                <div className="h-full p-8 md:p-10 bg-background rounded-2xl border border-border hover:border-red-200 dark:hover:border-red-900/50 transition-colors group">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <X className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-foreground">
                      Skool / Circle
                    </h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'Community is "active" but clients aren\'t changing',
                      '60%+ are lurkers who never post',
                      'You can\'t track who\'s actually implementing',
                      'No way to prove ROI when they ask "is this working?"',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FloatingCard>

              {/* Notion/Docs */}
              <FloatingCard delay={0.2}>
                <div className="h-full p-8 md:p-10 bg-background rounded-2xl border border-border hover:border-red-200 dark:hover:border-red-900/50 transition-colors group">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <X className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="font-display text-2xl font-semibold text-foreground">
                      Notion / Google Docs
                    </h3>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'You built it yourself. It\'s a mess.',
                      'Clients "forget" to update it',
                      'No notifications, no accountability, no streaks',
                      'Looks unprofessional—like you\'re winging it',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FloatingCard>
            </div>

            {/* Bottom callout */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-12 text-center"
            >
              <div className="inline-block px-8 py-6 bg-gradient-to-r from-brand-accent/5 via-brand-accent/10 to-brand-accent/5 rounded-2xl border border-brand-accent/20">
                <p className="font-display text-2xl md:text-3xl font-semibold text-foreground">
                  The problem isn't your clients.{' '}
                  <span className="gradient-text">It's your tools.</span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* SOLUTION / BEFORE-AFTER */}
        {/* ================================================================== */}
        <section className="py-20 md:py-32 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              badge="The Solution"
              title="Accountability That Scales."
              subtitle="Replace your patchwork of tools with one platform built for results, not vanity metrics."
            />

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Before */}
              <FloatingCard delay={0.1}>
                <div className="h-full p-8 md:p-10 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200/50 dark:border-red-900/30">
                  <div className="flex items-center gap-3 mb-8">
                    <Clock className="w-6 h-6 text-red-500" />
                    <span className="font-display text-lg font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">
                      Before: Your typical Monday
                    </span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      'Check Slack for client messages',
                      'Send "how\'s it going?" texts to 5 quiet clients',
                      'Update Notion tracker (who did homework?)',
                      'Scroll community looking for engagement',
                      'Prep for 6 calls you\'re dreading',
                      'Wonder if any of this is working',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <span className="text-red-700 dark:text-red-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-6 border-t border-red-200/50 dark:border-red-900/30">
                    <span className="font-display text-4xl font-bold text-red-600 dark:text-red-400">3-4 hours</span>
                    <span className="text-red-500 ml-2">of admin work</span>
                  </div>
                </div>
              </FloatingCard>

              {/* After */}
              <FloatingCard delay={0.2}>
                <div className="h-full p-8 md:p-10 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/50 dark:border-emerald-900/30">
                  <div className="flex items-center gap-3 mb-8">
                    <Zap className="w-6 h-6 text-emerald-500" />
                    <span className="font-display text-lg font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                      After: With Coachful
                    </span>
                  </div>
                  <ul className="space-y-4 mb-8">
                    {[
                      'Open dashboard. See all 24 clients at once.',
                      'Sarah: 94 alignment, 18-day streak. Crushing it.',
                      'Mike: 41 alignment, dropped off. Quick DM check-in.',
                      'Squad Alpha: 78% completed Daily Focus. On track.',
                      '2 calls today—both with prepared clients.',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-6 border-t border-emerald-200/50 dark:border-emerald-900/30">
                    <span className="font-display text-4xl font-bold text-emerald-600 dark:text-emerald-400">10 minutes</span>
                    <span className="text-emerald-500 ml-2">and done</span>
                  </div>
                </div>
              </FloatingCard>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* FEATURES SECTION */}
        {/* ================================================================== */}
        <section id="features" className="py-20 md:py-32 px-4">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              badge="Features"
              title="Everything You Need to Scale."
              subtitle="Built specifically for coaches who want client transformation, not just community."
            />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="group relative"
                >
                  {/* Hover glow */}
                  <div className={`absolute -inset-1 bg-gradient-to-r ${feature.gradient} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`} />

                  <div className="relative h-full p-8 bg-background rounded-2xl border border-border hover:border-brand-accent/30 transition-colors">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-foreground mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* TESTIMONIALS */}
        {/* ================================================================== */}
        <section className="py-20 md:py-32 px-4 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <SectionHeader
              badge="Testimonials"
              title="Coaches Who Made the Switch."
              subtitle="Real results from coaches who chose accountability over vanity metrics."
            />

            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTestimonial}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="bg-background rounded-3xl p-8 md:p-12 border border-border shadow-xl"
                >
                  {/* Stars */}
                  <div className="flex gap-1 mb-8">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-5 h-5 text-brand-accent fill-brand-accent" />
                    ))}
                  </div>

                  {/* Quote */}
                  <blockquote className="font-display text-2xl md:text-3xl text-foreground leading-relaxed mb-10">
                    "{TESTIMONIALS[activeTestimonial].quote}"
                  </blockquote>

                  {/* Author */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-brand-accent/70 flex items-center justify-center text-white font-semibold">
                        {TESTIMONIALS[activeTestimonial].avatar}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {TESTIMONIALS[activeTestimonial].name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {TESTIMONIALS[activeTestimonial].title}
                        </p>
                      </div>
                    </div>
                    <div className="hidden sm:block px-4 py-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-full">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {TESTIMONIALS[activeTestimonial].metric}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Dots */}
              <div className="flex justify-center gap-3 mt-8">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTestimonial(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i === activeTestimonial
                        ? 'bg-brand-accent w-8'
                        : 'bg-border hover:bg-muted-foreground'
                    }`}
                  />
                ))}
              </div>

              <p className="text-center mt-6 text-xs text-muted-foreground">
                *Testimonials shown are illustrative examples.
              </p>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* COMPARISON TABLE */}
        {/* ================================================================== */}
        <section className="py-20 md:py-32 px-4">
          <div className="max-w-4xl mx-auto">
            <SectionHeader
              badge="Comparison"
              title="Why Coaches Switch."
              subtitle="They track community. We track transformation."
            />

            <FloatingCard>
              <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xl">
                {/* Header */}
                <div className="grid grid-cols-4 bg-muted/50">
                  <div className="p-4 md:p-6 font-semibold text-foreground">Feature</div>
                  <div className="p-4 md:p-6 text-center font-semibold text-muted-foreground">Skool</div>
                  <div className="p-4 md:p-6 text-center font-semibold text-muted-foreground">Circle</div>
                  <div className="p-4 md:p-6 text-center bg-brand-accent/10">
                    <Image src={LOGO_URL} alt="Coachful" width={28} height={28} className="mx-auto rounded-lg" unoptimized />
                  </div>
                </div>

                {/* Rows */}
                {COMPARISON.map((row, i) => (
                  <div key={i} className="grid grid-cols-4 border-t border-border">
                    <div className="p-4 md:p-6 text-sm text-foreground">{row.feature}</div>
                    <div className="p-4 md:p-6 flex justify-center">
                      {row.skool ? (
                        <Check className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <X className="w-5 h-5 text-border" />
                      )}
                    </div>
                    <div className="p-4 md:p-6 flex justify-center">
                      {row.circle ? (
                        <Check className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <X className="w-5 h-5 text-border" />
                      )}
                    </div>
                    <div className="p-4 md:p-6 flex justify-center bg-brand-accent/5">
                      {row.coachful ? (
                        <Check className="w-5 h-5 text-brand-accent" />
                      ) : (
                        <X className="w-5 h-5 text-border" />
                      )}
                    </div>
                  </div>
                ))}

                {/* Pricing row */}
                <div className="grid grid-cols-4 border-t border-border bg-muted/30">
                  <div className="p-4 md:p-6 font-semibold text-foreground">Starting price</div>
                  <div className="p-4 md:p-6 text-center font-semibold text-muted-foreground">$99/mo</div>
                  <div className="p-4 md:p-6 text-center font-semibold text-muted-foreground">$89/mo</div>
                  <div className="p-4 md:p-6 text-center font-bold text-brand-accent bg-brand-accent/10">$49/mo</div>
                </div>
              </div>
            </FloatingCard>
          </div>
        </section>

        {/* ================================================================== */}
        {/* PRICING SECTION */}
        {/* ================================================================== */}
        <section id="pricing" className="py-20 md:py-32 px-4 bg-muted/30">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              badge="Pricing"
              title="Simple Pricing. No Surprises."
              subtitle="7-day free trial on all plans. Cancel anytime."
            />

            {/* Billing toggle */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center p-1 bg-background rounded-full border border-border">
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    billingPeriod === 'annual'
                      ? 'text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {billingPeriod === 'annual' && (
                    <motion.div
                      layoutId="billing-bg"
                      className="absolute inset-0 bg-foreground rounded-full"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative">Annual</span>
                </button>
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    billingPeriod === 'monthly'
                      ? 'text-background'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {billingPeriod === 'monthly' && (
                    <motion.div
                      layoutId="billing-bg"
                      className="absolute inset-0 bg-foreground rounded-full"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative">Monthly</span>
                </button>
                <AnimatePresence>
                  {billingPeriod === 'annual' && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8, width: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 'auto', marginLeft: 8 }}
                      exit={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0 }}
                      className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full overflow-hidden"
                    >
                      Save 41%
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-8"
            >
              {PRICING.map((plan, i) => (
                <motion.div
                  key={i}
                  variants={scaleIn}
                  className={`relative ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                      <span className="px-4 py-1.5 bg-brand-accent text-white text-xs font-bold rounded-full uppercase tracking-wide">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className={`h-full p-8 bg-background rounded-2xl border ${
                    plan.popular
                      ? 'border-brand-accent shadow-xl shadow-brand-accent/10'
                      : 'border-border'
                  }`}>
                    <div className="mb-6">
                      <h3 className="font-display text-2xl font-bold text-foreground mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>

                    {/* Price */}
                    <div className="mb-2">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={`${plan.name}-${billingPeriod}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="font-display text-5xl font-bold text-foreground"
                        >
                          ${billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-red-500 font-medium mb-6">Free for 7 days</p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 py-4 border-y border-border mb-6">
                      <div className="text-center">
                        <div className="font-display text-xl font-bold text-foreground">{plan.clients}</div>
                        <div className="text-xs text-muted-foreground">Clients</div>
                      </div>
                      <div className="text-center border-x border-border">
                        <div className="font-display text-xl font-bold text-foreground">{plan.programs}</div>
                        <div className="text-xs text-muted-foreground">Programs</div>
                      </div>
                      <div className="text-center">
                        <div className="font-display text-xl font-bold text-foreground">{plan.squads}</div>
                        <div className="text-xs text-muted-foreground">Squads</div>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <motion.button
                      onClick={handleCTA}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full py-3.5 rounded-full text-sm font-semibold transition-all ${
                        plan.popular
                          ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/25'
                          : 'bg-foreground text-background'
                      }`}
                    >
                      Start free trial
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* FAQ SECTION */}
        {/* ================================================================== */}
        <section id="faq" className="py-20 md:py-32 px-4">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              badge="FAQ"
              title="Questions Coaches Ask."
              subtitle="Everything you need to know about switching to Coachful."
            />

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-4"
            >
              {FAQ.map((item, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  className="bg-background rounded-2xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-semibold text-foreground pr-4">{item.q}</span>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground flex-shrink-0 transition-transform ${
                      openFaq === i ? 'rotate-180' : ''
                    }`} />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-6">
                          <p className="text-muted-foreground leading-relaxed">{item.a}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* FINAL CTA */}
        {/* ================================================================== */}
        <section className="py-20 md:py-32 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl bg-foreground p-12 md:p-20">
              {/* Background effects */}
              <div className="absolute inset-0">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand-accent/20 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/4 w-[400px] h-[200px] bg-brand-accent/10 rounded-full blur-3xl" />
              </div>

              <div className="relative text-center">
                <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-background mb-6 leading-tight">
                  Your Clients Are Waiting
                  <br />
                  <span className="text-brand-accent">to Be Held Accountable.</span>
                </h2>

                <p className="text-lg text-background/70 max-w-xl mx-auto mb-10">
                  Stop guessing. Start delivering. Set up your first program in 10 minutes.
                </p>

                <motion.button
                  onClick={handleCTA}
                  whileHover={{ scale: 1.03, boxShadow: '0 20px 40px -10px rgba(160, 120, 85, 0.4)' }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-3 px-10 py-5 bg-brand-accent text-white rounded-full text-lg font-semibold shadow-xl shadow-brand-accent/30"
                >
                  Start Your 7-Day Trial
                  <ArrowRight className="w-5 h-5" />
                </motion.button>

                <p className="text-sm text-background/50 mt-6">
                  Cancel anytime • Set up in 10 minutes
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* FOOTER */}
        {/* ================================================================== */}
        <footer className="py-12 px-4 border-t border-border">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                  <Image src={LOGO_URL} alt="Coachful" fill className="object-cover" unoptimized />
                </div>
                <span className="font-display text-lg font-semibold text-foreground">Coachful</span>
              </div>

              {/* Links */}
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
                <a href="mailto:support@coachful.co" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
              </div>

              {/* Copyright */}
              <p className="text-sm text-muted-foreground">
                © 2025 Coachful. Built for coaches who get results.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Quiz Modal */}
      <CoachQuizModal isOpen={quizOpen} onClose={() => setQuizOpen(false)} />
    </>
  );
}
