'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * Get Your Personal Coach Page
 * 
 * Landing page for personal coaching services with Growth Addicts.
 * Features coach profile, benefits, and CTA to the coaching intake form.
 */

export default function PersonalCoachPage() {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'quarterly'>('monthly');

  return (
    <div className="flex-1 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col">
      {/* Content sections */}
      <div className="flex-shrink-0 p-4 sm:p-6 lg:p-10">
        {/* Hero Section */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pt-8 pb-16">
        {/* Back button for mobile */}
        <button 
          onClick={() => window.history.back()}
          className="lg:hidden flex items-center gap-2 text-text-secondary mb-6 hover:text-text-primary transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-albert">Back</span>
        </button>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left Column - Coach Info */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 rounded-full px-4 py-2 mb-4">
              <svg className="w-5 h-5 text-[#4CAF50]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] bg-clip-text text-transparent">
                Private Coaching
              </span>
            </div>

            {/* Title */}
            <h1 className="font-albert text-[32px] sm:text-[40px] lg:text-[48px] font-semibold text-text-primary leading-[1.1] tracking-[-2px] mb-4">
              Get your personal coach
            </h1>

            {/* Subtitle */}
            <p className="font-albert text-[18px] sm:text-[20px] text-text-secondary leading-[1.5] mb-6">
              Work with a performance psychologist 1:1 to accelerate your growth, 
              overcome obstacles, and achieve your goals faster.
            </p>

            {/* Coaching Image */}
            <div className="relative w-full aspect-[16/10] mb-8 rounded-[15px] overflow-hidden shadow-lg">
              <Image
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?q=80&w=2574&auto=format&fit=crop"
                alt="Performance coaching session"
                fill
                className="object-cover"
                priority
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              {/* Badge overlay */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/90 dark:bg-[#171b22]/90 backdrop-blur-sm rounded-full px-3 py-1.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4CAF50] to-[#2E7D32] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="font-albert text-[12px] font-medium text-text-primary">1:1 Performance Coach</span>
              </div>
            </div>

            {/* Benefits List */}
            <div className="space-y-4 mb-8">
              {[
                'Weekly 1:1 video sessions with your dedicated coach',
                'Personalized growth plan tailored to your goals',
                'Unlimited messaging support between sessions',
                'Science-backed strategies for lasting change',
                'Accountability and progress tracking',
              ].map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
                &quot;The coaching sessions have been transformative. My coach helped me identify 
                patterns I couldn&apos;t see myself and gave me practical tools to make real changes. 
                I&apos;ve achieved more in 3 months than I did in the past year.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-accent to-[#7d5c3e] flex items-center justify-center text-white font-albert font-semibold">
                  S
                </div>
                <div>
                  <p className="font-albert text-[14px] font-medium text-text-primary">Sarah M.</p>
                  <p className="font-albert text-[12px] text-text-secondary">Coaching member since 2024</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Pricing Card */}
          <div className="lg:sticky lg:top-8">
            <div className="bg-white dark:bg-[#171b22] rounded-3xl p-8 shadow-lg border border-[#e1ddd8] dark:border-[#262b35]">
              {/* Private Coaching badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center gap-2 bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 rounded-full px-4 py-2">
                  <svg className="w-5 h-5 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] bg-clip-text text-transparent">
                    Private Coaching
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
                  onClick={() => setSelectedPlan('quarterly')}
                  className={`flex-1 py-3 px-4 rounded-full font-albert text-[15px] font-medium transition-all duration-200 ${
                    selectedPlan === 'quarterly'
                      ? 'bg-white dark:bg-[#171b22] text-text-primary shadow-sm'
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
                    ${selectedPlan === 'monthly' ? '99' : '79'}
                  </span>
                  <span className="font-albert text-[18px] text-text-secondary">
                    / week
                  </span>
                </div>
                <p className="font-albert text-[14px] text-text-secondary mt-1">
                  {selectedPlan === 'monthly' 
                    ? 'Billed monthly at $396/month' 
                    : 'Billed every 3 months at $948'}
                </p>
              </div>

              {/* Value callout */}
              <div className="bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 rounded-xl p-3 mb-8 text-center">
                <p className="font-albert text-[14px] text-text-primary">
                  {selectedPlan === 'monthly' 
                    ? <>Invest in <span className="font-semibold">your growth</span> with dedicated 1:1 coaching</>
                    : <>Save <span className="font-semibold text-[#2E7D32]">$240</span> compared to monthly billing</>
                  }
                </p>
              </div>

              {/* Features included */}
              <div className="space-y-3 mb-8">
                {[
                  '4 x 45-minute coaching sessions/month',
                  'Personalized action plans',
                  'Unlimited chat support',
                  'Progress tracking dashboard',
                  'Access to premium resources',
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                href={`/get-coach/form?plan=${selectedPlan}`}
                className="block w-full bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#43A047] hover:to-[#1B5E20] text-white py-4 px-6 rounded-2xl font-albert text-[17px] font-semibold transition-all duration-200 mb-4 shadow-lg shadow-[#4CAF50]/20 text-center"
              >
                Start Your Coaching Journey
              </Link>

              {/* Secondary action */}
              <Link 
                href={`/get-coach/form?plan=${selectedPlan}`}
                className="w-full text-text-secondary hover:text-text-primary py-3 font-albert text-[15px] transition-colors duration-200 block text-center"
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
              <a href="#faq" className="font-albert text-[14px] text-[#4CAF50] hover:underline">
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
            How coaching works
          </h2>

          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Book your session',
                description: 'Choose a time that works for you. Sessions are available 7 days a week.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'Meet your coach',
                description: 'Have a video call with your dedicated performance psychologist.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ),
              },
              {
                step: '3',
                title: 'Grow & achieve',
                description: 'Follow your personalized plan and watch your progress accelerate.',
                icon: (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                ),
              },
            ].map((item, index) => (
              <div key={index} className="flex sm:flex-col items-start sm:items-center text-left sm:text-center gap-4 sm:gap-0">
                {/* Icon - hidden on mobile, shown on desktop */}
                <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 items-center justify-center mb-4 text-[#4CAF50]">
                  {item.icon}
                </div>
                {/* Step badge - shown above title on desktop */}
                <div className="hidden sm:inline-block bg-[#f3f1ef] dark:bg-[#222631] rounded-full px-3 py-1 mb-3">
                  <span className="font-albert text-[12px] font-semibold text-text-secondary">
                    Step {item.step}
                  </span>
                </div>
                {/* Icon on mobile */}
                <div className="sm:hidden w-12 h-12 rounded-xl bg-gradient-to-r from-[#4CAF50]/10 to-[#2E7D32]/10 flex items-center justify-center text-[#4CAF50] flex-shrink-0">
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
            Standard vs Personal Coaching
          </h2>
          <p className="font-albert text-[16px] text-text-secondary text-center mb-10 max-w-[600px] mx-auto">
            See how personal coaching transforms your experience
          </p>

          <div className="bg-white dark:bg-[#171b22] rounded-3xl shadow-lg border border-[#e1ddd8] dark:border-[#262b35] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 border-b border-[#e1ddd8] dark:border-[#262b35]">
              <div className="p-4 sm:p-6" />
              <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8] dark:border-[#262b35]">
                <span className="font-albert text-[14px] font-semibold text-text-secondary">Standard</span>
              </div>
              <div className="p-4 sm:p-6 text-center border-l border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-r from-[#4CAF50]/5 to-[#2E7D32]/5 dark:from-[#4CAF50]/10 dark:to-[#2E7D32]/10">
                <span className="font-albert text-[14px] font-semibold bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] bg-clip-text text-transparent">Coaching</span>
              </div>
            </div>

            {/* Rows */}
            {[
              { feature: 'Squad group chat', regular: true, coaching: true },
              { feature: 'Basic progress tracking', regular: true, coaching: true },
              { feature: 'Daily streaks', regular: true, coaching: true },
              { feature: '1:1 coaching sessions', regular: false, coaching: true },
              { feature: 'Private chat with coach', regular: false, coaching: true },
              { feature: 'Personalized growth plan', regular: false, coaching: true },
              { feature: 'Science-backed strategies', regular: false, coaching: true },
              { feature: 'Unlimited messaging support', regular: false, coaching: true },
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
                <div className="p-4 sm:p-5 flex items-center justify-center border-l border-[#e1ddd8] dark:border-[#262b35] bg-gradient-to-r from-[#4CAF50]/5 to-[#2E7D32]/5 dark:from-[#4CAF50]/10 dark:to-[#2E7D32]/10">
                  <svg className="w-5 h-5 text-[#4CAF50]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              answer: 'Our coaches are certified performance psychologists with extensive experience helping professionals achieve their personal and career goals. Each coach has completed rigorous training and maintains ongoing education.',
            },
            {
              question: 'Can I switch coaches?',
              answer: 'Absolutely! If you feel like another coach might be a better fit, you can request a switch at any time. We want you to have the best possible coaching experience.',
            },
            {
              question: 'What happens in a coaching session?',
              answer: 'Sessions are 45 minutes long and tailored to your needs. Typically, you\'ll review progress, discuss challenges, work through exercises, and set action items for the week ahead.',
            },
            {
              question: 'How is this different from therapy?',
              answer: 'While therapy often focuses on healing past issues, coaching is forward-focused on achieving specific goals and optimizing performance. We complement therapy but don\'t replace it for clinical needs.',
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
            Join hundreds of Growth Addicts members who are transforming their lives with personal coaching.
          </p>
          <Link 
            href={`/get-coach/form?plan=${selectedPlan}`}
            className="inline-block bg-gradient-to-r from-[#4CAF50] to-[#2E7D32] hover:from-[#43A047] hover:to-[#1B5E20] text-white py-4 px-8 rounded-3xl font-albert text-[17px] font-semibold transition-all duration-200 shadow-lg shadow-[#4CAF50]/30"
          >
            Get Started Today
          </Link>
        </div>
      </div>
    </div>
  );
}

