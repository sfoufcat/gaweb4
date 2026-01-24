import { sendTenantEmail } from './email-sender';
import { notifyUser } from './notifications';
import type { IntakeCallConfig, UnifiedEvent, NotificationType } from '@/types';

interface IntakeNotificationData {
  event: UnifiedEvent;
  config: IntakeCallConfig;
  prospectName: string;
  prospectEmail: string;
  coachName: string;
  coachEmail?: string;
  organizationId: string;
  bookingTokenId?: string;
}

/**
 * Format a date for email display
 */
function formatDateTime(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
    timeZoneName: 'short',
  });
}

/**
 * Send confirmation email to the prospect who booked the call
 */
export async function sendIntakeConfirmationToProspect(data: IntakeNotificationData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    coachName,
    organizationId,
  } = data;

  const formattedDateTime = formatDateTime(event.startDateTime, event.timezone);
  const duration = event.durationMinutes || config.duration;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">
        You're all set!
      </h1>
      <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
        Your ${config.name} with ${coachName} has been confirmed.
      </p>

      <div style="background: #f7f7f7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a;">
          ${formattedDateTime}
        </p>
        <p style="margin: 0; color: #666;">
          ${duration} minutes
        </p>
      </div>

      ${event.meetingLink ? `
        <a href="${event.meetingLink}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin-bottom: 24px;">
          Join Meeting
        </a>
      ` : ''}

      <p style="color: #999; font-size: 14px; margin-top: 24px;">
        ${config.confirmationMessage || `Looking forward to speaking with you!`}
      </p>
    </div>
  `;

  const text = `
Your ${config.name} with ${coachName} has been confirmed.

When: ${formattedDateTime}
Duration: ${duration} minutes
${event.meetingLink ? `Join: ${event.meetingLink}` : ''}

${config.confirmationMessage || 'Looking forward to speaking with you!'}
  `.trim();

  try {
    await sendTenantEmail({
      to: prospectEmail,
      subject: `Confirmed: ${config.name} with ${coachName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
    });
    console.log('[INTAKE_NOTIFICATION] Confirmation sent to prospect:', prospectEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send confirmation:', error);
  }
}

/**
 * Send notification email to the coach about a new booking
 */
export async function sendIntakeNotificationToCoach(data: IntakeNotificationData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    coachEmail,
    organizationId,
  } = data;

  if (!coachEmail) {
    console.warn('[INTAKE_NOTIFICATION] No coach email provided, skipping notification');
    return;
  }

  const formattedDateTime = formatDateTime(event.startDateTime, event.timezone);
  const duration = event.durationMinutes || config.duration;

  // Build custom fields section if there's intake data
  let customFieldsHtml = '';
  if (event.intakeData && Object.keys(event.intakeData).length > 0) {
    const fields = Object.entries(event.intakeData)
      .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
      .join('');
    customFieldsHtml = `
      <div style="margin-top: 16px;">
        <p style="font-weight: 600; margin-bottom: 8px;">Form Responses:</p>
        <ul style="margin: 0; padding-left: 20px; color: #666;">
          ${fields}
        </ul>
      </div>
    `;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">
        New Intake Call Booked
      </h1>
      <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
        ${prospectName} has booked a ${config.name} with you.
      </p>

      <div style="background: #f7f7f7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a;">
          ${formattedDateTime}
        </p>
        <p style="margin: 0 0 8px; color: #666;">
          ${duration} minutes
        </p>
        <p style="margin: 0; color: #666;">
          <strong>Email:</strong> ${prospectEmail}
        </p>
        ${event.prospectPhone ? `
          <p style="margin: 8px 0 0; color: #666;">
            <strong>Phone:</strong> ${event.prospectPhone}
          </p>
        ` : ''}
        ${customFieldsHtml}
      </div>

      ${event.meetingLink ? `
        <a href="${event.meetingLink}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
          Join Meeting
        </a>
      ` : ''}
    </div>
  `;

  const text = `
New Intake Call Booked

${prospectName} has booked a ${config.name} with you.

When: ${formattedDateTime}
Duration: ${duration} minutes
Email: ${prospectEmail}
${event.prospectPhone ? `Phone: ${event.prospectPhone}` : ''}
${event.meetingLink ? `Join: ${event.meetingLink}` : ''}
  `.trim();

  try {
    await sendTenantEmail({
      to: coachEmail,
      subject: `New Booking: ${config.name} with ${prospectName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
    });
    console.log('[INTAKE_NOTIFICATION] Notification sent to coach:', coachEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send coach notification:', error);
  }
}

