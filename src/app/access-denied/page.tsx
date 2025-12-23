'use client';

import Link from 'next/link';
import { useUser, SignOutButton } from '@clerk/nextjs';

/**
 * Access Denied Page
 * 
 * Shown when a user is signed in but is not a member of the organization
 * they're trying to access via subdomain or custom domain.
 */
export default function AccessDeniedPage() {
  const { user, isLoaded } = useUser();
  
  return (
    <div className="min-h-screen bg-[#faf8f6] dark:bg-[#05070b] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-red-500 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>
        
        {/* Title */}
        <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
          Access Denied
        </h1>
        
        {/* Description */}
        <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-2">
          You don&apos;t have access to this organization.
        </p>
        
        {isLoaded && user && (
          <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert mb-8">
            Signed in as <span className="font-medium text-[#5f5a55] dark:text-[#b2b6c2]">{user.primaryEmailAddress?.emailAddress}</span>
          </p>
        )}
        
        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="https://growthaddicts.com"
            className="block w-full px-6 py-3 bg-[#a07855] hover:bg-[#8c6245] text-white font-medium rounded-xl transition-colors font-albert"
          >
            Go to My Dashboard
          </Link>
          
          <SignOutButton>
            <button className="block w-full px-6 py-3 border border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#f5f2ef] dark:hover:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-medium rounded-xl transition-colors font-albert">
              Sign Out & Try Different Account
            </button>
          </SignOutButton>
        </div>
        
        {/* Help text */}
        <p className="mt-8 text-sm text-[#8c8c8c] dark:text-[#7d8190] font-albert">
          Need access? Contact the organization administrator or{' '}
          <a href="mailto:hello@growthaddicts.com" className="text-[#a07855] dark:text-[#b8896a] hover:underline">
            reach out to support
          </a>
        </p>
      </div>
    </div>
  );
}

