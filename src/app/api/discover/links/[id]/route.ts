/**
 * API Route: Get Single Link
 * 
 * GET /api/discover/links/[id] - Get link by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { DiscoverLink } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId } = await auth();

    // Get link
    const linkDoc = await adminDb.collection('program_links').doc(id).get();

    if (!linkDoc.exists) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const data = linkDoc.data();
    
    // Get coach info if organizationId exists
    let coachName: string | undefined;
    let coachImageUrl: string | undefined;
    
    if (data?.organizationId) {
      const orgSettingsDoc = await adminDb
        .collection('org_settings')
        .doc(data.organizationId)
        .get();
      
      if (orgSettingsDoc.exists) {
        const orgSettings = orgSettingsDoc.data();
        coachName = orgSettings?.coachDisplayName;
        coachImageUrl = orgSettings?.coachAvatarUrl;
      }
    }

    const link: DiscoverLink = {
      id: linkDoc.id,
      title: data?.title,
      description: data?.description,
      url: data?.url,
      thumbnailUrl: data?.thumbnailUrl,
      programIds: data?.programIds,
      organizationId: data?.organizationId,
      order: data?.order,
      createdAt: data?.createdAt?.toDate?.()?.toISOString?.() || data?.createdAt || new Date().toISOString(),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString?.() || data?.updatedAt || new Date().toISOString(),
      priceInCents: data?.priceInCents,
      currency: data?.currency,
      purchaseType: data?.purchaseType,
      isPublic: data?.isPublic,
      keyOutcomes: data?.keyOutcomes,
      features: data?.features,
      testimonials: data?.testimonials,
      faqs: data?.faqs,
      coachName,
      coachImageUrl,
    };

    // Check ownership if user is signed in
    let isOwned = false;
    let includedInProgramName: string | undefined;

    if (userId) {
      // Check direct purchase
      const purchaseSnapshot = await adminDb
        .collection('user_content_purchases')
        .where('userId', '==', userId)
        .where('contentType', '==', 'link')
        .where('contentId', '==', id)
        .limit(1)
        .get();

      if (!purchaseSnapshot.empty) {
        isOwned = true;
        const purchase = purchaseSnapshot.docs[0].data();
        includedInProgramName = purchase.includedInProgramName;
      }

      // Check if included in an enrolled program
      if (!isOwned && link.programIds && link.programIds.length > 0) {
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', 'in', link.programIds)
          .where('status', 'in', ['active', 'upcoming', 'completed'])
          .limit(1)
          .get();

        if (!enrollmentSnapshot.empty) {
          isOwned = true;
          const enrollment = enrollmentSnapshot.docs[0].data();
          
          // Get program name
          const programDoc = await adminDb.collection('programs').doc(enrollment.programId).get();
          if (programDoc.exists) {
            includedInProgramName = programDoc.data()?.name;
          }
        }
      }
    }

    return NextResponse.json({
      link,
      isOwned,
      includedInProgramName,
    });

  } catch (error) {
    console.error('[DISCOVER_LINK_DETAIL] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch link' },
      { status: 500 }
    );
  }
}

