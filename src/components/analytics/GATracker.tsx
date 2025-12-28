'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

// Enable debug mode in development
const DEBUG = process.env.NODE_ENV === 'development';

function logGA(message: string, ...args: any[]) {
  if (DEBUG) {
    console.log(`[GA4] ${message}`, ...args);
  }
}

/**
 * Google Analytics Tracker Component
 * 
 * Fetches the org's GA measurement ID and injects the GA4 script.
 * Automatically tracks page views on route changes.
 * 
 * This component is included in the root layout and applies to the entire app.
 */
export function GATracker() {
  const [measurementId, setMeasurementId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Fetch GA config on mount
  useEffect(() => {
    const fetchGAConfig = async () => {
      logGA('Fetching GA config...');
      try {
        const response = await fetch('/api/org/ga-config');
        if (response.ok) {
          const data = await response.json();
          logGA('GA config response:', data);
          if (data.configured && data.measurementId) {
            setMeasurementId(data.measurementId);
            logGA(`GA configured with ID: ${data.measurementId}`);
          } else {
            logGA('GA not configured for this organization');
          }
        } else {
          logGA('GA config fetch failed:', response.status);
        }
      } catch (error) {
        console.error('[GA_TRACKER] Failed to fetch GA config:', error);
        setLoadError('Failed to fetch config');
      }
    };

    fetchGAConfig();
  }, []);

  // Track page views on route changes
  useEffect(() => {
    if (!measurementId || !isLoaded) return;

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    
    // Send page view to GA
    if (typeof window !== 'undefined' && (window as any).gtag) {
      logGA(`Tracking page view: ${url}`);
      (window as any).gtag('config', measurementId, {
        page_path: url,
      });
    } else {
      logGA('gtag not available yet');
    }
  }, [pathname, searchParams, measurementId, isLoaded]);

  // Don't render anything if no GA configured
  if (!measurementId) {
    return null;
  }

  return (
    <>
      {/* GA4 Script */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onLoad={() => {
          logGA(`GA script loaded successfully for ${measurementId}`);
          setIsLoaded(true);
        }}
        onError={(e) => {
          console.error('[GA_TRACKER] Script failed to load:', e);
          setLoadError('Script failed to load');
        }}
      />
      <Script
        id="ga-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
            });
            ${DEBUG ? `console.log('[GA4] Initial config sent for ${measurementId}');` : ''}
          `,
        }}
      />
    </>
  );
}

/**
 * Track a custom event to GA
 */
export function trackEvent(
  eventName: string,
  parameters?: Record<string, string | number | boolean>
) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, parameters);
  }
}

/**
 * Track funnel events specifically
 */
export function trackFunnelEvent(
  funnelId: string,
  eventType: 'view' | 'step_view' | 'step_complete' | 'purchase',
  additionalParams?: {
    stepId?: string;
    stepIndex?: number;
    amount?: number;
  }
) {
  const eventName = `funnel_${eventType}`;
  const params: Record<string, string | number> = {
    funnel_id: funnelId,
  };

  if (additionalParams?.stepId) {
    params.step_id = additionalParams.stepId;
  }
  if (additionalParams?.stepIndex !== undefined) {
    params.step_index = additionalParams.stepIndex;
  }
  if (additionalParams?.amount !== undefined) {
    params.value = additionalParams.amount;
    params.currency = 'USD';
  }

  trackEvent(eventName, params);
}

