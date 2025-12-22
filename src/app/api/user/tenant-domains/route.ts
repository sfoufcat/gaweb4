/**
 * User Tenant Domains API
 * 
 * GET /api/user/tenant-domains - Get all tenant domains the user belongs to
 * 
 * Returns org name, subdomain, and custom domain for each organization
 * the user is a member of. Used on platform domain to show links.
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
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's active memberships from Firestore
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    
    if (membershipsSnapshot.empty) {
      return NextResponse.json({ tenantDomains: [] });
    }
    
    const client = await clerkClient();
    const tenantDomains: TenantDomainInfo[] = [];
    
    for (const doc of membershipsSnapshot.docs) {
      const membership = doc.data();
      const organizationId = membership.organizationId;
      
      try {
        // Get organization info from Clerk
        const org = await client.organizations.getOrganization({ organizationId });
        
        // Get domain info from Firestore
        const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
        const domainData = domainDoc.data();
        
        const subdomain = domainData?.subdomain || null;
        const customDomain = domainData?.verifiedCustomDomain || null;
        
        // Build tenant URL (prefer custom domain, fall back to subdomain)
        let tenantUrl: string | null = null;
        if (customDomain) {
          tenantUrl = `https://${customDomain}`;
        } else if (subdomain) {
          tenantUrl = `https://${subdomain}.growthaddicts.app`;
        }
        
        tenantDomains.push({
          organizationId,
          name: org.name,
          subdomain,
          customDomain,
          imageUrl: org.imageUrl,
          tenantUrl,
        });
      } catch (error) {
        console.warn(`[USER_TENANT_DOMAINS] Could not fetch org ${organizationId}:`, error);
        // Skip orgs that can't be fetched
      }
    }
    
    // Sort alphabetically by name
    tenantDomains.sort((a, b) => a.name.localeCompare(b.name));
    
    return NextResponse.json({
      tenantDomains,
    });
  } catch (error) {
    console.error('[USER_TENANT_DOMAINS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

