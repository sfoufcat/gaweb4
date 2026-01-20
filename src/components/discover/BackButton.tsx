'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface BackButtonProps {
  className?: string;
  /** If provided, navigates to this URL instead of using browser history */
  href?: string;
}

export function BackButton({ className = '', href }: BackButtonProps) {
  const router = useRouter();

  const buttonClasses = `w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1e222a]/90 hover:bg-white dark:hover:bg-[#1e222a] shadow-sm backdrop-blur-sm transition-colors ${className}`;

  const icon = (
    <svg
      className="w-5 h-5 text-text-primary"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );

  // If href is provided, use Link for deterministic navigation
  if (href) {
    return (
      <Link href={href} className={buttonClasses} aria-label="Go back">
        {icon}
      </Link>
    );
  }

  // Default: use browser history
  return (
    <button
      onClick={() => router.back()}
      className={buttonClasses}
      aria-label="Go back"
    >
      {icon}
    </button>
  );
}
