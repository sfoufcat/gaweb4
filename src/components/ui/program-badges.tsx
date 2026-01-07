'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { Users, Eye, EyeOff, Globe, Lock, Star } from "lucide-react";

interface BadgeBaseProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
}

/**
 * StatusBadge - Shows Active/Draft status
 * Active: A beautiful green glowing circle (no text)
 * Draft: Amber badge with text
 */
export function StatusBadge({
  isActive,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isActive: boolean }) {
  if (isActive) {
    // Active: Just a beautiful green glowing circle
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          "bg-emerald-500/20 dark:bg-emerald-500/15",
          "backdrop-blur-xl border border-emerald-400/30 dark:border-emerald-400/20",
          "shadow-[0_0_12px_rgba(16,185,129,0.4)] dark:shadow-[0_0_16px_rgba(16,185,129,0.3)]",
          size === 'sm' ? "w-5 h-5" : "w-6 h-6",
          className
        )}
        title="Active"
        {...props}
      >
        <span className={cn(
          "rounded-full bg-emerald-500 animate-pulse",
          size === 'sm' ? "w-2 h-2" : "w-2.5 h-2.5"
        )} />
      </span>
    );
  }

  // Draft: Amber badge with text
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        "rounded-full backdrop-blur-xl",
        "bg-amber-500/15 dark:bg-amber-500/10",
        "border border-amber-400/30 dark:border-amber-400/20",
        "text-amber-600 dark:text-amber-400",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-semibold"
          : "px-2.5 py-1 text-[11px] font-semibold",
        className
      )}
      {...props}
    >
      <span className={cn(
        "rounded-full bg-amber-500/60",
        size === 'sm' ? "w-1.5 h-1.5" : "w-1.5 h-1.5"
      )} />
      Draft
    </span>
  );
}

/**
 * TypeBadge - Shows Group/1:1 program type
 * Group: Blue glassmorphic with users icon (3 people)
 * Individual: Purple glassmorphic with "1:1" text
 */
export function TypeBadge({
  type,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { type: 'group' | 'individual' }) {
  if (type === 'group') {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          "rounded-full backdrop-blur-xl",
          "bg-blue-500/15 dark:bg-blue-500/10",
          "border border-blue-400/30 dark:border-blue-400/20",
          "text-blue-600 dark:text-blue-400",
          "shadow-sm",
          size === 'sm'
            ? "px-2 py-0.5 text-[10px] font-semibold"
            : "px-2.5 py-1 text-[11px] font-semibold",
          className
        )}
        {...props}
      >
        <Users className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
        Group
      </span>
    );
  }

  // Individual: 1:1 badge
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        "rounded-full backdrop-blur-xl",
        "bg-violet-500/15 dark:bg-violet-500/10",
        "border border-violet-400/30 dark:border-violet-400/20",
        "text-violet-600 dark:text-violet-400",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-bold"
          : "px-2.5 py-1 text-[11px] font-bold",
        className
      )}
      {...props}
    >
      1:1
    </span>
  );
}

/**
 * VisibilityBadge - Shows Public/Private status
 * Public: Green-tinted glassmorphic with eye icon
 * Private: Gray glassmorphic with lock icon
 */
export function VisibilityBadge({
  isPublic,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          "rounded-full backdrop-blur-xl",
          "bg-emerald-500/10 dark:bg-emerald-500/8",
          "border border-emerald-400/25 dark:border-emerald-400/15",
          "text-emerald-600 dark:text-emerald-400",
          "shadow-sm",
          size === 'sm'
            ? "px-2 py-0.5 text-[10px] font-medium"
            : "px-2.5 py-1 text-[11px] font-medium",
          className
        )}
        {...props}
      >
        <Eye className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
        Public
      </span>
    );
  }

  // Private
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full backdrop-blur-xl",
        "bg-white/60 dark:bg-[#171b22]/60",
        "border border-[#e1ddd8]/40 dark:border-[#262b35]/40",
        "text-[#5f5a55] dark:text-[#b2b6c2]",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-medium"
          : "px-2.5 py-1 text-[11px] font-medium",
        className
      )}
      {...props}
    >
      <EyeOff className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
      Private
    </span>
  );
}

