import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { ClerkPublicMetadataWithOrg } from '@/lib/clerk-organizations';

/**
 * POST /api/coach/onboarding/profile
 * 
 * Save coach profile data during onboarding step 1.
 * Updates organization name, branding settings, and advances onboarding state.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const { businessName, description, avatarUrl } = body;
    
    if (!businessName?.trim()) {
      return NextResponse.json(
        { error: 'Business name is required' },
        { status: 400 }
      );
    }
    
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.publicMetadata as ClerkPublicMetadataWithOrg;
    
    if (!metadata?.organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Please start the signup process again.' },
        { status: 404 }
      );
    }
    
    const organizationId = metadata.organizationId;
    const now = new Date().toISOString();
    
    // Update organization name in Clerk
    try {
      await client.organizations.updateOrganization(organizationId, {
        name: businessName.trim(),
      });
      console.log(`[ONBOARDING_PROFILE] Updated org name for ${organizationId}: ${businessName}`);
    } catch (error) {
      console.error(`[ONBOARDING_PROFILE] Failed to update org name:`, error);
      // Continue - not critical
    }
    
    // Update or create branding settings
    const brandingRef = adminDb.collection('org_branding').doc(organizationId);
    const brandingDoc = await brandingRef.get();
    
    if (brandingDoc.exists) {
      await brandingRef.update({
        organizationId,
        displayName: businessName.trim(),
        description: description?.trim() || '',
        logoUrl: avatarUrl || null,
        updatedAt: now,
      });
    } else {
      await brandingRef.set({
        organizationId,
        displayName: businessName.trim(),
        description: description?.trim() || '',
        logoUrl: avatarUrl || null,
        faviconUrl: null,
        primaryColor: '#a07855',
        accentColor: '#e8b923',
        darkMode: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    // Update org_settings with profile info
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    await settingsRef.update({
      name: businessName.trim(),
      description: description?.trim() || '',
      updatedAt: now,
    });
    
    // Update onboarding state to next step
    await adminDb.collection('coach_onboarding').doc(organizationId).set({
      status: 'needs_plan',
      profileCompletedAt: now,
      updatedAt: now,
    }, { merge: true });
    
    console.log(`[ONBOARDING_PROFILE] Completed profile step for org ${organizationId}`);
    
    return NextResponse.json({
      success: true,
      nextStep: 'needs_plan',
    });
    
  } catch (error) {
    console.error('[API_ONBOARDING_PROFILE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

