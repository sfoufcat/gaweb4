/**
 * Resend Email Client
 * 
 * Centralized Resend client for sending emails.
 * API key is expected from Doppler via process.env.RESEND_API_KEY
 */

import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  console.warn('[RESEND] RESEND_API_KEY is not set - email sending will be disabled');
}

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Check if Resend is properly configured
 */
export function isResendConfigured(): boolean {
  return resend !== null;
}

