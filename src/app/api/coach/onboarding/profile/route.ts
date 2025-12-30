import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { ClerkPublicMetadataWithOrg, updateSubdomainFromBusinessName } from '@/lib/clerk-organizations';
import { syncTenantToEdgeConfig, DEFAULT_TENANT_BRANDING } from '@/lib/tenant-edge-config';
import { regenerateDefaultLogo } from '@/lib/logo-generator';
import type { OrgBranding, LogoSource } from '@/types';
import { DEFAULT_BRANDING_COLORS, DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_MENU_ORDER } from '@/types';

/**
 * POST /api/coach/onboarding/profile
 * 
 * Save coach profile data during onboarding step 1.
 * Updates organization name, branding settings, subdomain, and advances onboarding state.
 * 
 * The subdomain is generated from the business name:
 * - "Omir Delil" -> tries: omirdelil, omir-delil, coachomirdelil, coachomirdelil1, etc.
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
    
    // Generate and update subdomain from business name
    let subdomain: string | null = null;
    try {
      subdomain = await updateSubdomainFromBusinessName(organizationId, businessName.trim());
      console.log(`[ONBOARDING_PROFILE] Set subdomain for ${organizationId}: ${subdomain}`);
    } catch (subdomainError) {
      console.error(`[ONBOARDING_PROFILE] Failed to update subdomain:`, subdomainError);
      // Continue - subdomain can be updated later from dashboard
    }
    
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
    const trimmedName = businessName.trim();
    
    let finalLogoUrl: string | null = null;
    let logoSource: LogoSource | undefined = undefined;
    
    if (brandingDoc.exists) {
      const existingBranding = brandingDoc.data() as OrgBranding;
      
      // Determine logo handling based on logoSource
      if (existingBranding.logoSource === 'custom') {
        // Custom logo - preserve it, only update appTitle
        finalLogoUrl = existingBranding.logoUrl;
        logoSource = 'custom';
        console.log(`[ONBOARDING_PROFILE] Preserving custom logo for ${organizationId}`);
      } else {
        // Generated logo or no logo - regenerate from new business name
        try {
          finalLogoUrl = await regenerateDefaultLogo(organizationId, trimmedName);
          logoSource = 'generated';
          console.log(`[ONBOARDING_PROFILE] Regenerated logo for ${organizationId}: ${finalLogoUrl}`);
        } catch (logoError) {
          console.error(`[ONBOARDING_PROFILE] Failed to regenerate logo:`, logoError);
          // Keep existing logo if regeneration fails
          finalLogoUrl = existingBranding.logoUrl;
          logoSource = existingBranding.logoSource;
        }
      }
      
      // Update existing branding - always update appTitle
      await brandingRef.update({
        appTitle: trimmedName,
        logoUrl: finalLogoUrl,
        logoSource: logoSource,
        updatedAt: now,
      });
    } else {
      // Create new branding with generated logo
      try {
        finalLogoUrl = await regenerateDefaultLogo(organizationId, trimmedName);
        logoSource = 'generated';
        console.log(`[ONBOARDING_PROFILE] Generated initial logo for ${organizationId}: ${finalLogoUrl}`);
      } catch (logoError) {
        console.error(`[ONBOARDING_PROFILE] Failed to generate initial logo:`, logoError);
      }
      
      const newBranding: OrgBranding = {
        id: organizationId,
        organizationId,
        logoUrl: finalLogoUrl,
        logoUrlDark: null,
        horizontalLogoUrl: null,
        horizontalLogoUrlDark: null,
        logoSource: logoSource,
        appTitle: trimmedName,
        colors: DEFAULT_BRANDING_COLORS,
        menuTitles: DEFAULT_MENU_TITLES,
        menuIcons: DEFAULT_MENU_ICONS,
        menuOrder: DEFAULT_MENU_ORDER,
        createdAt: now,
        updatedAt: now,
      };
      
      await brandingRef.set(newBranding);
    }
    
    // Sync branding to Edge Config for fast tenant resolution
    if (subdomain) {
      try {
        await syncTenantToEdgeConfig(
          organizationId,
          subdomain,
          {
            ...DEFAULT_TENANT_BRANDING,
            appTitle: trimmedName,
            logoUrl: finalLogoUrl,
          },
          undefined // No custom domain initially
        );
        console.log(`[ONBOARDING_PROFILE] Synced branding to Edge Config for subdomain ${subdomain}`);
      } catch (edgeError) {
        console.error(`[ONBOARDING_PROFILE] Failed to sync to Edge Config:`, edgeError);
        // Continue - Edge Config is optimization, not critical
      }
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
      subdomain: subdomain || undefined,
      tenantUrl: subdomain ? `https://${subdomain}.growthaddicts.com` : undefined,
    });
    
  } catch (error) {
    console.error('[API_ONBOARDING_PROFILE_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

