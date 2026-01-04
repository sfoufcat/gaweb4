'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Pages that should not have the wrapper padding (full-width layouts)
  const isFullWidthPage = pathname === '/chat' || pathname === '/get-coach';
  
  // Pages with fixed positioning that break when transform is applied
  // Framer Motion's transform context causes fixed elements to position relative to the container
  const skipAnimation = pathname === '/chat' || 
    pathname.startsWith('/onboarding') ||
    pathname?.startsWith('/join') ||
    pathname.startsWith('/sign-in');
  
  // For pages with fixed positioning, render without animation to prevent layout issues
  if (skipAnimation) {
    return (
      <div className="flex flex-col min-h-screen">
        {children}
      </div>
    );
  }
  
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.2,
        ease: 'easeOut',
      }}
      className={isFullWidthPage ? 'flex flex-col min-h-screen' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-10'}
    >
      {children}
    </motion.div>
  );
}

