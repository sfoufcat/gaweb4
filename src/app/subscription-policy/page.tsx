'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SubscriptionPolicyPage() {
  return (
    <div className="min-h-screen bg-app-bg">
      {/* Header */}
      <motion.div 
        className="sticky top-0 z-50 bg-app-bg/95 backdrop-blur-sm border-b border-[#e1ddd8]/50"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between px-6 py-3 max-w-4xl mx-auto">
          <Link href="/onboarding/plan" className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-sans text-[14px]">Back</span>
          </Link>
          <Image 
            src="/logo.jpg" 
            alt="GrowthAddicts" 
            width={40} 
            height={40} 
            className="rounded-lg"
          />
        </div>
      </motion.div>

      {/* Content */}
      <div className="px-6 py-12 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="font-albert text-[36px] lg:text-[44px] text-text-primary tracking-[-2px] leading-[1.15] mb-4">
            Subscription Policy
          </h1>
          <p className="font-sans text-[14px] text-text-tertiary mb-12">
            Last updated: November 2024
          </p>

          <div className="prose prose-neutral max-w-none">
            <section className="mb-10">
              <div className="bg-[#faf8f6] rounded-xl p-4 border border-[#e1ddd8] mb-6">
                <p className="font-sans text-[14px] text-text-secondary">
                  <strong>Service Provider:</strong><br />
                  Influencee Agency OÜ (owner of GrowthAddicts)<br />
                  Ahtri 12, Tallinn 10151, Estonia
                </p>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                1. Subscription Plans
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                GrowthAddicts offers the following subscription plans:
              </p>
              
              <div className="bg-white rounded-xl border border-[#e1ddd8] p-6 mb-4">
                <h3 className="font-sans text-[18px] font-semibold text-text-primary mb-2">Standard Plan - $9/month</h3>
                <ul className="list-disc pl-6 space-y-1 font-sans text-[15px] text-text-secondary">
                  <li>Daily morning & evening check-ins</li>
                  <li>Goal tracking & progress visualization</li>
                  <li>Habit tracking system</li>
                  <li>Daily focus tasks</li>
                  <li>Weekly reflections</li>
                  <li>Community access</li>
                </ul>
              </div>

              <div className="bg-white rounded-xl border border-[#e1ddd8] p-6">
                <h3 className="font-sans text-[18px] font-semibold text-text-primary mb-2">Premium Plan - $99/month</h3>
                <ul className="list-disc pl-6 space-y-1 font-sans text-[15px] text-text-secondary">
                  <li>Everything in Standard</li>
                  <li>Premium Squad membership</li>
                  <li>Dedicated accountability coach</li>
                  <li>Priority support</li>
                  <li>Exclusive content & resources</li>
                  <li>Advanced analytics</li>
                </ul>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                2. Billing Cycle
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                All subscriptions are billed on a monthly basis:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Your subscription begins immediately upon successful payment</li>
                <li>You will be charged on the same date each month (e.g., if you subscribe on the 15th, you&apos;ll be billed on the 15th of each month)</li>
                <li>If your billing date falls on a day that doesn&apos;t exist in a given month, you&apos;ll be billed on the last day of that month</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                3. Automatic Renewal
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                Your subscription will automatically renew each month unless you cancel:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Renewal charges are processed automatically using your saved payment method</li>
                <li>You will receive a receipt via email for each renewal</li>
                <li>If your payment fails, we will attempt to charge your card again and notify you</li>
                <li>After multiple failed payment attempts, your subscription may be suspended</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                4. Price Changes
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We reserve the right to change subscription prices. If we change prices, we will provide at least 30 days' notice before the change takes effect. You may cancel your subscription before the new price applies.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                5. Payment Methods
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                We accept the following payment methods through Stripe:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Major credit cards (Visa, Mastercard, American Express, Discover)</li>
                <li>Debit cards</li>
                <li>Apple Pay and Google Pay (where available)</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                6. Updating Payment Information
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                You can update your payment method at any time through your account settings. It is your responsibility to ensure your payment information is current to avoid service interruption.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                7. Upgrading or Downgrading
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                You can change your plan at any time:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li><strong>Upgrading:</strong> When you upgrade, you&apos;ll be charged the prorated difference immediately and gain instant access to premium features</li>
                <li><strong>Downgrading:</strong> When you downgrade, the change will take effect at the end of your current billing period. You&apos;ll retain premium access until then</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                8. Taxes
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                Subscription prices do not include applicable taxes. Any applicable taxes will be calculated and added at checkout based on your location.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                9. Contact Us
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                For billing questions or issues, please contact us at{' '}
                <a href="mailto:billing@growthaddicts.com" className="text-[#a07855] hover:underline">
                  billing@growthaddicts.com
                </a>
              </p>
              <div className="bg-[#faf8f6] rounded-xl p-4 border border-[#e1ddd8]">
                <p className="font-sans text-[14px] text-text-secondary">
                  <strong>Influencee Agency OÜ</strong><br />
                  Ahtri 12, Tallinn 10151, Estonia
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

