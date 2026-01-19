/**
 * Public Website Page
 *
 * This page is shown to unauthenticated visitors when the organization
 * has enabled their website. It displays the coach's landing page with
 * Sign In and Join buttons.
 *
 * Routing:
 * - The proxy.ts middleware rewrites / to /website when:
 *   1. The request is from a tenant domain (subdomain or custom domain)
 *   2. The user is not authenticated
 *   3. The org has website enabled (websiteEnabled in Edge Config)
 */

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain } from '@/lib/server/branding';
import { WebsitePageRenderer } from '@/components/website';
import type { OrgWebsite, Funnel } from '@/types';

interface WebsitePageProps {
  searchParams: Promise<Record<string, string>>;
}

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Resolve tenant
  const tenantResult = await resolveTenant(hostname, null, null);
  if (tenantResult.type !== 'tenant') {
    return { title: 'Not Found' };
  }

  const organizationId = tenantResult.tenant.organizationId;

  // Fetch website
  const websiteDoc = await adminDb
    .collection('org_websites')
    .doc(organizationId)
    .get();

  if (!websiteDoc.exists) {
    return { title: 'Not Found' };
  }

  const website = websiteDoc.data() as OrgWebsite;

  // Fetch branding for app title fallback
  const branding = await getBrandingForDomain(hostname);

  return {
    title: website.metaTitle || website.heroHeadline || branding.appTitle || 'Coaching',
    description: website.metaDescription || website.heroSubheadline || undefined,
    openGraph: {
      title: website.metaTitle || website.heroHeadline || branding.appTitle || 'Coaching',
      description: website.metaDescription || website.heroSubheadline || undefined,
      images: website.ogImageUrl ? [{ url: website.ogImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: website.metaTitle || website.heroHeadline || branding.appTitle || 'Coaching',
      description: website.metaDescription || website.heroSubheadline || undefined,
      images: website.ogImageUrl ? [website.ogImageUrl] : undefined,
    },
  };
}

export default async function WebsitePage({ searchParams }: WebsitePageProps) {
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);

  if (tenantResult.type !== 'tenant') {
    // Not a tenant domain - redirect to main sign-in
    redirect('/sign-in');
  }

  const organizationId = tenantResult.tenant.organizationId;
  const subdomain = tenantResult.tenant.subdomain;

  // Fetch website configuration
  const websiteDoc = await adminDb
    .collection('org_websites')
    .doc(organizationId)
    .get();

  if (!websiteDoc.exists) {
    // No website configured - redirect to sign-in
    redirect('/sign-in');
  }

  const website = {
    id: websiteDoc.id,
    ...websiteDoc.data(),
  } as OrgWebsite;

  // Check if website is enabled
  if (!website.enabled) {
    redirect('/sign-in');
  }

  // Fetch branding
  const branding = await getBrandingForDomain(hostname);

  // Fetch coach info (organization owner or first super_coach)
  let coachName = branding.appTitle || 'Coach';
  let coachImageUrl: string | undefined;

  // Try to get coach info from users collection via org_memberships
  const membershipSnapshot = await adminDb
    .collection('org_memberships')
    .where('organizationId', '==', organizationId)
    .where('orgRole', '==', 'super_coach')
    .limit(1)
    .get();

  if (!membershipSnapshot.empty) {
    const membership = membershipSnapshot.docs[0].data();
    const userDoc = await adminDb.collection('users').doc(membership.userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      coachName = userData?.displayName || userData?.firstName || coachName;
      coachImageUrl = userData?.profileImageUrl || userData?.imageUrl;
    }
  }

  // Fetch funnels for URL mapping
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('organizationId', '==', organizationId)
    .where('isActive', '==', true)
    .get();

  const funnels: Array<{ id: string; slug: string; programSlug?: string }> = [];

  for (const doc of funnelsSnapshot.docs) {
    const funnel = doc.data() as Funnel;
    let programSlug: string | undefined;

    // If funnel targets a program, get the program slug
    if (funnel.targetType === 'program' && funnel.programId) {
      const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
      if (programDoc.exists) {
        programSlug = (programDoc.data() as { slug?: string }).slug;
      }
    }

    funnels.push({
      id: doc.id,
      slug: funnel.slug,
      programSlug: programSlug || 'default',
    });
  }

  return (
    <WebsitePageRenderer
      website={website}
      branding={branding}
      coachName={coachName}
      coachImageUrl={coachImageUrl}
      funnels={funnels}
      subdomain={subdomain}
    />
  );
}
