'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface WebsiteFooterCTAProps {
  headline?: string;
  subheadline?: string;
  buttonText?: string;
  url: string;
  accentColor: string;
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WebsiteFooterCTA({
  headline,
  subheadline,
  buttonText,
  url,
  accentColor,
}: WebsiteFooterCTAProps) {
  // If no headline is provided, skip rendering
  if (!headline) return null;

  return (
    <section
      className="py-16 sm:py-24"
      style={{
        background: `linear-gradient(to bottom right, ${hexToRgba(accentColor, 0.05)}, ${hexToRgba(accentColor, 0.1)})`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight mb-4">
          {headline}
        </h2>

        {/* Subheadline */}
        {subheadline && (
          <p className="text-lg text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-8 max-w-2xl mx-auto">
            {subheadline}
          </p>
        )}

        {/* CTA Button */}
        <Link
          href={url}
          className="inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold text-white rounded-full transition-all hover:scale-105 shadow-xl font-albert"
          style={{ backgroundColor: accentColor }}
        >
          {buttonText || 'Get Started'}
          <ArrowRight className="w-5 h-5" />
        </Link>
      </motion.div>
    </section>
  );
}
