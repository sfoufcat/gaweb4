'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Users, User, Calendar, Clock, DollarSign } from 'lucide-react';

interface ProgramCardProgram {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  type: 'group' | 'individual';
  lengthDays: number;
  priceInCents: number;
  currency?: string;
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
}

export function ProgramCard({ program, variant = 'default' }: ProgramCardProps) {
  const formatPrice = (cents: number) => {
    if (cents === 0) return 'Free';
    return `$${(cents / 100).toFixed(0)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isEnrolled = !!program.userEnrollment;
  const isCompact = variant === 'compact';

  return (
    <Link href={`/discover/programs/${program.id}`}>
      <div className={`bg-white/70 dark:bg-[#171b22] rounded-[20px] flex-shrink-0 hover:shadow-lg dark:hover:shadow-black/30 transition-all cursor-pointer overflow-hidden group ${
        isCompact ? 'w-[200px]' : 'w-[280px]'
      }`}>
        {/* Cover Image */}
        <div className={`relative w-full bg-gradient-to-br from-brand-accent/20 to-[#8c6245]/10 dark:from-brand-accent/10 dark:to-[#8c6245]/5 ${
          isCompact ? 'h-[100px]' : 'h-[140px]'
        }`}>
          {program.coverImageUrl ? (
            <Image
              src={program.coverImageUrl}
              alt={program.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes={isCompact ? "200px" : "280px"}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {program.type === 'group' ? (
                <Users className="w-10 h-10 text-brand-accent/40" />
              ) : (
                <User className="w-10 h-10 text-brand-accent/40" />
              )}
            </div>
          )}
          
          {/* Type badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 backdrop-blur-sm ${
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

          {/* Enrolled badge */}
          {isEnrolled && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-1 bg-green-500/90 text-white text-xs font-medium rounded-full backdrop-blur-sm">
                {program.userEnrollment?.status === 'active' ? 'Active' : 'Enrolled'}
              </span>
            </div>
          )}

          {/* Price badge */}
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-1 bg-white/90 dark:bg-[#171b22]/90 text-[#1a1a1a] dark:text-[#f5f5f8] text-sm font-semibold rounded-full backdrop-blur-sm">
              {formatPrice(program.priceInCents)}
            </span>
          </div>
        </div>
        
        {/* Content */}
        <div className={`flex flex-col gap-2 ${isCompact ? 'p-3' : 'p-4'}`}>
          {/* Title */}
          <h3 className={`font-albert font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-0.5px] leading-tight line-clamp-2 ${
            isCompact ? 'text-sm' : 'text-base'
          }`}>
            {program.name}
          </h3>
          
          {/* Description - only on default variant */}
          {!isCompact && program.description && (
            <p className="font-sans text-sm text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed line-clamp-2">
              {program.description}
            </p>
          )}

          {/* Coach */}
          {program.coachName && (
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
              <span className="font-sans text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {program.coachName}
              </span>
            </div>
          )}
          
          {/* Meta info */}
          <div className="flex items-center gap-3 text-xs text-[#5f5a55] dark:text-[#7d8190]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {program.lengthDays} days
            </span>
            
            {/* Next cohort for group programs */}
            {program.type === 'group' && program.nextCohort && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(program.nextCohort.startDate)}
              </span>
            )}
          </div>

          {/* Next cohort info */}
          {program.type === 'group' && program.nextCohort && !isCompact && (
            <div className="mt-1 pt-2 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                  Next: {program.nextCohort.name}
                </span>
                {program.nextCohort.spotsRemaining > 0 && program.nextCohort.spotsRemaining !== -1 && (
                  <span className="text-xs text-green-600 dark:text-green-400">
                    {program.nextCohort.spotsRemaining} spots left
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Individual program - Start anytime */}
          {program.type === 'individual' && !isCompact && (
            <div className="mt-1 pt-2 border-t border-[#e1ddd8]/50 dark:border-[#262b35]/50">
              <span className="text-xs text-green-600 dark:text-green-400">
                Start anytime
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}






