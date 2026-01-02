/**
 * Cal.com Integration
 * 
 * Allows coaches to create and manage external scheduling links
 * for clients to book coaching sessions.
 */

import { type CalcomSettings } from './types';

// =============================================================================
// API CONFIGURATION
// =============================================================================

const CALCOM_API_KEY = process.env.CALCOM_API_KEY;
const CALCOM_API_URL = 'https://api.cal.com/v1';

// =============================================================================
// TYPES
// =============================================================================

interface CalcomEventType {
  id: number;
  title: string;
  slug: string;
  description?: string;
  length: number; // minutes
  hidden: boolean;
  price: number;
  currency: string;
  schedulingType: 'collective' | 'roundRobin' | null;
}

interface CalcomBooking {
  id: number;
  uid: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  status: 'CANCELLED' | 'ACCEPTED' | 'PENDING';
  attendees: Array<{
    email: string;
    name: string;
    timeZone: string;
  }>;
}

interface CalcomAvailability {
  id: number;
  startTime: string;
  endTime: string;
  days: number[];
}

// =============================================================================
// API HELPERS
// =============================================================================

/**
 * Make an authenticated request to Cal.com API
 */
async function calcomRequest<T>(
  endpoint: string,
  apiKey: string,
  options?: RequestInit
): Promise<T> {
  const url = `${CALCOM_API_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cal.com API error: ${error}`);
  }

  return response.json();
}

/**
 * Get all event types for the authenticated user
 */
export async function getCalcomEventTypes(
  apiKey: string
): Promise<CalcomEventType[]> {
  const data = await calcomRequest<{ event_types: CalcomEventType[] }>(
    '/event-types',
    apiKey
  );
  return data.event_types || [];
}

/**
 * Get a specific event type
 */
export async function getCalcomEventType(
  apiKey: string,
  eventTypeId: number
): Promise<CalcomEventType> {
  const data = await calcomRequest<{ event_type: CalcomEventType }>(
    `/event-types/${eventTypeId}`,
    apiKey
  );
  return data.event_type;
}

/**
 * Create a new event type
 */
export async function createCalcomEventType(
  apiKey: string,
  eventType: {
    title: string;
    slug: string;
    description?: string;
    length: number;
    hidden?: boolean;
  }
): Promise<CalcomEventType> {
  const data = await calcomRequest<{ event_type: CalcomEventType }>(
    '/event-types',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify(eventType),
    }
  );
  return data.event_type;
}

/**
 * Update an event type
 */
export async function updateCalcomEventType(
  apiKey: string,
  eventTypeId: number,
  updates: Partial<{
    title: string;
    description: string;
    length: number;
    hidden: boolean;
  }>
): Promise<CalcomEventType> {
  const data = await calcomRequest<{ event_type: CalcomEventType }>(
    `/event-types/${eventTypeId}`,
    apiKey,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
  return data.event_type;
}

/**
 * Delete an event type
 */
export async function deleteCalcomEventType(
  apiKey: string,
  eventTypeId: number
): Promise<void> {
  await calcomRequest<{ message: string }>(
    `/event-types/${eventTypeId}`,
    apiKey,
    { method: 'DELETE' }
  );
}

/**
 * Get bookings
 */
export async function getCalcomBookings(
  apiKey: string,
  options?: {
    status?: 'upcoming' | 'recurring' | 'past' | 'cancelled';
  }
): Promise<CalcomBooking[]> {
  const params = new URLSearchParams();
  if (options?.status) {
    params.set('status', options.status);
  }
  
  const endpoint = `/bookings${params.toString() ? `?${params.toString()}` : ''}`;
  const data = await calcomRequest<{ bookings: CalcomBooking[] }>(endpoint, apiKey);
  return data.bookings || [];
}

/**
 * Cancel a booking
 */
export async function cancelCalcomBooking(
  apiKey: string,
  bookingId: number,
  reason?: string
): Promise<void> {
  await calcomRequest<{ message: string }>(
    `/bookings/${bookingId}/cancel`,
    apiKey,
    {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    }
  );
}

/**
 * Get user availability
 */
export async function getCalcomAvailability(
  apiKey: string
): Promise<CalcomAvailability[]> {
  const data = await calcomRequest<{ availability: CalcomAvailability[] }>(
    '/availability',
    apiKey
  );
  return data.availability || [];
}

// =============================================================================
// INTEGRATION HELPERS
// =============================================================================

/**
 * Build a Cal.com booking URL
 */
export function buildCalcomBookingUrl(
  username: string,
  eventTypeSlug: string,
  options?: {
    name?: string;
    email?: string;
    notes?: string;
  }
): string {
  const baseUrl = `https://cal.com/${username}/${eventTypeSlug}`;
  
  if (!options) return baseUrl;
  
  const params = new URLSearchParams();
  if (options.name) params.set('name', options.name);
  if (options.email) params.set('email', options.email);
  if (options.notes) params.set('notes', options.notes);
  
  return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
}

/**
 * Generate embed code for Cal.com widget
 */
export function generateCalcomEmbedCode(
  username: string,
  eventTypeSlug: string,
  options?: {
    theme?: 'light' | 'dark' | 'auto';
    hideEventTypeDetails?: boolean;
  }
): string {
  const config = {
    theme: options?.theme || 'auto',
    hideEventTypeDetails: options?.hideEventTypeDetails || false,
  };
  
  return `<!-- Cal.com embed -->
<div id="my-cal-inline" style="width:100%;height:100%;overflow:scroll"></div>
<script type="text/javascript">
  (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if(typeof namespace === "string"){cal.ns[namespace] = cal.ns[namespace] || api;p(cal.ns[namespace], ar);p(cal, ["initNamespace", namespace]);} else p(cal, ar); return;} p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", {origin:"https://cal.com"});
  Cal("inline", {
    elementOrSelector:"#my-cal-inline",
    calLink: "${username}/${eventTypeSlug}",
    config: ${JSON.stringify(config)}
  });
  Cal("ui", {"theme":"${config.theme}","styles":{"branding":{"brandColor":"#000000"}},"hideEventTypeDetails":${config.hideEventTypeDetails}});
</script>`;
}

/**
 * Validate API key by making a test request
 */
export async function validateCalcomApiKey(apiKey: string): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const data = await calcomRequest<{ user: { username: string; name: string } }>(
      '/me',
      apiKey
    );
    return {
      valid: true,
      username: data.user?.username,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid API key',
    };
  }
}

/**
 * Create a booking link for a specific client
 */
export function createClientBookingLink(
  settings: CalcomSettings,
  client: { name: string; email: string }
): string | null {
  if (!settings.username || !settings.eventTypeSlug) {
    return null;
  }

  return buildCalcomBookingUrl(settings.username, settings.eventTypeSlug, {
    name: client.name,
    email: client.email,
  });
}

/**
 * Check if Cal.com integration is configured
 */
export function isCalcomConfigured(): boolean {
  // Cal.com can be used with user-provided API keys,
  // so it's always "available" for configuration
  return true;
}