/**
 * SquadVisibilityBadge - Shows Public/Private status for squads
 * Uses Globe/Lock icons instead of Eye icons
 */
export function SquadVisibilityBadge({
  isPublic,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isPublic: boolean }) {
  if (isPublic) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          "rounded-full backdrop-blur-xl",
          "bg-emerald-500/10 dark:bg-emerald-500/8",
          "border border-emerald-400/25 dark:border-emerald-400/15",
          "text-emerald-600 dark:text-emerald-400",
          "shadow-sm",
          size === 'sm'
            ? "px-2 py-0.5 text-[10px] font-medium"
            : "px-2.5 py-1 text-[11px] font-medium",
          className
        )}
        {...props}
      >
        <Globe className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
        Public
      </span>
    );
  }

  // Private
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full backdrop-blur-xl",
        "bg-white/60 dark:bg-[#171b22]/60",
        "border border-[#e1ddd8]/40 dark:border-[#262b35]/40",
        "text-[#5f5a55] dark:text-[#b2b6c2]",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-medium"
          : "px-2.5 py-1 text-[11px] font-medium",
        className
      )}
      {...props}
    >
      <Lock className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
      Private
    </span>
  );
}

/**
 * EnrolledBadge - Shows enrolled/active enrollment status
 */
export function EnrolledBadge({
  status,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { status?: 'active' | 'enrolled' }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full backdrop-blur-xl",
        "bg-emerald-500/15 dark:bg-emerald-500/10",
        "border border-emerald-400/30 dark:border-emerald-400/20",
        "text-emerald-600 dark:text-emerald-400",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-semibold"
          : "px-2.5 py-1 text-[11px] font-semibold",
        className
      )}
      {...props}
    >
      <span className={cn(
        "rounded-full bg-emerald-500 animate-pulse",
        size === 'sm' ? "w-1.5 h-1.5" : "w-1.5 h-1.5"
      )} />
      {status === 'active' ? 'Active' : 'Enrolled'}
    </span>
  );
}

/**
 * PriceBadge - Shows price on cards
 */
export function PriceBadge({
  price,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { price: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "rounded-full backdrop-blur-xl",
        "bg-white/80 dark:bg-[#171b22]/80",
        "border border-white/40 dark:border-[#ffffff]/[0.08]",
        "text-[#1a1a1a] dark:text-[#f5f5f8]",
        "shadow-sm font-bold",
        size === 'sm'
          ? "px-2.5 py-1 text-xs"
          : "px-3 py-1.5 text-sm",
        className
      )}
      {...props}
    >
      {price}
    </span>
  );
}

/**
 * SquadTypeBadge - Shows Coached/Community squad type
 * Coached: Gradient badge with star icon
 * Community: Emerald badge with users icon
 */
export function SquadTypeBadge({
  isCoached,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isCoached: boolean }) {
  if (isCoached) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          "rounded-full backdrop-blur-xl",
          "bg-gradient-to-r from-orange-400/20 to-rose-400/20",
          "dark:from-orange-400/15 dark:to-rose-400/15",
          "border border-orange-400/30 dark:border-orange-400/20",
          "text-orange-600 dark:text-orange-400",
          "shadow-sm",
          size === 'sm'
            ? "px-2 py-0.5 text-[10px] font-semibold"
            : "px-2.5 py-1 text-[11px] font-semibold",
          className
        )}
        {...props}
      >
        <Star className={cn("fill-current", size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
        Coached
      </span>
    );
  }

  // Community
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full backdrop-blur-xl",
        "bg-emerald-500/15 dark:bg-emerald-500/10",
        "border border-emerald-400/30 dark:border-emerald-400/20",
        "text-emerald-600 dark:text-emerald-400",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-semibold"
          : "px-2.5 py-1 text-[11px] font-semibold",
        className
      )}
      {...props}
    >
      <Users className={cn(size === 'sm' ? "w-2.5 h-2.5" : "w-3 h-3")} />
      Community
    </span>
  );
}
