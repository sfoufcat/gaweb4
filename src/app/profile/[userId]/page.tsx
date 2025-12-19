'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import type { FirebaseUser, Habit } from '@/types';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { MyJourneyTab } from '@/components/profile/MyJourneyTab';
import { MyDetailsTab } from '@/components/profile/MyDetailsTab';
import { openOrCreateDirectChat } from '@/lib/chat';

/**
 * Dynamic Profile Page - /profile/[userId]
 * 
 * Shows the profile for a specific user by ID.
 * - If userId matches current user, shows editable "My Profile" version
 * - If userId is different, shows read-only "Other Profile" version
 */

interface UserData {
  user?: FirebaseUser;
  goal?: {
    goal: string;
    targetDate: string;
    progress: {
      percentage: number;
    };
  };
  isOwnProfile?: boolean;
}

export default function UserProfilePage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();
  const params = useParams();
  
  const userId = params.userId as string;
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Determine if viewing own profile
  const isCurrentUser = clerkUser?.id === userId;

  // Fetch user data
  useEffect(() => {
    async function fetchData() {
      if (!clerkUser) {
        setLoading(false);
        return;
      }

      try {
        // If it's the current user, redirect to /profile for cleaner URL
        if (isCurrentUser) {
          router.replace('/profile');
          return;
        }

        // Fetch other user's profile
        const userResponse = await fetch(`/api/user/${userId}`);
        
        if (userResponse.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        
        if (userResponse.ok) {
          const data = await userResponse.json();
          setUserData({
            ...data,
            isOwnProfile: false,
          });
        }

        // Fetch other user's habits
        const habitsResponse = await fetch(`/api/user/${userId}/habits`);
        if (habitsResponse.ok) {
          const habitsData = await habitsResponse.json();
          setHabits(habitsData.habits || []);
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    if (clerkLoaded && userId) {
      fetchData();
    }
  }, [clerkUser, clerkLoaded, userId, isCurrentUser, router]);

  // Redirect if not authenticated
  if (!clerkLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-text-primary" />
      </div>
    );
  }

  if (!clerkUser) {
    router.push('/sign-in');
    return null;
  }

  // Show not found state
  if (notFound) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-20 h-20 bg-[#f3f1ef] rounded-full flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="font-albert text-[28px] text-text-primary tracking-[-1.5px] leading-[1.2] mb-2">
            Profile not found
          </h1>
          <p className="font-sans text-[16px] text-text-secondary leading-[1.4] mb-6">
            We couldn&apos;t find the user you&apos;re looking for.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-[#2c2520] text-white rounded-full font-sans text-[14px] font-medium hover:bg-[#1a1a1a] transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Handle message button click for other profiles
  const handleMessageClick = async () => {
    // Use the userId from route params (which is the Clerk ID) instead of userData.user.id
    if (!userId) {
      console.error('No userId available for DM');
      alert('Error: No user ID available');
      return;
    }

    try {
      console.log('Creating DM with user:', userId);
      // Create or get existing DM channel with this user
      const channelId = await openOrCreateDirectChat(userId);
      console.log('Created/found channel:', channelId);
      // Navigate to chat with the specific channel
      router.push(`/chat?channel=${channelId}`);
    } catch (error) {
      console.error('Failed to open chat:', error);
      // Show error to user instead of silent redirect
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to start chat: ${errorMessage}`);
      // Do NOT redirect - stay on profile page so user knows something went wrong
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {userData?.user && (
        <>
          <ProfileHeader
            user={userData.user}
            userId={userId}
            clerkUser={clerkUser}
            isOwnProfile={false}
            onMessageClick={handleMessageClick}
          />

          <ProfileTabs
            isOwnProfile={false}
            journeyContent={
              <MyJourneyTab
                user={userData.user}
                goal={userData.goal}
                habits={habits}
                isOwnProfile={false}
              />
            }
            detailsContent={
              <MyDetailsTab user={userData.user} />
            }
          />
        </>
      )}

      {!userData?.user && !notFound && (
        <div className="text-center py-12">
          <p className="font-sans text-text-secondary mb-4">Loading profile...</p>
        </div>
      )}
    </div>
  );
}