/**
 * Send both notifications for a new intake call booking
 */
export async function sendIntakeBookingNotifications(data: IntakeNotificationData) {
  // Send both emails in parallel
  await Promise.all([
    sendIntakeConfirmationToProspect(data),
    sendIntakeNotificationToCoach(data),
  ]);
}

/**
 * Extended notification data for branded emails (coach-initiated bookings)
 */
interface BrandedIntakeNotificationData extends IntakeNotificationData {
  prospectTimezone: string;
  orgBranding: {
    name?: string;
    logoUrl?: string;
    horizontalLogoUrl?: string;  // Preferred over logoUrl if available
    accentColor?: string;        // Brand accent color for links/buttons (default: #E07A5F)
    hidePoweredBy?: boolean;     // Deprecated: use plan instead
    plan?: 'starter' | 'pro' | 'scale';  // Only show "Powered by" for starter plans
  };
  orgSlug: string;
  /** Whether to show reschedule link (defaults to config.allowReschedule) */
  showRescheduleLink?: boolean;
  /** Whether to show cancel link (defaults to config.allowCancellation) */
  showCancelLink?: boolean;
  /** ICS calendar content to attach to email */
  icsContent?: string;
}

/**
 * Format date/time for display
 */
function formatDateTimeParts(isoString: string, timezone: string): {
  date: string;
  time: string;
  timezoneAbbr: string;
} {
  const dateObj = new Date(isoString);

  const date = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });

  const time = dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });

  // Get timezone abbreviation
  const timezoneAbbr = dateObj.toLocaleTimeString('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).split(' ').pop() || timezone;

  return { date, time, timezoneAbbr };
}

/**
 * Get end time display
 */
function formatEndTime(isoString: string, timezone: string): string {
  const dateObj = new Date(isoString);
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
}

/**
 * Get meeting provider display name
 */
function getMeetingProviderLabel(provider: string): string {
  switch (provider) {
    case 'zoom': return 'Zoom Meeting';
    case 'google_meet': return 'Google Meet';
    case 'stream': return 'Video Call';
    case 'in_app': return 'Video Call';
    case 'manual': return 'Online Meeting';
    default: return 'Online Meeting';
  }
}

/**
 * Send branded confirmation email to the prospect (coach-initiated booking)
 *
 * This is a more polished version with:
 * - Coach/org branding (logo)
 * - Personalized greeting
 * - Meeting details in a styled card
 * - Join meeting button
 * - Reschedule and cancel links
 */
