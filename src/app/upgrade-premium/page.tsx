'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

/**
 * Upgrade to Premium Page
 * 
 * Landing page for individual premium membership upgrade.
 * Users upgrade themselves to join a premium squad with a coach.
 * 
 * Main premise: Get access to a coach-led premium squad with weekly calls,
 * better performance tracking, and dedicated support to accelerate your growth.
 */

export default function UpgradePremiumPage() {
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'biannual'>('monthly');
  
  // Get redirect URL from query params (used for invite flow)
  const redirectAfterUpgrade = searchParams.get('redirectAfterUpgrade');
  const redirectParam = redirectAfterUpgrade ? `&redirect=${encodeURIComponent(redirectAfterUpgrade)}` : '';

  return (
    <div className="min-h-[100dvh] bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Light background wrapper for content sections */}
      <div className="bg-[#faf8f6] dark:bg-[#05070b] flex-shrink-0">
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
            <span className="font-albert">Back</span>
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left Column - Premium Info */}
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-full px-4 py-2 mb-4">
                <svg className="w-5 h-5 text-[#FF6B6B]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                  Premium Membership
                </span>
              </div>

              {/* Title */}
              <h1 className="font-albert text-[32px] sm:text-[40px] lg:text-[48px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
                Join a premium squad with a dedicated coach
              </h1>

              {/* Subtitle */}
              <p className="font-albert text-[18px] sm:text-[20px] text-text-secondary leading-[1.5] mb-6">
                Get matched with a coach-led premium squad featuring weekly group calls, 
                advanced performance tracking, and dedicated support to accelerate your personal growth.
              </p>

              {/* Coaching Image */}
              <div className="relative w-full aspect-[16/10] mb-8 rounded-[15px] overflow-hidden shadow-lg">
                <Image
                  src="https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=2670&auto=format&fit=crop"
                  alt="Premium coaching session"
                  fill
                  className="object-cover"
                  priority
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {/* Badge overlay */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 dark:bg-[#171b22]/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="font-albert text-[12px] font-medium text-text-primary">Coach-led Premium Squad</span>
                </div>
              </div>

              {/* Benefits List */}
              <div className="space-y-4 mb-8">
                {[
                  'Weekly group coaching calls led by your dedicated coach',
                  'Access to an exclusive premium squad with like-minded members',
                  'Advanced performance tracking and personalized insights',
                  'Priority support and faster response times',
                  'Exclusive resources and growth materials',
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
              <div className="bg-white dark:bg-[#171b22] rounded-2xl p-6 shadow-sm border border-[#e1ddd8] dark:border-[#262b35]">
                <div className="flex items-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-5 h-5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="font-albert text-[15px] text-text-secondary leading-[1.6] italic mb-4">
                  "Going premium was the best decision I made for my growth. The weekly calls with my 
                  coach keep me accountable, and being matched with motivated squad members who are 
                  just as committed has pushed me to achieve more than I thought possible."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#a07855] to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold text-[14px] border-2 border-white">
                    S
                  </div>
                  <div>
                    <p className="font-albert text-[14px] font-medium text-text-primary">Sarah K.</p>
                    <p className="font-albert text-[12px] text-text-secondary">Premium member since 2024</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Pricing Card */}
            <div className="lg:sticky lg:top-8">
              <div className="bg-white dark:bg-[#171b22] rounded-3xl p-8 shadow-lg border border-[#e1ddd8] dark:border-[#262b35]">
                {/* Premium badge */}
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="flex items-center gap-2 bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-full px-4 py-2">
                    <svg className="w-5 h-5 text-[#FF6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">
                      Premium Membership
                    </span>
                  </div>
                </div>

                {/* Plan Toggle */}
                <div className="bg-[#f3f1ef] dark:bg-[#222631] rounded-full p-1 flex gap-1 mb-8">
                  <button
                    onClick={() => setSelectedPlan('monthly')}
                    className={`flex-1 py-3 px-4 rounded-full font-albert text-[15px] font-medium transition-all duration-200 ${
                      selectedPlan === 'monthly'
                        ? 'bg-white dark:bg-[#171b22] text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setSelectedPlan('biannual')}
                    className={`flex-1 py-3 px-4 rounded-full font-albert text-[15px] font-medium transition-all duration-200 ${
                      selectedPlan === 'biannual'
                        ? 'bg-white dark:bg-[#171b22] text-text-primary shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    6 Months
                    <span className="ml-2 text-[12px] text-[#4CAF50] font-semibold">Save 33%</span>
                  </button>
                </div>

                {/* Price */}
                <div className="text-center mb-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="font-albert text-[48px] font-bold text-text-primary tracking-[-2px]">
                      ${selectedPlan === 'monthly' ? '99' : '66'}
                    </span>
                    <span className="font-albert text-[18px] text-text-secondary">
                      / month
                    </span>
                  </div>
                  <p className="font-albert text-[14px] text-text-secondary mt-1">
                    {selectedPlan === 'monthly' 
                      ? 'Billed monthly at $99/month' 
                      : 'Billed every 6 months at $399'}
                  </p>
                </div>

                {/* Value callout */}
                <div className="bg-gradient-to-r from-[#FF8A65]/10 to-[#FF6B6B]/10 rounded-xl p-3 mb-8 text-center">
                  <p className="font-albert text-[14px] text-text-primary">
                    {selectedPlan === 'monthly' 
                      ? <>That&apos;s less than <span className="font-semibold">$25/week</span> for premium coaching</>
                      : <>Save <span className="font-semibold text-[#4CAF50]">$195</span> compared to monthly billing</>
                    }
                  </p>
                </div>

                {/* Features included */}
                <div className="space-y-3 mb-8">
                  {[
                    'Coach-led weekly group calls',
                    'Premium squad placement',
                    'Advanced performance tracking',
                    'Priority support access',
                    'Exclusive growth resources',
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
                  href={`/upgrade-premium/form?plan=${selectedPlan === 'monthly' ? 'monthly' : 'sixMonth'}${redirectParam}`}
                  className="block w-full bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] hover:from-[#FF7A55] hover:to-[#FF5B5B] text-white py-4 px-6 rounded-2xl font-albert text-[17px] font-semibold transition-all duration-200 mb-4 shadow-lg shadow-[#FF6B6B]/20 text-center"
                >
                  Upgrade to Premium
                </Link>

                {/* Secondary action */}
                <Link 
                  href={`/upgrade-premium/form?plan=${selectedPlan === 'monthly' ? 'monthly' : 'sixMonth'}${redirectParam}`}
                  className="block w-full text-text-secondary hover:text-text-primary py-3 font-albert text-[15px] transition-colors duration-200 text-center"
                >
                  Fill in your application form
                </Link>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-6 border-t border-[#e1ddd8] dark:border-[#262b35]">
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
          <div className="bg-white dark:bg-[#171b22] py-12 px-6 sm:px-12 rounded-3xl border border-[#e1ddd8] dark:border-[#262b35]">
            <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-text-primary text-center mb-12 tracking-[-1px]">
              How premium membership works
            </h2>

            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Go premium',
                  description: 'Choose your plan and instantly unlock premium status with all the benefits.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  ),
                },
                {
                  step: '2',
                  title: 'Join your premium squad',
                  description: 'Get matched with a coach-led squad of motivated members who share your goals.',
                  icon: (
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  ),
                },
                {
                  step: '3',
                  title: 'Accelerate your growth',
                  description: 'Weekly coaching calls, premium tracking, and squad support help you achieve more faster.',
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
                  <div className="hidden sm:inline-block bg-[#f3f1ef] dark:bg-[#222631] rounded-full px-3 py-1 mb-3">
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
                      <span className="sm:hidden font-albert text-[12px] font-semibold text-text-secondary bg-[#f3f1ef] dark:bg-[#222631] rounded-full px-2 py-0.5">
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
        <div className="bg-[#faf8f6] dark:bg-[#05070b] py-16 border-t border-[#e1ddd8] dark:border-[#262b35]">
          <div className="max-w-[900px] mx-auto px-4 sm:px-8">
            <h2 className="font-albert text-[28px] sm:text-[32px] font-semibold text-text-primary text-center mb-4 tracking-[-1px]">
              Standard vs Premium Membership
            </h2>
            <p className="font-albert text-[16px] text-text-secondary text-center mb-10 max-w-[600px] mx-auto">
              See how premium transforms your experience
            </p>

            <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
                <div className="p-4 sm:p-6" />
              <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8] dark:border-[#262b35]">
                <span className="font-albert text-[14px] font-semibold text-text-secondary">Standard</span>
              </div>
                <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-r from-[#FF8A65]/5 to-[#FF6B6B]/5 dark:from-[#FF8A65]/10 dark:to-[#FF6B6B]/10">
                  <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent">Premium</span>
                </div>
              </div>

              {/* Rows */}
              {[
                { feature: 'Squad group chat', regular: true, premium: true },
                { feature: 'Basic progress tracking', regular: true, premium: true },
                { feature: 'Daily streaks', regular: true, premium: true },
                { feature: 'Coach-led premium squad', regular: false, premium: true },
                { feature: 'Weekly group coaching calls', regular: false, premium: true },
                { feature: 'Advanced performance insights', regular: false, premium: true },
                { feature: 'Priority support', regular: false, premium: true },
                { feature: 'Exclusive resources & tools', regular: false, premium: true },
              ].map((row, index) => (
                <div key={index} className="grid grid-cols-3 border-b border-[#e1ddd8] dark:border-[#262b35] last:border-b-0">
                  <div className="p-4 sm:p-5 flex items-center">
                    <span className="font-albert text-[14px] sm:text-[15px] text-text-primary">{row.feature}</span>
                  </div>
                  <div className="p-4 sm:p-5 flex items-center justify-center border-l border-[#e1ddd8] dark:border-[#262b35]">
                    {row.regular ? (
                      <svg className="w-5 h-5 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-[#d1ccc5] dark:text-[#7d8190]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="p-4 sm:p-5 flex items-center justify-center border-l border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-r from-[#FF8A65]/5 to-[#FF6B6B]/5 dark:from-[#FF8A65]/10 dark:to-[#FF6B6B]/10">
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
                question: 'Who are the coaches?',
                answer: 'Our coaches are certified performance professionals with extensive experience helping individuals achieve their goals. They\'re trained to facilitate productive group sessions, provide personalized guidance, and support each member\'s growth journey.',
              },
              {
                question: 'How do the weekly coaching calls work?',
                answer: 'Your coach schedules a recurring weekly video call at a time that works for your squad. These 60-minute sessions include progress check-ins, goal setting, obstacle troubleshooting, and growth exercises. All squad members are encouraged to attend, but recordings are available if you can\'t make it.',
              },
              {
                question: 'What kind of squad will I be matched with?',
                answer: 'We match you with a premium squad based on your goals, schedule preferences, and growth areas. You\'ll be joining motivated members who are equally committed to their personal development, led by an experienced coach.',
              },
              {
                question: 'What if I\'m already in a squad?',
                answer: 'No problem! When you go premium, you\'ll be matched with a new premium squad led by a coach. You can still maintain connections with your previous squad members outside of the premium program.',
              },
              {
                question: 'Can I cancel my subscription?',
                answer: 'Yes, you can cancel your premium subscription anytime. Your premium access will continue until the end of your billing period. You\'ll keep all your progress data and can upgrade again whenever you\'d like.',
              },
            ].map((faq, index) => (
            <details
              key={index}
              className="group bg-white dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden"
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
            Ready to accelerate your growth?
          </h2>
          <p className="font-albert text-[16px] text-white/70 mb-8">
            Join premium members achieving more with dedicated coaching and advanced performance tracking.
          </p>
          <Link 
            href={`/upgrade-premium/form?plan=${selectedPlan === 'monthly' ? 'monthly' : 'sixMonth'}${redirectParam}`}
            className="inline-block bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] hover:from-[#FF7A55] hover:to-[#FF5B5B] text-white py-4 px-8 rounded-3xl font-albert text-[17px] font-semibold transition-all duration-200 shadow-lg shadow-[#FF6B6B]/30"
          >
            Upgrade to Premium Now
          </Link>
        </div>
      </div>
    </div>
  );
}

