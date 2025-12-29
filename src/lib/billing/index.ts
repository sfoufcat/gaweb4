/**
 * Billing Module Exports
 * 
 * Central exports for all billing-related functionality
 */

// Entitlements (core logic - works in both server and client)
export * from './entitlements';

// Server-side enforcement (server-only - uses Firebase Admin, Clerk server SDK)
export * from './server-enforcement';

// Client-side hooks are exported separately to avoid importing server code
// Use: import { useOrgEntitlements } from '@/lib/billing/use-entitlements';

