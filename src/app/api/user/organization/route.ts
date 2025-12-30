/**
 * User Organization API
 * 
 * GET /api/user/organization - Get all organizations the user belongs to
 * 
 * Checks multiple sources:
 * 1. Clerk's actual organization memberships
 * 2. Firestore org_memberships collection
 * 3. Firestore users.organizationId field
 * 4. Clerk publicMetadata.organizationId
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClerkPublicMetadata } from '@/types';

/**
 * GET /api/user/organization
 * Get all organizations the user belongs to from multiple sources
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const organizationIds: Set<string> = new Set();
    let primaryOrganizationId: string | null = null;
    
    // Source 1: Clerk publicMetadata - check primaryOrganizationId first, then legacy organizationId
    const metadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const metadataPrimaryOrgId = metadata?.primaryOrganizationId || metadata?.organizationId;
    if (metadataPrimaryOrgId) {
      organizationIds.add(metadataPrimaryOrgId);
      primaryOrganizationId = metadataPrimaryOrgId;
    }
    
    // Source 2: Check actual Clerk organization memberships
    try {
      const clerk = await clerkClient();
      const memberships = await clerk.users.getOrganizationMembershipList({ userId });
      
      for (const membership of memberships.data) {
        if (membership.organization?.id) {
          organizationIds.add(membership.organization.id);
          // First Clerk membership becomes primary if not already set
          if (!primaryOrganizationId) {
            primaryOrganizationId = membership.organization.id;
          }
        }
      }
    } catch (err) {
      // Clerk org memberships check failed, continue with other sources
      console.warn('[USER_ORG] Clerk membership check failed:', err);
    }
    
    // Source 3: Check Firestore org_memberships collection
    try {
      const membershipsSnapshot = await adminDb
        .collection('org_memberships')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .get();
      
      for (const doc of membershipsSnapshot.docs) {
        const data = doc.data();
        if (data.organizationId) {
          organizationIds.add(data.organizationId);
          if (!primaryOrganizationId) {
            primaryOrganizationId = data.organizationId;
          }
        }
      }
    } catch (err) {
      // Firestore org_memberships check failed, continue
      console.warn('[USER_ORG] Firestore org_memberships check failed:', err);
    }
    
    // Source 4: Check Firestore users document organizationId field
    try {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData?.organizationId) {
          organizationIds.add(userData.organizationId);
          if (!primaryOrganizationId) {
            primaryOrganizationId = userData.organizationId;
          }
        }
      }
    } catch (err) {
      // Firestore users check failed, continue
      console.warn('[USER_ORG] Firestore users check failed:', err);
    }
    
    return NextResponse.json({
      organizationId: primaryOrganizationId, // Primary org (for backward compat)
      organizationIds: Array.from(organizationIds), // All orgs user belongs to
      hasOrganizations: organizationIds.size > 0,
      userId,
    });
  } catch (error) {
    console.error('[USER_ORG_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
