/**
 * API Route: Get Single Course
 * 
 * GET /api/discover/courses/[id] - Get course by ID with ownership status
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { auth } from '@clerk/nextjs/server';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';
import { generateDemoDiscoverContent, generateAvatarUrl } from '@/lib/demo-data';
import type { DiscoverCourse } from '@/types/discover';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Demo mode: return demo course
    const isDemo = await isDemoRequest();
    if (isDemo) {
      const content = generateDemoDiscoverContent();
      const courses = content.filter(item => item.type === 'course');
      const course = courses.find(c => c.id === id) || courses[0];
      
      return demoResponse({
        course: {
          id: course.id,
          title: course.title,
          shortDescription: course.description,
          longDescription: `${course.description} This comprehensive course will guide you through proven strategies and techniques to achieve your goals. Learn at your own pace with our structured modules and practical exercises.`,
          coverImageUrl: course.imageUrl,
          category: 'growth',
          level: 'intermediate',
          modules: [
            {
              id: `${course.id}-mod-1`,
              title: 'Introduction',
              order: 0,
              lessons: [
                { id: `${course.id}-lesson-1`, title: 'Welcome to the course', durationMinutes: 5, order: 0, videoUrl: null, content: 'Welcome content here' },
                { id: `${course.id}-lesson-2`, title: 'How to get the most out of this course', durationMinutes: 10, order: 1, videoUrl: null, content: 'Getting started content' },
              ],
            },
            {
              id: `${course.id}-mod-2`,
              title: 'Core Concepts',
              order: 1,
              lessons: [
                { id: `${course.id}-lesson-3`, title: 'Key principles', durationMinutes: 15, order: 0, videoUrl: null, content: 'Key principles explained' },
                { id: `${course.id}-lesson-4`, title: 'Practical applications', durationMinutes: 20, order: 1, videoUrl: null, content: 'Practical examples' },
              ],
            },
            {
              id: `${course.id}-mod-3`,
              title: 'Advanced Techniques',
              order: 2,
              lessons: [
                { id: `${course.id}-lesson-5`, title: 'Taking it further', durationMinutes: 15, order: 0, videoUrl: null, content: 'Advanced content' },
                { id: `${course.id}-lesson-6`, title: 'Final project', durationMinutes: 30, order: 1, videoUrl: null, content: 'Your final project' },
              ],
            },
          ],
          featured: false,
          trending: true,
          organizationId: 'demo-org',
          priceInCents: course.priceInCents || (course.isPremium ? 9900 : 0),
          currency: 'usd',
          purchaseType: 'one_time',
          isPublic: !course.isPremium,
          keyOutcomes: [
            'Master the core concepts',
            'Apply practical techniques',
            'Build lasting habits',
          ],
          features: [
            { icon: 'video', title: 'Video Lessons', description: '6 high-quality video lessons' },
            { icon: 'book', title: 'Workbooks', description: 'Downloadable worksheets' },
            { icon: 'users', title: 'Community Access', description: 'Connect with fellow learners' },
          ],
          createdAt: course.publishedAt,
          updatedAt: course.publishedAt,
          coachName: 'Coach Adam',
          coachImageUrl: generateAvatarUrl('Coach Adam'),
        },
        // For premium paid courses, show as not owned so purchase flow can be displayed
        isOwned: !course.isPremium,
      });
    }
    
    const { userId } = await auth();
    
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











