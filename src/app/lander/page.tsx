'use client';

import { useEffect } from 'react';
import { EnterpriseLandingPage } from '@/components/lp/EnterpriseLandingPage';

/**
 * Enterprise Landing Page at /lander
 * A polished, enterprise-grade version of the main landing page
 */
export default function LanderPage() {
  useEffect(() => {
    // Set layout mode to fullscreen for landing page
    document.body.setAttribute('data-layout', 'fullscreen');
  }, []);

  return <EnterpriseLandingPage />;
}
