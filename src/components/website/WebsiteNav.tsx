'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LogIn, ArrowRight } from 'lucide-react';

// Simple branding interface - works with both OrgBranding and ServerBranding
interface WebsiteBranding {
  logoUrl?: string;
  horizontalLogoUrl?: string | null;
  appTitle?: string;
}

interface WebsiteNavProps {
  branding: WebsiteBranding | null;
  showSignIn: boolean;
  signInButtonText: string;
  joinButtonText: string;
  joinUrl: string;
  accentColor: string;
  isPreviewMode?: boolean;
}

export function WebsiteNav({
  branding,
  showSignIn,
  signInButtonText,
  joinButtonText,
  joinUrl,
  accentColor,
  isPreviewMode = false,
}: WebsiteNavProps) {
  const logoUrl = branding?.horizontalLogoUrl || branding?.logoUrl || null;
  const appTitle = branding?.appTitle || 'Coaching';

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`fixed left-0 right-0 z-50 bg-white/80 dark:bg-[#0a0c10]/80 backdrop-blur-xl border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50 ${isPreviewMode ? 'top-10' : 'top-0'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative h-8 w-auto">
                <Image
                  src={logoUrl}
                  alt={appTitle}
                  width={120}
                  height={32}
                  className="h-8 w-auto object-contain"
                />
              </div>
            ) : (
              <span className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                {appTitle}
              </span>
            )}
          </Link>

          {/* Navigation Actions */}
          <div className="flex items-center gap-3">
            {showSignIn && (
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] transition-colors font-albert"
              >
                <LogIn className="w-4 h-4" />
                {signInButtonText}
              </Link>
            )}
            <Link
              href={joinUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-full transition-all hover:scale-105 shadow-lg font-albert"
              style={{ backgroundColor: accentColor }}
            >
              {joinButtonText}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
