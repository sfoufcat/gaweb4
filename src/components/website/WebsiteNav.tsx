'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LogIn, ArrowRight, Menu, X } from 'lucide-react';

// Simple branding interface - works with both OrgBranding and ServerBranding
interface WebsiteBranding {
  logoUrl?: string;
  horizontalLogoUrl?: string | null;
  appTitle?: string;
}

export interface NavLink {
  label: string;
  href: string;
}

interface WebsiteNavProps {
  branding: WebsiteBranding | null;
  showSignIn: boolean;
  signInButtonText: string;
  joinButtonText: string;
  joinUrl: string;
  accentColor: string;
  isPreviewMode?: boolean;
  navLinks?: NavLink[];
  isDark?: boolean;
}

export function WebsiteNav({
  branding,
  showSignIn,
  signInButtonText,
  joinButtonText,
  joinUrl,
  accentColor,
  isPreviewMode = false,
  navLinks = [],
  isDark = false,
}: WebsiteNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const logoUrl = branding?.horizontalLogoUrl || branding?.logoUrl || null;
  const appTitle = branding?.appTitle || 'Coaching';

  // Scroll handler for smooth scrolling to sections
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMobileMenuOpen(false);
      }
    }
  };

  // Style variants based on dark mode
  const navBg = isDark
    ? 'rgba(10, 10, 11, 0.85)'
    : 'rgba(255, 255, 255, 0.85)';
  const navBorder = isDark
    ? 'rgba(255, 255, 255, 0.1)'
    : 'rgba(255, 255, 255, 0.3)';
  const textColor = isDark ? 'text-white' : 'text-[#1a1a1a]';
  const textMuted = isDark ? 'text-white/70 hover:text-white' : 'text-[#4a4a4a] hover:text-[#1a1a1a]';

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed left-0 right-0 z-50 flex justify-center px-4 ${isPreviewMode ? 'top-12' : 'top-4'}`}
      >
        {/* Floating pill navigation - Apple 2026 glassmorphism */}
        <div
          className="flex items-center justify-between gap-4 lg:gap-8 px-4 lg:px-6 py-3 rounded-full backdrop-blur-2xl border shadow-lg"
          style={{
            background: navBg,
            borderColor: navBorder,
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset'
              : '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
          }}
        >
          {/* Logo / Brand */}
          <Link href="#" className="flex items-center gap-3 flex-shrink-0">
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
              <span className={`text-base font-semibold ${textColor} font-albert tracking-tight`}>
                {appTitle}
              </span>
            )}
          </Link>

          {/* Desktop Navigation Links */}
          {navLinks.length > 0 && (
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-3 py-1.5 text-sm font-medium ${textMuted} transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/10`}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Desktop Navigation Actions */}
          <div className="hidden sm:flex items-center gap-2">
            {showSignIn && (
              <Link
                href="/sign-in"
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${textMuted} transition-colors font-albert rounded-full hover:bg-black/5 dark:hover:bg-white/10`}
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

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`sm:hidden p-2 rounded-full ${textMuted} transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 pt-24 px-4"
          style={{
            background: isDark
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.95), rgba(0,0,0,0.98))'
              : 'linear-gradient(to bottom, rgba(255,255,255,0.95), rgba(255,255,255,0.98))',
          }}
        >
          <div className="max-w-md mx-auto space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className={`block px-4 py-3 text-lg font-medium ${textColor} rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
              >
                {link.label}
              </a>
            ))}

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
              {showSignIn && (
                <Link
                  href="/sign-in"
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-base font-medium ${textMuted} rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LogIn className="w-4 h-4" />
                  {signInButtonText}
                </Link>
              )}
              <Link
                href={joinUrl}
                className="flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-xl transition-colors"
                style={{ backgroundColor: accentColor }}
                onClick={() => setMobileMenuOpen(false)}
              >
                {joinButtonText}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
