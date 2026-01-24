import { Metadata } from 'next';
import { headers } from 'next/headers';
import { RescheduleClient } from './RescheduleClient';

interface PageProps {
  params: Promise<{ configSlug: string }>;
  searchParams: Promise<{ token?: string }>;
}

async function getTokenData(tokenId: string) {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  try {
    const response = await fetch(
      `${protocol}://${host}/api/public/intake/token/${tokenId}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      const data = await response.json();
      return { error: data };
    }

    return { data: await response.json() };
  } catch (error) {
    console.error('Error fetching token data:', error);
    return { error: { code: 'FETCH_ERROR', message: 'Failed to load booking information' } };
  }
}

function getOrgSlugFromHost(host: string): string {
  if (host.includes('localhost')) {
    return 'demo';
  }
  const parts = host.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  return host.split('.')[0];
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { configSlug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return { title: 'Reschedule Booking' };
  }

  const result = await getTokenData(token);

  if (result.error || !result.data) {
    return { title: 'Reschedule Booking' };
  }

  return {
    title: `Reschedule ${result.data.config.name} | ${result.data.organization.name}`,
  };
}

export default async function ReschedulePage({ params, searchParams }: PageProps) {
  const { configSlug } = await params;
  const { token } = await searchParams;

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const orgSlug = getOrgSlugFromHost(host);

  if (!token) {
    return (
      <RescheduleClient
        error={{
          code: 'NO_TOKEN',
          message: 'No booking token provided. Please check your email for the correct link.',
        }}
      />
    );
  }

  const result = await getTokenData(token);

  if (result.error) {
    return (
      <RescheduleClient
        error={result.error}
      />
    );
  }

  // Use org subdomain from token data, fallback to host-based detection
  const effectiveOrgSlug = result.data.organization?.subdomain || orgSlug;

  return (
    <RescheduleClient
      tokenId={token}
      event={result.data.event}
      config={result.data.config}
      organization={result.data.organization}
      coach={result.data.coach}
      coachTimezone={result.data.coachTimezone}
      deadline={result.data.deadline}
      orgSlug={effectiveOrgSlug}
    />
  );
}
