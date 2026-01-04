'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Play,
  ExternalLink,
} from 'lucide-react';
import { LinedGradientBackground } from '@/components/ui/lined-gradient-background';
import { CoachQuizModal } from './CoachQuizModal';
import { CoachOnboardingOverlay } from '@/components/marketplace';

const LOGO_URL = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=78f383ba-0074-4375-985c-f623e8c90d70';

// Dashboard screenshot placeholder - replace with actual screenshot
const DASHBOARD_SCREENSHOT = 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2Fdashboard-preview.png?alt=media';

const TRUST_LOGOS = [
  { 
    name: 'ICF', 
    logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo1.png?alt=media&token=7334b9b8-3373-4916-83ec-df92eb5e9332',
    // Special handling for white background logo
    className: 'h-full w-auto object-contain grayscale mix-blend-multiply dark:mix-blend-screen dark:invert'
  },
  { name: 'iPEC', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo2.png?alt=media&token=fac36442-711e-4e77-a089-f6b27c5cc74b' },
  { name: 'CTI', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo3.png?alt=media&token=51e99040-6b73-4c0e-9436-50bc5aeda615' },
  { name: 'Health Coach Institute', logo: 'https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/landers%2Flogo4.png?alt=media&token=5efc6eb5-6642-47a1-b83a-b98e6341be14' },
];

const TESTIMONIALS = [
  {
    quote: "I had 40 clients in a Circle community. 12 were active. I moved to Coachful. Now I can see exactly who's doing the work. My renewal rate went from 60% to 85%.",
    name: 'David L.',
    title: 'Executive Coach',
    clients: '40 clients',
    revenue: '$32K/mo',
  },
  {
    quote: "Skool was great for building an audience. But my PAID clients? They got lost in the noise. Coachful separates the two. My premium clients get accountability.",
    name: 'Jen T.',
    title: 'Business Coach',
    clients: '28 clients',
    note: 'Uses both Skool + Coachful',
  },
  {
    quote: "The Alignment Score changed everything. My clients actually compete to have the highest score. I've never seen this level of engagement with any other tool.",
    name: 'Marcus W.',
    title: 'Fitness Coach',
    clients: '52 clients',
    note: '3 Squads',
  },
];

const FEATURES = [
  {
    icon: BarChart3,
    title: 'Alignment Scores',
    description: 'See every client\'s engagement at a glance. 0-100 score based on real behavior, not likes.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    icon: Target,
    title: 'Daily Focus',
    description: 'Clients commit to 3 tasks every morning. You see who did them. No more "I forgot."',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    icon: Flame,
    title: 'Habit Tracking',
    description: 'Any frequency: daily, 3x/week, specific days. Streaks build momentum. You see who\'s consistent.',
    color: 'from-orange-500 to-orange-600',
  },
  {
    icon: Users,
    title: 'Squad Accountability',
    description: 'Small group pods (8-12) with collective streaks. Peer pressure that works. Clients hold each other.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: MessageSquare,
    title: 'Built-in Chat',
    description: '1:1 messaging. Group squad chat. Everything in one place. Clients never leave the platform.',
    color: 'from-pink-500 to-pink-600',
  },
  {
    icon: Video,
    title: 'Video Calls',
    description: 'No more Zoom links. Call clients directly from the platform. Session notes included.',
    color: 'from-cyan-500 to-cyan-600',
  },
];

const COMPARISON = [
  { feature: 'Community feed', skool: true, circle: true, ga: true },
  { feature: 'Course hosting', skool: true, circle: true, ga: true },
  { feature: 'Group chat', skool: true, circle: true, ga: true },
  { feature: 'Daily task commitments', skool: false, circle: false, ga: true },
  { feature: 'Habit tracking with streaks', skool: false, circle: false, ga: true },
  { feature: 'Alignment/engagement score', skool: false, circle: false, ga: true },
  { feature: 'Squad accountability', skool: false, circle: false, ga: true },
  { feature: 'Coach dashboard with all clients', skool: false, circle: false, ga: true },
  { feature: 'Built-in 1:1 + video calls', skool: false, circle: false, ga: true },
];

const PRICING = [
  {
    name: 'Starter',
    monthlyPrice: 49,
    annualPrice: 29,
    description: 'Perfect for coaches just starting out',
    stats: { clients: 15, programs: 2, squads: 3 },
    features: ['Check-ins + accountability', 'Tasks + habits', 'Chat + video calls', 'Stripe payments'],
    cta: 'Start free trial',
    popular: false,
  },
  {
    name: 'Pro',
    monthlyPrice: 129,
    annualPrice: 76,
    description: 'For growing coaching businesses',
    stats: { clients: 150, programs: 10, squads: 25 },
    features: ['Everything in Starter, plus:', 'Custom domain', 'Email white labeling', 'Advanced funnel steps', 'Upsells + downsells'],
    cta: 'Start free trial',
    popular: true,
  },
  {
    name: 'Scale',
    monthlyPrice: 299,
    annualPrice: 176,
    description: 'For established coaching operations',
    stats: { clients: 500, programs: 50, squads: 100 },
    features: ['Everything in Pro, plus:', 'Team roles + permissions', 'Multi-coach support', 'AI Builder / AI Helper'],
    cta: 'Start free trial',
    popular: false,
  },
];

const FAQ = [
  {
    q: 'Can I migrate my clients from Skool/Circle?',
    a: 'Yes. Invite them via email or link. They sign up and you assign them to a program or squad. You can import clients in bulk.',
  },
  {
    q: 'Do I need to stop using Skool/Circle?',
    a: 'No. Many coaches use Skool for free community and Coachful for paid clients who need accountability.',
  },
  {
    q: 'What if my clients don\'t log in?',
    a: 'You\'ll know immediately—their Alignment Score drops. That\'s the point. You catch disengagement before they churn.',
  },
  {
    q: 'Can I white-label this as my own platform?',
    a: 'Yes. Custom domain (yourname.com) on Pro tier. Full brand customization on all plans.',
  },
  {
    q: 'What about 1:1 coaching? I don\'t just do groups.',
    a: 'Perfect for both. Daily Focus and Habits work for 1:1. Squads are optional. Many coaches do hybrid.',
  },
  {
    q: 'How is this different from CoachAccountable?',
    a: 'They\'re CRM/scheduling tools. We\'re a transformation platform. We track what clients DO between sessions—not just appointments.',
  },
];

const testimonialSlideVariants = {
  enter: (direction: 'left' | 'right') => ({
    x: direction === 'left' ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: 'left' | 'right') => ({
    x: direction === 'left' ? -300 : 300,
    opacity: 0,
  }),
};

export function CoachLandingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [quizOpen, setQuizOpen] = useState(false);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right'>('left');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [coachOnboardingState, setCoachOnboardingState] = useState<'needs_profile' | 'needs_plan' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const heroRef = useRef<HTMLDivElement>(null);

  // Check coach onboarding state if user is logged in
  useEffect(() => {
    if (!isLoaded || !user) {
      setCoachOnboardingState(null);
      return;
    }

    const checkOnboardingState = async () => {
      try {
        const res = await fetch('/api/coach/onboarding-state');
        if (res.ok) {
          const data = await res.json();
          if (data.state === 'needs_profile' || data.state === 'needs_plan') {
            setCoachOnboardingState(data.state);
          } else {
            setCoachOnboardingState(null);
          }
        }
      } catch {
        // Silently fail - don't show overlay if we can't check
        setCoachOnboardingState(null);
      }
    };

    checkOnboardingState();
  }, [isLoaded, user]);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCTA = () => {
    // If user has already started onboarding, take them directly to where they left off
    if (coachOnboardingState === 'needs_profile') {
      router.push('/coach/onboarding/profile');
      return;
    }
    if (coachOnboardingState === 'needs_plan') {
      router.push('/coach/onboarding/plans');
      return;
    }
    // Otherwise, open the quiz modal for new users
    setQuizOpen(true);
  };

  return (
    <>
      {/* Force main padding to 0 */}
      <style dangerouslySetInnerHTML={{__html: `
        main { padding-left: 0 !important; transition: none !important; }
        body[data-layout="with-sidebar"] main { padding-left: 0 !important; }
      `}} />
      
      {/* Fixed background */}
      <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] -z-10" />
      <LinedGradientBackground fixed />
      
      {/* Top spotlight glow */}
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#e8b923]/5 dark:bg-[#e8b923]/3 rounded-full blur-[120px] pointer-events-none -z-[5]"
        aria-hidden="true"
      />

      <div className="min-h-screen relative">
        {/* Header */}
        <header className="sticky top-0 z-40 mx-2 sm:mx-4 mt-2 rounded-2xl bg-[#faf8f6]/80 dark:bg-[#05070b]/80 backdrop-blur-xl border border-[#e1ddd8]/30 dark:border-[#262b35]/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden relative">
                  <Image
                    src={LOGO_URL}
                    alt="Coachful"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <span className="hidden sm:inline font-albert text-xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-tight">
                  Coachful
                </span>
              </Link>

              {/* Nav */}
              <nav className="hidden md:flex items-center gap-8">
                <a href="#features" className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">Features</a>
                <a href="#pricing" className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">Pricing</a>
                <a href="#faq" className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">FAQ</a>
              </nav>

              {/* CTA */}
              <button
                onClick={handleCTA}
                className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] text-[#2c2520] rounded-full font-albert text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#e8b923]/20"
              >
                <span className="sm:hidden">Try Free</span>
                <span className="hidden sm:inline">Start free trial</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section ref={heroRef} className="relative pt-16 sm:pt-24 pb-20 overflow-hidden">
          {/* Subtle gradient orbs - large, soft, stationary */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-brand-accent/8 via-[#e8b923]/5 to-transparent rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-emerald-400/8 via-cyan-400/5 to-transparent rounded-full blur-3xl" />
          </div>

          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
            {/* Badge */}
            <motion.div 
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1e222a] border border-[#e1ddd8] dark:border-[#313746] rounded-full mb-8 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Star className="w-4 h-4 text-[#e8b923]" />
              <span className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                Trusted by 500+ coaches worldwide
              </span>
            </motion.div>
            
            {/* Headline */}
            <motion.h1 
              className="font-albert text-[42px] sm:text-[56px] lg:text-[72px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-2px] leading-[1.05] mb-6"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Finally, Proof<br />
              <span className="bg-gradient-to-r from-brand-accent via-[#d4a61d] to-[#c08a5c] bg-clip-text text-transparent bg-[length:200%_auto]" style={{ animation: 'shimmer 3s ease-in-out infinite' }}>
                Your Coaching Works.
              </span>
            </motion.h1>
            
            <motion.div 
              className="max-w-2xl mx-auto mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <p className="font-sans text-[18px] sm:text-[20px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                <span>Coachful is the only coaching platform where clients don't just listen - they <strong className="text-[#1a1a1a] dark:text-[#f5f5f8]">do</strong>.</span>
                <span className="block h-3 sm:hidden" />
                <span className="hidden sm:inline"> </span>
                <span>Track habits, daily commitments, and accountability scores. Start delivering proof, not promises.</span>
              </p>
            </motion.div>
            
            {/* CTA Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <button
                onClick={handleCTA}
                className="group relative flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#d4a61d] hover:to-[#c09819] text-[#2c2520] rounded-full font-albert text-[17px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#e8b923]/30 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                Start 7-Day Trial
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="https://demo.coachful.co"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-4 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert text-[16px] font-medium transition-colors"
              >
                Visit live demo
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
            
            <motion.p 
              className="font-sans text-[13px] text-[#a7a39e] dark:text-[#7d8190]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Cancel anytime • Set up in 10 minutes
            </motion.p>
            
            {/* Trust badges - actual logos in grayscale */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-12">
              <span className="font-sans text-[12px] text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wider">
                Trusted by coaches from:
              </span>
              <div className="flex items-center justify-center gap-4 sm:gap-8">
                {TRUST_LOGOS.map((logo) => (
                  <div 
                    key={logo.name} 
                    className="h-6 sm:h-10 opacity-60 dark:opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Image
                      src={logo.logo}
                      alt={logo.name}
                      width={120}
                      height={40}
                      className={logo.className || "h-full w-auto object-contain grayscale dark:brightness-0 dark:invert"}
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Dashboard Preview - 3D perspective animation */}
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16" style={{ perspective: '2000px' }}>
            <motion.div 
              className="relative"
              initial={{ rotateX: 25, opacity: 0, y: 60 }}
              whileInView={{ rotateX: 0, opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Gradient glow behind */}
              <div className="absolute inset-0 bg-gradient-to-r from-brand-accent/20 via-[#e8b923]/10 to-brand-accent/20 blur-3xl -z-10 scale-95" />
              
              {/* Floating decorative elements */}
              <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-[#e8b923]/20 to-transparent rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-gradient-to-tr from-brand-accent/15 to-transparent rounded-full blur-2xl" />
              
              {/* Screenshot container */}
              <div className="bg-white dark:bg-[#171b22] rounded-2xl sm:rounded-3xl shadow-2xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 bg-[#f8f7f5] dark:bg-[#1e222a] border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1.5 bg-white dark:bg-[#262b35] rounded-lg">
                      <span className="font-mono text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        yourname.com/coach
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Dashboard preview - actual screenshot */}
                <div className="relative">
                  {/* Light mode screenshot */}
                  <Image
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcoachdash.png?alt=media&token=ef410083-561e-4594-9381-aa604d04a490"
                    alt="Coach Dashboard - See all your clients' alignment scores at a glance"
                    width={1920}
                    height={1080}
                    className="w-full h-auto dark:hidden"
                    unoptimized
                    priority
                  />
                  {/* Dark mode screenshot */}
                  <Image
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/images%2Fcoachdashdark.png?alt=media&token=8fd12376-9f03-4a85-9033-03eec00ae1fa"
                    alt="Coach Dashboard - See all your clients' alignment scores at a glance"
                    width={1920}
                    height={1080}
                    className="w-full h-auto hidden dark:block"
                    unoptimized
                    priority
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-12 sm:py-16 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-rose-200/20 dark:bg-rose-900/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-accent/10 rounded-full blur-3xl" />
          
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                You've Tried the Alternatives.
              </h2>
              <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2]">
                Community isn't accountability. Here's what you're probably experiencing:
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Skool/Circle */}
              <motion.div 
                className="bg-white dark:bg-[#171b22] rounded-2xl p-8 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-lg shadow-rose-500/5"
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                    <X className="w-5 h-5 text-rose-500" />
                  </div>
                  <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
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
                      <X className="w-4 h-4 text-rose-500 mt-1 flex-shrink-0" />
                      <span className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              
              {/* Notion/Docs */}
              <motion.div 
                className="bg-white dark:bg-[#171b22] rounded-2xl p-8 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 shadow-lg shadow-rose-500/5"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                    <X className="w-5 h-5 text-rose-500" />
                  </div>
                  <h3 className="font-albert text-[20px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
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
                      <X className="w-4 h-4 text-rose-500 mt-1 flex-shrink-0" />
                      <span className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2]">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
            
            <motion.div 
              className="mt-12 text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="inline-block px-8 py-5 bg-gradient-to-r from-brand-accent/10 via-[#e8b923]/5 to-brand-accent/10 dark:from-brand-accent/20 dark:via-[#e8b923]/10 dark:to-brand-accent/20 rounded-2xl border border-brand-accent/20">
                <p className="font-albert text-[20px] sm:text-[22px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  The problem isn't your clients. <span className="text-brand-accent font-bold">It's your tools.</span>
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
              Finally. Accountability That Scales.
            </h2>
            <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2] max-w-2xl mx-auto mb-16">
              Coachful replaces your patchwork of tools with one platform built for coaches who need <strong className="text-[#1a1a1a] dark:text-[#f5f5f8]">results</strong>, not vanity metrics.
            </p>
            
            {/* Before/After */}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-20">
              {/* Before */}
              <div className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl p-8 border border-rose-200/50 dark:border-rose-900/30 text-left flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-rose-500" />
                  <span className="font-albert text-[14px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    Before: Your typical Monday
                  </span>
                </div>
                <ul className="space-y-3 flex-1">
                  {[
                    'Check Slack for client messages',
                    'Send "how\'s it going?" texts to 5 quiet clients',
                    'Update Notion tracker (who did homework?)',
                    'Scroll community looking for engagement',
                    'Prep for 6 calls you\'re dreading',
                    'Wonder if any of this is working',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <X className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <span className="font-sans text-[14px] text-rose-700 dark:text-rose-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-4 border-t border-rose-200/50 dark:border-rose-900/30">
                  <span className="font-albert text-[24px] font-bold text-rose-600 dark:text-rose-400">3-4 hours</span>
                  <span className="font-sans text-[14px] text-rose-500 dark:text-rose-400 ml-2">of admin work</span>
                </div>
              </div>
              
              {/* After */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-8 border border-emerald-200/50 dark:border-emerald-900/30 text-left flex flex-col">
                <div className="flex items-center gap-2 mb-6">
                  <Zap className="w-5 h-5 text-emerald-500" />
                  <span className="font-albert text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    After: With Coachful
                  </span>
                </div>
                <ul className="space-y-3 flex-1">
                  {[
                    'Open dashboard. See all 24 clients at once.',
                    'Sarah: 94 alignment, 18-day streak. Crushing it.',
                    'Mike: 41 alignment, dropped off. Quick DM check-in.',
                    'Squad Alpha: 78% completed Daily Focus. On track.',
                    '2 calls today—both with prepared clients.',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="font-sans text-[14px] text-emerald-700 dark:text-emerald-300">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="font-albert text-[24px] font-bold text-emerald-600 dark:text-emerald-400">10 minutes</span>
                  <span className="font-sans text-[14px] text-emerald-500 dark:text-emerald-400 ml-2">and done</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-12 sm:py-16 relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#faf8f6] via-white to-[#f8f6f3] dark:from-[#0f1218] dark:via-[#12161e] dark:to-[#0f1218]" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-purple-200/30 to-transparent dark:from-purple-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-to-tl from-brand-accent/20 to-transparent rounded-full blur-3xl" />
          
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Everything You Need to Scale
              </h2>
              <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2]">
                Built specifically for coaches who want client transformation, not just community
              </p>
            </motion.div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={i}
                  className="group bg-white dark:bg-[#171b22] rounded-2xl p-6 border border-[#e1ddd8]/50 dark:border-[#262b35]/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                    {feature.title}
                  </h3>
                  <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Coaches Who Made the Switch
              </h2>
            </div>
            
            <div className="relative overflow-hidden touch-pan-y">
              <AnimatePresence initial={false} mode="popLayout" custom={swipeDirection}>
                <motion.div
                  key={testimonialIndex}
                  custom={swipeDirection}
                  variants={testimonialSlideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.15}
                  onDragEnd={(_, info) => {
                    const swipeThreshold = 50;
                    if (info.offset.x < -swipeThreshold) {
                      // Swiped left - go to next
                      setSwipeDirection('left');
                      setTestimonialIndex((prev) => (prev + 1) % TESTIMONIALS.length);
                    } else if (info.offset.x > swipeThreshold) {
                      // Swiped right - go to previous
                      setSwipeDirection('right');
                      setTestimonialIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
                    }
                  }}
                  className="bg-white dark:bg-[#171b22] rounded-3xl p-8 sm:p-12 shadow-xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex flex-col items-center text-center select-none">
                    <div className="flex gap-1 mb-6">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-5 h-5 text-[#e8b923] fill-[#e8b923]" />
                      ))}
                    </div>
                    <blockquote className="font-sans text-[18px] sm:text-[20px] text-[#1a1a1a] dark:text-[#f5f5f8] leading-relaxed mb-8 max-w-2xl">
                      "{TESTIMONIALS[testimonialIndex].quote}"
                    </blockquote>
                    <div>
                      <p className="font-albert text-[17px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {TESTIMONIALS[testimonialIndex].name}
                      </p>
                      <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                        {TESTIMONIALS[testimonialIndex].title} • {TESTIMONIALS[testimonialIndex].clients}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
              
              {/* Navigation */}
              <div className="flex justify-center gap-3 mt-6">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setTestimonialIndex(i)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${
                      i === testimonialIndex
                        ? 'bg-brand-accent'
                        : 'bg-[#e1ddd8] dark:bg-[#313746] hover:bg-[#c5bfb8] dark:hover:bg-[#3d4452]'
                    }`}
                  />
                ))}
              </div>
              
              {/* Disclaimer */}
              <p className="text-center mt-6 text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
                *Testimonials shown are illustrative examples.
              </p>
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-12 sm:py-16 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-1/2 left-0 w-64 h-64 bg-emerald-200/20 dark:bg-emerald-900/10 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-1/3 right-0 w-80 h-80 bg-brand-accent/15 rounded-full blur-3xl" />
          
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Why Coaches Switch
              </h2>
              <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2]">
                They track community. We track transformation.
              </p>
            </motion.div>
            
            <motion.div 
              className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 overflow-hidden shadow-xl"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <div className="overflow-x-auto">
                {/* Header row */}
                <div className="flex items-center border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                  <div className="flex-1 min-w-0 text-left p-4 font-albert text-[14px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2]">Feature</div>
                  <div className="p-4 font-albert text-[14px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] flex items-center justify-center w-16 sm:w-24 flex-shrink-0 order-2 sm:order-1">Skool</div>
                  <div className="p-4 font-albert text-[14px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] flex items-center justify-center w-16 sm:w-24 flex-shrink-0 order-3 sm:order-2">Circle</div>
                  <div className="p-4 flex items-center justify-center w-16 sm:w-24 flex-shrink-0 order-1 sm:order-3">
                    <Image
                      src="/logo.png"
                      alt="Coachful"
                      width={32}
                      height={32}
                      className="rounded-lg"
                    />
                  </div>
                </div>
                {/* Data rows */}
                {COMPARISON.map((row, i) => (
                  <div key={i} className="flex border-b border-[#e1ddd8]/30 dark:border-[#262b35]/30 last:border-0">
                    <div className="flex-1 min-w-0 p-4 font-sans text-[14px] text-[#1a1a1a] dark:text-[#f5f5f8]">{row.feature}</div>
                    <div className="p-4 text-center w-16 sm:w-24 flex-shrink-0 order-2 sm:order-1">
                      {row.skool ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-[#c5bfb8] dark:text-[#3d4452] mx-auto" />
                      )}
                    </div>
                    <div className="p-4 text-center w-16 sm:w-24 flex-shrink-0 order-3 sm:order-2">
                      {row.circle ? (
                        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-[#c5bfb8] dark:text-[#3d4452] mx-auto" />
                      )}
                    </div>
                    <div className="p-4 text-center w-16 sm:w-24 flex-shrink-0 bg-brand-accent/5 dark:bg-brand-accent/10 order-1 sm:order-3">
                      {row.ga ? (
                        <Check className="w-5 h-5 text-brand-accent mx-auto" />
                      ) : (
                        <X className="w-5 h-5 text-[#c5bfb8] dark:text-[#3d4452] mx-auto" />
                      )}
                    </div>
                  </div>
                ))}
                {/* Pricing row */}
                <div className="flex bg-[#f3f1ef] dark:bg-[#1e222a]">
                  <div className="flex-1 min-w-0 p-4 font-albert text-[14px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">Starting price</div>
                  <div className="p-4 font-albert text-[14px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] text-center w-16 sm:w-24 flex-shrink-0 order-2 sm:order-1">$99/mo</div>
                  <div className="p-4 font-albert text-[14px] font-semibold text-[#5f5a55] dark:text-[#b2b6c2] text-center w-16 sm:w-24 flex-shrink-0 order-3 sm:order-2">$89/mo</div>
                  <div className="p-4 font-albert text-[16px] font-bold text-brand-accent text-center w-16 sm:w-24 flex-shrink-0 bg-brand-accent/5 dark:bg-brand-accent/10 order-1 sm:order-3">$49/mo</div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-12 sm:py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Simple Pricing. No Surprises.
              </h2>
              <p className="font-sans text-[17px] text-[#5f5a55] dark:text-[#b2b6c2]">
                7-day free trial on all plans
              </p>
            </div>
            
            {/* Monthly/Annual Toggle */}
            <div className="flex justify-center mb-10">
              <motion.div 
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="inline-flex items-center bg-white dark:bg-[#171b22] rounded-full p-1 border border-[#e1ddd8]/50 dark:border-[#262b35]/50"
              >
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className="relative px-5 py-2.5 rounded-full font-albert text-[14px] font-medium transition-colors duration-200"
                >
                  {billingPeriod === 'annual' && (
                    <motion.div
                      layoutId="billing-pill"
                      className="absolute inset-0 bg-[#1a1a1a] dark:bg-[#f5f5f8] rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={`relative z-10 ${
                    billingPeriod === 'annual'
                      ? 'text-white dark:text-[#1a1a1a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                  }`}>
                    Annual
                  </span>
                </button>
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className="relative px-5 py-2.5 rounded-full font-albert text-[14px] font-medium transition-colors duration-200"
                >
                  {billingPeriod === 'monthly' && (
                    <motion.div
                      layoutId="billing-pill"
                      className="absolute inset-0 bg-[#1a1a1a] dark:bg-[#f5f5f8] rounded-full"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className={`relative z-10 ${
                    billingPeriod === 'monthly'
                      ? 'text-white dark:text-[#1a1a1a]'
                      : 'text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8]'
                  }`}>
                    Monthly
                  </span>
                </button>
                <AnimatePresence mode="wait">
                  {billingPeriod === 'annual' && (
                    <motion.span
                      key="save-badge"
                      initial={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0, marginRight: 0 }}
                      animate={{ opacity: 1, scale: 1, width: 'auto', marginLeft: 8, marginRight: 4 }}
                      exit={{ opacity: 0, scale: 0.8, width: 0, marginLeft: 0, marginRight: 0 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="px-2.5 py-1 bg-emerald-500 text-white font-albert text-[11px] font-bold rounded-full uppercase whitespace-nowrap overflow-hidden"
                    >
                      Save 41%
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {PRICING.map((plan, i) => (
                <div
                  key={i}
                  className={`relative bg-white dark:bg-[#171b22] rounded-2xl p-8 border ${
                    plan.popular
                      ? 'border-brand-accent shadow-xl shadow-brand-accent/10'
                      : 'border-[#e1ddd8]/50 dark:border-[#262b35]/50'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-brand-accent text-white font-albert text-[12px] font-semibold rounded-full uppercase tracking-wide">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <div className="mb-6">
                    <h3 className="font-albert text-[22px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                      {plan.name}
                    </h3>
                    <p className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      {plan.description}
                    </p>
                  </div>
                  
                  {/* Price */}
                  <div className="mb-2">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={`price-${plan.name}-${billingPeriod}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="font-albert text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] inline-block"
                      >
                        ${billingPeriod === 'annual' ? plan.annualPrice : plan.monthlyPrice}
                      </motion.span>
                    </AnimatePresence>
                    <span className="font-sans text-[16px] text-[#5f5a55] dark:text-[#b2b6c2]">/month</span>
                  </div>
                  
                  {/* Trial info */}
                  <div className="mb-6">
                    <p className="font-sans text-[14px] font-semibold text-red-500">Free for 7 days</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={`billing-${plan.name}-${billingPeriod}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]"
                      >
                        {billingPeriod === 'annual' 
                          ? `Billed as $${plan.annualPrice * 12}/year after trial`
                          : 'Billed monthly after trial'
                        }
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  
                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mb-6 py-4 border-y border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                    <div className="text-center">
                      <div className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {plan.stats.clients}
                      </div>
                      <div className="font-sans text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">
                        Clients
                      </div>
                    </div>
                    <div className="text-center border-x border-[#e1ddd8]/50 dark:border-[#262b35]/50">
                      <div className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {plan.stats.programs}
                      </div>
                      <div className="font-sans text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">
                        Programs
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                        {plan.stats.squads}
                      </div>
                      <div className="font-sans text-[11px] text-[#5f5a55] dark:text-[#b2b6c2] uppercase tracking-wide">
                        Squads
                      </div>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="font-sans text-[14px] text-[#5f5a55] dark:text-[#b2b6c2]">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={handleCTA}
                    className={`w-full py-3.5 rounded-full font-albert text-[15px] font-semibold transition-all ${
                      plan.popular
                        ? 'bg-gradient-to-r from-[#e8b923] to-[#d4a61d] text-[#2c2520] hover:opacity-90 shadow-lg shadow-[#e8b923]/20'
                        : 'bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] hover:opacity-90'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-12 sm:py-16 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-1/4 right-10 w-64 h-64 bg-cyan-200/20 dark:bg-cyan-900/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-10 w-72 h-72 bg-brand-accent/15 rounded-full blur-3xl" />
          
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-albert text-[32px] sm:text-[42px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] mb-4">
                Questions Coaches Ask
              </h2>
            </motion.div>
            
            <div className="space-y-4">
              {FAQ.map((item, i) => (
                <motion.div
                  key={i}
                  className="bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8]/50 dark:border-[#262b35]/50 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] pr-4">
                      {item.q}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
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
                        <div className="px-5 pb-5">
                          <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                            {item.a}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-[#1a1a1a] via-[#2c2520] to-[#1a1a1a] dark:from-[#0f1218] dark:via-[#171b22] dark:to-[#0f1218] rounded-3xl py-16 sm:py-20 px-8 sm:px-12 lg:px-16 relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute inset-0 -z-10">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#e8b923]/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-brand-accent/10 rounded-full blur-3xl" />
              </div>
              
              <div className="max-w-3xl mx-auto text-center relative">
                <h2 className="font-albert text-[32px] sm:text-[44px] lg:text-[52px] font-bold text-white tracking-[-2px] leading-[1.1] mb-6">
                  Your Clients Are Waiting{' '}
                  <span className="hidden sm:inline"><br /></span>
                  <span className="bg-gradient-to-r from-[#e8b923] via-[#f0c940] to-[#e8b923] bg-clip-text text-transparent">
                    to Be Held Accountable.
                  </span>
                </h2>
                
                <p className="font-sans text-[17px] sm:text-[19px] text-[#a7a39e] dark:text-[#b2b6c2] max-w-xl mx-auto mb-10">
                  Stop guessing. Start delivering. Set up your first program in 10 minutes.
                </p>
                
                <button
                  onClick={handleCTA}
                  className="inline-flex items-center gap-2 px-8 sm:px-10 py-4 sm:py-5 bg-gradient-to-r from-[#e8b923] to-[#d4a61d] hover:from-[#f0c940] hover:to-[#e8b923] text-[#2c2520] rounded-full font-albert text-[16px] sm:text-[18px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-[#e8b923]/30"
                >
                  <span className="sm:hidden">Start Your Trial</span>
                  <span className="hidden sm:inline">Start Your 7-Day Trial</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                
                <p className="font-sans text-[13px] text-[#7d8190] mt-6">
                  Cancel anytime • Set up in 10 minutes
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                  <Image
                    src={LOGO_URL}
                    alt="Coachful"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <span className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                  Coachful
                </span>
              </div>
              
              <div className="flex items-center gap-6 text-[#5f5a55] dark:text-[#b2b6c2]">
                <Link href="/privacy" className="font-sans text-[14px] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">Privacy</Link>
                <Link href="/terms" className="font-sans text-[14px] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">Terms</Link>
                <a href="mailto:support@coachful.co" className="font-sans text-[14px] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors">Contact</a>
              </div>
              
              <p className="font-sans text-[13px] text-[#a7a39e] dark:text-[#7d8190]">
                © 2025 Coachful. Built for coaches who get results.
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Quiz Modal */}
      <CoachQuizModal isOpen={quizOpen} onClose={() => setQuizOpen(false)} />

      {/* Coach Onboarding Overlay - shows for coaches who started but haven't completed signup */}
      {coachOnboardingState && (
        <CoachOnboardingOverlay state={coachOnboardingState} />
      )}
    </>
  );
}

