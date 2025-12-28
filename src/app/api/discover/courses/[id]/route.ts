/**
 * API Route: Get Single Course
 * 
 * GET /api/discover/courses/[id] - Get course by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import type { DiscoverCourse } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    const courseDoc = await adminDb.collection('courses').doc(id).get();
    
    if (!courseDoc.exists) {
      return NextResponse.json(
        { error: 'Course not found' },
        { status: 404 }
      );
    }

    const courseData = courseDoc.data();
    
    // Get coach info if organizationId exists
    let coachName: string | undefined;
    let coachImageUrl: string | undefined;
    
    if (courseData?.organizationId) {
      const orgSettingsDoc = await adminDb
        .collection('org_settings')
        .doc(courseData.organizationId)
        .get();
      
      if (orgSettingsDoc.exists) {
        const orgSettings = orgSettingsDoc.data();
        coachName = orgSettings?.coachDisplayName;
        coachImageUrl = orgSettings?.coachAvatarUrl;
      }
    }

    const course: DiscoverCourse & { coachName?: string; coachImageUrl?: string } = {
      id: courseDoc.id,
      title: courseData?.title,
      shortDescription: courseData?.shortDescription,
      longDescription: courseData?.longDescription,
      coverImageUrl: courseData?.coverImageUrl,
      category: courseData?.category,
      level: courseData?.level,
      modules: courseData?.modules || [],
      featured: courseData?.featured,
      trending: courseData?.trending,
      organizationId: courseData?.organizationId,
      programIds: courseData?.programIds,
      // Pricing
      priceInCents: courseData?.priceInCents,
      currency: courseData?.currency,
      purchaseType: courseData?.purchaseType,
      isPublic: courseData?.isPublic,
      keyOutcomes: courseData?.keyOutcomes,
      features: courseData?.features,
      testimonials: courseData?.testimonials,
      faqs: courseData?.faqs,
      createdAt: courseData?.createdAt?.toDate?.()?.toISOString?.() || courseData?.createdAt,
      updatedAt: courseData?.updatedAt?.toDate?.()?.toISOString?.() || courseData?.updatedAt,
      // Coach info
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
        .where('contentType', '==', 'course')
        .where('contentId', '==', id)
        .limit(1)
        .get();

      if (!purchaseSnapshot.empty) {
        isOwned = true;
        const purchase = purchaseSnapshot.docs[0].data();
        includedInProgramName = purchase.includedInProgramName;
      }

      // Check if included in an enrolled program
      if (!isOwned && course.programIds && course.programIds.length > 0) {
        const enrollmentSnapshot = await adminDb
          .collection('program_enrollments')
          .where('userId', '==', userId)
          .where('programId', 'in', course.programIds)
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
      course,
      isOwned,
      includedInProgramName,
    });
  } catch (error) {
    console.error('[DISCOVER_COURSE_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}











