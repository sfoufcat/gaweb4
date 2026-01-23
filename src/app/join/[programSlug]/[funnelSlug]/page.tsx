/**
 * Funnel Page - Main funnel flow entry point
 * 
 * This page:
 * 1. Loads the funnel and its steps
 * 2. Creates/retrieves a flow session
 * 3. Renders the FunnelRenderer component
 */

import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenant } from '@/lib/tenant/resolveTenant';
import { getBrandingForDomain, getBestLogoUrl } from '@/lib/server/branding';
import { checkExistingEnrollment, getProductRedirectUrl } from '@/lib/enrollment-check';
import FunnelClient from './FunnelClient';
import FunnelDeactivated from '@/components/FunnelDeactivated';
import JoinNotAvailable from '@/components/funnel/JoinNotAvailable';
import type { Program, Funnel, FunnelStep, OrgSettings, CoachSubscriptionStatus, NewProgramEnrollmentStatus } from '@/types';
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

interface FunnelPageProps {
  params: Promise<{ programSlug: string; funnelSlug: string }>;
  searchParams: Promise<{ invite?: string; ref?: string }>;
}

export default async function FunnelPage({ params, searchParams }: FunnelPageProps) {
  const { programSlug, funnelSlug } = await params;
  const { invite: inviteCode, ref: referrerId } = await searchParams;

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

  // Find program by slug
  let programQuery = adminDb.collection('programs').where('slug', '==', programSlug);
  
  if (organizationId) {
    programQuery = programQuery.where('organizationId', '==', organizationId);
  }

  const programsSnapshot = await programQuery.where('isActive', '==', true).limit(1).get();

  if (programsSnapshot.empty) {
    return <JoinNotAvailable coachName={branding.appTitle} type="program" />;
  }

  const programDoc = programsSnapshot.docs[0];
  const program = { id: programDoc.id, ...programDoc.data() } as Program;

  // Check for existing enrollment (for authenticated users)
  // This provides immediate feedback if user already owns the program
  let existingEnrollment: {
    id: string;
    status: NewProgramEnrollmentStatus;
    redirectUrl: string;
  } | null = null;
  
  const { userId } = await auth();
  
  if (userId) {
    const enrollmentCheck = await checkExistingEnrollment(userId, program.id);
    
    if (enrollmentCheck.exists && !enrollmentCheck.allowReEnrollment) {
      existingEnrollment = {
        id: enrollmentCheck.enrollment!.id,
        status: enrollmentCheck.enrollment!.status,
        redirectUrl: getProductRedirectUrl('program', program.id),
      };
    }
  }

  // Find funnel by slug
  const funnelsSnapshot = await adminDb
    .collection('funnels')
    .where('programId', '==', program.id)
    .where('slug', '==', funnelSlug)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (funnelsSnapshot.empty) {
    return <JoinNotAvailable coachName={branding.appTitle} type="funnel" />;
  }

  const funnelDoc = funnelsSnapshot.docs[0];
  const funnelData = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

  // Fetch org settings to get global tracking pixels AND subscription status
  const orgSettingsDoc = await adminDb.collection('org_settings').doc(program.organizationId).get();
  const orgSettings = orgSettingsDoc.exists ? (orgSettingsDoc.data() as OrgSettings) : null;
  
  // Check if coach's subscription is active
  // If not, show the deactivated page instead of the funnel
  let subscriptionActive = true;
  
  try {
    // Try to get subscription status from Clerk org metadata (fastest)
    const { clerkClient } = await import('@clerk/nextjs/server');
    const clerk = await clerkClient();
    const org = await clerk.organizations.getOrganization({ organizationId: program.organizationId });
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
        .where('organizationId', '==', program.organizationId)
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
    console.error('[FUNNEL_PAGE] Error checking subscription:', subErr);
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

  // Get funnel steps - try with orderBy first, fallback to getting all steps if query fails
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
    console.warn(`[PROGRAM_FUNNEL] orderBy query failed for funnel ${funnel.id}, fetching all steps:`, orderError);
    
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
      // Fallback to createdAt if order is missing
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime;
    });
  }
  
  // Log warning if steps are empty (helps with debugging)
  if (steps.length === 0) {
    console.warn(`[PROGRAM_FUNNEL] No steps found for funnel ${funnel.id} (slug: ${funnelSlug})`);
  }

  // Validate invite code if funnel is invite-only
  let validatedInvite: {
    paymentStatus: string;
    targetSquadId?: string;
    lockedEmail?: string;    // Single locked email (legacy, for backwards compat)
    lockedEmails?: string[]; // Multiple allowed emails (batch invites)
  } | null = null;
  
  if (funnel.accessType === 'invite_only' && !inviteCode) {
    // Redirect to error or show invite required message
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Invite Required</h1>
          <p className="text-text-secondary">This program requires an invite code to join.</p>
        </div>
      </div>
    );
  }

  if (inviteCode) {
    const inviteDoc = await adminDb.collection('program_invites').doc(inviteCode.toUpperCase()).get();
    
    if (inviteDoc.exists) {
      const invite = inviteDoc.data();
      
      // Validate invite
      const isValid =
        (invite?.funnelId === funnel.id || invite?.programId === program.id) &&
        invite?.status !== 'cancelled' &&  // Reject cancelled invites
        (!invite?.expiresAt || new Date(invite.expiresAt) >= new Date()) &&
        (!invite?.maxUses || (invite?.useCount || 0) < invite.maxUses);

      if (isValid) {
        // Determine locked emails: support both single email and batch emails array
        let lockedEmails: string[] | undefined;
        if (invite?.emailRequired) {
          if (invite?.emails && Array.isArray(invite.emails) && invite.emails.length > 0) {
            lockedEmails = invite.emails;
          } else if (invite?.email) {
            lockedEmails = [invite.email];
          }
        }

        validatedInvite = {
          paymentStatus: invite?.paymentStatus || 'required',
          targetSquadId: invite?.targetSquadId,
          // If invite has email(s) and emailRequired, lock signup to those emails
          lockedEmail: lockedEmails?.length === 1 ? lockedEmails[0] : undefined,
          lockedEmails: lockedEmails?.length ? lockedEmails : undefined,
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
      organizationId: program.organizationId,
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
    console.error('[FUNNEL_PAGE] Error fetching coach info:', err);
    // Fallback to generic coach name
  }

  return (
    <FunnelClient
      funnel={funnel}
      steps={steps}
      program={{
        id: program.id,
        name: program.name,
        slug: program.slug,
        description: program.description || '',
        coverImageUrl: program.coverImageUrl,
        type: program.type,
        lengthDays: program.lengthDays,
        priceInCents: program.priceInCents,
        currency: program.currency,
        stripePriceId: program.stripePriceId,
        subscriptionEnabled: program.subscriptionEnabled,
        billingInterval: program.billingInterval,
        coachName,
        coachImageUrl,
      }}
      branding={{
        logoUrl,
        appTitle,
        primaryColor,
      }}
      organization={{
        id: funnel.organizationId,
        name: appTitle, // Use appTitle as org display name
      }}
      inviteCode={inviteCode}
      validatedInvite={validatedInvite}
      hostname={hostname}
      tenantSubdomain={tenantSubdomain}
      referrerId={referrerId}
      existingEnrollment={existingEnrollment}
    />
  );
}

