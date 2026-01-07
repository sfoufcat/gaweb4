'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { Users, User, Eye, EyeOff, Globe, Lock, Star, PenLine } from "lucide-react";

interface BadgeBaseProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md';
}

/**
 * StatusBadge - Shows Active/Draft status
 * Active: Simple green dot (no animation)
 * Draft: Amber dot
 */
export function StatusBadge({
  isActive,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isActive: boolean }) {
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  if (isActive) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center",
          dotSize,
          "rounded-full",
          "bg-emerald-500",
          "shadow-[0_0_6px_rgba(16,185,129,0.5)]",
          className
        )}
        title="Active"
        {...props}
      />
    );
  }

  // Draft: amber dot
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        dotSize,
        "rounded-full",
        "bg-amber-500",
        "shadow-[0_0_6px_rgba(245,158,11,0.5)]",
        className
      )}
      title="Draft"
      {...props}
    />
  );
}

/**
 * TypeBadge - Shows Group/1:1 program type
 * Group: Frosted badge with users icon
 * Individual: Frosted badge with "1:1" text
 */
export function TypeBadge({
  type,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { type: 'group' | 'individual' }) {
  const baseClasses = cn(
    "inline-flex items-center justify-center",
    "rounded-full",
    "bg-white/80 dark:bg-white/10",
    "backdrop-blur-md",
    "border border-white/50 dark:border-white/20",
    "shadow-sm",
    className
  );

  if (type === 'group') {
    return (
      <span
        className={cn(
          baseClasses,
          size === 'sm' ? "w-6 h-6" : "w-7 h-7"
        )}
        title="Group"
        {...props}
      >
        <Users className={cn(
          "text-blue-600 dark:text-blue-400",
          size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
        )} />
      </span>
    );
  }

  // Individual: 1:1 text
  return (
    <span
      className={cn(
        baseClasses,
        "text-violet-600 dark:text-violet-400",
        "font-bold tracking-tight",
        size === 'sm'
          ? "w-6 h-6 text-[9px]"
          : "w-7 h-7 text-[10px]"
      )}
      title="1:1"
      {...props}
    >
      1:1
    </span>
  );
}

/**
 * VisibilityBadge - Shows Public/Private status
 * Icon only, no text
 */
export function VisibilityBadge({
  isPublic,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isPublic: boolean }) {
  const baseClasses = cn(
    "inline-flex items-center justify-center",
    "rounded-full",
    "bg-white/80 dark:bg-white/10",
    "backdrop-blur-md",
    "border border-white/50 dark:border-white/20",
    "shadow-sm",
    size === 'sm' ? "w-6 h-6" : "w-7 h-7",
    className
  );

  if (isPublic) {
    return (
      <span className={baseClasses} title="Public" {...props}>
        <Eye className={cn(
          "text-emerald-600 dark:text-emerald-400",
          size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
        )} />
      </span>
    );
  }

  return (
    <span className={baseClasses} title="Private" {...props}>
      <EyeOff className={cn(
        "text-gray-500 dark:text-gray-400",
        size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
      )} />
    </span>
  );
}

/**
 * SquadVisibilityBadge - Shows Public/Private status for squads
 * Uses Globe/Lock icons
 */
export function SquadVisibilityBadge({
  isPublic,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isPublic: boolean }) {
  const baseClasses = cn(
    "inline-flex items-center justify-center",
    "rounded-full",
    "bg-white/80 dark:bg-white/10",
    "backdrop-blur-md",
    "border border-white/50 dark:border-white/20",
    "shadow-sm",
    size === 'sm' ? "w-6 h-6" : "w-7 h-7",
    className
  );

  if (isPublic) {
    return (
      <span className={baseClasses} title="Public" {...props}>
        <Globe className={cn(
          "text-emerald-600 dark:text-emerald-400",
          size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
        )} />
      </span>
    );
  }

  return (
    <span className={baseClasses} title="Private" {...props}>
      <Lock className={cn(
        "text-gray-500 dark:text-gray-400",
        size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
      )} />
    </span>
  );
}

/**
 * EnrolledBadge - Shows enrolled/active enrollment status
 * Simple pill with status text
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
        "rounded-full",
        "bg-emerald-500/90 dark:bg-emerald-500/80",
        "backdrop-blur-sm",
        "text-white",
        "shadow-sm",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px] font-semibold"
          : "px-2.5 py-1 text-[11px] font-semibold",
        className
      )}
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
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
        "rounded-full",
        "bg-white/90 dark:bg-black/60",
        "backdrop-blur-md",
        "border border-white/50 dark:border-white/10",
        "text-[#1a1a1a] dark:text-white",
        "shadow-sm font-semibold",
        size === 'sm'
          ? "px-2 py-0.5 text-[10px]"
          : "px-2.5 py-1 text-[11px]",
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
 * Coached: Frosted badge with star icon
 * Community: Frosted badge with users icon
 */
export function SquadTypeBadge({
  isCoached,
  className,
  size = 'md',
  ...props
}: BadgeBaseProps & { isCoached: boolean }) {
  const baseClasses = cn(
    "inline-flex items-center justify-center",
    "rounded-full",
    "bg-white/80 dark:bg-white/10",
    "backdrop-blur-md",
    "border border-white/50 dark:border-white/20",
    "shadow-sm",
    size === 'sm' ? "w-6 h-6" : "w-7 h-7",
    className
  );

  if (isCoached) {
    return (
      <span className={baseClasses} title="Coached" {...props}>
        <Star className={cn(
          "text-amber-500 dark:text-amber-400 fill-current",
          size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
        )} />
      </span>
    );
  }

  // Community
  return (
    <span className={baseClasses} title="Community" {...props}>
      <Users className={cn(
        "text-emerald-600 dark:text-emerald-400",
        size === 'sm' ? "w-3 h-3" : "w-3.5 h-3.5"
      )} />
    </span>
  );
}
