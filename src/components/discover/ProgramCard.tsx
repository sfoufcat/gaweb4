'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, User, Clock } from 'lucide-react';

interface ProgramCardProgram {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  durationType?: 'fixed' | 'evergreen';
  priceInCents: number;
  currency?: string;
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
  coachName?: string;
  coachImageUrl?: string;
  nextCohort?: {
    name: string;
    startDate: string;
    spotsRemaining: number;
  } | null;
  userEnrollment?: {
    status: string;
    cohortId?: string;
  } | null;
}

interface ProgramCardProps {
  program: ProgramCardProgram;
  variant?: 'default' | 'compact';
  /** When true (default), card uses w-full for grid layouts. Set to false for horizontal scroll carousels. */
  fullWidth?: boolean;
}

export function ProgramCard({ program, variant = 'default', fullWidth = true }: ProgramCardProps) {
  const formatPrice = (cents: number, subscriptionEnabled?: boolean, billingInterval?: 'monthly' | 'quarterly' | 'yearly') => {
    if (cents === 0) return 'Free';
    const price = `$${(cents / 100).toFixed(0)}`;
    if (subscriptionEnabled && billingInterval) {
      const intervalSuffix = billingInterval === 'monthly' ? '/mo' : billingInterval === 'quarterly' ? '/qtr' : '/yr';
      return `${price}${intervalSuffix}`;
    }
    return price;
  };

  const isEnrolled = !!program.userEnrollment;
  const isCompact = variant === 'compact';

  // Width classes: fullWidth for grids, fixed width for carousels
  const widthClass = fullWidth
    ? 'w-full'
    : isCompact ? 'w-[200px]' : 'w-[280px]';

  return (
    <Link href={`/discover/programs/${program.id}`}>
      <div className={`glass-card flex-shrink-0 overflow-hidden cursor-pointer group ${widthClass}`}>
        {/* Cover Image */}
        <div className={`relative w-full overflow-hidden ${
          isCompact ? 'h-[100px]' : 'h-[140px]'
        }`}>
          {program.coverImageUrl ? (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent z-10" />
              <Image
                src={program.coverImageUrl}
                alt={program.name}
                fill
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                sizes={fullWidth ? "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" : isCompact ? "200px" : "280px"}
              />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-accent/15 via-brand-accent/8 to-[#8c6245]/5 dark:from-brand-accent/10 dark:via-brand-accent/5 dark:to-[#8c6245]/3 flex items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-white/50 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                {program.type === 'group' ? (
                  <Users className="w-6 h-6 text-brand-accent/60" />
                ) : (
                  <User className="w-6 h-6 text-brand-accent/60" />
                )}
              </div>
            </div>
          )}

          {/* Type badge - top left */}
          <div className="absolute top-3 left-3 z-20">
            <span className={`glass-badge px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
              program.type === 'group'
                ? 'bg-blue-500/90 text-white'
                : 'bg-purple-500/90 text-white'
            }`}>
              {program.type === 'group' ? (
                <>
                  <Users className="w-3 h-3" />
                  Group
                </>
              ) : (
                <>
                  <User className="w-3 h-3" />
                  1:1
                </>
              )}
            </span>
          </div>

          {/* Top right badges - Price and optionally Enrolled */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {isEnrolled && (
              <span className="glass-badge px-2.5 py-1 bg-emerald-500/85 text-white text-[11px] font-semibold rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {program.userEnrollment?.status === 'active' ? 'Active' : 'Enrolled'}
              </span>
            )}
            <span className="glass-badge px-3 py-1.5 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-bold rounded-full border border-white/50 dark:border-[#ffffff]/[0.08]">
              {formatPrice(program.priceInCents, program.subscriptionEnabled, program.billingInterval)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className={`flex flex-col gap-2 ${isCompact ? 'p-3' : 'p-5'}`}>
          {/* Title - fixed height for 2 lines */}
          <h3 className={`font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.3px] leading-tight line-clamp-2 ${
            isCompact ? 'text-sm' : 'text-[17px] h-[2.65em]'
          }`}>
            {program.name}
          </h3>

          {/* Description - 3 lines max */}
          {!isCompact && (
            <p className="text-[13px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-3">
              {program.description || '\u00A0'}
            </p>
          )}

          {/* Coach and Duration row */}
          <div className="flex items-center justify-between">
            {program.coachName ? (
              <div className="flex items-center gap-2">
                {program.coachImageUrl ? (
                  <Image
                    src={program.coachImageUrl}
                    alt={program.coachName}
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-brand-accent/20 dark:bg-brand-accent/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-brand-accent" />
                  </div>
                )}
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  {program.coachName}
                </span>
              </div>
            ) : (
              <div />
            )}
            <span className="meta-pill text-[#5f5a55] dark:text-[#b2b6c2]">
              <Clock className="w-3 h-3 text-brand-accent" />
              {program.durationType === 'evergreen' ? 'Continuous' : `${program.lengthDays} days`}
            </span>
          </div>

          {/* Footer section - simple CTA */}
          {!isCompact && (
            <div className="mt-1 pt-3 border-t border-[#e1ddd8]/40 dark:border-[#262b35]/40">
              <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                Start Program
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
