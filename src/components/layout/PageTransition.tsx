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
      <div className="flex flex-col min-h-screen bg-app-bg">
        {children}
      </div>
    );
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      className={`bg-app-bg ${isFullWidthPage ? 'flex flex-col min-h-screen' : 'min-h-screen max-w-7xl mx-auto p-4 sm:p-6 lg:p-10'}`}
    >
      {children}
    </motion.div>
  );
}
