/**
 * Integration Error Messages
 *
 * Maps error codes from OAuth callbacks and API responses to user-friendly messages.
 */

export interface IntegrationErrorMessage {
  title: string;
  description: string;
  action: string;
  type: 'user_action' | 'config_error' | 'temporary';
}

export const INTEGRATION_ERROR_MESSAGES: Record<string, IntegrationErrorMessage> = {
  // User-initiated errors
  access_denied: {
    title: 'Access Denied',
    description: 'You declined to grant calendar access.',
    action: 'Click Try Again and allow access on the permission screen.',
    type: 'user_action',
  },

  // Configuration errors (should rarely happen in production)
  redirect_uri_mismatch: {
    title: 'Configuration Issue',
    description: 'There\'s a temporary issue with our calendar integration.',
    action: 'Please try again in a few minutes.',
    type: 'config_error',
  },
  oauth_not_configured: {
    title: 'Integration Unavailable',
    description: 'This integration is temporarily unavailable.',
    action: 'Please try again later.',
    type: 'config_error',
  },
  server_config: {
    title: 'Server Configuration Error',
    description: 'There\'s a problem with our server configuration.',
    action: 'Please try again later.',
    type: 'config_error',
  },
  invalid_scope: {
    title: 'Permission Issue',
    description: 'The requested permissions couldn\'t be granted.',
    action: 'Please try again and ensure you grant all requested permissions.',
    type: 'user_action',
  },

  // Temporary/network errors
  token_exchange: {
    title: 'Connection Failed',
    description: 'We couldn\'t complete the connection.',
    action: 'Please try again.',
    type: 'temporary',
  },
  missing_params: {
    title: 'Connection Interrupted',
    description: 'The connection process was interrupted.',
    action: 'Please try again.',
    type: 'temporary',
  },

  // Authentication errors
  user_mismatch: {
    title: 'Account Mismatch',
    description: 'The account you used doesn\'t match your current session.',
    action: 'Please sign out and sign back in, then try connecting again.',
    type: 'user_action',
  },
  not_org_member: {
    title: 'Organization Access',
    description: 'You don\'t have access to this organization\'s integrations.',
    action: 'Contact your organization admin for access.',
    type: 'user_action',
  },

  // Fallback
  unknown: {
    title: 'Connection Failed',
    description: 'An unexpected error occurred while connecting.',
    action: 'Please try again.',
    type: 'temporary',
  },
};

/**
 * Get error message for an error code, with fallback to unknown
 */
export function getIntegrationErrorMessage(errorCode: string): IntegrationErrorMessage {
  return INTEGRATION_ERROR_MESSAGES[errorCode] || INTEGRATION_ERROR_MESSAGES.unknown;
}
