/**
 * User Tenant Domains API
 * 
 * GET /api/user/tenant-domains - Get all tenant domains the user belongs to
 * 
 * Returns org name, subdomain, and custom domain for each organization
 * the user is a member of. Used on platform domain to show links.
 * 
 * Checks both:
 * - Firestore org_memberships (for regular members)
 * - Clerk organization memberships (for coaches who own their orgs)
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface TenantDomainInfo {
  organizationId: string;
  name: string;
  subdomain: string | null;
  customDomain: string | null;
  imageUrl: string | null;
  tenantUrl: string | null;
  isOwner?: boolean; // True if user is the org owner/coach
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const client = await clerkClient();
    
    // Collect all unique organization IDs from multiple sources
    const orgIds = new Set<string>();
    const ownerOrgIds = new Set<string>(); // Track which orgs the user owns
    
    // Source 1: Clerk organization memberships (includes coaches who own their orgs)
    try {
      const clerkMemberships = await client.users.getOrganizationMembershipList({ userId });
      for (const membership of clerkMemberships.data) {
        orgIds.add(membership.organization.id);
        // If user is org:admin, they're the owner
        if (membership.role === 'org:admin') {
          ownerOrgIds.add(membership.organization.id);
        }
      }
    } catch (clerkError) {
      console.warn(`[USER_TENANT_DOMAINS] Could not fetch Clerk memberships for ${userId}:`, clerkError);
    }
    
    // Source 2: Firestore org_memberships (for regular members)
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    
    for (const doc of membershipsSnapshot.docs) {
      const membership = doc.data();
      orgIds.add(membership.organizationId);
    }
    
    // If no orgs found, return empty
    if (orgIds.size === 0) {
      return NextResponse.json({ tenantDomains: [] });
    }
    
    const tenantDomains: TenantDomainInfo[] = [];
    
    // Fetch domain info for all unique organizations
    for (const organizationId of orgIds) {
      try {
        // Get organization info from Clerk
        const org = await client.organizations.getOrganization({ organizationId });
        
        // Get domain info from Firestore (query by field since docs may have auto-generated IDs)
        const domainSnapshot = await adminDb
          .collection('org_domains')
          .where('organizationId', '==', organizationId)
          .limit(1)
          .get();
        const domainData = domainSnapshot.docs[0]?.data();
        
        const subdomain = domainData?.subdomain || null;
        const customDomain = domainData?.verifiedCustomDomain || null;
        
        // Build tenant URL (prefer custom domain, fall back to subdomain)
        let tenantUrl: string | null = null;
        if (customDomain) {
          tenantUrl = `https://${customDomain}`;
        } else if (subdomain) {
          tenantUrl = `https://${subdomain}.growthaddicts.com`;
        }
        
        tenantDomains.push({
          organizationId,
          name: org.name,
          subdomain,
          customDomain,
          imageUrl: org.imageUrl,
          tenantUrl,
          isOwner: ownerOrgIds.has(organizationId),
        });
      } catch (error) {
        console.warn(`[USER_TENANT_DOMAINS] Could not fetch org ${organizationId}:`, error);
        // Skip orgs that can't be fetched
      }
    }
    
    // Sort: owner orgs first, then alphabetically by name
    tenantDomains.sort((a, b) => {
      if (a.isOwner && !b.isOwner) return -1;
      if (!a.isOwner && b.isOwner) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({
      tenantDomains,
    });
  } catch (error) {
    console.error('[USER_TENANT_DOMAINS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

