/**
 * Freshdesk API Client
 * 
 * Handles ticket creation for support requests and feedback.
 * API Reference: https://developers.freshdesk.com/api/
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FreshdeskTicketPayload {
  subject: string;
  description: string;
  email: string;
  name?: string;
  priority?: 1 | 2 | 3 | 4; // 1=Low, 2=Medium, 3=High, 4=Urgent
  status?: 2 | 3 | 4 | 5; // 2=Open, 3=Pending, 4=Resolved, 5=Closed
  type?: string; // Custom ticket type (e.g., "Support", "Feedback", "Bug Report")
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  requester_id: number;
  status: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface FreshdeskError {
  code: string;
  field?: string;
  message: string;
}

export interface FreshdeskResponse {
  success: boolean;
  ticket?: FreshdeskTicket;
  error?: string;
  errors?: FreshdeskError[];
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;
const FRESHDESK_DOMAIN = process.env.FRESHDESK_DOMAIN;

/**
 * Check if Freshdesk is properly configured
 */
export function isFreshdeskConfigured(): boolean {
  return Boolean(FRESHDESK_API_KEY && FRESHDESK_DOMAIN);
}

/**
 * Get the Freshdesk API base URL
 */
function getBaseUrl(): string {
  if (!FRESHDESK_DOMAIN) {
    throw new Error('FRESHDESK_DOMAIN not configured');
  }
  // Domain should be like 'growthaddicts' or 'growthaddicts.freshdesk.com'
  const domain = FRESHDESK_DOMAIN.includes('.freshdesk.com') 
    ? FRESHDESK_DOMAIN 
    : `${FRESHDESK_DOMAIN}.freshdesk.com`;
  return `https://${domain}/api/v2`;
}

/**
 * Get authorization header for Freshdesk API
 * Freshdesk uses Basic Auth with API key as username and 'X' as password
 */
function getAuthHeader(): string {
  if (!FRESHDESK_API_KEY) {
    throw new Error('FRESHDESK_API_KEY not configured');
  }
  const credentials = Buffer.from(`${FRESHDESK_API_KEY}:X`).toString('base64');
  return `Basic ${credentials}`;
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * Create a new support ticket in Freshdesk
 */
export async function createTicket(payload: FreshdeskTicketPayload): Promise<FreshdeskResponse> {
  if (!isFreshdeskConfigured()) {
    console.error('[FRESHDESK] Not configured - missing API key or domain');
    return {
      success: false,
      error: 'Freshdesk is not configured',
    };
  }

  try {
    const response = await fetch(`${getBaseUrl()}/tickets`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: payload.subject,
        description: payload.description,
        email: payload.email,
        name: payload.name,
        priority: payload.priority || 2, // Default to Medium
        status: payload.status || 2, // Default to Open
        type: payload.type,
        tags: payload.tags,
        custom_fields: payload.custom_fields,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[FRESHDESK] API error:', response.status, errorData);
      
      return {
        success: false,
        error: errorData.description || `Freshdesk API error: ${response.status}`,
        errors: errorData.errors,
      };
    }

    const ticket = await response.json() as FreshdeskTicket;
    console.log(`[FRESHDESK] Created ticket #${ticket.id}: ${ticket.subject}`);

    return {
      success: true,
      ticket,
    };
  } catch (error) {
    console.error('[FRESHDESK] Request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create ticket',
    };
  }
}

/**
 * Create a support ticket with predefined settings
 */
export async function createSupportTicket(
  email: string,
  name: string,
  subject: string,
  message: string,
  metadata?: {
    userId?: string;
    organizationId?: string;
    page?: string;
  }
): Promise<FreshdeskResponse> {
  // Build description with metadata
  let description = message;
  
  if (metadata) {
    description += '\n\n---\nMetadata:';
    if (metadata.userId) description += `\nUser ID: ${metadata.userId}`;
    if (metadata.organizationId) description += `\nOrg ID: ${metadata.organizationId}`;
    if (metadata.page) description += `\nPage: ${metadata.page}`;
  }

  return createTicket({
    subject,
    description,
    email,
    name,
    priority: 2, // Medium
    type: 'Support',
    tags: ['coach-dashboard', 'support-form'],
  });
}

/**
 * Create a private feedback ticket with predefined settings
 */
export async function createFeedbackTicket(
  email: string,
  name: string,
  feedback: string,
  category: 'general' | 'bug' | 'improvement' | 'other',
  metadata?: {
    userId?: string;
    organizationId?: string;
  }
): Promise<FreshdeskResponse> {
  const categoryLabels: Record<typeof category, string> = {
    general: 'General Feedback',
    bug: 'Bug Report',
    improvement: 'Improvement Suggestion',
    other: 'Other Feedback',
  };

  let description = feedback;
  
  if (metadata) {
    description += '\n\n---\nMetadata:';
    if (metadata.userId) description += `\nUser ID: ${metadata.userId}`;
    if (metadata.organizationId) description += `\nOrg ID: ${metadata.organizationId}`;
  }

  return createTicket({
    subject: `[Feedback] ${categoryLabels[category]}`,
    description,
    email,
    name,
    priority: 1, // Low priority for feedback
    type: 'Feedback',
    tags: ['coach-dashboard', 'private-feedback', category],
  });
}


