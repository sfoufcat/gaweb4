/**
 * Public API: Squad Detail
 * 
 * GET /api/discover/squads/[squadId] - Get squad details for public landing page
 * 
 * Returns squad info with landing page content, coach info, and member stats.
 * Unlike programs, squads don't have cohorts - they're evergreen communities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Squad, SquadMember, OrgBranding } from '@/types';
import { DEFAULT_BRANDING_COLORS } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ squadId: string }> }
) {
  try {
    const { userId } = await auth();
    const { squadId } = await params;

    // Get squad
    const squadDoc = await adminDb.collection('squads').doc(squadId).get();
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const squadData = squadDoc.data() as Squad;
    
    // Only show public squads (private squads need invite code)
    if (squadData.visibility === 'private') {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }
    
    // Don't show closed squads
    if (squadData.isClosed) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }
    
    // Don't show program squads - they belong to programs and use program landing pages
    if (squadData.programId) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Get coach info
    let coachName = 'Coach';
    let coachImageUrl: string | undefined;
    let coachBio = squadData.coachBio;
    
    if (squadData.coachId) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        const coachUser = await clerk.users.getUser(squadData.coachId);
        coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
        coachImageUrl = coachUser.imageUrl || undefined;
      } catch (err) {
        console.error('[DISCOVER_SQUAD_GET] Error fetching coach info:', err);
      }
    } else if (squadData.organizationId) {
      // If no specific coach, try to get the organization owner
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        
        const memberships = await clerk.organizations.getOrganizationMembershipList({
          organizationId: squadData.organizationId,
        });
        
        const coachMember = memberships.data.find(m => {
          const metadata = m.publicMetadata as { orgRole?: string } | undefined;
          return metadata?.orgRole === 'super_coach';
        }) || memberships.data.find(m => m.role === 'org:admin');
        
        if (coachMember?.publicUserData?.userId) {
          const coachUser = await clerk.users.getUser(coachMember.publicUserData.userId);
          coachName = `${coachUser.firstName || ''} ${coachUser.lastName || ''}`.trim() || 'Coach';
          coachImageUrl = coachUser.imageUrl || undefined;
        }
      } catch (err) {
        console.error('[DISCOVER_SQUAD_GET] Error fetching org coach info:', err);
      }
    }

    // Check if user is already a member
    let isMember = false;
    let membershipStatus: 'active' | 'past_due' | 'canceled' | 'expired' | 'none' = 'none';
    
    if (userId) {
      const membershipSnapshot = await adminDb
        .collection('squadMembers')
        .where('squadId', '==', squadId)
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!membershipSnapshot.empty) {
        isMember = true;
        const memberData = membershipSnapshot.docs[0].data() as SquadMember;
        membershipStatus = memberData.subscriptionStatus || 'active';
      }
    }

    // Get member count and avatars for social proof
    let memberCount = 0;
    let memberAvatars: string[] = [];
    
    const memberCountResult = await adminDb
      .collection('squadMembers')
      .where('squadId', '==', squadId)
      .count()
      .get();
    memberCount = memberCountResult.data().count;
    
    if (squadData.showMemberCount && memberCount > 0) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const clerk = await clerkClient();
        
        const recentMembers = await adminDb
          .collection('squadMembers')
          .where('squadId', '==', squadId)
          .orderBy('createdAt', 'desc')
          .limit(3)
          .get();
        
        const userIds = recentMembers.docs.map(doc => doc.data().userId as string);
        const avatarPromises = userIds.map(async (uid) => {
          try {
            const user = await clerk.users.getUser(uid);
            return user.imageUrl || null;
          } catch {
            return null;
          }
        });
        
        const avatars = await Promise.all(avatarPromises);
        memberAvatars = avatars.filter((url): url is string => url !== null);
      } catch (err) {
        console.error('[DISCOVER_SQUAD_GET] Error fetching member avatars:', err);
      }
    }

    // Determine if user can join
    let canJoin = true;
    let cannotJoinReason: string | undefined;

    if (isMember) {
      canJoin = false;
      cannotJoinReason = 'Already a member of this squad';
    } else if (squadData.capacity && memberCount >= squadData.capacity) {
      canJoin = false;
      cannotJoinReason = 'Squad is full';
    }

    // Format the squad response
    const squad = {
      id: squadDoc.id,
      name: squadData.name,
      slug: squadData.slug,
      description: squadData.description,
      avatarUrl: squadData.avatarUrl,
      visibility: squadData.visibility,
      coachId: squadData.coachId,
      coachName,
      coachImageUrl,
      coachBio,
      // Pricing
      priceInCents: squadData.priceInCents || 0,
      currency: squadData.currency || 'usd',
      subscriptionEnabled: squadData.subscriptionEnabled || false,
      billingInterval: squadData.billingInterval,
      // Landing page content
      keyOutcomes: squadData.keyOutcomes || [],
      features: squadData.features || [],
      testimonials: squadData.testimonials || [],
      faqs: squadData.faqs || [],
      showMemberCount: squadData.showMemberCount,
    };

    // Get organization branding
    let branding = {
      accentLight: DEFAULT_BRANDING_COLORS.accentLight,
      accentDark: DEFAULT_BRANDING_COLORS.accentDark,
    };
    
    if (squadData.organizationId) {
      try {
        const brandingDoc = await adminDb
          .collection('org_branding')
          .doc(squadData.organizationId)
          .get();
        
        if (brandingDoc.exists) {
          const brandingData = brandingDoc.data() as OrgBranding;
          if (brandingData.colors) {
            branding = {
              accentLight: brandingData.colors.accentLight || DEFAULT_BRANDING_COLORS.accentLight,
              accentDark: brandingData.colors.accentDark || DEFAULT_BRANDING_COLORS.accentDark,
            };
          }
        }
      } catch (err) {
        console.error('[DISCOVER_SQUAD_GET] Error fetching branding:', err);
      }
    }

    return NextResponse.json({ 
      squad,
      memberCount: squadData.showMemberCount ? memberCount : undefined,
      memberAvatars: squadData.showMemberCount ? memberAvatars : undefined,
      isMember,
      membershipStatus: isMember ? membershipStatus : undefined,
      canJoin,
      cannotJoinReason,
      branding,
    });
  } catch (error) {
    console.error('[DISCOVER_SQUAD_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch squad' }, { status: 500 });
  }
}


