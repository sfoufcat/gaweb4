/**
 * Squad Funnel Page - Entry point for squad-based funnels
 * 
 * This page:
 * 1. Loads the squad and its funnel with steps
 * 2. Creates/retrieves a flow session
 * 3. Renders the FunnelRenderer component
 */

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import SquadFunnelClient from './SquadFunnelClient';
import type { Funnel, FunnelStep } from '@/types';

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
  const { invite: inviteCode, ref: referrerId } = await searchParams;

  // Get hostname for tenant resolution and branding
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);
  const organizationId = tenantResult.type === 'tenant' ? tenantResult.tenant.organizationId : null;

  // Get branding
  const branding = await getBrandingForDomain(hostname);
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
    notFound();
  }

  const squadDoc = squadsSnapshot.docs[0];
  const squadData = squadDoc.data();
  
  // Check if squad is active
  if (squadData.isActive === false) {
    notFound();
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

  // Find funnel by slug (targeting this squad)
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('squadId', '==', squad.id)
    .where('slug', '==', funnelSlug)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (funnelsSnapshot.empty) {
    notFound();
  }

  const funnelDoc = funnelsSnapshot.docs[0];
  const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

  // Get funnel steps
  const stepsSnapshot = await adminDb
    .collection('funnels')
    .doc(funnel.id)
    .collection('steps')
    .orderBy('order', 'asc')
    .get();

  const steps: FunnelStep[] = stepsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as FunnelStep[];

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
    />
  );
}