export async function sendBrandedIntakeConfirmation(data: BrandedIntakeNotificationData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    prospectTimezone,
    coachName,
    organizationId,
    bookingTokenId,
    orgBranding,
    orgSlug,
    showRescheduleLink = config.allowReschedule !== false, // Default to config setting
    showCancelLink = config.allowCancellation !== false,   // Default to config setting
    icsContent,
  } = data;

  const firstName = prospectName.split(' ')[0];
  const displayTimezone = prospectTimezone || event.timezone;
  const duration = event.durationMinutes || config.duration;

  const { date, time, timezoneAbbr } = formatDateTimeParts(event.startDateTime, displayTimezone);
  const endTime = event.endDateTime ? formatEndTime(event.endDateTime, displayTimezone) : '';
  const timeRange = endTime ? `${time} - ${endTime}` : time;

  const meetingProviderLabel = getMeetingProviderLabel(event.meetingProvider || config.meetingProvider);

  // Brand accent color for links (default: coral #E07A5F)
  const accentColor = orgBranding.accentColor || '#E07A5F';

  // Prefer horizontal logo over square logo over text
  const logoUrl = orgBranding.horizontalLogoUrl || orgBranding.logoUrl;

  // Build reschedule and cancel links (only if allowed by config)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coachful.co';
  const rescheduleUrl = (bookingTokenId && showRescheduleLink)
    ? `${baseUrl}/book/${config.slug}/reschedule?token=${bookingTokenId}`
    : null;
  const cancelUrl = (bookingTokenId && showCancelLink)
    ? `${baseUrl}/book/${config.slug}/cancel?token=${bookingTokenId}`
    : null;

  // Build meeting link - for in_app calls, use the join page with booking token
  let meetingUrl = event.meetingLink;
  if (event.meetingProvider === 'stream' && event.streamVideoCallId && bookingTokenId) {
    meetingUrl = `${baseUrl}/intake-call/${event.streamVideoCallId}?token=${bookingTokenId}`;
  }

  // Build HTML email with branding
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f7f5f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7f5f3;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 520px; margin: 0 auto;">
          <!-- Logo / Org Name -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${orgBranding.name || 'Coach'}" style="max-height: 48px; max-width: 200px;">`
                : `<span style="font-size: 24px; font-weight: 600; color: #1a1a1a;">${orgBranding.name || coachName}</span>`
              }
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <!-- Greeting -->
                <tr>
                  <td style="padding: 32px 32px 0;">
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
                      Hi ${firstName},
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #5f5a55; line-height: 1.5;">
                      Your <strong>${config.name}</strong> with ${coachName} is confirmed!
                    </p>
                  </td>
                </tr>

                <!-- Meeting Details Card -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9f7f5; border-radius: 12px; border: 1px solid #e8e4df; border-left: 4px solid ${accentColor};">
                      <tr>
                        <td style="padding: 20px;">
                          <!-- Date -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">📅</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${date}</p>
                              </td>
                            </tr>
                          </table>

                          <!-- Time -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">🕐</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${timeRange} (${timezoneAbbr})</p>
                                <p style="margin: 4px 0 0; font-size: 13px; color: #7d7872;">${duration} minutes</p>
                              </td>
                            </tr>
                          </table>

                          <!-- Location -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">📍</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${meetingProviderLabel}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${config.description ? `
                <!-- Description -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <p style="margin: 0; font-size: 14px; color: #5f5a55; line-height: 1.6;">
                      ${config.description}
                    </p>
                  </td>
                </tr>
                ` : ''}

                <!-- Join Meeting Button -->
                ${meetingUrl ? `
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <a href="${meetingUrl}" style="display: inline-block; background: ${accentColor}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                      Join Meeting →
                    </a>
                  </td>
                </tr>
                ` : ''}

                <!-- Reschedule / Cancel Links -->
                ${(rescheduleUrl || cancelUrl) ? `
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #7d7872;">
                      Need to make changes?
                      ${rescheduleUrl ? `<a href="${rescheduleUrl}" style="color: ${accentColor}; text-decoration: none; font-weight: 500;">Reschedule</a>` : ''}
                      ${rescheduleUrl && cancelUrl ? ` · ` : ''}
                      ${cancelUrl ? `<a href="${cancelUrl}" style="color: ${accentColor}; text-decoration: none; font-weight: 500;">Cancel</a>` : ''}
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          ${orgBranding.plan === 'starter' ? `
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a09a94;">
                Powered by <a href="https://coachful.co" style="color: #a09a94; text-decoration: none;">Coachful</a>
              </p>
            </td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  // Plain text version
  const text = `
Hi ${firstName},

Your ${config.name} with ${coachName} is confirmed!

📅 ${date}
🕐 ${timeRange} (${timezoneAbbr}) · ${duration} minutes
📍 ${meetingProviderLabel}

${config.description || ''}

${meetingUrl ? `Join the meeting: ${meetingUrl}` : ''}

${rescheduleUrl ? `Need to reschedule? ${rescheduleUrl}` : ''}
${cancelUrl ? `Need to cancel? ${cancelUrl}` : ''}
${orgBranding.plan === 'starter' ? `
---
Powered by Coachful` : ''}
  `.trim();

  try {
    // Build attachments (ICS calendar invite)
    const attachments = icsContent
      ? [{
          filename: `${config.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}.ics`,
          content: icsContent,
          contentType: 'text/calendar; method=REQUEST; charset=utf-8',
        }]
      : undefined;

    await sendTenantEmail({
      to: prospectEmail,
      subject: `Confirmed: ${config.name} with ${coachName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
      attachments,
    });
    console.log('[INTAKE_NOTIFICATION] Branded confirmation sent to prospect:', prospectEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send branded confirmation:', error);
    throw error;
  }
}

