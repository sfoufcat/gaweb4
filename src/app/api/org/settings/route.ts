import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { syncTenantToEdgeConfig, buildTenantConfigData, setTenantByCustomDomain, type TenantBrandingData } from '@/lib/tenant-edge-config';
import type { OrgSettings, OrgBranding, OrgCustomDomain, EmptyStateBehavior, AlignmentActivityKey, CompletionThreshold, AlignmentActivityConfig, FunnelTrackingConfig } from '@/types';
import { DEFAULT_MENU_TITLES, DEFAULT_MENU_ICONS, DEFAULT_BRANDING_COLORS, DEFAULT_APP_TITLE, DEFAULT_LOGO_URL, DEFAULT_MENU_ORDER } from '@/types';

// Valid alignment activity keys
const VALID_ALIGNMENT_ACTIVITIES: AlignmentActivityKey[] = [
  'morning_checkin',
  'evening_checkin',
  'set_tasks',
  'complete_tasks',
  'chat_with_squad',
  'active_goal',
  'complete_habits',
];

// Valid completion thresholds
const VALID_THRESHOLDS: CompletionThreshold[] = ['at_least_one', 'half', 'all'];

/**
 * GET /api/org/settings
 * Get organization settings for the current user's org
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get org from tenant context
    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization context' }, { status: 400 });
    }

    // Fetch org settings
    const settingsDoc = await adminDb.collection('org_settings').doc(organizationId).get();
    
    if (!settingsDoc.exists) {
      return NextResponse.json({ settings: null }, { status: 200 });
    }

    const settings = { id: settingsDoc.id, ...settingsDoc.data() } as OrgSettings;

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('[ORG_SETTINGS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/org/settings
 * Update organization settings (coach only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();

    // Build update object with allowed fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Alumni & Community settings
    if (body.defaultConvertToCommunity !== undefined) {
      updateData.defaultConvertToCommunity = body.defaultConvertToCommunity === true;
    }
    if (body.alumniDiscountEnabled !== undefined) {
      updateData.alumniDiscountEnabled = body.alumniDiscountEnabled === true;
    }
    if (body.alumniDiscountType !== undefined) {
      if (!['percentage', 'fixed'].includes(body.alumniDiscountType)) {
        return NextResponse.json({ error: 'Invalid discount type' }, { status: 400 });
      }
      updateData.alumniDiscountType = body.alumniDiscountType;
    }
    if (body.alumniDiscountValue !== undefined) {
      const value = Number(body.alumniDiscountValue);
      if (isNaN(value) || value < 0) {
        return NextResponse.json({ error: 'Invalid discount value' }, { status: 400 });
      }
      updateData.alumniDiscountValue = value;
    }

    // Feed settings
    if (body.feedEnabled !== undefined) {
      updateData.feedEnabled = body.feedEnabled === true;
    }

    // Menu empty state behaviors
    if (body.programEmptyStateBehavior !== undefined) {
      if (!['hide', 'discover'].includes(body.programEmptyStateBehavior)) {
        return NextResponse.json({ error: 'Invalid program empty state behavior' }, { status: 400 });
      }
      updateData.programEmptyStateBehavior = body.programEmptyStateBehavior;
    }
    if (body.squadEmptyStateBehavior !== undefined) {
      if (!['hide', 'discover'].includes(body.squadEmptyStateBehavior)) {
        return NextResponse.json({ error: 'Invalid squad empty state behavior' }, { status: 400 });
      }
      updateData.squadEmptyStateBehavior = body.squadEmptyStateBehavior;
    }

    // Daily focus settings
    if (body.defaultDailyFocusSlots !== undefined) {
      const slots = Number(body.defaultDailyFocusSlots);
      if (isNaN(slots) || slots < 1 || slots > 6) {
        return NextResponse.json({ error: 'Daily focus slots must be between 1 and 6' }, { status: 400 });
      }
      updateData.defaultDailyFocusSlots = slots;
    }

    // Alignment config settings
    if (body.alignmentConfig !== undefined) {
      const config = body.alignmentConfig as AlignmentActivityConfig;
      
      // Validate enabledActivities
      if (!config.enabledActivities || !Array.isArray(config.enabledActivities)) {
        return NextResponse.json({ error: 'enabledActivities must be an array' }, { status: 400 });
      }
      
      if (config.enabledActivities.length === 0) {
        return NextResponse.json({ error: 'At least one alignment activity must be enabled' }, { status: 400 });
      }
      
      // Validate each activity key
      for (const activity of config.enabledActivities) {
        if (!VALID_ALIGNMENT_ACTIVITIES.includes(activity)) {
          return NextResponse.json({ error: `Invalid alignment activity: ${activity}` }, { status: 400 });
        }
      }
      
      // Validate thresholds if provided
      if (config.taskCompletionThreshold !== undefined && 
          !VALID_THRESHOLDS.includes(config.taskCompletionThreshold)) {
        return NextResponse.json({ error: 'Invalid task completion threshold' }, { status: 400 });
      }
      
      if (config.habitCompletionThreshold !== undefined && 
          !VALID_THRESHOLDS.includes(config.habitCompletionThreshold)) {
        return NextResponse.json({ error: 'Invalid habit completion threshold' }, { status: 400 });
      }
      
      // Store the validated config
      updateData.alignmentConfig = {
        enabledActivities: config.enabledActivities,
        taskCompletionThreshold: config.taskCompletionThreshold || 'at_least_one',
        habitCompletionThreshold: config.habitCompletionThreshold || 'at_least_one',
        weekendStreakEnabled: config.weekendStreakEnabled === true, // Default to false
      };
    }

    // AI Summary settings
    if (body.summarySettings !== undefined) {
      const summarySettings = body.summarySettings;

      // Validate task generation mode
      const validModes = ['auto', 'approve', 'disabled'];
      if (summarySettings.taskGenerationMode && !validModes.includes(summarySettings.taskGenerationMode)) {
        return NextResponse.json({ error: 'Invalid task generation mode' }, { status: 400 });
      }

      updateData.summarySettings = {
        autoGenerate: summarySettings.autoGenerate !== false, // Default to true
        taskGenerationMode: summarySettings.taskGenerationMode || 'approve',
      };
    }

    // White-label settings
    if (body.hidePoweredByCoachful !== undefined) {
      updateData.hidePoweredByCoachful = body.hidePoweredByCoachful === true;
    }

    // Global tracking pixels settings
    if (body.globalTracking !== undefined) {
      // Allow null to clear global tracking
      if (body.globalTracking === null) {
        updateData.globalTracking = null;
      } else {
        const tracking = body.globalTracking as FunnelTrackingConfig;
        
        // Build clean tracking config (only include non-empty values)
        const cleanTracking: FunnelTrackingConfig = {};
        
        if (tracking.metaPixelId?.trim()) {
          cleanTracking.metaPixelId = tracking.metaPixelId.trim();
        }
        if (tracking.googleAnalyticsId?.trim()) {
          cleanTracking.googleAnalyticsId = tracking.googleAnalyticsId.trim();
        }
        if (tracking.googleAdsId?.trim()) {
          cleanTracking.googleAdsId = tracking.googleAdsId.trim();
        }
        if (tracking.customHeadHtml?.trim()) {
          cleanTracking.customHeadHtml = tracking.customHeadHtml.trim();
        }
        if (tracking.customBodyHtml?.trim()) {
          cleanTracking.customBodyHtml = tracking.customBodyHtml.trim();
        }
        
        // Only store if there are any values, otherwise set to null to clear
        updateData.globalTracking = Object.keys(cleanTracking).length > 0 ? cleanTracking : null;
      }
    }

    // Check if settings doc exists
    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      await settingsRef.update(updateData);
    } else {
      // Create settings doc if it doesn't exist
      await settingsRef.set({
        id: organizationId,
        organizationId,
        createdAt: new Date().toISOString(),
        ...updateData,
      });
    }

    // Fetch updated settings
    const updatedDoc = await settingsRef.get();
    const settings = { id: updatedDoc.id, ...updatedDoc.data() } as OrgSettings;

    console.log(`[ORG_SETTINGS_PATCH] Updated settings for org ${organizationId}`);
    
    // Sync to Edge Config if empty state behaviors changed
    if (body.programEmptyStateBehavior !== undefined || body.squadEmptyStateBehavior !== undefined) {
      try {
        // Get subdomain from org_domains
        const domainDoc = await adminDb.collection('org_domains').doc(organizationId).get();
        const domainData = domainDoc.data();
        const subdomain = domainData?.subdomain;
        
        // Get verified custom domain from org_custom_domains
        const customDomainSnapshot = await adminDb
          .collection('org_custom_domains')
          .where('organizationId', '==', organizationId)
          .where('status', '==', 'verified')
          .limit(1)
          .get();
        
        const verifiedCustomDomain = customDomainSnapshot.empty 
          ? null 
          : (customDomainSnapshot.docs[0].data() as OrgCustomDomain).domain;
        
        // Get branding from org_branding
        const brandingDoc = await adminDb.collection('org_branding').doc(organizationId).get();
        const brandingData = brandingDoc.exists ? (brandingDoc.data() as OrgBranding) : null;
        
        const edgeBranding: TenantBrandingData = {
          logoUrl: brandingData?.logoUrl ?? DEFAULT_LOGO_URL,
          horizontalLogoUrl: brandingData?.horizontalLogoUrl ?? null,
          appTitle: brandingData?.appTitle ?? DEFAULT_APP_TITLE,
          colors: brandingData?.colors ?? DEFAULT_BRANDING_COLORS,
          menuTitles: brandingData?.menuTitles ?? DEFAULT_MENU_TITLES,
          menuIcons: brandingData?.menuIcons ?? DEFAULT_MENU_ICONS,
          menuOrder: brandingData?.menuOrder ?? DEFAULT_MENU_ORDER,
        };
        
        // Get current settings from updated doc
        const feedEnabled = settings.feedEnabled === true;
        const programEmptyStateBehavior: EmptyStateBehavior = settings.programEmptyStateBehavior || 'discover';
        const squadEmptyStateBehavior: EmptyStateBehavior = settings.squadEmptyStateBehavior || 'discover';
        
        if (subdomain) {
          await syncTenantToEdgeConfig(
            organizationId,
            subdomain,
            edgeBranding,
            verifiedCustomDomain || undefined,
            undefined, // coachingPromo
            feedEnabled,
            programEmptyStateBehavior,
            squadEmptyStateBehavior
          );
          console.log(`[ORG_SETTINGS_PATCH] Synced empty state settings to Edge Config for subdomain: ${subdomain}`);
        } else if (verifiedCustomDomain) {
          const fallbackSubdomain = `org-${organizationId.substring(0, 8)}`;
          const configData = buildTenantConfigData(
            organizationId,
            fallbackSubdomain,
            edgeBranding,
            verifiedCustomDomain,
            undefined,
            feedEnabled,
            programEmptyStateBehavior,
            squadEmptyStateBehavior
          );
          await setTenantByCustomDomain(verifiedCustomDomain, configData);
          console.log(`[ORG_SETTINGS_PATCH] Synced empty state settings to Edge Config for custom domain: ${verifiedCustomDomain}`);
        }
      } catch (edgeError) {
        console.error('[ORG_SETTINGS_PATCH] Edge Config sync error (non-fatal):', edgeError);
      }
    }

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[ORG_SETTINGS_PATCH] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

