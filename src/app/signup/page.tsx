/**
 * /signup - Default signup page for an organization
 * 
 * This page handles public signups without requiring a program/funnel configuration.
 * - If publicSignupEnabled: Shows signup form (OAuth + email/password)
 * - If disabled: Shows "contact coach" page with coach info
 * 
 * After signup, users are added to the organization but NOT enrolled in any program.
 */

import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import type { OrgSettings } from '@/types';
import SignupPageClient from './SignupPageClient';

interface CoachInfo {
  name: string;
  email: string;
  imageUrl?: string;
}

async function getOrgSettings(organizationId: string): Promise<OrgSettings | null> {
  try {
    const doc = await adminDb.collection('org_settings').doc(organizationId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as OrgSettings;
  } catch (error) {
    console.error('[SIGNUP] Error fetching org settings:', error);
    return null;
  }
}

async function getCoachInfo(organizationId: string): Promise<CoachInfo> {
  try {
    const clerk = await clerkClient();
    
    // Get organization members to find the super_coach (the actual coach user)
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId,
    });
    
    // Find the member with super_coach orgRole (stored in membership publicMetadata)
    const coachMember = memberships.data.find(m => {
      const metadata = m.publicMetadata as { orgRole?: string } | undefined;
      return metadata?.orgRole === 'super_coach';
    });
    
    if (coachMember?.publicUserData?.userId) {
      // Get the actual coach user's details
      const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
      const name = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
      const email = coachUser.emailAddresses[0]?.emailAddress || '';
      return { name, email, imageUrl: coachUser.imageUrl };
    }
    
    // Fallback to first admin member if no super_coach found
    const adminMember = memberships.data.find(m => 
      m.role === 'org:admin' && m.publicUserData?.userId
    );
    
    if (adminMember?.publicUserData?.userId) {
      const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
      const name = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Coach';
      const email = adminUser.emailAddresses[0]?.emailAddress || '';
      return { name, email, imageUrl: adminUser.imageUrl };
    }
    
    return { name: 'Coach', email: '' };
  } catch (error) {
    console.error('[SIGNUP] Error fetching coach info:', error);
    return { name: 'Coach', email: '' };
  }
}

export default async function SignupPage() {
  // Get hostname for tenant resolution and branding
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  
  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);
  const organizationId = tenantResult.type === 'tenant' ? tenantResult.tenant.organizationId : null;
  const tenantSubdomain = tenantResult.type === 'tenant' ? tenantResult.tenant.subdomain : null;
  
  // Get branding
  const branding = await getBrandingForDomain(hostname);
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;
  
  // Check if this is a custom domain (satellite)
  const domainWithoutPort = hostname.split(':')[0];
  const isSatellite = Boolean(domainWithoutPort && 
    !domainWithoutPort.includes('growthaddicts') && 
    !domainWithoutPort.includes('localhost') &&
    !domainWithoutPort.includes('127.0.0.1'));
  
  // Get org settings and coach info
  let publicSignupEnabled = true; // Default to true
  let coachInfo: CoachInfo = { name: 'Coach', email: '' };
  
  if (organizationId) {
    const settings = await getOrgSettings(organizationId);
    publicSignupEnabled = settings?.publicSignupEnabled !== false; // Default true if not set
    coachInfo = await getCoachInfo(organizationId);
  }
  
  return (
    <SignupPageClient
      publicSignupEnabled={publicSignupEnabled}
      logoUrl={logoUrl}
      appTitle={appTitle}
      coachName={coachInfo.name}
      coachEmail={coachInfo.email}
      coachImageUrl={coachInfo.imageUrl}
      hostname={hostname}
      isSatellite={isSatellite}
      tenantSubdomain={tenantSubdomain}
    />
  );
}

