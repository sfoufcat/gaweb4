'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMenuTitles } from '@/contexts/BrandingContext';

/**
 * Upgrade Squad to Premium Page
 * 
 * Landing page for premium squad upgrade with dedicated mentor.
 * Features benefits, pricing, and booking CTA.
 * 
 * Main premise: Get a dedicated mentor who joins your group chat,
 * supports your squad, and leads weekly calls to keep everyone
 * on track and progressing together.
 */

export default function UpgradeSquadPage() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'quarterly'>('monthly');
  
  // Get customizable menu titles
  const { squad: squadTitle, squadLower } = useMenuTitles();

  return (
    <div className="min-h-[100dvh] bg-[#1a1a1a] flex flex-col">
      {/* Light background wrapper for content sections */}
      <div className="bg-[#faf8f6] flex-shrink-0">
        {/* Hero Section */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
          {/* Back button for mobile */}
          <Link 
            href="/squad"
            className="lg:hidden flex items-center gap-2 text-text-secondary mb-6 hover:text-text-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-albert">Back to {squadTitle}</span>
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column - Premium Squad Info */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-full px-4 py-2 mb-4">
                <svg className="w-5 h-5 text-[#FF6B6B]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Premium {squadTitle}
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[32px] sm:text-[40px] lg:text-[48px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                Upgrade your {squadLower} with a dedicated mentor
              </h1>

              {/* Subtitle */}
              <p className="font-albert text-[18px] sm:text-[20px] text-text-secondary leading-[1.5] mb-6">
                Get a dedicated mentor who joins your group chat, supports your {squadLower}, 
                and leads weekly calls to keep everyone on track and progressing together.
              </p>

              {/* Squad Coaching Image */}
              <div className="relative w-full aspect-[16/10] mb-8 rounded-[15px] overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=2670&auto=format&fit=crop"
                  alt="Premium squad coaching session"
                  fill
                  className="object-cover"
                  priority
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {/* Badge overlay */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-[#a07855] to-[#7d5c3e]"
                      />
                    ))}
                  </div>
                  <span className="font-albert text-[12px] font-medium text-text-primary">{squadTitle} + Mentor</span>
                </div>
              </div>

              {/* Benefits List */}
              <div className="space-y-4 mb-8">
                {[
                  `Dedicated mentor joins your ${squadLower} chat for daily support`,
                  `Weekly group coaching calls with your entire ${squadLower}`,
                  `Personalized ${squadLower} growth plan tailored to your goals`,
                  `Accountability tracking for every ${squadLower} member`,
                  'Priority support and faster response times',
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="font-albert text-[16px] text-text-primary leading-[1.5]">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Testimonial */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#e1ddd8]">
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-5 h-5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="font-albert text-[15px] text-text-secondary leading-[1.6] italic mb-4">
                  &quot;Our squad was doing okay on our own, but adding a mentor changed everything. 
                  The weekly calls keep us focused, and having someone in our chat who understands 
                  our goals makes a huge difference. We&apos;ve all grown faster together.&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['M', 'J', 'A', 'K'].map((initial, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-[12px] border-2 border-white"
                      >
                        {initial}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="font-albert text-[14px] font-medium text-text-primary">The Momentum Squad</p>
                    <p className="font-albert text-[12px] text-text-secondary">Premium members since 2024</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Pricing Card */}
            <div className="lg:sticky lg:top-8">
              <div className="bg-white rounded-3xl p-8 shadow-lg border border-[#e1ddd8]">
                {/* Premium badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-full px-4 py-2">
                    <svg className="w-5 h-5 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                      Premium {squadTitle} Upgrade
                    </span>
                  </div>
                </div>

                {/* Plan Toggle */}
                <div className="bg-[#f3f1ef] rounded-full p-1 flex gap-1 mb-8">
                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`flex-1 py-3 px-4 rounded-full font-albert text-[15px] font-medium transition-all duration-200 ${
                      selectedPlan === 'monthly'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setSelectedPlan('quarterly')}
                    className={`flex-1 py-3 px-4 rounded-full font-albert text-[15px] font-medium transition-all duration-200 ${
                      selectedPlan === 'quarterly'
                        ? 'bg-white text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Quarterly
                    <span className="ml-2 text-[12px] text-[#4CAF50] font-semibold">Save 20%</span>
                  </button>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[48px] font-bold text-text-primary tracking-[-2px]">
                      ${selectedPlan === 'monthly' ? '49' : '39'}
                    </span>
                    <span className="font-albert text-[18px] text-text-secondary">
                      / week
                    </span>
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary mt-1">
                    {selectedPlan === 'monthly' 
                      ? 'Billed monthly at $196/month' 
                      : 'Billed every 3 months at $468'}
                  </p>
                </div>

                {/* Per member info */}
                <div className="bg-[#f3f1ef] rounded-xl p-3 mb-8 text-center">
                  <p className="font-albert text-[14px] text-text-secondary">
                    Split with your {squadLower} • As low as <span className="font-semibold text-text-primary">${selectedPlan === 'monthly' ? '10' : '8'}/week</span> per member
                  </p>
                </div>

                {/* Features included */}
                <div className="space-y-3 mb-8">
                  {[
                    `Dedicated mentor in your ${squadLower} chat`,
                    '4 weekly group coaching calls/month',
                    `Personalized ${squadLower} growth plans`,
                    'Progress tracking for all members',
                    'Priority support & fast responses',
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-albert text-[15px] text-text-primary">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Link 
                  href={selectedPlan === 'monthly' ? '/guided-monthly' : '/guided-halfyear'}
                  className="block w-full bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] hover:from-[#FF7A55] hover:to-[#FF5B5B] text-white py-4 px-6 rounded-2xl font-albert text-[17px] font-semibold transition-all duration-200 mb-4 shadow-lg shadow-[#FF6B6B]/20 text-center"
                >
                  Upgrade Your {squadTitle}
                </Link>

                {/* Secondary action */}
                <Link 
                  href={selectedPlan === 'monthly' ? '/guided-monthly' : '/guided-halfyear'}
                  className="block w-full text-text-secondary hover:text-text-primary py-3 font-albert text-[15px] transition-colors duration-200 text-center"
                >
                  Book a free {squadLower} consultation first
                </Link>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8]">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-albert text-[12px]">Secure checkout</span>
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-albert text-[12px]">Cancel anytime</span>
                  </div>
                </div>
              </div>

              {/* FAQ Link */}
              <p className="text-center mt-6">
                <a href="#faq" className="font-albert text-[14px] text-[#FF6B6B] hover:underline">
                  Have questions? Read our FAQ
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* How it works section */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 py-8">
          <div className="bg-white py-12 px-6 sm:px-12 rounded-3xl border border-[#e1ddd8]">
            <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-text-primary text-center mb-12 tracking-[-1px]">
              How premium {squadLower}s work
            </h2>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: `Upgrade your ${squadLower}`,
                  description: `Choose a plan and your ${squadLower} instantly gets premium status with all benefits.`,
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  ),
                },
                {
                  step: '2',
                  title: 'Meet your mentor',
                  description: `Your dedicated mentor joins your ${squadLower} chat and schedules your first group call.`,
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  ),
                },
                {
                  step: '3',
                  title: 'Grow as a team',
                  description: `Weekly calls, daily chat support, and ${squadLower}-wide accountability keep everyone moving forward.`,
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  ),
                },
              ].map((item, index) => (
                <div key={index} className="flex sm:flex-col items-start sm:items-center text-left sm:text-center gap-4 sm:gap-0">
                  {/* Icon - hidden on mobile, shown on desktop */}
                  <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 items-center justify-center mb-4 text-[#FF6B6B]">
                    {item.icon}
                  </div>
                  {/* Step badge - shown above title on desktop */}
                  <div className="hidden sm:inline-block bg-[#f3f1ef] rounded-full px-3 py-1 mb-3">
                    <span className="font-albert text-[12px] font-semibold text-text-secondary">
                      Step {item.step}
                    </span>
                  </div>
                  {/* Icon on mobile */}
                  <div className="sm:hidden w-12 h-12 rounded-xl bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 flex items-center justify-center text-[#FF6B6B] flex-shrink-0">
                    {item.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 sm:flex-none">
                    <div className="flex items-center gap-2 sm:block mb-1 sm:mb-2">
                      {/* Step badge inline on mobile */}
                      <span className="sm:hidden font-albert text-[12px] font-semibold text-text-secondary bg-[#f3f1ef] rounded-full px-2 py-0.5">
                        Step {item.step}
                      </span>
                      <h3 className="font-albert text-[16px] sm:text-[18px] font-semibold text-text-primary">
                        {item.title}
                      </h3>
                    </div>
                    <p className="font-albert text-[14px] text-text-secondary leading-[1.5]">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Section */}
        <div className="bg-[#faf8f6] py-16 border-t border-[#e1ddd8]">
          <div className="max-w-[900px] mx-auto px-4 sm:px-8">
            <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-text-primary text-center mb-4 tracking-[-1px]">
              Regular vs Premium {squadTitle}
            </h2>
            <p className="font-albert text-[16px] text-text-secondary text-center mb-10 max-w-[600px] mx-auto">
              See how a premium upgrade transforms your {squadLower} experience
            </p>

            <div className="bg-white rounded-3xl shadow-lg border border-[#e1ddd8] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 border-b border-[#e1ddd8]">
                <div className="p-4 sm:p-6" />
                <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8]">
                  <span className="font-albert text-[14px] font-semibold text-text-secondary">Regular {squadTitle}</span>
                </div>
                <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8] bg-gradient-to-r from-[#FF8A65]/5 to-[#FF6B6B]/5">
                  <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">Premium {squadTitle}</span>
                </div>
              </div>

              {/* Rows */}
              {[
                { feature: `${squadTitle} group chat`, regular: true, premium: true },
                { feature: `${squadTitle} streak tracking`, regular: true, premium: true },
                { feature: 'Member progress stats', regular: true, premium: true },
                { feature: 'Dedicated mentor in chat', regular: false, premium: true },
                { feature: 'Weekly group coaching calls', regular: false, premium: true },
                { feature: `Personalized ${squadLower} plans`, regular: false, premium: true },
                { feature: 'Priority support', regular: false, premium: true },
              ].map((row, index) => (
                <div key={index} className="grid grid-cols-3 border-b border-[#e1ddd8] last:border-b-0">
                  <div className="p-4 sm:p-5 flex items-center">
                    <span className="font-albert text-[14px] sm:text-[15px] text-text-primary">{row.feature}</span>
                  </div>
                  <div className="p-4 sm:p-5 flex items-center justify-center border-l border-[#e1ddd8]">
                    {row.regular ? (
                      <svg className="w-5 h-5 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#d1ccc5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="p-4 sm:p-5 flex items-center justify-center border-l border-[#e1ddd8] bg-gradient-to-r from-[#FF8A65]/5 to-[#FF6B6B]/5">
                    <svg className="w-5 h-5 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div id="faq" className="max-w-[800px] mx-auto px-4 sm:px-8 py-16">
          <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-text-primary text-center mb-12 tracking-[-1px]">
            Frequently asked questions
          </h2>

          <div className="space-y-4">
            {[
              {
                question: 'Who are the mentors?',
                answer: 'Our mentors are certified performance coaches with extensive experience helping groups achieve their goals together. They\'re trained to foster team dynamics, facilitate productive group discussions, and support each member\'s individual growth within the squad context.',
              },
              {
                question: 'How do the weekly calls work?',
                answer: 'Your mentor schedules a recurring weekly video call at a time that works for your squad. These 60-minute sessions include progress check-ins, goal setting, obstacle troubleshooting, and growth exercises. All squad members are encouraged to attend, but recordings are available.',
              },
              {
                question: 'Can we split the cost among squad members?',
                answer: 'Absolutely! Many squads split the premium cost among members. With 4-5 members, this brings the cost down to around $8-10 per person per week — less than a coffee for group coaching and mentorship.',
              },
              {
                question: 'What happens in the squad chat?',
                answer: 'Your mentor actively participates in your squad\'s group chat, offering encouragement, answering questions, providing resources, and checking in on progress. They\'re there to support the whole team throughout the week, not just during calls.',
              },
              {
                question: 'Can we downgrade back to a regular squad?',
                answer: 'Yes, you can cancel your premium subscription anytime. Your squad will revert to regular status at the end of your billing period. You\'ll keep all progress data and can upgrade again whenever you\'d like.',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="group bg-white rounded-2xl border border-[#e1ddd8] overflow-hidden"
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                  <span className="font-albert text-[16px] font-medium text-text-primary pr-4">
                    {faq.question}
                  </span>
                  <svg
                    className="w-5 h-5 text-text-secondary flex-shrink-0 transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5">
                  <p className="font-albert text-[14px] text-text-secondary leading-[1.6]">
                    {faq.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-[#1a1a1a] pt-16 pb-32 md:pb-16 rounded-[32px] mt-auto mx-4 sm:mx-6 lg:mx-10 mb-8">
        <div className="max-w-[600px] mx-auto px-4 text-center">
          <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-white mb-4 tracking-[-1px]">
            Ready to level up your {squadLower}?
          </h2>
          <p className="font-albert text-[16px] text-white/70 mb-8">
            Join the premium {squadLower}s achieving more together with dedicated mentorship and weekly coaching.
          </p>
          <Link 
            href={selectedPlan === 'monthly' ? '/guided-monthly' : '/guided-halfyear'}
            className="inline-block bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] hover:from-[#FF7A55] hover:to-[#FF5B5B] text-white py-4 px-8 rounded-3xl font-albert text-[17px] font-semibold transition-all duration-200 shadow-lg shadow-[#FF6B6B]/30"
          >
            Upgrade Your {squadTitle} Now
          </Link>
        </div>
      </div>
    </div>
  );
}

