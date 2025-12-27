'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { CheckInFlowRenderer } from '@/components/checkin/CheckInFlowRenderer';

interface PageProps {
  params: Promise<{ type: string }>;
}

/**
 * Dynamic Check-in Flow Page
 * 
 * This page renders the check-in flow based on the org's configured steps.
 * 
 * Routes:
 *   /checkin/flow/morning - Morning check-in
 *   /checkin/flow/evening - Evening check-in
 *   /checkin/flow/weekly  - Weekly reflection
 * 
 * This is the new dynamic flow system. The old hardcoded pages at
 * /checkin/morning/*, /checkin/evening/*, /checkin/weekly/* remain
 * available as fallbacks until orgs are migrated.
 */
export default function DynamicCheckInPage({ params }: PageProps) {
  const { type } = use(params);
  const router = useRouter();

  // Validate flow type
  if (!['morning', 'evening', 'weekly'].includes(type)) {
    return (
      <div className="fixed inset-0 bg-[#faf8f6] dark:bg-[#05070b] flex flex-col items-center justify-center z-[9999] p-6">
        <div className="text-center max-w-md">
          <p className="text-6xl mb-6">❓</p>
          <h1 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] mb-4">
            Invalid Flow Type
          </h1>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] mb-8">
            Check-in type &quot;{type}&quot; is not valid.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#2c2520] dark:bg-[#f5f5f8] text-white dark:text-[#1a1a1a] rounded-full font-medium"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <CheckInFlowRenderer
      flowType={type as 'morning' | 'evening' | 'weekly'}
      onComplete={() => router.push('/')}
      onClose={() => router.push('/')}
    />
  );
}

