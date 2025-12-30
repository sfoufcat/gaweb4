import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getOrgDomain } from '@/lib/tenant/resolveTenant';
import type { CoachOnboardingState } from '@/types';

/**
 * POST /api/auth/post-signin-redirect
 * 
 * Determines the appropriate redirect URL after sign-in on the main domain.
 * 
 * Logic:
 * - No organization: return '/' (stay on marketing domain, show marketplace)
 * - Has organization:
 *   - needs_profile: return '/coach/onboarding/profile'
 *   - needs_plan: return '/coach/onboarding/plans'
 *   - active: return 'https://{subdomain}.growthaddicts.com/coach'
 */
export async function POST() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      // Not authenticated - shouldn't happen, but handle gracefully
      return NextResponse.json({ redirect: '/sign-in' });
    }
    
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as {
      primaryOrganizationId?: string;
      organizationId?: string;
    };
    
    // Check if user has an organization
    const organizationId = metadata?.primaryOrganizationId || metadata?.organizationId;
    
    if (!organizationId) {
      // No organization - stay on marketing domain
      // This user is not a coach, they might be browsing the marketplace
      return NextResponse.json({ redirect: '/' });
    }
    
    // User has an organization - check onboarding state
    // First try Clerk org metadata (faster), then fall back to Firebase
    let onboardingState: CoachOnboardingState = 'active';
    
    try {
      const org = await client.organizations.getOrganization({ organizationId });
      const orgMetadata = org.publicMetadata as {
        onboardingState?: CoachOnboardingState;
        subscriptionStatus?: string;
      };
      
      if (orgMetadata?.onboardingState) {
        onboardingState = orgMetadata.onboardingState;
      } else {
        // Fallback to Firebase coach_onboarding collection
        const onboardingDoc = await adminDb.collection('coach_onboarding').doc(organizationId).get();
        
        if (onboardingDoc.exists) {
          const data = onboardingDoc.data();
          onboardingState = data?.status as CoachOnboardingState || 'active';
        }
        // If no document exists, treat as 'active' (grandfathered coaches)
      }
    } catch (error) {
      console.error('[POST_SIGNIN_REDIRECT] Error fetching org state:', error);
      // Default to 'active' if we can't determine state
    }
    
    // Handle based on onboarding state
    if (onboardingState === 'needs_profile') {
      return NextResponse.json({ redirect: '/coach/onboarding/profile' });
    }
    
    if (onboardingState === 'needs_plan') {
      return NextResponse.json({ redirect: '/coach/onboarding/plans' });
    }
    
    // Active - redirect to their subdomain
    try {
      const orgDomain = await getOrgDomain(organizationId);
      
      if (orgDomain?.subdomain) {
        const subdomain = orgDomain.subdomain;
        return NextResponse.json({ 
          redirect: `https://${subdomain}.growthaddicts.com/coach`,
          crossDomain: true,
        });
      }
      
      // No subdomain found - this shouldn't happen for active coaches
      // but handle gracefully by sending to profile to set one up
      console.warn(`[POST_SIGNIN_REDIRECT] No subdomain found for org ${organizationId}`);
      return NextResponse.json({ redirect: '/coach/onboarding/profile' });
      
    } catch (error) {
      console.error('[POST_SIGNIN_REDIRECT] Error fetching org domain:', error);
      // If we can't get the subdomain, stay on main domain
      return NextResponse.json({ redirect: '/coach/onboarding/profile' });
    }
    
  } catch (error) {
    console.error('[POST_SIGNIN_REDIRECT] Error:', error);
    // On error, default to marketplace
    return NextResponse.json({ redirect: '/' });
  }
}

