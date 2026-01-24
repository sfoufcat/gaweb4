import { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebase-admin';
import { getTenantFromHeaders } from '@/lib/tenant';
import type { IntakeCallConfig, CoachAvailability, Funnel } from '@/types';
import { BookingClient } from './BookingClient';

interface PageProps {
  params: Promise<{ funnelSlug: string }>;
}

async function getIntakeFunnel(funnelSlug: string) {
  // Get tenant from middleware headers
  const headersList = await headers();
  // Convert ReadonlyHeaders to standard Headers for getTenantFromHeaders
  const headersObj = new Headers();
  headersList.forEach((value, key) => {
    headersObj.set(key, value);
  });
  const tenant = getTenantFromHeaders(headersObj);
  if (!tenant) {
    console.log('[BOOK_PAGE] No tenant found from headers');
    return null;
  }
  console.log('[BOOK_PAGE] Tenant resolved:', tenant.organizationId, tenant.subdomain);
  const organizationId = tenant.organizationId;

  try {
    // Find funnel by slug and targetType
    const funnelsSnapshot = await adminDb
      .collection('funnels')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', funnelSlug)
      .where('targetType', '==', 'intake')
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (funnelsSnapshot.empty) {
      console.log('[BOOK_PAGE] No funnel found for slug:', funnelSlug, 'orgId:', organizationId);
      return null;
    }
    console.log('[BOOK_PAGE] Found funnel:', funnelsSnapshot.docs[0].id);

    const funnelDoc = funnelsSnapshot.docs[0];
    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    if (!funnel.intakeConfigId) {
      return null;
    }

    // Find intake config by ID
    const configDoc = await adminDb
      .collection('intake_call_configs')
      .doc(funnel.intakeConfigId)
      .get();

    if (!configDoc.exists) {
      return null;
    }

    const configData = configDoc.data();
    if (!configData?.isActive) {
      return null;
    }

    const config = { id: configDoc.id, ...configData } as IntakeCallConfig;

    // Get organization data for branding
    const orgDoc = await adminDb.collection('organizations').doc(organizationId).get();
    const orgData = orgDoc.exists ? orgDoc.data() : null;

    // Get organization branding
    const brandingDoc = await adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('settings')
      .doc('branding')
      .get();

    const branding = brandingDoc.exists ? brandingDoc.data() : null;

    // Get coach info
    let coachInfo = {
      name: orgData?.name || tenant.subdomain,
      avatarUrl: branding?.logoUrl || null,
    };

    const coachesSnapshot = await adminDb
      .collection('users')
      .where('clerkOrganizationId', '==', organizationId)
      .where('role', 'in', ['super_coach', 'admin'])
      .limit(1)
      .get();

    if (!coachesSnapshot.empty) {
      const coachData = coachesSnapshot.docs[0].data();
      coachInfo = {
        name: coachData.displayName || coachData.firstName || coachInfo.name,
        avatarUrl: coachData.avatarUrl || coachInfo.avatarUrl,
      };
    }

    // Get availability settings
    const availabilityDoc = await adminDb
      .collection('coach_availability')
      .doc(organizationId)
      .get();

    const availability = availabilityDoc.exists
      ? (availabilityDoc.data() as CoachAvailability)
      : null;

    return {
      funnel: {
        id: funnel.id,
        slug: funnel.slug,
        name: funnel.name,
        tracking: funnel.tracking,
      },
      config: {
        id: config.id,
        name: config.name,
        slug: config.slug,
        description: config.description,
        duration: config.duration,
        coverImageUrl: config.coverImageUrl,
        requireEmail: config.requireEmail,
        requireName: config.requireName,
        requirePhone: config.requirePhone,
        customFields: config.customFields,
        confirmationMessage: config.confirmationMessage,
        allowCancellation: config.allowCancellation,
        allowReschedule: config.allowReschedule,
      },
      organization: {
        name: orgData?.name || tenant.subdomain,
        logoUrl: branding?.logoUrl,
        primaryColor: branding?.primaryColor,
      },
      coach: coachInfo,
      timezone: availability?.timezone || 'America/New_York',
      orgSlug: tenant.subdomain,
    };
  } catch (error) {
    console.error('Error fetching intake funnel:', error);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { funnelSlug } = await params;
  const data = await getIntakeFunnel(funnelSlug);

  if (!data) {
    return {
      title: 'Book a Call',
    };
  }

  return {
    title: `${data.config.name} | ${data.organization.name}`,
    description: data.config.description || `Book a ${data.config.name} with ${data.coach.name}`,
    openGraph: {
      title: `${data.config.name} | ${data.organization.name}`,
      description: data.config.description || `Book a ${data.config.name} with ${data.coach.name}`,
      images: data.config.coverImageUrl ? [data.config.coverImageUrl] : [],
    },
  };
}

export default async function BookingPage({ params }: PageProps) {
  const { funnelSlug } = await params;
  const data = await getIntakeFunnel(funnelSlug);

  if (!data) {
    notFound();
  }

  return (
    <BookingClient
      config={data.config}
      organization={data.organization}
      coach={data.coach}
      timezone={data.timezone}
      orgSlug={data.orgSlug}
      funnelSlug={funnelSlug}
      funnel={data.funnel}
    />
  );
}
