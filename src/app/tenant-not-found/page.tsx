'use client';

import Link from 'next/link';

/**
 * Tenant Not Found Page
 * 
 * Shown when a user visits an unregistered subdomain or custom domain.
 */
export default function TenantNotFoundPage() {
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-brand-accent/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-brand-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Organization Not Found
        </h1>
        
        {/* Description */}
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-8">
          The organization you&apos;re looking for doesn&apos;t exist or hasn&apos;t been set up yet.
          This might be a typo in the URL or the organization may have been removed.
        </p>
        
        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="https://growthaddicts.com"
            className="block w-full px-6 py-3 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-xl transition-colors font-albert"
          >
            Go to GrowthAddicts
          </Link>
          
          <Link
            href="https://growthaddicts.com/start"
            className="block w-full px-6 py-3 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f5f2ef] dark:hover:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium rounded-xl transition-colors font-albert"
          >
            Become a Coach
          </Link>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          If you believe this is an error, please contact{' '}
          <a href="mailto:hello@growthaddicts.com" className="text-brand-accent hover:underline">
            hello@growthaddicts.com
          </a>
        </p>
      </div>
    </div>
  );
}

