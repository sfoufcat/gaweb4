import { headers } from 'next/headers';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { BeginPageClient } from './BeginPageClient';

/**
 * /begin - Public entry point for new users (Server Component)
 * 
 * Fetches branding server-side and passes to client component
 */
export default async function BeginPage() {
  // Fetch branding server-side based on domain
  const headersList = await headers();
  const hostname = headersList.get('host') || '';
  const branding = await getBrandingForDomain(hostname);
  
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;

  return <BeginPageClient logoUrl={logoUrl} appTitle={appTitle} />;
}
