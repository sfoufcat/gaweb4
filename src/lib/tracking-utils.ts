import type { FunnelTrackingConfig } from '@/types';

/**
 * Merge global organization tracking config with funnel-specific tracking config
 * 
 * Behavior:
 * - Pixel IDs: Funnel-specific values override global values
 * - Custom HTML: Concatenate (global first, then funnel)
 * 
 * @param globalTracking - Organization-level tracking config
 * @param funnelTracking - Funnel-specific tracking config
 * @returns Merged tracking config, or undefined if neither is set
 */
export function mergeTrackingConfig(
  globalTracking?: FunnelTrackingConfig | null,
  funnelTracking?: FunnelTrackingConfig | null
): FunnelTrackingConfig | undefined {
  // If neither is set, return undefined
  if (!globalTracking && !funnelTracking) {
    return undefined;
  }

  // If only one is set, return it
  if (!globalTracking) {
    return funnelTracking || undefined;
  }
  if (!funnelTracking) {
    return globalTracking || undefined;
  }

  // Merge both configs
  const merged: FunnelTrackingConfig = {};

  // Pixel IDs: Funnel-specific overrides global
  merged.metaPixelId = funnelTracking.metaPixelId || globalTracking.metaPixelId;
  merged.googleAnalyticsId = funnelTracking.googleAnalyticsId || globalTracking.googleAnalyticsId;
  merged.googleAdsId = funnelTracking.googleAdsId || globalTracking.googleAdsId;

  // Custom HTML: Concatenate (global first, then funnel)
  const headHtmlParts: string[] = [];
  if (globalTracking.customHeadHtml?.trim()) {
    headHtmlParts.push(globalTracking.customHeadHtml.trim());
  }
  if (funnelTracking.customHeadHtml?.trim()) {
    headHtmlParts.push(funnelTracking.customHeadHtml.trim());
  }
  if (headHtmlParts.length > 0) {
    merged.customHeadHtml = headHtmlParts.join('\n');
  }

  const bodyHtmlParts: string[] = [];
  if (globalTracking.customBodyHtml?.trim()) {
    bodyHtmlParts.push(globalTracking.customBodyHtml.trim());
  }
  if (funnelTracking.customBodyHtml?.trim()) {
    bodyHtmlParts.push(funnelTracking.customBodyHtml.trim());
  }
  if (bodyHtmlParts.length > 0) {
    merged.customBodyHtml = bodyHtmlParts.join('\n');
  }

  // Only return if there are any values
  if (Object.values(merged).some(v => v)) {
    return merged;
  }

  return undefined;
}

