/**
 * Content Funnel Page - Entry point for content funnels
 * 
 * This page:
 * 1. Loads the funnel and its steps
 * 2. Loads the content item (article, course, event, download, or link)
 * 3. Creates/retrieves a flow session
 * 4. Renders the ContentFunnelClient component
 */

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { checkExistingContentPurchase, getProductRedirectUrl } from '@/lib/enrollment-check';
import ContentFunnelClient from './ContentFunnelClient';
import FunnelDeactivated from '@/components/FunnelDeactivated';
import type { Funnel, FunnelStep, FunnelContentType, OrgSettings, CoachSubscriptionStatus, ContentPurchaseType } from '@/types';
import { mergeTrackingConfig } from '@/lib/tracking-utils';

/**
 * Check if organization subscription is active
 */
function isSubscriptionActive(
  status?: CoachSubscriptionStatus,
  currentPeriodEnd?: string,
  cancelAtPeriodEnd?: boolean
): boolean {
  // Active or trialing = full access
  if (status === 'active' || status === 'trialing') {
    return true;
  }
  
  // Canceled but still in paid period
  if ((status === 'canceled' || cancelAtPeriodEnd) && currentPeriodEnd) {
    const endDate = new Date(currentPeriodEnd);
    const now = new Date();
    return endDate > now;
  }
  
  return false;
}

interface ContentFunnelPageProps {
  params: Promise<{ contentType: string; contentId: string; funnelSlug: string }>;
  searchParams: Promise<{ invite?: string; ref?: string }>;
}

// Map content type to Firestore collection name
const CONTENT_COLLECTION_MAP: Record<FunnelContentType, string> = {
  article: 'articles',
  course: 'courses',
  event: 'events',
  download: 'downloads',
  link: 'links',
};

