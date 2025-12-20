/**
 * Coach API: Custom Domain Management (Single Domain)
 * 
 * DELETE /api/coach/org-domain/custom/[domainId] - Remove a custom domain
 */

import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { removeCustomDomain } from '@/lib/tenant/resolveTenant';
import { isSuperCoach } from '@/lib/admin-utils-shared';
import { auth } from '@clerk/nextjs/server';
import type { OrgRole, OrgCustomDomain } from '@/types';

interface ClerkPublicMetadata {
  orgRole?: OrgRole;
  [key: string]: unknown;
}

/**
 * DELETE /api/coach/org-domain/custom/[domainId]
 * Remove a custom domain
 * Only super_coach can remove custom domains
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const { domainId } = await params;
    const { organizationId } = await requireCoachWithOrg();
    
    // Check if user is super_coach
    const { sessionClaims } = await auth();
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const orgRole = publicMetadata?.orgRole;
    
    if (!isSuperCoach(orgRole)) {
      return NextResponse.json(
        { error: 'Only the Super Coach can remove custom domains' },
        { status: 403 }
      );
    }
    
    // Verify the domain belongs to this organization
    const domainDoc = await adminDb.collection('org_custom_domains').doc(domainId).get();
    
    if (!domainDoc.exists) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    
    const domainData = domainDoc.data() as OrgCustomDomain;
    if (domainData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Domain does not belong to your organization' },
        { status: 403 }
      );
    }
    
    // Remove the domain
    await removeCustomDomain(domainId);
    
    console.log(`[COACH_CUSTOM_DOMAIN] Removed custom domain ${domainData.domain} from org ${organizationId}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[COACH_CUSTOM_DOMAIN_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to remove custom domain' }, { status: 500 });
  }
}
