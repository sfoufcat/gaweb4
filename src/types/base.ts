// Base types - shared between index.ts and discover.ts to avoid circular imports

/**
 * Track Types - Business type the user is building
 * @deprecated FULLY DEPRECATED - Tracks have been replaced by coach-defined Programs.
 * This type is kept ONLY for backward compatibility with legacy code.
 * Do NOT use in new code - use Program entities instead.
 */
export type UserTrack =
  | 'content_creator'
  | 'saas'
  | 'coach_consultant'
  | 'ecom'
  | 'agency'
  | 'community_builder'
  | 'general'; // Legacy fallback

// ============================================================================
// ORDER BUMPS - Pre-purchase add-ons for landing pages
// ============================================================================

/** Product type for order bumps */
export type OrderBumpProductType = 'program' | 'squad' | 'content';

/** Content subtype for order bump content products */
export type OrderBumpContentType = 'event' | 'article' | 'course' | 'download' | 'link';

/**
 * Order Bump - A product offered as an add-on during checkout
 */
export interface OrderBump {
  id: string;
  productType: OrderBumpProductType;
  productId: string;
  contentType?: OrderBumpContentType; // Required when productType = 'content'
  // Cached display data (denormalized for performance)
  productName: string;
  productImageUrl?: string;
  priceInCents: number;
  currency: string;
  // Optional override copy
  headline?: string;        // e.g., "Add this to your order"
  description?: string;     // Short value proposition
  discountPercent?: number; // Optional discount (e.g., 20 = 20% off)
}

/**
 * Order Bump Configuration for a product
 * Stored on Program, Squad, and Content documents
 */
export interface OrderBumpConfig {
  enabled: boolean;
  bumps: OrderBump[];  // Max based on tier: Starter=1, Pro+=2
}
