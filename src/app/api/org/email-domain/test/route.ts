import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import type { OrgBranding, UserRole } from '@/types';

const PLATFORM_DEFAULT_SENDER = 'Growth Addicts <hi@updates.growthaddicts.com>';

/**
 * POST /api/org/email-domain/test
 * Sends a test email to the current user using the configured domain
 */
export async function POST() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has coach/admin access
    const publicMetadata = sessionClaims?.publicMetadata as { role?: UserRole } | undefined;
    const role = publicMetadata?.role;

    if (!canAccessCoachDashboard(role)) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    // Check if Resend is configured
    if (!isResendConfigured() || !resend) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    // Get user's email
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userEmail = user.emailAddresses.find(
      (email) => email.id === user.primaryEmailAddressId
    )?.emailAddress;

    if (!userEmail) {
      return NextResponse.json({ error: 'No email address found for user' }, { status: 400 });
    }

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Get branding settings
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const branding = brandingDoc.data() as OrgBranding | undefined;
    const emailSettings = branding?.emailSettings;

    // Determine sender
    let fromAddress: string;
    if (emailSettings?.status === 'verified' && emailSettings.domain) {
      const fromName = emailSettings.fromName || branding?.appTitle || 'Notifications';
      fromAddress = `${fromName} <notifications@${emailSettings.domain}>`;
    } else {
      fromAddress = PLATFORM_DEFAULT_SENDER;
    }

    // Send test email
    console.log(`[EMAIL_DOMAIN_TEST] Sending test email to ${userEmail} from ${fromAddress}`);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: userEmail,
      subject: '✅ Test Email - Your Domain is Working!',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">
            🎉 Success!
          </h1>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            This is a test email from your whitelabel email domain.
          </p>
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">
              <strong>From:</strong> ${fromAddress}
            </p>
            <p style="margin: 8px 0 0; color: #666; font-size: 14px;">
              <strong>Domain Status:</strong> ${emailSettings?.status || 'not configured'}
            </p>
          </div>
          <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
            If you received this email, your email domain is configured correctly. All emails sent to your users will come from this domain.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">
            This is a test email. You can ignore it.
          </p>
        </div>
      `,
      text: `
Success! This is a test email from your whitelabel email domain.

From: ${fromAddress}
Domain Status: ${emailSettings?.status || 'not configured'}

If you received this email, your email domain is configured correctly.
      `.trim(),
      replyTo: emailSettings?.replyTo || undefined,
    });

    if (error) {
      console.error('[EMAIL_DOMAIN_TEST] Send error:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to send test email' 
      }, { status: 400 });
    }

    console.log(`[EMAIL_DOMAIN_TEST] Test email sent successfully: ${data?.id}`);

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      sentTo: userEmail,
      sentFrom: fromAddress,
    });
  } catch (error) {
    console.error('[EMAIL_DOMAIN_TEST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}







