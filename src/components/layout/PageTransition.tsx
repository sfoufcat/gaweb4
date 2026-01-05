'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isFullWidthPage = pathname === '/chat' || pathname === '/get-coach';

  const skipAnimation = pathname === '/chat' ||
    pathname.startsWith('/onboarding') ||
    pathname?.startsWith('/join') ||
    pathname.startsWith('/sign-in');

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className={`min-h-screen relative ${isFullWidthPage ? '' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-10'}`}
      >
        {children}
      </motion.div>
    </>
  );
}
