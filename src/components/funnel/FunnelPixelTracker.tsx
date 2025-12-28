'use client';

import { useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import type { FunnelTrackingConfig, FunnelStepTrackingConfig, MetaPixelEvent } from '@/types';

interface FunnelPixelTrackerProps {
  /** Funnel-level tracking config (pixel IDs) */
  tracking?: FunnelTrackingConfig;
  /** Current step tracking config */
  stepTracking?: FunnelStepTrackingConfig;
  /** Current step index (for change detection) */
  stepIndex: number;
  /** Funnel ID for event tagging */
  funnelId: string;
}

// Enable debug mode in development
const DEBUG = process.env.NODE_ENV === 'development';

function log(message: string, ...args: unknown[]) {
  if (DEBUG) {
    console.log(`[FunnelPixels] ${message}`, ...args);
  }
}

/**
 * FunnelPixelTracker - Manages pixel loading and event firing for funnels
 * 
 * Loads funnel-level pixels once (Meta, Google, custom HTML)
 * Fires step-level events when step changes
 */
export function FunnelPixelTracker({
  tracking,
  stepTracking,
  stepIndex,
  funnelId,
}: FunnelPixelTrackerProps) {
  const prevStepIndexRef = useRef<number>(-1);
  const pixelsLoadedRef = useRef({
    meta: false,
    google: false,
    googleAds: false,
  });

  // Track if Meta pixel is loaded
  const onMetaLoad = useCallback(() => {
    pixelsLoadedRef.current.meta = true;
    log('Meta Pixel loaded');
  }, []);

  // Track if Google Analytics is loaded
  const onGoogleLoad = useCallback(() => {
    pixelsLoadedRef.current.google = true;
    log('Google Analytics loaded');
  }, []);

  // Track if Google Ads is loaded
  const onGoogleAdsLoad = useCallback(() => {
    pixelsLoadedRef.current.googleAds = true;
    log('Google Ads loaded');
  }, []);

  // Fire Meta Pixel event
  const fireMetaEvent = useCallback((event: MetaPixelEvent, params?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
      const fbq = (window as unknown as { fbq: (...args: unknown[]) => void }).fbq;
      if (params && Object.keys(params).length > 0) {
        fbq('track', event, params);
        log(`Meta event fired: ${event}`, params);
      } else {
        fbq('track', event);
        log(`Meta event fired: ${event}`);
      }
    } else {
      log(`Meta Pixel not loaded, skipping event: ${event}`);
    }
  }, []);

  // Fire Google Analytics event
  const fireGoogleEvent = useCallback((eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag;
      const eventParams = {
        ...params,
        funnel_id: funnelId,
        step_index: stepIndex,
      };
      gtag('event', eventName, eventParams);
      log(`Google event fired: ${eventName}`, eventParams);
    } else {
      log(`Google Analytics not loaded, skipping event: ${eventName}`);
    }
  }, [funnelId, stepIndex]);

  // Fire Google Ads conversion
  const fireGoogleAdsConversion = useCallback((conversionLabel: string) => {
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag && tracking?.googleAdsId) {
      const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag;
      gtag('event', 'conversion', {
        send_to: `${tracking.googleAdsId}/${conversionLabel}`,
      });
      log(`Google Ads conversion fired: ${tracking.googleAdsId}/${conversionLabel}`);
    }
  }, [tracking?.googleAdsId]);

  // Execute custom HTML/script
  const executeCustomScript = useCallback((html: string) => {
    if (typeof window === 'undefined' || !html.trim()) return;

    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = html;

      // Execute any script tags
      const scripts = container.querySelectorAll('script');
      scripts.forEach((script) => {
        const newScript = document.createElement('script');
        // Copy attributes
        Array.from(script.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        // Copy content
        newScript.textContent = script.textContent;
        document.body.appendChild(newScript);
        log('Custom script executed');
      });

      // Append non-script elements (like noscript, img pixels)
      const nonScripts = container.querySelectorAll(':not(script)');
      nonScripts.forEach((element) => {
        if (element.parentNode === container) {
          document.body.appendChild(element.cloneNode(true));
        }
      });
    } catch (error) {
      console.error('[FunnelPixels] Error executing custom script:', error);
    }
  }, []);

  // Fire step-level events when step changes
  useEffect(() => {
    // Skip if step hasn't changed or is the initial render
    if (prevStepIndexRef.current === stepIndex) return;
    
    // Update ref
    prevStepIndexRef.current = stepIndex;

    // Skip if no step tracking configured
    if (!stepTracking) return;

    log(`Step ${stepIndex} reached, firing events...`, stepTracking);

    // Fire Meta event
    if (stepTracking.metaEvent) {
      fireMetaEvent(stepTracking.metaEvent, stepTracking.metaEventParams);
    }

    // Fire Google Analytics event
    if (stepTracking.googleEvent) {
      fireGoogleEvent(stepTracking.googleEvent, stepTracking.googleEventParams);
    }

    // Fire Google Ads conversion
    if (stepTracking.googleAdsConversionLabel) {
      fireGoogleAdsConversion(stepTracking.googleAdsConversionLabel);
    }

    // Execute step-specific custom script
    if (stepTracking.customHtml) {
      executeCustomScript(stepTracking.customHtml);
    }
  }, [stepIndex, stepTracking, fireMetaEvent, fireGoogleEvent, fireGoogleAdsConversion, executeCustomScript]);

  // Execute custom body HTML on mount
  useEffect(() => {
    if (tracking?.customBodyHtml) {
      executeCustomScript(tracking.customBodyHtml);
    }
  }, [tracking?.customBodyHtml, executeCustomScript]);

  // Don't render anything if no tracking configured
  if (!tracking) {
    return null;
  }

  const { metaPixelId, googleAnalyticsId, googleAdsId, customHeadHtml } = tracking;

  return (
    <>
      {/* Meta Pixel */}
      {metaPixelId && (
        <>
          <Script
            id="meta-pixel-init"
            strategy="afterInteractive"
            onLoad={onMetaLoad}
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
                ${DEBUG ? `console.log('[FunnelPixels] Meta Pixel initialized: ${metaPixelId}');` : ''}
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {/* Google Analytics */}
      {googleAnalyticsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
            onLoad={onGoogleLoad}
          />
          <Script
            id="google-analytics-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAnalyticsId}', {
                  page_path: window.location.pathname,
                });
                ${DEBUG ? `console.log('[FunnelPixels] Google Analytics initialized: ${googleAnalyticsId}');` : ''}
              `,
            }}
          />
        </>
      )}

      {/* Google Ads */}
      {googleAdsId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
            strategy="afterInteractive"
            onLoad={onGoogleAdsLoad}
          />
          <Script
            id="google-ads-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${googleAdsId}');
                ${DEBUG ? `console.log('[FunnelPixels] Google Ads initialized: ${googleAdsId}');` : ''}
              `,
            }}
          />
        </>
      )}

      {/* Custom Head HTML */}
      {customHeadHtml && (
        <Script
          id="custom-head-html"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: customHeadHtml,
          }}
        />
      )}
    </>
  );
}

/**
 * Helper hook to expose pixel firing functions for manual use
 */
export function useFunnelPixels(funnelId: string) {
  const fireMetaEvent = useCallback((event: MetaPixelEvent, params?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq) {
      const fbq = (window as unknown as { fbq: (...args: unknown[]) => void }).fbq;
      if (params && Object.keys(params).length > 0) {
        fbq('track', event, params);
      } else {
        fbq('track', event);
      }
      log(`Meta event fired manually: ${event}`);
    }
  }, []);

  const fireGoogleEvent = useCallback((eventName: string, params?: Record<string, unknown>) => {
    if (typeof window !== 'undefined' && (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag) {
      const gtag = (window as unknown as { gtag: (...args: unknown[]) => void }).gtag;
      gtag('event', eventName, { ...params, funnel_id: funnelId });
      log(`Google event fired manually: ${eventName}`);
    }
  }, [funnelId]);

  return { fireMetaEvent, fireGoogleEvent };
}