export default async function ContentFunnelPage({ params, searchParams }: ContentFunnelPageProps) {
  const { contentType: rawContentType, contentId, funnelSlug } = await params;
  const { invite: inviteCode, ref: referrerId } = await searchParams;

  // Validate content type
  const contentType = rawContentType as FunnelContentType;
  if (!CONTENT_COLLECTION_MAP[contentType]) {
    notFound();
  }

  // Get hostname for tenant resolution and branding
  const headersList = await headers();
  const hostname = headersList.get('host') || '';

  // Resolve tenant (organization) from hostname
  const tenantResult = await resolveTenant(hostname, null, null);
  const organizationId = tenantResult.type === 'tenant' ? tenantResult.tenant.organizationId : null;
  // Extract subdomain for custom domain auth iframe (needed by SignupStep)
  const tenantSubdomain = tenantResult.type === 'tenant' ? tenantResult.tenant.subdomain : null;

  // Get branding
  const branding = await getBrandingForDomain(hostname);
  const logoUrl = getBestLogoUrl(branding);
  const appTitle = branding.appTitle;
  const primaryColor = branding.primaryColor;

  // Find content by ID
  const collectionName = CONTENT_COLLECTION_MAP[contentType];
  const contentDoc = await adminDb.collection(collectionName).doc(contentId).get();

  if (!contentDoc.exists) {
    notFound();
  }

  const contentData = contentDoc.data();

  // Verify content belongs to the organization (if on tenant domain)
  if (organizationId && contentData?.organizationId !== organizationId) {
    notFound();
  }

  // Check for existing content purchase (for authenticated users)
  let existingPurchase: {
    id: string;
    redirectUrl: string;
  } | null = null;
  
  const { userId } = await auth();
  
  if (userId) {
    // Map FunnelContentType to ContentPurchaseType
    const purchaseType = contentType as ContentPurchaseType;
    const purchaseCheck = await checkExistingContentPurchase(userId, purchaseType, contentId);
    
    if (purchaseCheck.exists) {
      existingPurchase = {
        id: purchaseCheck.purchase!.id,
        redirectUrl: getProductRedirectUrl('content', contentId, purchaseType),
      };
    }
  }

  // Find funnel by contentId and slug
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('contentId', '==', contentId)
    .where('contentType', '==', contentType)
    .where('slug', '==', funnelSlug)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (funnelsSnapshot.empty) {
    notFound();
  }

  const funnelDoc = funnelsSnapshot.docs[0];
  const funnelData = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

  // Fetch org settings to get global tracking pixels AND subscription status
  const contentOrgId = contentData?.organizationId || funnelData.organizationId;
  const orgSettingsDoc = await adminDb.collection('org_settings').doc(contentOrgId).get();
  const orgSettings = orgSettingsDoc.exists ? (orgSettingsDoc.data() as OrgSettings) : null;
  
  // Check if coach's subscription is active
  // If not, show the deactivated page instead of the funnel
  let subscriptionActive = true;
  
  try {
    // Try to get subscription status from Clerk org metadata (fastest)
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: contentOrgId });
    const orgMetadata = org.publicMetadata as { 
      subscriptionStatus?: CoachSubscriptionStatus; 
      currentPeriodEnd?: string;
      cancelAtPeriodEnd?: boolean;
    } | undefined;
    
    if (orgMetadata?.subscriptionStatus) {
      subscriptionActive = isSubscriptionActive(
        orgMetadata.subscriptionStatus,
        orgMetadata.currentPeriodEnd,
        orgMetadata.cancelAtPeriodEnd
      );
    } else {
      // Fallback: Check coach_subscriptions collection
      const subSnapshot = await adminDb
        .collection('coach_subscriptions')
        .where('organizationId', '==', contentOrgId)
        .limit(1)
        .get();
      
      if (!subSnapshot.empty) {
        const subData = subSnapshot.docs[0].data();
        subscriptionActive = isSubscriptionActive(
          subData.status as CoachSubscriptionStatus,
          subData.currentPeriodEnd,
          subData.cancelAtPeriodEnd
        );
      }
      // If no subscription record found, assume inactive (none status)
      else {
        subscriptionActive = false;
      }
    }
  } catch (subErr) {
    console.error('[CONTENT_FUNNEL] Error checking subscription:', subErr);
    // On error, allow access (don't block due to subscription check failure)
    subscriptionActive = true;
  }
  
  // If subscription is not active, show deactivated page
  if (!subscriptionActive) {
    return <FunnelDeactivated coachName={branding.appTitle} platformName={branding.appTitle} />;
  }
  
  // Merge global tracking with funnel-specific tracking
  const mergedTracking = mergeTrackingConfig(orgSettings?.globalTracking, funnelData.tracking);
  
  // Create funnel object with merged tracking
  const funnel: Funnel = {
    ...funnelData,
    tracking: mergedTracking,
  };

  // Get funnel steps
  let steps: FunnelStep[] = [];
  
  try {
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnel.id)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];
  } catch (orderError) {
    // Fallback: Query without orderBy (handles missing index or missing order field)
    console.warn(`[CONTENT_FUNNEL] orderBy query failed for funnel ${funnel.id}, fetching all steps:`, orderError);
    
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnel.id)
      .collection('steps')
      .get();

    steps = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];
    
    // Sort client-side by order field if it exists, otherwise by createdAt
    steps.sort((a, b) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }
  
  if (steps.length === 0) {
    console.warn(`[CONTENT_FUNNEL] No steps found for funnel ${funnel.id} (slug: ${funnelSlug})`);
  }

  // Validate invite code if funnel is invite-only
  let validatedInvite: { paymentStatus: string } | null = null;
  
  if (funnel.accessType === 'invite_only' && !inviteCode) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Invite Required</h1>
          <p className="text-text-secondary">This content requires an invite code to access.</p>
        </div>
      </div>
    );
  }

  if (inviteCode) {
    // Check content invites collection
    const inviteDoc = await adminDb.collection('content_invites').doc(inviteCode.toUpperCase()).get();
    
    if (inviteDoc.exists) {
      const invite = inviteDoc.data();
      
      // Validate invite
      const isValid = 
        invite?.funnelId === funnel.id &&
        (!invite?.expiresAt || new Date(invite.expiresAt) >= new Date()) &&
        (!invite?.maxUses || (invite?.useCount || 0) < invite.maxUses);

      if (isValid) {
        validatedInvite = {
          paymentStatus: invite?.paymentStatus || 'required',
        };
      }
    }
  }

  // Get coach info from organization
  let coachName = 'Coach';
  let coachImageUrl: string | undefined;
  
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    
    // Get organization memberships to find the coach
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: funnel.organizationId,
      limit: 100,
    });
    
    // Find the super_coach (primary coach)
    const coachMember = memberships.data.find(m => {
      const metadata = m.publicMetadata as Record<string, unknown>;
      return metadata?.orgRole === 'super_coach';
    });
    
    if (coachMember?.publicUserData?.userId) {
      const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
      coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
      coachImageUrl = coachUser.imageUrl || undefined;
    } else {
      // Fallback to first admin member
      const adminMember = memberships.data.find(m => 
        m.role === 'org:admin' && m.publicUserData?.userId
      );
      if (adminMember?.publicUserData?.userId) {
        const adminUser = await clerk.users.getUser(adminMember.publicUserData.userId);
        coachName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim() || 'Coach';
        coachImageUrl = adminUser.imageUrl || undefined;
      }
    }
  } catch (err) {
    console.error('[CONTENT_FUNNEL] Error fetching coach info:', err);
  }

  // Build content object for the client
  const content = {
    id: contentId,
    type: contentType,
    title: contentData?.title || 'Untitled',
    description: contentData?.description || contentData?.shortDescription || contentData?.content?.substring(0, 200) || '',
    coverImageUrl: contentData?.coverImageUrl || contentData?.thumbnailUrl,
    priceInCents: contentData?.priceInCents || 0,
    currency: contentData?.currency || 'usd',
    coachName,
    coachImageUrl,
  };

  return (
    <ContentFunnelClient
      funnel={funnel}
      steps={steps}
      content={content}
      branding={{
        logoUrl,
        appTitle,
        primaryColor,
      }}
      organization={{
        id: funnel.organizationId,
        name: appTitle,
      }}
      inviteCode={inviteCode}
      validatedInvite={validatedInvite}
      hostname={hostname}
      tenantSubdomain={tenantSubdomain}
      referrerId={referrerId}
      existingPurchase={existingPurchase}
    />
  );
}

