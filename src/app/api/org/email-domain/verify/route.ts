import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { resend, isResendConfigured } from '@/lib/resend';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { ensureCoachHasOrganization } from '@/lib/clerk-organizations';
import type { OrgBranding, OrgEmailSettings, EmailDomainStatus, EmailDnsRecord, UserRole } from '@/types';

/**
 * POST /api/org/email-domain/verify
 * Triggers domain verification check in Resend
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

    // Ensure user has an organization
    const organizationId = await ensureCoachHasOrganization(userId);

    // Get existing branding
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const existingBranding = brandingDoc.data() as OrgBranding | undefined;

    if (!existingBranding?.emailSettings?.resendDomainId) {
      return NextResponse.json({ error: 'No domain configured' }, { status: 400 });
    }

    const domainId = existingBranding.emailSettings.resendDomainId;

    // Trigger verification in Resend
    console.log(`[EMAIL_DOMAIN_VERIFY] Verifying domain ${domainId} for org ${organizationId}`);
    
    const { data: verifyData, error: verifyError } = await resend.domains.verify(domainId);

    if (verifyError) {
      console.error('[EMAIL_DOMAIN_VERIFY] Resend verify error:', verifyError);
      // Don't fail - just get the current status instead
    }

    // Get updated domain info
    const { data: domainData, error: domainError } = await resend.domains.get(domainId);

    if (domainError) {
      console.error('[EMAIL_DOMAIN_VERIFY] Resend get error:', domainError);
      return NextResponse.json({ 
        error: domainError.message || 'Failed to get domain status' 
      }, { status: 400 });
    }

    if (!domainData) {
      return NextResponse.json({ error: 'No data returned from Resend' }, { status: 500 });
    }

    // Map Resend status to our status
    const statusMap: Record<string, EmailDomainStatus> = {
      'pending': 'pending',
      'verified': 'verified',
      'failed': 'failed',
      'not_started': 'not_started',
    };
    const status: EmailDomainStatus = statusMap[domainData.status] || 'pending';

    // Map Resend records to our format
    const dnsRecords: EmailDnsRecord[] = (domainData.records || []).map((record) => ({
      type: record.type as 'MX' | 'TXT',
      name: record.name,
      value: record.value,
      priority: record.priority,
      ttl: record.ttl,
    }));

    // Update email settings
    const now = new Date().toISOString();
    const updatedEmailSettings: OrgEmailSettings = {
      ...existingBranding.emailSettings,
      status,
      dnsRecords,
      verifiedAt: status === 'verified' ? now : existingBranding.emailSettings.verifiedAt,
    };

    // Update Firestore
    await adminDb.collection('org_branding').doc(organizationId).set({
      emailSettings: updatedEmailSettings,
      updatedAt: now,
    }, { merge: true });

    console.log(`[EMAIL_DOMAIN_VERIFY] Domain ${domainId} status: ${status} for org ${organizationId}`);

    return NextResponse.json({
      success: true,
      verified: status === 'verified',
      status,
      emailSettings: updatedEmailSettings,
    });
  } catch (error) {
    console.error('[EMAIL_DOMAIN_VERIFY_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}






