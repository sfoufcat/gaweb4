'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Squad Page - Redirect to Program Hub
 * 
 * The Squad tab has been refactored into the Program Hub.
 * This page now redirects to /program?tab=squad to maintain
 * backward compatibility with any existing links.
 * 
 * Note: ?discover param is no longer supported. Squad discovery
 * has been replaced by Program discovery at /discover.
 */
export default function SquadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    // Build redirect URL
    let redirectUrl = '/program?tab=squad';
    
    // Preserve joined query param (useful for data refetch triggers)
    const joined = searchParams.get('joined');
    if (joined) {
      redirectUrl += `&joined=${joined}`;
    }
    
    // Redirect to the new program hub with squad tab
    router.replace(redirectUrl);
  }, [router, searchParams]);
  
  // Show a brief loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
    </div>
  );
}
