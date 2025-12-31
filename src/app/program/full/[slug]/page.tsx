'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Users, Clock, Star, Bell, CheckCircle } from 'lucide-react';
import { getDecoyBySlug } from '@/lib/config/decoy-listings';
import type { DecoyListing } from '@/types';
import { MARKETPLACE_CATEGORIES } from '@/types';
import { LinedGradientBackground } from '@/components/ui/lined-gradient-background';

/**
 * Program Full Page
 * 
 * Landing page for decoy programs that shows they are "currently full"
 * with a waitlist CTA and browse other programs option.
 */
export default function ProgramFullPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [program, setProgram] = useState<DecoyListing | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  useEffect(() => {
    const decoy = getDecoyBySlug(slug);
    if (decoy) {
      setProgram(decoy);
    } else {
      setNotFound(true);
    }
  }, [slug]);
  
  // Handle waitlist submission (just UI feedback, no backend)
  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };
  
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="text-center">
          <h1 className="font-albert text-[32px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
            Program Not Found
          </h1>
          <p className="font-sans text-[16px] text-[#5f5a55] dark:text-[#b2b6c2] mb-6">
            The program you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-xl font-albert text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Programs
          </Link>
        </div>
      </div>
    );
  }
  
  if (!program) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b]">
        <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  const categoryLabel = program.categories[0] 
    ? MARKETPLACE_CATEGORIES.find(c => c.value === program.categories[0])?.label 
    : null;
  
  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] -z-10" />
      <LinedGradientBackground fixed />
      
      <div className="min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-[#faf8f6]/80 dark:bg-[#05070b]/80 backdrop-blur-xl border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors font-albert text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Marketplace
              </Link>
              
              <Link
                href="/"
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                  <Image
                    src="https://firebasestorage.googleapis.com/v0/b/gawebdev2-3191a.firebasestorage.app/o/assets%2FLogo.png?alt=media&token=686f3c16-47d2-4a2e-aef3-fa2d87e050af"
                    alt="GrowthAddicts"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </Link>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero Image */}
          <div className="relative aspect-[16/9] sm:aspect-[21/9] rounded-2xl sm:rounded-3xl overflow-hidden mb-8">
            <Image
              src={program.coverImageUrl}
              alt={program.title}
              fill
              className="object-cover"
              priority
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            {/* "Full" Badge */}
            <div className="absolute top-4 right-4 px-4 py-2 bg-red-500/90 backdrop-blur-sm rounded-full">
              <span className="font-albert text-sm font-semibold text-white">
                Currently Full
              </span>
            </div>
            
            {/* Category Badge */}
            {categoryLabel && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-sm rounded-full">
                <span className="font-albert text-xs font-medium text-[#5f5a55] dark:text-[#b2b6c2]">
                  {categoryLabel}
                </span>
              </div>
            )}
          </div>
          
          {/* Program Info */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Title & Coach */}
              <div>
                <h1 className="font-albert text-[32px] sm:text-[40px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1.5px] leading-tight mb-4">
                  {program.title}
                </h1>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden relative">
                    <Image
                      src={program.coachAvatarUrl}
                      alt={program.coachName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div>
                    <p className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8]">
                      {program.coachName}
                    </p>
                    <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      Program Creator
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Description */}
              <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-6">
                <h2 className="font-albert text-[18px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-3">
                  About this program
                </h2>
                <p className="font-sans text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed">
                  {program.description}
                </p>
              </div>
              
              {/* Fake Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 text-center">
                  <Users className="w-5 h-5 text-brand-accent mx-auto mb-2" />
                  <p className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    250+
                  </p>
                  <p className="font-sans text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Graduates
                  </p>
                </div>
                <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 text-center">
                  <Clock className="w-5 h-5 text-brand-accent mx-auto mb-2" />
                  <p className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    12
                  </p>
                  <p className="font-sans text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Weeks
                  </p>
                </div>
                <div className="bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl p-4 text-center">
                  <Star className="w-5 h-5 text-brand-accent mx-auto mb-2" />
                  <p className="font-albert text-[20px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8]">
                    4.9
                  </p>
                  <p className="font-sans text-[12px] text-[#5f5a55] dark:text-[#b2b6c2]">
                    Rating
                  </p>
                </div>
              </div>
            </div>
            
            {/* Right Column - Waitlist CTA */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl p-6 space-y-5">
                {/* Full Notice */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="font-albert text-[15px] font-semibold text-red-700 dark:text-red-300 mb-1">
                        This program is currently full
                      </h3>
                      <p className="font-sans text-[13px] text-red-600/80 dark:text-red-400/80">
                        All spots for the current cohort have been filled.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Waitlist Form */}
                {submitted ? (
                  <div className="text-center py-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-3">
                      <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-albert text-[16px] font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] mb-1">
                      You&apos;re on the list!
                    </h3>
                    <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2]">
                      We&apos;ll notify you when a spot opens up.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                    <div>
                      <label className="block font-albert text-[14px] font-medium text-[#1a1a1a] dark:text-[#f5f5f8] mb-2">
                        Join the waitlist
                      </label>
                      <p className="font-sans text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] mb-3">
                        Be the first to know when spots open up.
                      </p>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full px-4 py-3 bg-[#faf8f6] dark:bg-[#262b35] border border-[#e1ddd8] dark:border-[#313746] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert placeholder:text-[#a7a39e] dark:placeholder:text-[#7d8190] focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-brand-accent to-[#8c6245] hover:from-[#8c6245] hover:to-[#7a5539] text-white rounded-xl font-albert text-[15px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Bell className="w-4 h-4" />
                      Notify Me
                    </button>
                  </form>
                )}
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#e1ddd8] dark:border-[#262b35]" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-white dark:bg-[#171b22] font-sans text-[12px] text-[#a7a39e] dark:text-[#7d8190]">
                      or
                    </span>
                  </div>
                </div>
                
                {/* Browse Other Programs */}
                <Link
                  href="/"
                  className="block w-full text-center px-6 py-3 bg-[#faf8f6] dark:bg-[#262b35] hover:bg-[#e1ddd8] dark:hover:bg-[#313746] border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert text-[14px] font-medium transition-colors"
                >
                  Browse Other Programs
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

