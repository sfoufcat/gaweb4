/**
 * Admin API: Force Re-sync Tenant Edge Config
 * 
 * POST /api/admin/force-sync-tenant
 * 
 * Forces a re-sync of a tenant's Edge Config entry, clearing any stale
 * verifiedCustomDomain references. Only accessible by super_admin.
 */

import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { 
  syncTenantToEdgeConfig, 
  type TenantBrandingData,
  DEFAULT_TENANT_BRANDING,
} from '@/lib/tenant-edge-config';

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();
    
    const body = await request.json();
    const { subdomain, clearCustomDomain } = body as { 
      subdomain: string;
      clearCustomDomain?: boolean;
    };
    
    if (!subdomain) {
      return NextResponse.json({ error: 'subdomain is required' }, { status: 400 });
    }
    
    // Find the org_domains entry for this subdomain
    const orgDomainSnapshot = await adminDb
      .collection('org_domains')
      .where('subdomain', '==', subdomain.toLowerCase())
      .limit(1)
      .get();
    
    if (orgDomainSnapshot.empty) {
      return NextResponse.json({ error: 'Subdomain not found' }, { status: 404 });
    }
    
    const orgDomainDoc = orgDomainSnapshot.docs[0];
    const orgDomainData = orgDomainDoc.data();
    const organizationId = orgDomainData.organizationId;
    
    // Get branding
    const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
    const brandingData = brandingDoc.data();
    
    const edgeBranding: TenantBrandingData = brandingData ? {
      logoUrl: brandingData.logoUrl || null,
      horizontalLogoUrl: brandingData.horizontalLogoUrl || null,
      appTitle: brandingData.appTitle || DEFAULT_TENANT_BRANDING.appTitle,
      colors: brandingData.colors || DEFAULT_TENANT_BRANDING.colors,
      menuTitles: brandingData.menuTitles || DEFAULT_TENANT_BRANDING.menuTitles,
    } : DEFAULT_TENANT_BRANDING;
    
    // Determine verified custom domain
    let verifiedCustomDomain: string | undefined = undefined;
    
    if (!clearCustomDomain) {
      // Check if there's actually a verified custom domain in org_custom_domains
      const customDomainSnapshot = await adminDb
        .collection('org_custom_domains')
        .where('organizationId', '==', organizationId)
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      
      if (!customDomainSnapshot.empty) {
        verifiedCustomDomain = customDomainSnapshot.docs[0].data().domain;
      }
    }
    
    // Sync to Edge Config
    await syncTenantToEdgeConfig(
      organizationId,
      subdomain.toLowerCase(),
      edgeBranding,
      verifiedCustomDomain
    );
    
    console.log(`[FORCE_SYNC_TENANT] Synced Edge Config for ${subdomain}, verifiedCustomDomain=${verifiedCustomDomain || 'none'}`);
    
    return NextResponse.json({
      success: true,
      subdomain: subdomain.toLowerCase(),
      organizationId,
      verifiedCustomDomain: verifiedCustomDomain || null,
      message: clearCustomDomain 
        ? 'Edge Config synced with custom domain cleared'
        : 'Edge Config synced',
    });
  } catch (error) {
    console.error('[FORCE_SYNC_TENANT] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized' || message.includes('super_admin')) {
      return NextResponse.json({ error: 'Unauthorized - super_admin required' }, { status: 401 });
    }
    
    return NextResponse.json({ error: 'Failed to sync tenant' }, { status: 500 });
  }
}

