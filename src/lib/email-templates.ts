/**
 * Email Templates Library
 * 
 * Provides default email templates and variable replacement logic for
 * coaches with verified email whitelabeling.
 * 
 * Supported variables:
 * - {{firstName}} - User's first name (or "there")
 * - {{appTitle}} - Coach's business name
 * - {{teamName}} - Same as appTitle (for consistency)
 * - {{logoUrl}} - Coach's logo URL
 * - {{ctaUrl}} - Action URL (varies by email type)
 * - {{year}} - Current year
 */

import type { EmailTemplate, EmailTemplateType, OrgEmailTemplates } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

export interface TemplateVariables {
  firstName: string;
  appTitle: string;
  teamName: string;
  logoUrl: string;
  ctaUrl: string;
  year: string;
}

export interface EmailTemplateConfig {
  key: EmailTemplateType;
  label: string;
  description: string;
  ctaLabel: string;
  isLocked?: boolean;
}

// =============================================================================
// TEMPLATE CONFIGURATIONS
// =============================================================================

export const EMAIL_TEMPLATE_CONFIGS: EmailTemplateConfig[] = [
  {
    key: 'welcome',
    label: 'Welcome Email',
    description: 'Sent after successful payment/signup',
    ctaLabel: 'Start your journey',
  },
  {
    key: 'abandonedCart',
    label: 'Abandoned Cart',
    description: 'Sent 15 minutes after starting signup without completing',
    ctaLabel: 'Resume your plan',
  },
  {
    key: 'morningReminder',
    label: 'Morning Reminder',
    description: 'Daily morning check-in reminder',
    ctaLabel: 'Start your morning check-in',
  },
  {
    key: 'eveningReminder',
    label: 'Evening Reminder',
    description: 'Daily evening reflection reminder',
    ctaLabel: 'Complete your evening check-in',
  },
  {
    key: 'weeklyReminder',
    label: 'Weekly Reminder',
    description: 'Weekend weekly reflection reminder',
    ctaLabel: 'Start your weekly reflection',
  },
  {
    key: 'paymentFailed',
    label: 'Payment Failed',
    description: 'Notification when subscription payment fails',
    ctaLabel: 'Update payment method',
  },
];

// Verification template config (shown but locked)
export const VERIFICATION_TEMPLATE_CONFIG: EmailTemplateConfig = {
  key: 'welcome' as EmailTemplateType, // Not actually used
  label: 'Verification Email',
  description: 'Email verification codes for new signups',
  ctaLabel: '',
  isLocked: true,
};

