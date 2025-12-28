import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import type { OrgBranding, OrgEmailSettings, EmailDomainStatus, EmailDnsRecord, UserRole } from '@/types';
import { DEFAULT_EMAIL_SETTINGS } from '@/types';

/**
 * GET /api/org/email-domain
 * Fetches email domain settings for the current user's organization
 */
export async function GET() {
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

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Fetch branding from Firestore
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();

    if (!brandingDoc.exists) {
      return NextResponse.json({
        emailSettings: DEFAULT_EMAIL_SETTINGS,
        isDefault: true,
      });
    }

    const branding = brandingDoc.data() as OrgBranding;

    return NextResponse.json({
      emailSettings: branding.emailSettings || DEFAULT_EMAIL_SETTINGS,
      isDefault: !branding.emailSettings,
    });
  } catch (error) {
    console.error('[EMAIL_DOMAIN_GET_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * POST /api/org/email-domain
 * Adds a new email domain via Resend API
 * 
 * Body: { domain: string, fromName?: string, replyTo?: string }
 */
export async function POST(request: Request) {
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

    // Parse request body
    const body = await request.json();
    const { domain, fromName, replyTo } = body as { 
      domain: string; 
      fromName?: string; 
      replyTo?: string;
    };

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    if (!domainRegex.test(domain.toLowerCase())) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Get existing branding to check if domain already exists
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const existingBranding = brandingDoc.data() as OrgBranding | undefined;

    if (existingBranding?.emailSettings?.resendDomainId) {
      return NextResponse.json({ 
        error: 'A domain is already configured. Please remove it first before adding a new one.' 
      }, { status: 400 });
    }

    // Create domain in Resend
    console.log(`[EMAIL_DOMAIN_POST] Creating domain ${domain} for org ${organizationId}`);
    
    const { data: resendData, error: resendError } = await resend.domains.create({
      name: domain.toLowerCase(),
    });

    if (resendError) {
      console.error('[EMAIL_DOMAIN_POST] Resend error:', resendError);
      return NextResponse.json({ 
        error: resendError.message || 'Failed to create domain in Resend' 
      }, { status: 400 });
    }

    if (!resendData) {
      return NextResponse.json({ error: 'No data returned from Resend' }, { status: 500 });
    }

    // Map Resend records to our format
    const dnsRecords: EmailDnsRecord[] = (resendData.records || []).map((record) => ({
      type: record.type as 'MX' | 'TXT',
      name: record.name,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl,
    }));

    // Map Resend status to our status
    const statusMap: Record<string, EmailDomainStatus> = {
      'pending': 'pending',
      'verified': 'verified',
      'failed': 'failed',
      'not_started': 'not_started',
    };
    const status: EmailDomainStatus = statusMap[resendData.status] || 'pending';

    // Create email settings
    const emailSettings: OrgEmailSettings = {
      domain: domain.toLowerCase(),
      resendDomainId: resendData.id,
      status,
      dnsRecords,
      verifiedAt: status === 'verified' ? new Date().toISOString() : null,
      fromName: fromName || existingBranding?.appTitle || 'Notifications',
      replyTo: replyTo || null,
    };

    // Update Firestore
    const now = new Date().toISOString();
    await adminDb.collection('org_branding').doc(organizationId).set({
      emailSettings,
      updatedAt: now,
    }, { merge: true });

    console.log(`[EMAIL_DOMAIN_POST] Domain ${domain} created successfully for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      emailSettings,
    });
  } catch (error) {
    console.error('[EMAIL_DOMAIN_POST_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/org/email-domain
 * Removes the email domain from Resend and clears settings
 */
export async function DELETE() {
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

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Get existing branding
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const existingBranding = brandingDoc.data() as OrgBranding | undefined;

    if (!existingBranding?.emailSettings?.resendDomainId) {
      return NextResponse.json({ error: 'No domain configured' }, { status: 400 });
    }

    const domainId = existingBranding.emailSettings.resendDomainId;

    // Remove domain from Resend
    console.log(`[EMAIL_DOMAIN_DELETE] Removing domain ${domainId} for org ${organizationId}`);
    
    try {
      await resend.domains.remove(domainId);
    } catch (resendError) {
      console.error('[EMAIL_DOMAIN_DELETE] Resend error (continuing anyway):', resendError);
      // Continue even if Resend fails - the domain might already be deleted
    }

    // Clear email settings in Firestore
    const now = new Date().toISOString();
    await adminDb.collection('org_branding').doc(organizationId).set({
      emailSettings: DEFAULT_EMAIL_SETTINGS,
      updatedAt: now,
    }, { merge: true });

    console.log(`[EMAIL_DOMAIN_DELETE] Domain removed successfully for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      emailSettings: DEFAULT_EMAIL_SETTINGS,
    });
  } catch (error) {
    console.error('[EMAIL_DOMAIN_DELETE_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}






