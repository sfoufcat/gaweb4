'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Pages that should not have the wrapper padding (full-width layouts)
  const isFullWidthPage = pathname === '/chat' || pathname === '/get-coach' || pathname === '/coach';

  // Pages with fixed positioning that break when transform is applied
  const skipAnimation = pathname === '/chat' ||
    pathname === '/coach' ||
    pathname.startsWith('/onboarding') ||
    pathname?.startsWith('/join') ||
    pathname.startsWith('/sign-in');

  // For pages with fixed positioning, render without animation
  if (skipAnimation) {
    return (
      <>
        <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] -z-10" />
        <div className="min-h-screen relative">
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] -z-10" />
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          ease: [0.25, 0.1, 0.25, 1]
        }}
        className={`min-h-screen relative ${isFullWidthPage ? '' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-10'}`}
      >
        {children}
      </motion.div>
    </>
  );
}
