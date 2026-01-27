/**
 * Squad Funnel Page - Entry point for squad-based funnels
 * 
 * This page:
 * 1. Loads the squad and its funnel with steps
 * 2. Creates/retrieves a flow session
 * 3. Renders the FunnelRenderer component
 */

import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { checkExistingSquadMembership, getProductRedirectUrl } from '@/lib/enrollment-check';
import SquadFunnelClient from './SquadFunnelClient';
import JoinNotAvailable from '@/components/funnel/JoinNotAvailable';
import type { Funnel, FunnelStep, OrgSettings } from '@/types';
import { mergeTrackingConfig } from '@/lib/tracking-utils';

interface Squad {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  organizationId: string;
  isActive: boolean;
}

interface SquadFunnelPageProps {
  params: Promise<{ squadSlug: string; funnelSlug: string }>;
  searchParams: Promise<{ invite?: string; ref?: string }>;
}

export default async function SquadFunnelPage({ params, searchParams }: SquadFunnelPageProps) {
  const { squadSlug, funnelSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const { invite: inviteCode, ref: referrerId } = resolvedSearchParams;

  // Get hostname for tenant resolution and branding
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Convert search params to URLSearchParams for tenant resolution (supports ?tenant= on localhost)
  const urlSearchParams = new URLSearchParams(resolvedSearchParams as Record<string, string>);

  // Resolve tenant (organization) from hostname (or ?tenant= param on localhost)
  const tenantResult = await resolveTenant(hostname, urlSearchParams, null);
  const organizationId = tenantResult.type === 'tenant' ? tenantResult.tenant.organizationId : null;

  // Get branding (pass search params for ?tenant= on localhost)
  const branding = await getBrandingForDomain(hostname, urlSearchParams);
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;
  const primaryColor = branding.primaryColor;

  // Find squad by slug
  let squadQuery = adminDb.collection('squads').where('slug', '==', squadSlug);
  
  if (organizationId) {
    squadQuery = squadQuery.where('organizationId', '==', organizationId);
  }

  const squadsSnapshot = await squadQuery.limit(1).get();

  if (squadsSnapshot.empty) {
    return <JoinNotAvailable coachName={branding.appTitle} type="squad" />;
  }

  const squadDoc = squadsSnapshot.docs[0];
  const squadData = squadDoc.data();

  // Check if squad is active
  if (squadData.isActive === false) {
    return <JoinNotAvailable coachName={branding.appTitle} type="squad" />;
  }

  const squad: Squad = {
    id: squadDoc.id,
    name: squadData.name,
    slug: squadData.slug || squadSlug,
    description: squadData.description,
    imageUrl: squadData.imageUrl,
    organizationId: squadData.organizationId,
    isActive: squadData.isActive !== false,
  };

  // Check for existing squad membership (for authenticated users)
  let existingMembership: {
    id: string;
    redirectUrl: string;
  } | null = null;
  
  const { userId } = await auth();
  
  if (userId) {
    const membershipCheck = await checkExistingSquadMembership(userId, squad.id);
    
    if (membershipCheck.exists) {
      existingMembership = {
        id: membershipCheck.membership!.id,
        redirectUrl: getProductRedirectUrl('squad', squad.id),
      };
    }
  }

  // Find funnel by slug (targeting this squad)
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('squadId', '==', squad.id)
    .where('slug', '==', funnelSlug)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (funnelsSnapshot.empty) {
    return <JoinNotAvailable coachName={branding.appTitle} type="funnel" />;
  }

  const funnelDoc = funnelsSnapshot.docs[0];
  const funnelData = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

  // Fetch org settings to get global tracking pixels
  const orgSettingsDoc = await adminDb.collection('org_settings').doc(squad.organizationId).get();
  const orgSettings = orgSettingsDoc.exists ? (orgSettingsDoc.data() as OrgSettings) : null;
  
  // Merge global tracking with funnel-specific tracking
  const mergedTracking = mergeTrackingConfig(orgSettings?.globalTracking, funnelData.tracking);
  
  // Create funnel object with merged tracking
  const funnel: Funnel = {
    ...funnelData,
    tracking: mergedTracking,
  };

  // Get funnel steps - try with orderBy first, fallback to getting all steps if query fails
  let steps: FunnelStep[] = [];
  
  try {
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnel.id)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];
  } catch (orderError) {
    // Fallback: Query without orderBy (handles missing index or missing order field)
    console.warn(`[SQUAD_FUNNEL] orderBy query failed for funnel ${funnel.id}, fetching all steps:`, orderError);
    
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnel.id)
      .collection('steps')
      .get();

    steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];
    
    // Sort client-side by order field if it exists, otherwise by createdAt
    steps.sort((a, b) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      // Fallback to createdAt if order is missing
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }
  
  // Log warning if steps are empty (helps with debugging)
  if (steps.length === 0) {
    console.warn(`[SQUAD_FUNNEL] No steps found for funnel ${funnel.id} (slug: ${funnelSlug})`);
  }

  // Validate invite code if funnel is invite-only
  let validatedInvite: { paymentStatus: string; targetSquadId?: string } | null = null;
  
  if (funnel.accessType === 'invite_only' && !inviteCode) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Invite Required</h1>
          <p className="text-text-secondary">This squad requires an invite code to join.</p>
        </div>
      </div>
    );
  }

  if (inviteCode) {
    // Check squad invites collection
    const inviteDoc = await adminDb.collection('squad_invites').doc(inviteCode.toUpperCase()).get();
    
    if (inviteDoc.exists) {
      const invite = inviteDoc.data();
      
      // Validate invite
      const isValid = 
        (invite?.funnelId === funnel.id || invite?.squadId === squad.id) &&
        (!invite?.expiresAt || new Date(invite.expiresAt) >= new Date()) &&
        (!invite?.maxUses || (invite?.useCount || 0) < invite.maxUses);

      if (isValid) {
        validatedInvite = {
          paymentStatus: invite?.paymentStatus || 'required',
          targetSquadId: squad.id,
        };
      }
    }
  }

  return (
    <SquadFunnelClient
      funnel={funnel}
      steps={steps}
      squad={{
        id: squad.id,
        name: squad.name,
        slug: squad.slug,
        description: squad.description || '',
        imageUrl: squad.imageUrl,
      }}
      branding={{
        logoUrl,
        appTitle,
        primaryColor,
      }}
      organization={{
        id: funnel.organizationId,
        name: appTitle,
      }}
      inviteCode={inviteCode}
      validatedInvite={validatedInvite}
      hostname={hostname}
      referrerId={referrerId}
      existingMembership={existingMembership}
    />
  );
}