// =============================================================================
// DEFAULT TEMPLATES
// =============================================================================

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateType, EmailTemplate> = {
  welcome: {
    subject: 'Welcome to {{teamName}}: Your Transformation Starts Today 🚀',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{{logoUrl}}" alt="{{teamName}}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey {{firstName}},</p>
  
  <p style="margin-bottom: 20px;"><strong>Welcome to {{teamName}}</strong>. We're genuinely excited you're here.</p>
  
  <p style="margin-bottom: 20px;">You've just taken the first step into a system built to help you grow consistently, without burning out or losing momentum.</p>
  
  <p style="margin-bottom: 15px;"><strong>Here's what's waiting for you inside:</strong></p>
  
  <ul style="margin-bottom: 25px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">🔥 Daily structure that keeps you moving forward</li>
    <li style="margin-bottom: 8px;">🤝 Your accountability squad (no more doing this alone)</li>
    <li style="margin-bottom: 8px;">📅 Weekly reviews to lock in your progress</li>
    <li style="margin-bottom: 8px;">🧠 Expert strategies that protect your long-term results</li>
    <li style="margin-bottom: 8px;">📚 A full resource hub with templates, prompts & tools</li>
  </ul>
  
  <p style="margin-bottom: 20px;"><strong>This isn't just another program.</strong></p>
  
  <p style="margin-bottom: 25px;">It's a commitment. A commitment from us to guide you, and a commitment from you to show up.</p>
  
  <p style="margin-bottom: 15px;">Your login details are the same as the ones you used to sign up.</p>
  
  <p style="margin-bottom: 20px;">You can jump into your dashboard here:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      👉 Start your {{teamName}} journey
    </a>
  </div>
  
  <p style="margin-bottom: 20px;">If you ever need support, we're always here for you.</p>
  
  <p style="margin-bottom: 20px;"><strong>Let's make the next 12 months the most transformative of your life.</strong></p>
  
  <p style="margin-bottom: 30px;">Welcome to the family. ❤️</p>
  
  <p style="color: #666;">The {{teamName}} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © {{year}} {{teamName}}. All rights reserved.
  </p>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },

  abandonedCart: {
    subject: 'Your {{teamName}} plan is ready: complete your signup ⚡',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{{logoUrl}}" alt="{{teamName}}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hey {{firstName}},</p>
  
  <p style="margin-bottom: 20px;">You started building your plan inside {{teamName}}, and you were so close to unlocking everything.</p>
  
  <p style="margin-bottom: 20px;"><strong>Your personalized setup is saved and ready.</strong></p>
  
  <p style="margin-bottom: 25px;">All that's left is to complete your membership.</p>
  
  <p style="margin-bottom: 20px;">Here's the link to finish your signup:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      👉 Resume your {{teamName}} plan
    </a>
  </div>
  
  <p style="margin-bottom: 15px;"><strong>Why it's worth coming back (right now):</strong></p>
  
  <ul style="margin-bottom: 25px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">• Your daily structure is already prepared</li>
    <li style="margin-bottom: 8px;">• Your accountability squad activates once you join</li>
    <li style="margin-bottom: 8px;">• Your first weekly review begins the moment you're inside</li>
    <li style="margin-bottom: 8px;">• Your long-term success system is waiting for you</li>
  </ul>
  
  <p style="margin-bottom: 20px;"><strong>You already did the hard part: you showed up.</strong></p>
  
  <p style="margin-bottom: 25px;">Now take the final step so we can guide you through the rest.</p>
  
  <p style="margin-bottom: 30px;">If you run into anything while joining, reply directly to this email. We're here to help.</p>
  
  <p style="margin-bottom: 10px;">See you inside,</p>
  <p style="color: #666;">The {{teamName}} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © {{year}} {{teamName}}. All rights reserved.
  </p>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },

  morningReminder: {
    subject: 'Your morning check-in is ready 🌅',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{{logoUrl}}" alt="{{teamName}}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hi {{firstName}},</p>
  
  <p style="margin-bottom: 20px;">Your {{teamName}} morning check-in is ready.</p>
  
  <p style="margin-bottom: 25px;">Take 2–3 minutes to check in and set your focus for today.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      🌅 Start your morning check-in
    </a>
  </div>
  
  <p style="margin-bottom: 10px;">Keep going,</p>
  <p style="color: #666;">The {{teamName}} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © {{year}} {{teamName}}. All rights reserved.
  </p>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },

  eveningReminder: {
    subject: 'Close your day with a quick reflection 🌙',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{{logoUrl}}" alt="{{teamName}}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hi {{firstName}},</p>
  
  <p style="margin-bottom: 20px;">Not every day is a hit, and that's okay.</p>
  
  <p style="margin-bottom: 25px;">Take a moment to check in, reflect on today, and reset for tomorrow.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      🌙 Complete your evening check-in
    </a>
  </div>
  
  <p style="margin-bottom: 10px;">One step at a time,</p>
  <p style="color: #666;">The {{teamName}} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © {{year}} {{teamName}}. All rights reserved.
  </p>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },

  weeklyReminder: {
    subject: 'Reflect on your week and set up the next one 🔁',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #2c2520; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <img src="{{logoUrl}}" alt="{{teamName}}" style="width: 60px; height: 60px; border-radius: 12px;">
  </div>
  
  <p style="font-size: 18px; margin-bottom: 20px;">Hi {{firstName}},</p>
  
  <p style="margin-bottom: 20px;">You've made progress this week. Now is the perfect time to capture it.</p>
  
  <p style="margin-bottom: 25px;">Take a few minutes to complete your weekly reflection, review your wins, and set clear intentions for next week.</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2c2520 0%, #3d342d 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 32px; font-weight: bold; font-size: 16px;">
      🔁 Start your weekly reflection
    </a>
  </div>
  
  <p style="margin-bottom: 10px;">On your side,</p>
  <p style="color: #666;">The {{teamName}} Team</p>
  
  <hr style="border: none; border-top: 1px solid #e1ddd8; margin: 30px 0;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    © {{year}} {{teamName}}. All rights reserved.
  </p>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },

  paymentFailed: {
    subject: '⚠️ Payment Failed - Update Your Payment Method',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px 40px; text-align: center;">
              <img src="{{logoUrl}}" alt="{{teamName}}" style="max-height: 50px; max-width: 180px; margin-bottom: 15px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Payment Failed</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                Hi {{firstName}},
              </p>
              
              <p style="font-size: 16px; color: #374151; line-height: 1.6; margin: 0 0 20px 0;">
                We were unable to process your subscription payment for {{teamName}}. This could be due to an expired card, insufficient funds, or an issue with your payment method.
              </p>
              
              <!-- Warning Box -->
              <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="font-size: 14px; color: #7f1d1d; margin: 0;">
                  Please update your payment method to avoid any interruption to your service and your members' access.
                </p>
              </div>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <a href="{{ctaUrl}}" style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      Update Payment Method
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                If you have any questions, please reply to this email or contact our support team.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                © {{year}} {{teamName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    updatedAt: new Date().toISOString(),
  },
};

// Verification email template (read-only, for display purposes)
export const VERIFICATION_EMAIL_TEMPLATE: EmailTemplate = {
  subject: '{{code}} is your {{appTitle}} verification code',
  html: `<p>This is a system-generated verification email from Clerk.</p>
<p>The verification code will be inserted automatically.</p>
<p><strong>This template cannot be customized for security reasons.</strong></p>`,
  updatedAt: new Date().toISOString(),
};

// =============================================================================
// VARIABLE REPLACEMENT
// =============================================================================

/**
 * Replace template variables with actual values
 */
export function replaceTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template;
  
  result = result.replace(/\{\{firstName\}\}/g, variables.firstName);
  result = result.replace(/\{\{appTitle\}\}/g, variables.appTitle);
  result = result.replace(/\{\{teamName\}\}/g, variables.teamName);
  result = result.replace(/\{\{logoUrl\}\}/g, variables.logoUrl);
  result = result.replace(/\{\{ctaUrl\}\}/g, variables.ctaUrl);
  result = result.replace(/\{\{year\}\}/g, variables.year);
  
  return result;
}

/**
 * Get the template for an email type, using custom template if available
 */
export function getEmailTemplate(
  templateType: EmailTemplateType,
  customTemplates?: OrgEmailTemplates | null
): EmailTemplate {
  // Check for custom template
  if (customTemplates && customTemplates[templateType]) {
    return customTemplates[templateType]!;
  }
  
  // Fall back to default
  return DEFAULT_EMAIL_TEMPLATES[templateType];
}

/**
 * Render an email template with variables replaced
 */
export function renderEmailTemplate(
  templateType: EmailTemplateType,
  variables: TemplateVariables,
  customTemplates?: OrgEmailTemplates | null
): { subject: string; html: string } {
  const template = getEmailTemplate(templateType, customTemplates);
  
  return {
    subject: replaceTemplateVariables(template.subject, variables),
    html: replaceTemplateVariables(template.html, variables),
  };
}

/**
 * Sanitize HTML template (remove script tags and dangerous attributes)
 */
export function sanitizeHtmlTemplate(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove on* event handlers
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  
  return sanitized;
}

/**
 * List of available template variables for display in UI
 */
export const AVAILABLE_TEMPLATE_VARIABLES = [
  { name: '{{firstName}}', description: "User's first name (or 'there')" },
  { name: '{{appTitle}}', description: "Your business name" },
  { name: '{{teamName}}', description: "Same as appTitle" },
  { name: '{{logoUrl}}', description: "Your logo URL" },
  { name: '{{ctaUrl}}', description: "Action button URL" },
  { name: '{{year}}', description: "Current year" },
];

