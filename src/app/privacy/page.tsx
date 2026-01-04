'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

export default function PrivacyPage() {
  const { logoUrl, appTitle } = useBrandingValues();
  
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
            src={logoUrl} 
            alt={appTitle} 
            width={40} 
            height={40} 
            className="rounded-lg"
            unoptimized
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
            Privacy Policy
          </h1>
          <p className="font-sans text-[14px] text-text-tertiary mb-12">
            Last updated: November 2024
          </p>

          <div className="prose prose-neutral max-w-none">
            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                1. Introduction
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                Coachful, operated by Influencee Agency OÜ (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;), is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
              </p>
              <div className="bg-[#faf8f6] rounded-xl p-4 border border-[#e1ddd8]">
                <p className="font-sans text-[14px] text-text-secondary">
                  <strong>Data Controller:</strong><br />
                  Influencee Agency OÜ<br />
                  Ahtri 12, Tallinn 10151, Estonia
                </p>
              </div>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                2. Information We Collect
              </h2>
              
              <h3 className="font-sans text-[18px] font-semibold text-text-primary mb-3">
                Personal Information
              </h3>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                When you create an account, we collect:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary mb-6">
                <li>Name and email address</li>
                <li>Profile picture (optional)</li>
                <li>Account authentication data via Clerk</li>
              </ul>

              <h3 className="font-sans text-[18px] font-semibold text-text-primary mb-3">
                Usage Information
              </h3>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                We automatically collect:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary mb-6">
                <li>Goals, habits, and progress data you enter</li>
                <li>Check-in responses and reflections</li>
                <li>Device information and browser type</li>
                <li>Usage patterns and feature interactions</li>
              </ul>

              <h3 className="font-sans text-[18px] font-semibold text-text-primary mb-3">
                Payment Information
              </h3>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                Payment processing is handled by Stripe. We do not store your complete credit card information. We only receive limited information such as the last four digits of your card for reference purposes.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                3. How We Use Your Information
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                We use your information to:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Provide and maintain the Service</li>
                <li>Personalize your experience and recommendations</li>
                <li>Process transactions and send related information</li>
                <li>Send you notifications, updates, and support messages</li>
                <li>Analyze usage to improve our Service</li>
                <li>Facilitate community features like Squad interactions</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                4. Information Sharing
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                We may share your information with:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary mb-4">
                <li><strong>Service Providers:</strong> Third-party services that help us operate the platform (Clerk for authentication, Stripe for payments, Stream for chat)</li>
                <li><strong>Squad Members:</strong> Limited profile information visible to other members in your accountability squads</li>
                <li><strong>Coaches:</strong> If you have a premium plan with coach access, your coach may view your progress data</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              </ul>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We do not sell your personal information to third parties.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                5. Data Security
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                6. Data Retention
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We retain your personal information for as long as your account is active or as needed to provide you services. You can request deletion of your account and data at any time by contacting us.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                7. Your Rights
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 font-sans text-[15px] text-text-secondary">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                8. Cookies and Tracking
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We use cookies and similar tracking technologies to maintain your session, remember your preferences, and analyze how you use our Service. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                9. Children&apos;s Privacy
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                Our Service is not intended for children under 16. We do not knowingly collect personal information from children under 16. If we learn we have collected such information, we will delete it promptly.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                10. Changes to This Policy
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by email or through the Service. Your continued use after changes indicates acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-10">
              <h2 className="font-albert text-[24px] text-text-primary tracking-[-1px] mb-4">
                11. Contact Us
              </h2>
              <p className="font-sans text-[15px] text-text-secondary leading-relaxed mb-4">
                If you have questions about this Privacy Policy or want to exercise your rights, contact us at{' '}
                <a href="mailto:privacy@coachful.co" className="text-brand-accent hover:underline">
                  privacy@coachful.co
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

