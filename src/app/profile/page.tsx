'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FirebaseUser, Habit, EmailPreferences } from '@/types';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { MyJourneyTab } from '@/components/profile/MyJourneyTab';
import { MyDetailsTab } from '@/components/profile/MyDetailsTab';
import { ProfileEditForm } from '@/components/profile/ProfileEditForm';
import { SettingsDrawer } from '@/components/profile/SettingsDrawer';
import { openOrCreateDirectChat } from '@/lib/chat';

/**
 * Profile Page
 * 
 * Supports three modes:
 * 1. My Profile - when viewing your own profile (default)
 * 2. Edit Profile - when editing your own profile (via ?edit=true query param)
 * 3. Other Profile - when viewing someone else's profile (via ?userId=xxx query param)
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

export default function ProfilePage() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [fromOnboarding, setFromOnboarding] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences | undefined>(undefined);

  // Check if we're in edit mode, viewing another user, or from onboarding
  useEffect(() => {
    setIsEditMode(searchParams.get('edit') === 'true');
    setViewingUserId(searchParams.get('userId'));
    setFromOnboarding(searchParams.get('fromOnboarding') === 'true');
    setReturnTo(searchParams.get('returnTo'));
  }, [searchParams]);

  // Fetch email preferences when settings drawer opens
  useEffect(() => {
    async function fetchEmailPreferences() {
      if (!isSettingsOpen) return;
      
      try {
        const response = await fetch('/api/user/email-preferences');
        if (response.ok) {
          const data = await response.json();
          setEmailPreferences(data.emailPreferences);
        }
      } catch (error) {
        console.error('Failed to fetch email preferences:', error);
      }
    }

    fetchEmailPreferences();
  }, [isSettingsOpen]);

  // Fetch user data
  useEffect(() => {
    async function fetchData() {
      if (!clerkUser) {
        setLoading(false);
        return;
      }

      try {
        // Determine which profile to fetch
        const isViewingOtherProfile = viewingUserId && viewingUserId !== clerkUser.id;
        const endpoint = isViewingOtherProfile 
          ? `/api/user/${viewingUserId}`
          : '/api/user/me';

        // Fetch user profile data
        const userResponse = await fetch(endpoint);
        if (userResponse.ok) {
          const data = await userResponse.json();
          setUserData(data);
        }

        // Fetch habits - own profile uses /api/habits, other profiles use /api/user/[userId]/habits
        if (!isViewingOtherProfile) {
          const habitsResponse = await fetch('/api/habits');
          if (habitsResponse.ok) {
            const habitsData = await habitsResponse.json();
            setHabits(habitsData.habits || []);
          }
        } else {
          // Fetch other user's habits
          const habitsResponse = await fetch(`/api/user/${viewingUserId}/habits`);
          if (habitsResponse.ok) {
            const habitsData = await habitsResponse.json();
            setHabits(habitsData.habits || []);
          }
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (clerkLoaded) {
      fetchData();
    }
  }, [clerkUser, clerkLoaded, viewingUserId]);

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

  // Show edit form if in edit mode
  if (isEditMode) {
    return (
      <div className={`${fromOnboarding ? 'fixed inset-0 bg-app-bg overflow-y-auto lg:pl-0' : 'max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 py-6 pb-32'}`}>
        {!fromOnboarding && (
          <div className="mb-4">
            <button
              onClick={() => router.push('/profile')}
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-sans text-sm">Back</span>
            </button>
          </div>
        )}

        {fromOnboarding ? (
          <div className="min-h-full flex flex-col items-center justify-start py-6 px-4">
            <div className="w-full max-w-md lg:max-w-2xl mx-auto">
              <h1 className="font-albert text-[36px] lg:text-[42px] text-text-primary tracking-[-2px] leading-[1.2] mb-8">
                Create profile
              </h1>

              <ProfileEditForm
                initialData={userData?.user}
                clerkUser={clerkUser}
                fromOnboarding={fromOnboarding}
                onSave={() => {
                  // If from onboarding, check for returnTo or pending squad redirect
                  if (fromOnboarding) {
                    if (returnTo) {
                      router.push(returnTo);
                      return;
                    }
                    const pendingSquadRedirect = sessionStorage.getItem('pendingSquadRedirect');
                    if (pendingSquadRedirect) {
                      sessionStorage.removeItem('pendingSquadRedirect');
                      router.push('/squad?joined=true');
                    } else {
                      router.push('/onboarding/journey-started');
                    }
                    return;
                  }
                  
                  // Otherwise, exit edit mode and refetch data (normal behavior)
                  router.push('/profile');
                  window.location.reload();
                }}
                onCancel={() => {
                  // If from onboarding, check for returnTo or pending squad redirect
                  if (fromOnboarding) {
                    if (returnTo) {
                      router.push(returnTo);
                      return;
                    }
                    const pendingSquadRedirect = sessionStorage.getItem('pendingSquadRedirect');
                    if (pendingSquadRedirect) {
                      sessionStorage.removeItem('pendingSquadRedirect');
                      router.push('/squad?joined=true');
                    } else {
                      router.push('/onboarding/journey-started');
                    }
                  } else {
                    router.push('/profile');
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-albert text-[36px] text-text-primary tracking-[-2px] leading-[1.2] mb-6">
              My Profile
            </h1>

            <ProfileEditForm
              initialData={userData?.user}
              clerkUser={clerkUser}
              fromOnboarding={fromOnboarding}
              onSave={() => {
                // If from onboarding, check for returnTo or pending squad redirect
                if (fromOnboarding) {
                  if (returnTo) {
                    router.push(returnTo);
                    return;
                  }
                  const pendingSquadRedirect = sessionStorage.getItem('pendingSquadRedirect');
                  if (pendingSquadRedirect) {
                    sessionStorage.removeItem('pendingSquadRedirect');
                    router.push('/squad?joined=true');
                  } else {
                    router.push('/onboarding/journey-started');
                  }
                  return;
                }
                
                // Otherwise, exit edit mode and refetch data (normal behavior)
                router.push('/profile');
                window.location.reload();
              }}
              onCancel={() => {
                // If from onboarding, check for returnTo or pending squad redirect
                if (fromOnboarding) {
                  if (returnTo) {
                    router.push(returnTo);
                    return;
                  }
                  const pendingSquadRedirect = sessionStorage.getItem('pendingSquadRedirect');
                  if (pendingSquadRedirect) {
                    sessionStorage.removeItem('pendingSquadRedirect');
                    router.push('/squad?joined=true');
                  } else {
                    router.push('/onboarding/journey-started');
                  }
                } else {
                  router.push('/profile');
                }
              }}
            />
          </>
        )}
      </div>
    );
  }

  // Show profile view
  const isOwnProfile = userData?.isOwnProfile !== false;

  // Handle message button click for other profiles
  const handleMessageClick = async () => {
    // Use viewingUserId (from query param) as it's the Clerk ID
    const targetUserId = viewingUserId || userData?.user?.id;
    if (!targetUserId) {
      console.error('No targetUserId available for DM');
      alert('Error: No user ID available');
      return;
    }

    try {
      console.log('Creating DM with user:', targetUserId);
      // Create or get existing DM channel with this user
      const channelId = await openOrCreateDirectChat(targetUserId);
      console.log('Created/found channel:', channelId);
      // Navigate to chat with the specific channel
      router.push(`/chat?channel=${channelId}`);
    } catch (error) {
      console.error('Failed to open chat:', error);
      // Show error to user instead of silent redirect
      alert(`Failed to start chat: ${error?.message || 'Unknown error'}`);
      // Do NOT redirect - stay on profile page so user knows something went wrong
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-8 lg:px-16 pb-32 pt-4">
      {userData?.user && (
        <>
          <ProfileHeader
            user={userData.user}
            userId={viewingUserId || clerkUser?.id || ''}
            clerkUser={clerkUser}
            isOwnProfile={isOwnProfile}
            onEditClick={() => router.push('/profile?edit=true')}
            onSettingsClick={() => setIsSettingsOpen(true)}
            onMessageClick={handleMessageClick}
          />

          <ProfileTabs
            isOwnProfile={isOwnProfile}
            journeyContent={
              <MyJourneyTab
                user={userData.user}
                goal={userData.goal}
                habits={habits}
                isOwnProfile={isOwnProfile}
              />
            }
            detailsContent={
              <MyDetailsTab user={userData.user} />
            }
          />

          {/* Settings Drawer */}
          <SettingsDrawer
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialEmailPreferences={emailPreferences}
          />
        </>
      )}

      {!userData?.user && (
        <div className="text-center py-12">
          <p className="font-sans text-text-secondary mb-4">Loading profile...</p>
        </div>
      )}
    </div>
  );
}