/**
 * Notification data for cancellation emails
 */
interface IntakeCancellationData {
  event: UnifiedEvent;
  config: IntakeCallConfig;
  prospectName: string;
  prospectEmail: string;
  coachName: string;
  coachEmail?: string;
  organizationId: string;
  reason?: string;
  cancelledBy: 'prospect' | 'coach';
  orgBranding: {
    name?: string;
    logoUrl?: string;
    horizontalLogoUrl?: string;
    accentColor?: string;
    plan?: 'starter' | 'pro' | 'scale';  // Only show "Powered by" for starter plans
  };
  /** URL to book a new appointment (only include if funnel exists) */
  bookingUrl?: string;
}

/**
 * Send cancellation confirmation to the prospect
 */
async function sendIntakeCancellationToProspect(data: IntakeCancellationData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    coachName,
    organizationId,
    orgBranding,
    bookingUrl,
  } = data;

  const firstName = prospectName.split(' ')[0];
  const timezone = event.timezone || 'America/New_York';
  const { date, time, timezoneAbbr } = formatDateTimeParts(event.startDateTime, timezone);
  const accentColor = orgBranding.accentColor || '#E07A5F';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f7f5f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7f5f3;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 520px; margin: 0 auto;">
          <!-- Logo / Org Name -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              ${orgBranding.logoUrl
                ? `<img src="${orgBranding.logoUrl}" alt="${orgBranding.name || 'Coach'}" style="max-height: 48px; max-width: 200px;">`
                : `<span style="font-size: 24px; font-weight: 600; color: #1a1a1a;">${orgBranding.name || coachName}</span>`
              }
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <!-- Icon & Heading -->
                <tr>
                  <td style="padding: 32px 32px 0; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: #fef2f2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 28px;">✕</span>
                    </div>
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
                      Appointment Cancelled
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #5f5a55; line-height: 1.5;">
                      Hi ${firstName}, your ${config.name} has been cancelled.
                    </p>
                  </td>
                </tr>

                <!-- Cancelled Booking Details -->
                <tr>
                  <td style="padding: 24px 32px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fafafa; border-radius: 12px; border: 1px solid #e5e5e5;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 4px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Cancelled appointment</p>
                          <p style="margin: 0 0 8px; font-size: 15px; font-weight: 500; color: #666; text-decoration: line-through;">${date}</p>
                          <p style="margin: 0; font-size: 15px; color: #666; text-decoration: line-through;">${time} (${timezoneAbbr})</p>
                          <p style="margin: 8px 0 0; font-size: 14px; color: #666;">with ${coachName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                ${bookingUrl ? `
                <!-- Book new appointment link (only shown if funnel exists) -->
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #7d7872; line-height: 1.5;">
                      If you'd like to book a new appointment, <a href="${bookingUrl}" style="color: ${accentColor}; text-decoration: none; font-weight: 500;">visit our booking page</a>.
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer - only show for starter plans -->
          ${orgBranding.plan === 'starter' ? `
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a09a94;">
                Powered by <a href="https://coachful.co" style="color: #a09a94; text-decoration: none;">Coachful</a>
              </p>
            </td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Appointment Cancelled

Hi ${firstName},

Your ${config.name} with ${coachName} has been cancelled.

Cancelled appointment:
${date}
${time} (${timezoneAbbr})
${bookingUrl ? `
If you'd like to book a new appointment, visit: ${bookingUrl}` : ''}
${orgBranding.plan === 'starter' ? `
---
Powered by Coachful` : ''}
  `.trim();

  try {
    await sendTenantEmail({
      to: prospectEmail,
      subject: `Cancelled: ${config.name} with ${coachName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
    });
    console.log('[INTAKE_NOTIFICATION] Cancellation sent to prospect:', prospectEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send cancellation to prospect:', error);
  }
}

