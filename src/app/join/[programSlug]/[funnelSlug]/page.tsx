/**
 * Funnel Page - Main funnel flow entry point
 * 
 * This page:
 * 1. Loads the funnel and its steps
 * 2. Creates/retrieves a flow session
 * 3. Renders the FunnelRenderer component
 */

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import FunnelClient from './FunnelClient';
import type { Program, Funnel, FunnelStep } from '@/types';

interface FunnelPageProps {
  params: Promise<{ programSlug: string; funnelSlug: string }>;
  searchParams: Promise<{ invite?: string }>;
}

export default async function FunnelPage({ params, searchParams }: FunnelPageProps) {
  const { programSlug, funnelSlug } = await params;
  const { invite: inviteCode } = await searchParams;

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

  // Find program by slug
  let programQuery = adminDb.collection('programs').where('slug', '==', programSlug);
  
  if (organizationId) {
    programQuery = programQuery.where('organizationId', '==', organizationId);
  }

  const programsSnapshot = await programQuery.where('isActive', '==', true).limit(1).get();

  if (programsSnapshot.empty) {
    notFound();
  }

  const programDoc = programsSnapshot.docs[0];
  const program = { id: programDoc.id, ...programDoc.data() } as Program;

  // Find funnel by slug
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('programId', '==', program.id)
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
    // Redirect to error or show invite required message
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Invite Required</h1>
          <p className="text-text-secondary">This program requires an invite code to join.</p>
        </div>
      </div>
    );
  }

  if (inviteCode) {
    const inviteDoc = await adminDb.collection('program_invites').doc(inviteCode.toUpperCase()).get();
    
    if (inviteDoc.exists) {
      const invite = inviteDoc.data();
      
      // Validate invite
      const isValid = 
        (invite?.funnelId === funnel.id || invite?.programId === program.id) &&
        (!invite?.expiresAt || new Date(invite.expiresAt) >= new Date()) &&
        (!invite?.maxUses || (invite?.useCount || 0) < invite.maxUses);

      if (isValid) {
        validatedInvite = {
          paymentStatus: invite?.paymentStatus || 'required',
          targetSquadId: invite?.targetSquadId,
        };
      }
    }
  }

  return (
    <FunnelClient
      funnel={funnel}
      steps={steps}
      program={{
        id: program.id,
        name: program.name,
        slug: program.slug,
        description: program.description || '',
        coverImageUrl: program.coverImageUrl,
        type: program.type,
        lengthDays: program.lengthDays,
        priceInCents: program.priceInCents,
        currency: program.currency,
        stripePriceId: program.stripePriceId,
      }}
      branding={{
        logoUrl,
        appTitle,
      }}
      inviteCode={inviteCode}
      validatedInvite={validatedInvite}
      hostname={hostname}
    />
  );
}

