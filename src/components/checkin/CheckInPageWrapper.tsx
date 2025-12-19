import { ReactNode } from 'react';

interface CheckInPageWrapperProps {
  children: ReactNode;
  background?: string;
  className?: string;
  centered?: boolean;
}

export function CheckInPageWrapper({ 
  children, 
  background = 'bg-[#faf8f6] dark:bg-[#05070b]',
  className = '',
  centered = true
}: CheckInPageWrapperProps) {
  // Pure CSS animation - no Framer Motion, no hydration delay
  // Uses absolute positioning for bulletproof centering (no flexbox shift issues)
  return (
    <div 
      className={`fixed inset-0 z-[9999] overflow-hidden ${background} ${className}`}
      style={{ minHeight: '100dvh' }}
    >
      {centered ? (
        // Absolute positioning centering - bulletproof, no layout shifts
        <div 
          className="absolute left-1/2 top-1/2 w-full max-w-[600px] px-6 animate-page-fade-in"
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          {children}
        </div>
      ) : (
        // Full-size container for custom layouts
        <div className="w-full h-full animate-page-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