/**
 * Send cancellation notification to the coach
 */
async function sendIntakeCancellationToCoach(data: IntakeCancellationData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    coachEmail,
    organizationId,
    reason,
    cancelledBy,
  } = data;

  if (!coachEmail) {
    console.warn('[INTAKE_NOTIFICATION] No coach email provided, skipping cancellation notification');
    return;
  }

  const timezone = event.timezone || 'America/New_York';
  const formattedDateTime = formatDateTime(event.startDateTime, timezone);

  const cancelledByText = cancelledBy === 'prospect' ? `${prospectName} has cancelled their` : 'You have cancelled the';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #dc2626; font-size: 24px; margin-bottom: 8px;">
        Appointment Cancelled
      </h1>
      <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
        ${cancelledByText} ${config.name}.
      </p>

      <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #fecaca;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; text-decoration: line-through;">
          ${formattedDateTime}
        </p>
        <p style="margin: 0 0 8px; color: #666;">
          <strong>Name:</strong> ${prospectName}
        </p>
        <p style="margin: 0; color: #666;">
          <strong>Email:</strong> ${prospectEmail}
        </p>
        ${event.prospectPhone ? `
          <p style="margin: 8px 0 0; color: #666;">
            <strong>Phone:</strong> ${event.prospectPhone}
          </p>
        ` : ''}
        ${reason ? `
          <p style="margin: 16px 0 0; padding-top: 16px; border-top: 1px solid #fecaca; color: #666;">
            <strong>Reason:</strong> ${reason}
          </p>
        ` : ''}
      </div>
    </div>
  `;

  const text = `
Appointment Cancelled

${cancelledByText} ${config.name}.

When: ${formattedDateTime}
Name: ${prospectName}
Email: ${prospectEmail}
${event.prospectPhone ? `Phone: ${event.prospectPhone}` : ''}
${reason ? `\nReason: ${reason}` : ''}
  `.trim();

  try {
    await sendTenantEmail({
      to: coachEmail,
      subject: `Cancelled: ${config.name} with ${prospectName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
    });
    console.log('[INTAKE_NOTIFICATION] Cancellation sent to coach:', coachEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send cancellation to coach:', error);
  }
}

/**
 * Send both cancellation notifications
 */
export async function sendIntakeCancellationNotifications(data: IntakeCancellationData) {
  await Promise.all([
    sendIntakeCancellationToProspect(data),
    sendIntakeCancellationToCoach(data),
  ]);
}

/**
 * Notification data for reschedule emails
 */
interface IntakeRescheduleData {
  event: UnifiedEvent;
  config: IntakeCallConfig;
  prospectName: string;
  prospectEmail: string;
  prospectTimezone?: string;
  coachName: string;
  coachEmail?: string;
  organizationId: string;
  oldStartDateTime: string;
  newStartDateTime: string;
  newEndDateTime: string;
  bookingTokenId?: string;
  orgBranding: {
    name?: string;
    logoUrl?: string;
    horizontalLogoUrl?: string;
    accentColor?: string;
    hidePoweredBy?: boolean;  // Deprecated: use plan instead
    plan?: 'starter' | 'pro' | 'scale';  // Only show "Powered by" for starter plans
  };
  /** Whether to show reschedule link (defaults to config.allowReschedule) */
  showRescheduleLink?: boolean;
  /** Whether to show cancel link (defaults to config.allowCancellation) */
  showCancelLink?: boolean;
  /** ICS calendar content to attach to email */
  icsContent?: string;
}

