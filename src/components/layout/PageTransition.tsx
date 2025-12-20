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
    pathname?.startsWith('/begin') ||
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={isFullWidthPage ? 'flex flex-col min-h-screen' : 'max-w-7xl mx-auto p-4 sm:p-6 lg:p-10'}
    >
      {children}
    </motion.div>
  );
}

