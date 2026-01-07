'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className = '' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className={`w-9 h-9 flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1e222a]/90 hover:bg-white dark:hover:bg-[#1e222a] shadow-sm backdrop-blur-sm transition-colors ${className}`}
      aria-label="Go back"
    >
      <svg
        className="w-5 h-5 text-text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
