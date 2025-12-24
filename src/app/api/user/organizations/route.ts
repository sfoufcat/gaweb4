/**
 * User Organizations API
 * 
 * GET /api/user/organizations - Get all organizations the user belongs to
 * POST /api/user/organizations/switch - Switch active organization
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { OrgMembership, OrgBranding } from '@/types';

interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  membership: {
    id: string;
    orgRole: string;
    tier: string;
    track: string | null;
    joinedAt: string;
  };
  branding?: {
    logoUrl: string | null;
    appTitle: string;
  };
  isPrimary: boolean;
}

/**
 * GET /api/user/organizations
 * Get all organizations the user belongs to
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user's memberships from Firestore
    const membershipsSnapshot = await adminDb
      .collection('org_memberships')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    
    if (membershipsSnapshot.empty) {
      return NextResponse.json({ organizations: [] });
    }
    
    const client = await clerkClient();
    const primaryOrgId = (sessionClaims?.publicMetadata as Record<string, unknown>)?.primaryOrganizationId;
    
    const organizations: OrganizationInfo[] = [];
    
    for (const doc of membershipsSnapshot.docs) {
      const membership = doc.data() as OrgMembership;
      
      try {
        // Get organization info from Clerk
        const org = await client.organizations.getOrganization({
          organizationId: membership.organizationId,
        });
        
        // Get branding from Firestore (optional)
        let branding: OrganizationInfo['branding'];
        try {
          const brandingDoc = await adminDb
            .collection('org_branding')
            .doc(membership.organizationId)
            .get();
          
          if (brandingDoc.exists) {
            const brandingData = brandingDoc.data() as OrgBranding;
            branding = {
              logoUrl: brandingData.logoUrl,
              appTitle: brandingData.appTitle,
            };
          }
        } catch {
          // Branding not found, use defaults
        }
        
        organizations.push({
          id: org.id,
          name: org.name,
          slug: org.slug || '',
          imageUrl: org.imageUrl,
          membership: {
            id: doc.id,
            orgRole: membership.orgRole,
            tier: membership.tier || 'basic',
            track: membership.track,
            joinedAt: membership.joinedAt,
          },
          branding,
          isPrimary: org.id === primaryOrgId,
        });
      } catch (error) {
        console.warn(`[USER_ORGS] Could not fetch org ${membership.organizationId}:`, error);
        // Skip orgs that can't be fetched
      }
    }
    
    // Sort: primary org first, then by name
    organizations.sort((a, b) => {
      if (a.isPrimary) return -1;
      if (b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return NextResponse.json({
      organizations,
      primaryOrganizationId: primaryOrgId || null,
    });
  } catch (error) {
    console.error('[USER_ORGS_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}


