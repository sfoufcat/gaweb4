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
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain } from '@/lib/server/branding';
import { WebsitePageRenderer } from '@/components/website';
import type { OrgWebsite, Funnel } from '@/types';
import { DEFAULT_ORG_WEBSITE } from '@/types';

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
  const params = await searchParams;
  const isPreviewMode = params.preview === 'true';

  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);

  if (tenantResult.type !== 'tenant') {
    // Not a tenant domain - redirect to main sign-in
    redirect('/sign-in');
  }

  const organizationId = tenantResult.tenant.organizationId;
  const subdomain = tenantResult.tenant.subdomain;

  // For preview mode, verify the user is a coach in this org
  let isCoachPreview = false;
  if (isPreviewMode) {
    const { userId, orgId } = await auth();
    console.log(`[WEBSITE_PREVIEW] userId=${userId}, orgId=${orgId}, tenantOrgId=${organizationId}`);
    if (userId && orgId === organizationId) {
      // User is authenticated and in the correct org - allow preview
      isCoachPreview = true;
    } else if (userId) {
      // User is authenticated but in a different org - still allow preview if they're an admin
      // This helps when coaches switch between orgs
      console.log(`[WEBSITE_PREVIEW] User ${userId} is in org ${orgId} but tenant is ${organizationId}`);
    }
  }

  // Fetch website configuration
  const websiteDoc = await adminDb
    .collection('org_websites')
    .doc(organizationId)
    .get();

  let website: OrgWebsite;

  if (!websiteDoc.exists) {
    // No website configured
    console.log(`[WEBSITE_PREVIEW] No website doc for org ${organizationId}, isCoachPreview=${isCoachPreview}`);
    if (!isCoachPreview) {
      redirect('/sign-in');
    }
    // For coach preview without a website doc, create a default website object
    // This allows coaches to preview the default template before saving anything
    const now = new Date().toISOString();
    website = {
      ...DEFAULT_ORG_WEBSITE,
      id: organizationId,
      organizationId,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    website = {
      id: websiteDoc.id,
      ...websiteDoc.data(),
    } as OrgWebsite;
  }

  // Check if website is enabled (skip check for coach preview)
  if (!website.enabled && !isCoachPreview) {
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

  const funnels: Array<{ id: string; slug: string; programSlug?: string; url?: string }> = [];

  // Helper function to build funnel URL
  const buildFunnelUrl = async (funnel: Funnel, funnelId: string): Promise<{ programSlug?: string; url: string }> => {
    let programSlug: string | undefined;
    let url: string | undefined;

    // Build URL based on funnel target type
    if (funnel.targetType === 'program' && funnel.programId) {
      // Program funnel: /join/[programSlug]/[funnelSlug]
      const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
      if (programDoc.exists) {
        programSlug = (programDoc.data() as { slug?: string }).slug;
        if (programSlug) {
          url = `/join/${programSlug}/${funnel.slug}`;
        } else {
          console.warn(`[WEBSITE] Program ${funnel.programId} has no slug for funnel ${funnelId}`);
        }
      } else {
        console.warn(`[WEBSITE] Program ${funnel.programId} not found for funnel ${funnelId}`);
      }
    } else if (funnel.targetType === 'squad' && funnel.squadId) {
      // Squad funnel: /join/squad/[squadSlug]/[funnelSlug]
      const squadDoc = await adminDb.collection('squads').doc(funnel.squadId).get();
      if (squadDoc.exists) {
        const squadSlug = (squadDoc.data() as { slug?: string }).slug;
        if (squadSlug) {
          url = `/join/squad/${squadSlug}/${funnel.slug}`;
        } else {
          console.warn(`[WEBSITE] Squad ${funnel.squadId} has no slug for funnel ${funnelId}`);
        }
      } else {
        console.warn(`[WEBSITE] Squad ${funnel.squadId} not found for funnel ${funnelId}`);
      }
    } else if (funnel.targetType === 'content' && funnel.contentType && funnel.contentId) {
      // Content funnel: /join/content/[contentType]/[contentId]/[funnelSlug]
      url = `/join/content/${funnel.contentType}/${funnel.contentId}/${funnel.slug}`;
    } else {
      console.warn(`[WEBSITE] Funnel ${funnelId} has incomplete target configuration (targetType=${funnel.targetType})`);
    }

    // Fallback to sign-in if we couldn't build a proper funnel URL
    return { programSlug, url: url || '/sign-in' };
  };

  for (const doc of funnelsSnapshot.docs) {
    const funnel = doc.data() as Funnel;
    const { programSlug, url } = await buildFunnelUrl(funnel, doc.id);

    funnels.push({
      id: doc.id,
      slug: funnel.slug,
      programSlug,
      url,
    });
  }

  // If heroCtaFunnelId is set but not in our list, try to fetch it directly
  // This handles cases where the funnel might be inactive or have issues
  if (website.heroCtaFunnelId && !funnels.find(f => f.id === website.heroCtaFunnelId)) {
    console.log(`[WEBSITE] heroCtaFunnelId ${website.heroCtaFunnelId} not in active funnels, fetching directly`);
    const funnelDoc = await adminDb.collection('funnels').doc(website.heroCtaFunnelId).get();
    if (funnelDoc.exists) {
      const funnel = funnelDoc.data() as Funnel;
      const { programSlug, url } = await buildFunnelUrl(funnel, funnelDoc.id);
      if (url) {
        funnels.push({
          id: funnelDoc.id,
          slug: funnel.slug,
          programSlug,
          url,
        });
        console.log(`[WEBSITE] Added heroCtaFunnel: ${url}`);
      } else {
        console.error(`[WEBSITE] Could not build URL for heroCtaFunnelId ${website.heroCtaFunnelId}`);
      }
    } else {
      console.error(`[WEBSITE] heroCtaFunnelId ${website.heroCtaFunnelId} not found in funnels collection`);
    }
  }

  return (
    <WebsitePageRenderer
      website={website}
      branding={branding}
      coachName={coachName}
      coachImageUrl={coachImageUrl}
      funnels={funnels}
      subdomain={subdomain}
      isPreviewMode={isCoachPreview}
    />
  );
}
