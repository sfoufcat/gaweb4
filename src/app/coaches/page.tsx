'use client';

import { useEffect } from 'react';
import { CoachLandingPage } from '@/components/lp/CoachLandingPage';

/**
 * /coaches - Landing Page for Scaling Coaches
 * 
 * This page targets coaches with 5-50 clients who are frustrated with
 * Skool/Circle and looking for an accountability-first platform.
 * 
 * Features:
 * - Full-width layout (no sidebar)
 * - Quiz-based signup flow
 * - Light/dark mode support
 * - Responsive design
 */
export default function CoachesLandingPage() {
  // Force fullscreen layout mode - hide sidebar
  useEffect(() => {
    document.body.setAttribute('data-layout', 'fullscreen');
    
    // Cleanup on unmount - let next page handle its layout
    return () => {
      // Don't restore - let the next page's LayoutModeSync set the correct value
    };
  }, []);

  return <CoachLandingPage />;
}

