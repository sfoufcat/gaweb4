/**
 * Admin API: Organization Management
 * 
 * DELETE /api/admin/organizations/[organizationId]
 * Allows super_admin to delete an organization and all associated data
 */

import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireSuperAdmin } from '@/lib/admin-utils-clerk';
import { adminDb } from '@/lib/firebase-admin';
import { removeDomainFromVercel, isVercelDomainApiConfigured } from '@/lib/vercel-domains';
import { removeDomainFromClerk } from '@/lib/clerk-domains';
import { removeDomainFromApplePay } from '@/lib/stripe-domains';
import { 
  invalidateTenantBySubdomain,
  invalidateTenantByCustomDomain,
} from '@/lib/tenant-edge-config';
import type { OrgCustomDomain } from '@/types';

interface DeletionResult {
  success: boolean;
  organizationId: string;
  organizationName?: string;
  deletedData: {
    orgDomains: number;
    customDomains: number;
    orgSettings: boolean;
    orgBranding: boolean;
    orgChannels: number;
    coachSubscription: boolean;
    orgMemberships: number;
    clerkOrg: boolean;
  };
  errors: string[];
}

/**
 * DELETE /api/admin/organizations/[organizationId]
 * Delete an organization and all associated data (super_admin only)
 * 
 * This will:
 * 1. Delete all custom domains (from Clerk, Vercel, Stripe, and database)
 * 2. Delete org_domains (subdomain mappings)
 * 3. Delete org_settings
 * 4. Delete org_branding
 * 5. Delete org_channels
 * 6. Delete coach_subscriptions
 * 7. Delete org_memberships
 * 8. Invalidate Edge Config entries
 * 9. Delete the Clerk Organization (removes all memberships automatically)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const result: DeletionResult = {
    success: false,
    organizationId: '',
    deletedData: {
      orgDomains: 0,
      customDomains: 0,
      orgSettings: false,
      orgBranding: false,
      orgChannels: 0,
      coachSubscription: false,
      orgMemberships: 0,
      clerkOrg: false,
    },
    errors: [],
  };

  try {
    // Check authorization - only super_admin can access
    await requireSuperAdmin();
    
    const { organizationId } = await params;
    result.organizationId = organizationId;

    console.log(`[ADMIN_ORG_DELETE] Super admin deleting organization ${organizationId}`);

    // Get organization info from Clerk first
    const client = await clerkClient();
    let orgName: string | undefined;
    try {
      const org = await client.organizations.getOrganization({ organizationId });
      orgName = org.name;
      result.organizationName = orgName;
      console.log(`[ADMIN_ORG_DELETE] Deleting organization: ${orgName} (${organizationId})`);
    } catch (error) {
      console.error(`[ADMIN_ORG_DELETE] Could not fetch org from Clerk:`, error);
      result.errors.push('Could not fetch organization from Clerk - it may already be deleted');
    }

    // 1. Get and delete custom domains (need to remove from external services too)
    try {
      const customDomainsSnapshot = await adminDb
        .collection('org_custom_domains')
        .where('organizationId', '==', organizationId)
        .get();

      for (const doc of customDomainsSnapshot.docs) {
        const domainData = doc.data() as OrgCustomDomain;
        
        // Invalidate Edge Config for custom domain
        try {
          await invalidateTenantByCustomDomain(domainData.domain);
          console.log(`[ADMIN_ORG_DELETE] Invalidated Edge Config for custom domain: ${domainData.domain}`);
        } catch (e) {
          result.errors.push(`Edge Config invalidation failed for ${domainData.domain}`);
        }

        // Remove from Vercel
        if (isVercelDomainApiConfigured()) {
          try {
            await removeDomainFromVercel(domainData.domain);
            console.log(`[ADMIN_ORG_DELETE] Removed from Vercel: ${domainData.domain}`);
          } catch (e) {
            result.errors.push(`Vercel removal failed for ${domainData.domain}`);
          }
        }

        // Remove from Clerk
        if (domainData.clerkDomainId) {
          try {
            await removeDomainFromClerk(domainData.clerkDomainId);
            console.log(`[ADMIN_ORG_DELETE] Removed from Clerk: ${domainData.domain}`);
          } catch (e) {
            result.errors.push(`Clerk removal failed for ${domainData.domain}`);
          }
        }

        // Remove from Stripe Apple Pay (if connected account exists)
        const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
        const settings = settingsDoc.data();
        if (settings?.stripeConnectAccountId) {
          try {
            await removeDomainFromApplePay(domainData.domain, settings.stripeConnectAccountId);
            console.log(`[ADMIN_ORG_DELETE] Removed from Stripe: ${domainData.domain}`);
          } catch (e) {
            result.errors.push(`Stripe removal failed for ${domainData.domain}`);
          }
        }

        // Delete from Firestore
        await doc.ref.delete();
        result.deletedData.customDomains++;
      }
      console.log(`[ADMIN_ORG_DELETE] Deleted ${result.deletedData.customDomains} custom domains`);
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting custom domains:', error);
      result.errors.push('Failed to delete some custom domains');
    }

    // 2. Get and delete org_domains (subdomain mappings) and invalidate Edge Config
    try {
      const orgDomainsSnapshot = await adminDb
        .collection('org_domains')
        .where('organizationId', '==', organizationId)
        .get();

      for (const doc of orgDomainsSnapshot.docs) {
        const domainData = doc.data();
        
        // Invalidate Edge Config for subdomain
        if (domainData.subdomain) {
          try {
            await invalidateTenantBySubdomain(domainData.subdomain);
            console.log(`[ADMIN_ORG_DELETE] Invalidated Edge Config for subdomain: ${domainData.subdomain}`);
          } catch (e) {
            result.errors.push(`Edge Config invalidation failed for subdomain ${domainData.subdomain}`);
          }
        }

        await doc.ref.delete();
        result.deletedData.orgDomains++;
      }
      console.log(`[ADMIN_ORG_DELETE] Deleted ${result.deletedData.orgDomains} org domains`);
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting org domains:', error);
      result.errors.push('Failed to delete org domains');
    }

    // 3. Delete org_settings
    try {
      const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
      if (settingsDoc.exists) {
        await settingsDoc.ref.delete();
        result.deletedData.orgSettings = true;
        console.log(`[ADMIN_ORG_DELETE] Deleted org_settings`);
      }
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting org settings:', error);
      result.errors.push('Failed to delete org settings');
    }

    // 4. Delete org_branding
    try {
      const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
      if (brandingDoc.exists) {
        await brandingDoc.ref.delete();
        result.deletedData.orgBranding = true;
        console.log(`[ADMIN_ORG_DELETE] Deleted org_branding`);
      }
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting org branding:', error);
      result.errors.push('Failed to delete org branding');
    }

    // 5. Delete org_channels
    try {
      const channelsSnapshot = await adminDb
        .collection('org_channels')
        .where('organizationId', '==', organizationId)
        .get();

      for (const doc of channelsSnapshot.docs) {
        await doc.ref.delete();
        result.deletedData.orgChannels++;
      }
      console.log(`[ADMIN_ORG_DELETE] Deleted ${result.deletedData.orgChannels} org channels`);
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting org channels:', error);
      result.errors.push('Failed to delete org channels');
    }

    // 6. Delete coach_subscriptions
    try {
      const subscriptionDoc = await adminDb.collection('coach_subscriptions').doc(organizationId).get();
      if (subscriptionDoc.exists) {
        await subscriptionDoc.ref.delete();
        result.deletedData.coachSubscription = true;
        console.log(`[ADMIN_ORG_DELETE] Deleted coach_subscriptions`);
      }
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting coach subscription:', error);
      result.errors.push('Failed to delete coach subscription');
    }

    // 7. Delete org_memberships
    try {
      const membershipsSnapshot = await adminDb
        .collection('org_memberships')
        .where('organizationId', '==', organizationId)
        .get();

      for (const doc of membershipsSnapshot.docs) {
        await doc.ref.delete();
        result.deletedData.orgMemberships++;
      }
      console.log(`[ADMIN_ORG_DELETE] Deleted ${result.deletedData.orgMemberships} org memberships`);
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting org memberships:', error);
      result.errors.push('Failed to delete org memberships');
    }

    // 8. Delete the Clerk Organization (this removes all memberships automatically)
    try {
      await client.organizations.deleteOrganization(organizationId);
      result.deletedData.clerkOrg = true;
      console.log(`[ADMIN_ORG_DELETE] Deleted Clerk organization`);
    } catch (error) {
      console.error('[ADMIN_ORG_DELETE] Error deleting Clerk organization:', error);
      result.errors.push('Failed to delete Clerk organization');
    }

    result.success = result.errors.length === 0;
    
    console.log(`[ADMIN_ORG_DELETE] Completed deletion of org ${organizationId}. Success: ${result.success}, Errors: ${result.errors.length}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[ADMIN_ORG_DELETE] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Super admin')) {
      return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to delete organization',
      details: message,
    }, { status: 500 });
  }
}

