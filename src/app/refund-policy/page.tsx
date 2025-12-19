'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Shield, CheckCircle, XCircle } from 'lucide-react';

export default function RefundPolicyPage() {
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
            Refund & Cancellation Policy
          </h1>
          <p className="font-sans text-[14px] text-text-tertiary mb-12">
            Last updated: November 2024
          </p>

          {/* 30-Day Guarantee Highlight */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] rounded-[24px] p-6 lg:p-8 border border-[#bbf7d0] mb-12"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Shield className="w-6 h-6 text-[#22c55e]" />
              </div>
              <div>
                <h2 className="font-albert text-[24px] font-bold text-[#166534] tracking-[-0.5px] mb-2">
                  Our 30-Day Satisfaction Guarantee
                </h2>
                <p className="font-sans text-[15px] text-[#15803d] leading-relaxed mb-3">
                  We believe in our system. If you commit to GrowthAddicts for 30 days, complete your daily tasks every day, and don&apos;t see any progress towards your goals, we&apos;ll give you a full refund. No questions asked.
                </p>
                <p className="font-sans text-[12px] text-[#166534]/70">
                  Influencee Agency OÜ · Ahtri 12, Tallinn 10151, Estonia
                </p>
              </div>
            </div>
          </motion.div>

          <div className="prose prose-neutral max-w-none">
            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                1. 30-Day Money-Back Guarantee
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                We offer a 30-day satisfaction guarantee for new subscribers. To be eligible for a refund under this guarantee, you must meet the following requirements:
              </p>
              
              <div className="bg-white rounded-xl border border-[#e1ddd8] p-6 mb-4">
                <h3 className="font-sans text-[16px] font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-[#22c55e]" />
                  Requirements for Refund Eligibility
                </h3>
                <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                  <li><strong>Complete daily tasks:</strong> You must have completed your morning check-in, evening check-in, and all assigned daily focus tasks for at least 22 out of 30 days</li>
                  <li><strong>Active engagement:</strong> You must have actively used the goal tracking and habit features</li>
                  <li><strong>Request within timeframe:</strong> Your refund request must be submitted within 30 days of your initial subscription purchase</li>
                  <li><strong>First-time subscribers only:</strong> This guarantee applies only to your first subscription with GrowthAddicts</li>
                </ul>
              </div>

              <div className="bg-white rounded-xl border border-[#e1ddd8] p-6">
                <h3 className="font-sans text-[16px] font-semibold text-text-primary mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-[#ef4444]" />
                  Not Eligible for Guarantee Refund
                </h3>
                <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                  <li>Users who did not complete daily tasks consistently</li>
                  <li>Users who request a refund after 30 days</li>
                  <li>Returning subscribers who previously received a refund</li>
                  <li>Users who violated our Terms of Service</li>
                </ul>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                2. How to Request a Guarantee Refund
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                To request a refund under our 30-day guarantee:
              </p>
              <ol className="list-decimal pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Email us at <a href="mailto:support@growthaddicts.com" className="text-[#a07855] hover:underline">support@growthaddicts.com</a> with the subject line &quot;30-Day Guarantee Refund Request&quot;</li>
                <li>Include your account email address and the date of your subscription</li>
                <li>Briefly explain why you feel you haven&apos;t made progress despite completing the program</li>
                <li>Our team will review your account activity and respond within 3-5 business days</li>
                <li>If approved, refunds are processed within 5-10 business days to your original payment method</li>
              </ol>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                3. Cancellation Policy
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                You can cancel your subscription at any time:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li><strong>How to cancel:</strong> Visit your account settings and click &quot;Cancel Subscription&quot;, or email us at support@growthaddicts.com</li>
                <li><strong>Effective date:</strong> Cancellation takes effect at the end of your current billing period</li>
                <li><strong>Access after cancellation:</strong> You&apos;ll retain full access to all features until your subscription period ends</li>
                <li><strong>No partial refunds:</strong> We do not provide refunds for partial months of service after the 30-day guarantee period</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                4. Refunds Outside the Guarantee
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                Outside of our 30-day guarantee, refunds may be considered in exceptional circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Duplicate charges or billing errors</li>
                <li>Extended service outages caused by us</li>
                <li>Other circumstances at our discretion</li>
              </ul>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mt-4">
                Each case will be reviewed individually. Contact our support team to discuss your situation.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                5. Resubscription
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                If you cancel your subscription, you can resubscribe at any time. Your previous data (goals, habits, check-in history) will be retained and available when you return. Note that the 30-day guarantee only applies to first-time subscribers.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                6. Premium Plan Downgrades
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                If you downgrade from Premium to Standard, the change takes effect at the end of your current billing period. You won&apos;t receive a refund for the price difference, but you&apos;ll maintain premium access until the period ends.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                7. Account Termination
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                If we terminate your account for violation of our Terms of Service, you will not be eligible for any refund. We reserve the right to refuse service to anyone at our discretion.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                8. Contact Us
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                For any questions about refunds or cancellations, please contact us at{' '}
                <a href="mailto:support@growthaddicts.com" className="text-[#a07855] hover:underline">
                  support@growthaddicts.com
                </a>
              </p>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mt-4 mb-4">
                We&apos;re here to help and will do our best to resolve any concerns.
              </p>
              <div className="bg-[#faf8f6] rounded-xl p-4 border border-[#e1ddd8]">
                <p className="font-sans text-[14px] text-text-secondary">
                  <strong>Influencee Agency OÜ</strong> (owner of GrowthAddicts)<br />
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

