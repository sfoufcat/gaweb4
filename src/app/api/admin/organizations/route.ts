import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import type { OrgDomain, OrgCustomDomain } from '@/types';

interface OrganizationWithDomainInfo {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  membersCount: number;
  createdAt: string;
  // Domain info from Firestore
  subdomain: string | null;
  customDomains: Array<{ domain: string; status: string }>;
  tenantUrl: string | null;
}

/**
 * GET /api/admin/organizations
 * Lists all Clerk organizations with domain info from Firestore (super_admin only)
 * 
 * Used by the Admin panel to show all orgs and let super_admin select one
 * to view/manage its users and org roles.
 */
export async function GET() {
  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();

    const client = await clerkClient();
    
    // Fetch all organizations from Clerk
    const { data: clerkOrgs } = await client.organizations.getOrganizationList({
      limit: 100,
      orderBy: '-created_at',
    });

    console.log(`[ADMIN_ORGS] Found ${clerkOrgs.length} organizations in Clerk`);

    // Fetch domain info from Firestore for all orgs
    const orgIds = clerkOrgs.map(org => org.id);
    
    // Get org_domains (subdomains)
    const domainsMap = new Map<string, OrgDomain>();
    if (orgIds.length > 0) {
      // Firestore 'in' queries are limited to 30 items
      for (let i = 0; i < orgIds.length; i += 30) {
        const chunk = orgIds.slice(i, i + 30);
        const snapshot = await adminDb
          .collection('org_domains')
          .where('organizationId', 'in', chunk)
          .get();
        
        snapshot.forEach((doc) => {
          const data = doc.data() as OrgDomain;
          domainsMap.set(data.organizationId, { id: doc.id, ...data });
        });
      }
    }

    // Get org_custom_domains
    const customDomainsMap = new Map<string, OrgCustomDomain[]>();
    if (orgIds.length > 0) {
      for (let i = 0; i < orgIds.length; i += 30) {
        const chunk = orgIds.slice(i, i + 30);
        const snapshot = await adminDb
          .collection('org_custom_domains')
          .where('organizationId', 'in', chunk)
          .get();
        
        snapshot.forEach((doc) => {
          const data = doc.data() as OrgCustomDomain;
          const existing = customDomainsMap.get(data.organizationId) || [];
          existing.push({ id: doc.id, ...data });
          customDomainsMap.set(data.organizationId, existing);
        });
      }
    }

    // Get member counts for each org
    const memberCountsMap = new Map<string, number>();
    for (const org of clerkOrgs) {
      try {
        const memberships = await client.organizations.getOrganizationMembershipList({
          organizationId: org.id,
          limit: 1, // We just need the count
        });
        memberCountsMap.set(org.id, memberships.totalCount || 0);
      } catch {
        memberCountsMap.set(org.id, 0);
      }
    }

    // Transform to our format
    const organizations: OrganizationWithDomainInfo[] = clerkOrgs.map((org) => {
      const domainInfo = domainsMap.get(org.id);
      const customDomains = customDomainsMap.get(org.id) || [];
      const subdomain = domainInfo?.subdomain || null;
      
      return {
        id: org.id,
        name: org.name,
        slug: org.slug || '',
        imageUrl: org.imageUrl,
        membersCount: memberCountsMap.get(org.id) || 0,
        createdAt: new Date(org.createdAt).toISOString(),
        subdomain,
        customDomains: customDomains.map(cd => ({
          domain: cd.domain,
          status: cd.status,
        })),
        tenantUrl: subdomain ? `https://${subdomain}.growthaddicts.app` : null,
      };
    });

    return NextResponse.json({
      organizations,
      totalCount: organizations.length,
    });
  } catch (error) {
    console.error('[ADMIN_ORGS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Super admin')) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