/**
 * Send reschedule confirmation to the prospect
 */
async function sendIntakeRescheduleToProspect(data: IntakeRescheduleData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    prospectTimezone,
    coachName,
    organizationId,
    oldStartDateTime,
    newStartDateTime,
    newEndDateTime,
    bookingTokenId,
    orgBranding,
    showRescheduleLink = config.allowReschedule !== false, // Default to config setting
    showCancelLink = config.allowCancellation !== false,   // Default to config setting
    icsContent,
  } = data;

  const firstName = prospectName.split(' ')[0];
  const timezone = prospectTimezone || event.timezone || 'America/New_York';

  const oldParts = formatDateTimeParts(oldStartDateTime, timezone);
  const newParts = formatDateTimeParts(newStartDateTime, timezone);
  const newEndTime = formatEndTime(newEndDateTime, timezone);
  const newTimeRange = `${newParts.time} - ${newEndTime}`;
  const duration = event.durationMinutes || config.duration;

  const meetingProviderLabel = getMeetingProviderLabel(event.meetingProvider || config.meetingProvider);

  // Build reschedule and cancel links (only if allowed by config)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.coachful.co';
  const rescheduleUrl = (bookingTokenId && showRescheduleLink)
    ? `${baseUrl}/book/${config.slug}/reschedule?token=${bookingTokenId}`
    : null;
  const cancelUrl = (bookingTokenId && showCancelLink)
    ? `${baseUrl}/book/${config.slug}/cancel?token=${bookingTokenId}`
    : null;

  // Build meeting link
  let meetingUrl = event.meetingLink;
  if (event.meetingProvider === 'stream' && event.streamVideoCallId && bookingTokenId) {
    meetingUrl = `${baseUrl}/intake-call/${event.streamVideoCallId}?token=${bookingTokenId}`;
  }

  // Brand accent color for buttons/links (default: coral #E07A5F)
  const accentColor = orgBranding.accentColor || '#E07A5F';

  // Prefer horizontal logo over square logo
  const logoUrl = orgBranding.horizontalLogoUrl || orgBranding.logoUrl;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f7f5f3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f7f5f3;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 520px; margin: 0 auto;">
          <!-- Logo / Org Name -->
          <tr>
            <td style="text-align: center; padding-bottom: 32px;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${orgBranding.name || 'Coach'}" style="max-height: 48px; max-width: 200px;">`
                : `<span style="font-size: 24px; font-weight: 600; color: #1a1a1a;">${orgBranding.name || coachName}</span>`
              }
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <!-- Heading -->
                <tr>
                  <td style="padding: 32px 32px 0;">
                    <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">
                      Appointment Rescheduled
                    </h1>
                    <p style="margin: 0; font-size: 16px; color: #5f5a55; line-height: 1.5;">
                      Hi ${firstName}, your ${config.name} has been moved to a new time.
                    </p>
                  </td>
                </tr>

                <!-- Old Time (Crossed Out) -->
                <tr>
                  <td style="padding: 24px 32px 12px;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Previous time</p>
                    <p style="margin: 0; font-size: 14px; color: #999; text-decoration: line-through;">
                      ${oldParts.date} at ${oldParts.time}
                    </p>
                  </td>
                </tr>

                <!-- New Time -->
                <tr>
                  <td style="padding: 0 32px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f0fdf4; border-radius: 12px; border: 1px solid #bbf7d0; border-left: 4px solid ${accentColor};">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 8px; font-size: 13px; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">New time</p>

                          <!-- Date -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">📅</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${newParts.date}</p>
                              </td>
                            </tr>
                          </table>

                          <!-- Time -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">🕐</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${newTimeRange} (${newParts.timezoneAbbr})</p>
                                <p style="margin: 4px 0 0; font-size: 13px; color: #7d7872;">${duration} minutes</p>
                              </td>
                            </tr>
                          </table>

                          <!-- Location -->
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 12px;">
                            <tr>
                              <td style="width: 24px; vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 16px;">📍</span>
                              </td>
                              <td>
                                <p style="margin: 0; font-size: 15px; font-weight: 500; color: #1a1a1a;">${meetingProviderLabel}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Join Meeting Button -->
                ${meetingUrl ? `
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <a href="${meetingUrl}" style="display: inline-block; background: ${accentColor}; color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                      Join Meeting →
                    </a>
                  </td>
                </tr>
                ` : ''}

                <!-- Reschedule / Cancel Links -->
                ${(rescheduleUrl || cancelUrl) ? `
                <tr>
                  <td style="padding: 0 32px 32px; text-align: center;">
                    <p style="margin: 0; font-size: 13px; color: #7d7872;">
                      Need to make changes?
                      ${rescheduleUrl ? `<a href="${rescheduleUrl}" style="color: ${accentColor}; text-decoration: none; font-weight: 500;">Reschedule</a>` : ''}
                      ${rescheduleUrl && cancelUrl ? ` · ` : ''}
                      ${cancelUrl ? `<a href="${cancelUrl}" style="color: ${accentColor}; text-decoration: none; font-weight: 500;">Cancel</a>` : ''}
                    </p>
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Footer - only show for starter plans -->
          ${orgBranding.plan === 'starter' ? `
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a09a94;">
                Powered by <a href="https://coachful.co" style="color: #a09a94; text-decoration: none;">Coachful</a>
              </p>
            </td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Appointment Rescheduled

Hi ${firstName},

Your ${config.name} with ${coachName} has been moved to a new time.

Previous: ${oldParts.date} at ${oldParts.time} (cancelled)

New time:
📅 ${newParts.date}
🕐 ${newTimeRange} (${newParts.timezoneAbbr}) · ${duration} minutes
📍 ${meetingProviderLabel}

${meetingUrl ? `Join the meeting: ${meetingUrl}` : ''}

${rescheduleUrl ? `Need to reschedule? ${rescheduleUrl}` : ''}
${cancelUrl ? `Need to cancel? ${cancelUrl}` : ''}
${orgBranding.plan === 'starter' ? `
---
Powered by Coachful` : ''}
  `.trim();

  // Build attachments (ICS calendar invite)
  const attachments = icsContent
    ? [{
        filename: `${config.name.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-')}.ics`,
        content: icsContent,
        contentType: 'text/calendar; method=REQUEST; charset=utf-8' as const,
      }]
    : undefined;

  try {
    await sendTenantEmail({
      to: prospectEmail,
      subject: `Rescheduled: ${config.name} with ${coachName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
      attachments,
    });
    console.log('[INTAKE_NOTIFICATION] Reschedule sent to prospect:', prospectEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send reschedule to prospect:', error);
  }
}

/**
 * Send reschedule notification to the coach
 */
async function sendIntakeRescheduleToCoach(data: IntakeRescheduleData) {
  const {
    event,
    config,
    prospectName,
    prospectEmail,
    coachEmail,
    organizationId,
    oldStartDateTime,
    newStartDateTime,
    newEndDateTime,
  } = data;

  if (!coachEmail) {
    console.warn('[INTAKE_NOTIFICATION] No coach email provided, skipping reschedule notification');
    return;
  }

  const timezone = event.timezone || 'America/New_York';
  const oldFormatted = formatDateTime(oldStartDateTime, timezone);
  const newFormatted = formatDateTime(newStartDateTime, timezone);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #2563eb; font-size: 24px; margin-bottom: 8px;">
        Appointment Rescheduled
      </h1>
      <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
        ${prospectName} has rescheduled their ${config.name}.
      </p>

      <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #fcd34d;">
        <p style="margin: 0; font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Previous time</p>
        <p style="margin: 8px 0 0; font-weight: 500; color: #666; text-decoration: line-through;">
          ${oldFormatted}
        </p>
      </div>

      <div style="background: #d1fae5; border-radius: 12px; padding: 16px; margin-bottom: 24px; border: 1px solid #6ee7b7;">
        <p style="margin: 0; font-size: 13px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px;">New time</p>
        <p style="margin: 8px 0 0; font-weight: 600; color: #1a1a1a;">
          ${newFormatted}
        </p>
      </div>

      <div style="background: #f7f7f7; border-radius: 12px; padding: 20px;">
        <p style="margin: 0 0 8px; color: #666;">
          <strong>Name:</strong> ${prospectName}
        </p>
        <p style="margin: 0; color: #666;">
          <strong>Email:</strong> ${prospectEmail}
        </p>
        ${event.prospectPhone ? `
          <p style="margin: 8px 0 0; color: #666;">
            <strong>Phone:</strong> ${event.prospectPhone}
          </p>
        ` : ''}
      </div>

      ${event.meetingLink ? `
        <div style="margin-top: 24px;">
          <a href="${event.meetingLink}" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">
            Join Meeting
          </a>
        </div>
      ` : ''}
    </div>
  `;

  const text = `
Appointment Rescheduled

${prospectName} has rescheduled their ${config.name}.

Previous: ${oldFormatted}
New: ${newFormatted}

Name: ${prospectName}
Email: ${prospectEmail}
${event.prospectPhone ? `Phone: ${event.prospectPhone}` : ''}
${event.meetingLink ? `\nJoin: ${event.meetingLink}` : ''}
  `.trim();

  try {
    await sendTenantEmail({
      to: coachEmail,
      subject: `Rescheduled: ${config.name} with ${prospectName}`,
      html,
      text,
      organizationId,
      emailType: 'transactional',
    });
    console.log('[INTAKE_NOTIFICATION] Reschedule sent to coach:', coachEmail);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to send reschedule to coach:', error);
  }
}

/**
 * Send both reschedule notifications
 */
export async function sendIntakeRescheduleNotifications(data: IntakeRescheduleData) {
  await Promise.all([
    sendIntakeRescheduleToProspect(data),
    sendIntakeRescheduleToCoach(data),
  ]);
}

/**
 * Create an in-app notification for the coach when an intake call is booked/rescheduled/cancelled
 */
export async function createIntakeNotificationForCoach(params: {
  coachUserId: string;
  type: 'intake_call_booked' | 'intake_call_rescheduled' | 'intake_call_cancelled';
  prospectName: string;
  configName: string;
  startDateTime: string;
  organizationId: string;
  eventId: string;
}) {
  const { coachUserId, type, prospectName, configName, startDateTime, organizationId } = params;

  // Skip if no valid coach user ID
  if (!coachUserId || coachUserId === 'system' || coachUserId === 'public_booking') {
    console.log('[INTAKE_NOTIFICATION] Skipping in-app notification - no valid coach userId');
    return;
  }

  const titles: Record<typeof type, string> = {
    intake_call_booked: 'New intake call booked',
    intake_call_rescheduled: 'Intake call rescheduled',
    intake_call_cancelled: 'Intake call cancelled',
  };

  // Format the start time for display
  const date = new Date(startDateTime);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  try {
    await notifyUser({
      userId: coachUserId,
      type: type as NotificationType,
      title: titles[type],
      body: `${prospectName} - ${configName} on ${formattedDate} at ${formattedTime}`,
      actionRoute: '/coach?tab=scheduling',
      organizationId,
    });
    console.log(`[INTAKE_NOTIFICATION] In-app notification created for coach: ${coachUserId}, type: ${type}`);
  } catch (error) {
    console.error('[INTAKE_NOTIFICATION] Failed to create in-app notification:', error);
    throw error;
  }
}
