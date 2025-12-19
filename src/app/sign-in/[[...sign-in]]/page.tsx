'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignInForm } from '@/components/auth';

/**
 * /sign-in - Sign in page for existing users
 */
export default function SignInPage() {
  return (
    <div className="fixed inset-0 bg-app-bg overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8 lg:py-16">
        <div className="w-full max-w-xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10 lg:mb-12">
            {/* Logo */}
            <Image 
              src="/logo.jpg" 
              alt="Growth Architecture" 
              width={80}
              height={80}
              className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-6 shadow-lg"
            />
            <h1 className="font-albert text-[38px] sm:text-[46px] lg:text-[56px] text-text-primary tracking-[-2px] leading-[1.1] mb-5 lg:mb-6">
              Welcome back
            </h1>
            <p className="font-sans text-[16px] lg:text-[18px] text-text-secondary leading-[1.6] max-w-md mx-auto">
              Sign in to continue your growth journey.
            </p>
          </div>

          {/* Custom Sign In Form */}
          <SignInForm redirectUrl="/" />

          {/* Sign Up Link */}
          <p className="text-center mt-8 lg:mt-10 font-sans text-[15px] text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link href="/begin" className="text-[#a07855] hover:text-[#8a6649] font-medium">
              Start your journey
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
