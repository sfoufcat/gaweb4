import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createOrganizationForCoach, ClerkPublicMetadataWithOrg } from '@/lib/clerk-organizations';
import { adminDb } from '@/lib/firebase-admin';
import { queueEmailsForTrigger } from '@/lib/email-automation';

// Map quiz frustration IDs to readable text
const FRUSTRATION_LABELS: Record<string, string> = {
  manual_checkins: 'Manual check-ins',
  no_visibility: 'No visibility into engagement',
  spreadsheets: 'Managing spreadsheets',
  client_ghosting: 'Clients ghosting',
  scaling_hard: 'Hard to scale',
};

// Map quiz impact feature IDs to readable text
const IMPACT_LABELS: Record<string, string> = {
  tracking: 'Tracking client progress automatically',
  squads: 'Squad accountability groups',
  habits: 'Daily habits & check-ins',
  engagement: 'Seeing who\'s actually engaged',
  automation: 'Automated program delivery',
  group: 'Group coaching that feels personal',
};

/**
 * POST /api/coach/create-organization
 * 
 * Creates a new Clerk Organization for a coach.
 * Supports multi-org: coaches can create multiple organizations.
 * 
 * Body (optional):
 * - quizData: { clientCount, frustrations: string[], impactFeatures: string[], referralCode?: string }
 * 
 * Steps:
 * 1. Verify user is authenticated
 * 2. Create new organization with defaults (supports multiple orgs per coach)
 * 3. Set user's role to 'coach' and orgRole to 'super_coach'
 * 4. Initialize onboarding state to 'needs_profile'
 * 5. Track referral if referral code is present
 * 6. Queue abandoned cart emails with quiz data for personalization
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    // Parse optional quiz data from body
    let quizData: { 
      clientCount?: string; 
      frustrations?: string[]; 
      impactFeatures?: string[];
      referralCode?: string;
    } | undefined;
    
    try {
      const body = await req.json();
      quizData = body?.quizData;
    } catch {
      // No body or invalid JSON - that's fine
    }
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    // Check if this is their first organization (for logging)
    const isFirstOrg = !metadata?.organizationId;
    console.log(`[API_CREATE_ORG] Creating ${isFirstOrg ? 'first' : 'additional'} organization for user ${userId}`);
    
    // Get name for organization
    const coachName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
    
    // Create the organization (this also sets up subdomain, default channels, etc.)
    // createOrganizationForCoach handles multi-org: sets primaryOrganizationId to new org
    const organizationId = await createOrganizationForCoach(userId, coachName);
    
    // Update user's role to 'coach' if not already (for first-time coaches)
    // Note: createOrganizationForCoach already updates primaryOrganizationId and orgRole
    if (metadata?.role !== 'coach') {
      // Refetch user to get updated metadata from createOrganizationForCoach
      const updatedUser = await client.users.getUser(userId);
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...updatedUser.publicMetadata,
          role: 'coach',
        },
      });
    }
    
    // Initialize onboarding state for the new organization
    const now = new Date().toISOString();
    await adminDb.collection('coach_onboarding').doc(organizationId).set({
      organizationId,
      userId,
      status: 'needs_profile', // First step after org creation
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`[API_CREATE_ORG] Created organization ${organizationId} for user ${userId} (isFirstOrg: ${isFirstOrg})`);
    
    const email = user.emailAddresses[0]?.emailAddress;
    
    // Track referral if referral code is present
    if (quizData?.referralCode && email) {
      try {
        const referralResponse = await fetch(
          new URL('/api/coach-referral/track', process.env.NEXT_PUBLIC_APP_URL || 'https://growthaddicts.com').toString(),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              referralCode: quizData.referralCode,
              referredEmail: email,
              referredUserId: userId,
              referredOrgId: organizationId,
            }),
          }
        );
        
        if (referralResponse.ok) {
          const referralResult = await referralResponse.json();
          console.log(`[API_CREATE_ORG] Tracked referral for ${email}: ${referralResult.referralId || 'already tracked'}`);
        } else {
          console.warn(`[API_CREATE_ORG] Failed to track referral: ${referralResponse.status}`);
        }
      } catch (referralErr) {
        console.warn('[API_CREATE_ORG] Failed to track referral:', referralErr);
        // Don't fail org creation if referral tracking fails
      }
    }
    
    // Queue abandoned cart emails (will be cancelled when they select a plan)
    if (email) {
      try {
        // Build email variables from quiz data
        const emailVariables: Record<string, string> = {
          firstName: user.firstName || 'there',
        };
        
        // Add quiz data for personalized emails
        if (quizData) {
          if (quizData.clientCount) {
            emailVariables.quizClientCount = quizData.clientCount;
          }
          if (quizData.frustrations && quizData.frustrations.length > 0) {
            // Convert frustration IDs to readable text
            const frustrationTexts = quizData.frustrations
              .map(f => FRUSTRATION_LABELS[f] || f)
              .slice(0, 2); // Limit to 2 for readability
            emailVariables.quizFrustrations = frustrationTexts.join(', ');
          }
          if (quizData.impactFeatures && quizData.impactFeatures.length > 0) {
            // Convert impact feature IDs to readable text
            const impactTexts = quizData.impactFeatures
              .map(f => IMPACT_LABELS[f] || f)
              .slice(0, 2); // Limit to 2 for readability
            emailVariables.quizImpactFeatures = impactTexts.join(', ');
          }
        }
        
        await queueEmailsForTrigger(
          'signup_no_plan',
          email,
          userId,
          organizationId,
          emailVariables
        );
        console.log(`[API_CREATE_ORG] Queued abandoned cart emails for ${email} with quiz data:`, quizData ? 'yes' : 'no');
      } catch (emailErr) {
        console.warn('[API_CREATE_ORG] Failed to queue emails:', emailErr);
        // Don't fail org creation if email queueing fails
      }
    }
    
    return NextResponse.json({
      success: true,
      organizationId,
      onboardingStatus: 'needs_profile',
      isFirstOrg,
    });
    
  } catch (error: any) {
    console.error('[API_CREATE_ORG_ERROR]', error);
    
    // Handle specific Clerk errors
    if (error.errors) {
      const clerkError = error.errors[0];
      return NextResponse.json(
        { 
          error: clerkError.message || 'Failed to create organization',
          code: clerkError.code,
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

