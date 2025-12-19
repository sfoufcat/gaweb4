'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="font-sans text-[14px] text-text-tertiary mb-12">
            Last updated: November 2024
          </p>

          <div className="prose prose-neutral max-w-none">
            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                1. Acceptance of Terms
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                By accessing or using GrowthAddicts (&quot;the Service&quot;), operated by Influencee Agency OÜ, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                GrowthAddicts is a personal development and accountability platform designed to help users achieve their goals through structured daily practices, community support, and progress tracking.
              </p>
              <div className="bg-[#faf8f6] rounded-xl p-4 border border-[#e1ddd8]">
                <p className="font-sans text-[14px] text-text-secondary">
                  <strong>Company Information:</strong><br />
                  Influencee Agency OÜ<br />
                  Ahtri 12, Tallinn 10151, Estonia
                </p>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                2. User Accounts
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                To use certain features of the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                3. Subscription and Payment
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                GrowthAddicts offers subscription-based services. By subscribing, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary mb-4">
                <li>Pay the applicable subscription fees as described at the time of purchase</li>
                <li>Automatic renewal of your subscription until you cancel</li>
                <li>Provide valid payment information and keep it up to date</li>
              </ul>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                All payments are processed securely through Stripe. We do not store your payment card details.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                4. User Conduct
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Use the Service for any unlawful purpose</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Post content that is offensive, defamatory, or violates others&apos; rights</li>
                <li>Attempt to gain unauthorized access to the Service or its systems</li>
                <li>Use the Service to distribute spam or malicious content</li>
                <li>Impersonate any person or entity</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                5. Intellectual Property
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                The Service and its original content, features, and functionality are owned by GrowthAddicts and are protected by international copyright, trademark, and other intellectual property laws.
              </p>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                You retain ownership of any content you create or upload to the Service, but grant us a license to use, display, and distribute such content in connection with the Service.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                6. Disclaimers
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                GrowthAddicts is a personal development tool and is not a substitute for professional medical, psychological, or financial advice. The Service is provided &quot;as is&quot; without warranties of any kind.
              </p>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                Results may vary. While we provide tools and support for goal achievement, success depends on individual effort, circumstances, and consistency.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                7. Limitation of Liability
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                To the maximum extent permitted by law, GrowthAddicts shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                8. Termination
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We reserve the right to terminate or suspend your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                9. Changes to Terms
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We may modify these Terms at any time. We will notify you of significant changes by email or through the Service. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                10. Contact Us
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us at{' '}
                <a href="mailto:support@growthaddicts.com" className="text-[#a07855] hover:underline">
                  support@growthaddicts.com
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

