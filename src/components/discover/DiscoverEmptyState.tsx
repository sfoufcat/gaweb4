'use client';

import { Compass, Sparkles } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';

export function DiscoverEmptyState() {
  const { colors } = useBrandingValues();

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="relative mb-6">
        {/* Background decorative ring */}
        <div 
          className="absolute inset-0 rounded-full opacity-20 blur-xl"
          style={{ backgroundColor: colors.accentLight }}
        />
        
        {/* Main Icon Container */}
        <div 
          className="relative w-24 h-24 rounded-3xl flex items-center justify-center bg-gradient-to-br from-white to-[#f3f1ef] dark:from-[#222631] dark:to-[#171b22] border border-white/50 dark:border-[#313746] shadow-sm"
        >
          <Compass
            className="w-10 h-10"
            style={{ color: colors.accentLight }}
          />
          
          {/* Floating decorative element */}
          <div className="absolute -top-2 -right-2 bg-white dark:bg-[#2c3240] p-2 rounded-full shadow-sm border border-white/50 dark:border-[#313746]">
            <Sparkles 
              className="w-4 h-4"
              style={{ color: colors.accentLight }}
            />
          </div>
        </div>
      </div>

      <h3 className="font-albert font-medium text-2xl text-text-primary dark:text-[#f5f5f8] tracking-[-1px] text-center mb-3">
        Nothing to discover yet
      </h3>
      
      <p className="font-sans text-text-muted text-center max-w-sm leading-relaxed">
        Check back soon! New programs, events, and content will appear here once they're published.
      </p>
    </div>
  );
}
