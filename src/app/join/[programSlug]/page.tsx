/**
 * Join Program Page - Entry point for program funnels
 * 
 * Routes:
 * - /join/[programSlug] - Default funnel for a program
 * - /join/[programSlug]?invite=ABC123 - With invite code
 * 
 * This page:
 * 1. Resolves the program by slug
 * 2. Finds the default (or specified) funnel
 * 3. Redirects to the funnel flow
 */

import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import type { Program, Funnel } from '@/types';

interface JoinPageProps {
  params: Promise<{ programSlug: string }>;
  searchParams: Promise<{ invite?: string; funnel?: string }>;
}

export default async function JoinProgramPage({ params, searchParams }: JoinPageProps) {
  const { programSlug } = await params;
  const { invite, funnel: funnelSlug } = await searchParams;

  // Get hostname for tenant resolution
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);
  const organizationId = tenantResult.type === 'tenant' ? tenantResult.tenant.organizationId : null;

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

  // Find funnel
  let funnelQuery = adminDb
    .collection('funnels')
    .where('programId', '==', program.id)
    .where('isActive', '==', true);

  if (funnelSlug) {
    // Specific funnel requested
    funnelQuery = funnelQuery.where('slug', '==', funnelSlug);
  } else {
    // Get default funnel
    funnelQuery = funnelQuery.where('isDefault', '==', true);
  }

  let funnelsSnapshot = await funnelQuery.limit(1).get();

  // If no default found, get any active funnel
  if (funnelsSnapshot.empty && !funnelSlug) {
    funnelsSnapshot = await adminDb
      .collection('funnels')
      .where('programId', '==', program.id)
      .where('isActive', '==', true)
      .limit(1)
      .get();
  }

  if (funnelsSnapshot.empty) {
    // No funnel found - show error or create default
    notFound();
  }

  const funnelDoc = funnelsSnapshot.docs[0];
  const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

  // Build redirect URL
  let redirectUrl = `/join/${programSlug}/${funnel.slug}`;
  
  if (invite) {
    redirectUrl += `?invite=${encodeURIComponent(invite)}`;
  }

  // Redirect to the funnel
  redirect(redirectUrl);
}









