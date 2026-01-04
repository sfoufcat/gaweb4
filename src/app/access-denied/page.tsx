import Link from 'next/link';
import { ShieldX, ArrowRight, Home } from 'lucide-react';

export const metadata = {
  title: 'Access Denied | Coachful',
  description: 'This domain is restricted to platform administrators only.',
};

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f6] dark:bg-[#05070b] px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-8">
          <ShieldX className="w-10 h-10 text-red-600 dark:text-red-400" />
        </div>
        
        {/* Heading */}
        <h1 className="font-albert text-[32px] sm:text-[40px] font-bold text-[#1a1a1a] dark:text-[#f5f5f8] tracking-[-1px] mb-4">
          Access Denied
        </h1>
        
        {/* Description */}
        <p className="font-sans text-[16px] sm:text-[17px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-8">
          This domain is restricted to platform administrators only. If you&apos;re a coach or user, please access your dashboard through your organization&apos;s subdomain.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://www.coachful.co"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a1a1a] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-xl font-albert text-[15px] font-semibold hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            Go to Coachful
          </a>
          
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent border border-[#e1ddd8] dark:border-[#262b35] text-[#1a1a1a] dark:text-[#f5f5f8] rounded-xl font-albert text-[15px] font-medium hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors"
          >
            Sign in as Admin
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        
        {/* Help text */}
        <p className="font-sans text-[13px] text-[#a7a39e] dark:text-[#7d8190] mt-8">
          Need help? Contact support@coachful.co
        </p>
      </div>
    </div>
  );
}
