import { Metadata } from 'next';
import { headers } from 'next/headers';
import { CancelClient } from './CancelClient';

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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { configSlug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return { title: 'Cancel Booking' };
  }

  const result = await getTokenData(token);

  if (result.error || !result.data) {
    return { title: 'Cancel Booking' };
  }

  return {
    title: `Cancel ${result.data.config.name} | ${result.data.organization.name}`,
  };
}

export default async function CancelPage({ params, searchParams }: PageProps) {
  const { configSlug } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <CancelClient
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
      <CancelClient
        error={result.error}
      />
    );
  }

  return (
    <CancelClient
      tokenId={token}
      event={result.data.event}
      config={result.data.config}
      organization={result.data.organization}
      coach={result.data.coach}
      deadline={result.data.deadline}
    />
  );
}
