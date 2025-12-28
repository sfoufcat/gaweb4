'use client';

import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';

/**
 * User Profile Page Loading Skeleton
 * Shows while navigating to view another user's profile
 */
export default function UserProfileLoading() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      <ProfileSkeleton variant="view" />
    </div>
  );
}





