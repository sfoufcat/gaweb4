/**
 * Tenant Resolution API
 * 
 * GET /api/tenant/resolve?subdomain=xxx or ?domain=xxx
 * 
 * Called by middleware to resolve tenant from subdomain or custom domain.
 * This API has access to Firebase Admin SDK, which edge middleware does not.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgDomain, OrgCustomDomain } from '@/types';

export async function GET(request: Request) {
  // Only allow internal requests (from middleware)
  const isInternal = request.headers.get('x-internal-request') === 'true';
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isInternal && !isDev) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  const { searchParams } = new URL(request.url);
  const subdomain = searchParams.get('subdomain');
  const domain = searchParams.get('domain');
  
  if (!subdomain && !domain) {
    return NextResponse.json({ error: 'Missing subdomain or domain parameter' }, { status: 400 });
  }
  
  try {
    if (subdomain) {
      // Resolve by subdomain
      const snapshot = await adminDb
        .collection('org_domains')
        .where('subdomain', '==', subdomain.toLowerCase())
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return NextResponse.json({ found: false }, { status: 404 });
      }
      
      const data = snapshot.docs[0].data() as OrgDomain;
      return NextResponse.json({
        found: true,
        organizationId: data.organizationId,
        subdomain: data.subdomain,
        isCustomDomain: false,
      });
    } else if (domain) {
      // Resolve by custom domain
      const snapshot = await adminDb
        .collection('org_custom_domains')
        .where('domain', '==', domain.toLowerCase())
        .where('status', '==', 'verified')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return NextResponse.json({ found: false }, { status: 404 });
      }
      
      const customDomainData = snapshot.docs[0].data() as OrgCustomDomain;
      
      // Get the org's subdomain
      const orgDomainSnapshot = await adminDb
        .collection('org_domains')
        .where('organizationId', '==', customDomainData.organizationId)
        .limit(1)
        .get();
      
      const subdomain = orgDomainSnapshot.empty 
        ? '' 
        : (orgDomainSnapshot.docs[0].data() as OrgDomain).subdomain;
      
      return NextResponse.json({
        found: true,
        organizationId: customDomainData.organizationId,
        subdomain,
        isCustomDomain: true,
      });
    }
    
    return NextResponse.json({ found: false }, { status: 404 });
  } catch (error) {
    console.error('[TENANT_RESOLVE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
