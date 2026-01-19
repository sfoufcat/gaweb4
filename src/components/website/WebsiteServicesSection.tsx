'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { WebsiteService } from '@/types';

interface WebsiteServicesSectionProps {
  headline: string;
  services: WebsiteService[];
  funnelUrls: Record<string, string>; // funnelId -> url
  accentColor: string;
}

// Icon mapping (same as landing templates)
const featureIconMap: Record<string, string> = {
  'video': '📹',
  'users': '👥',
  'message-circle': '💬',
  'book': '📚',
  'target': '🎯',
  'calendar': '📅',
  'check-circle': '✅',
  'zap': '⚡',
  'heart': '❤️',
  'star': '⭐',
  'rocket': '🚀',
  'trophy': '🏆',
};

// Stagger animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WebsiteServicesSection({
  headline,
  services,
  funnelUrls,
  accentColor,
}: WebsiteServicesSectionProps) {
  if (services.length === 0) return null;

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-[#0a0c10]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert tracking-tight">
            {headline || 'What I Offer'}
          </h2>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {services.map((service) => {
            const url = funnelUrls[service.funnelId] || '#';
            const icon = featureIconMap[service.icon || 'star'] || '⭐';

            return (
              <motion.div key={service.id} variants={staggerItem}>
                <Link
                  href={url}
                  className="group block h-full p-6 bg-[#faf8f6] dark:bg-[#171b22] rounded-2xl border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 dark:hover:border-brand-accent/50 transition-all hover:shadow-lg"
                >
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                    style={{ background: hexToRgba(accentColor, 0.1) }}
                  >
                    {icon}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2 group-hover:text-brand-accent transition-colors">
                    {service.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert leading-relaxed mb-4">
                    {service.description}
                  </p>

                  {/* Arrow Link */}
                  <div className="flex items-center gap-1 text-sm font-medium font-albert" style={{ color: accentColor }}>
                    Learn more
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
