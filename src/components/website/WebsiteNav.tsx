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
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed left-0 right-0 z-50 flex justify-center px-4 ${isPreviewMode ? 'top-12' : 'top-4'}`}
    >
      {/* Floating pill navigation - Apple 2026 glassmorphism */}
      <div
        className="flex items-center justify-between gap-8 px-6 py-3 rounded-full backdrop-blur-2xl border shadow-lg"
        style={{
          background: 'rgba(255, 255, 255, 0.75)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
        }}
      >
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-3">
          {logoUrl ? (
            <div className="relative h-7 w-auto">
              <Image
                src={logoUrl}
                alt={appTitle}
                width={100}
                height={28}
                className="h-7 w-auto object-contain"
              />
            </div>
          ) : (
            <span className="text-base font-semibold text-[#1a1a1a] font-albert tracking-tight">
              {appTitle}
            </span>
          )}
        </Link>

        {/* Navigation Actions */}
        <div className="flex items-center gap-2">
          {showSignIn && (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#4a4a4a] hover:text-[#1a1a1a] transition-colors font-albert rounded-full hover:bg-black/5"
            >
              <LogIn className="w-3.5 h-3.5" />
              {signInButtonText}
            </Link>
          )}
          <Link
            href={joinUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white rounded-full transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] font-albert"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 4px 16px ${accentColor}50`,
            }}
          >
            {joinButtonText}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}
