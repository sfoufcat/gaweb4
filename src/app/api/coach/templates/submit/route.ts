/**
 * Coach API: Submit Program as Template
 * 
 * POST /api/coach/templates/submit - Submit an existing program as a template for review
 * 
 * Copies program + days to template collections with status: 'pending_review'
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { currentUser } from '@clerk/nextjs/server';
import type { Program, ProgramDay, ProgramTemplate, TemplateDay, TemplateCategory } from '@/types';

interface SubmitRequest {
  programId: string;
  category: TemplateCategory;
  tags: string[];
  previewDescription: string;
  suggestedPriceInCents?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const user = await currentUser();
    const body: SubmitRequest = await request.json();
    
    const {
      programId,
      category,
      tags,
      previewDescription,
      suggestedPriceInCents,
    } = body;
    
    // Validate required fields
    if (!programId || !category || !previewDescription) {
      return NextResponse.json(
        { error: 'programId, category, and previewDescription are required' },
        { status: 400 }
      );
    }
    
    console.log(`[SUBMIT_TEMPLATE] User ${userId} submitting program ${programId} as template`);
    
    // 1. Fetch the program
    const programDoc = await adminDb
      .collection('programs')
      .doc(programId)
      .get();
    
    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }
    
    const program = programDoc.data() as Program;
    
    // Verify ownership
    if (program.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'You can only submit your own programs' },
        { status: 403 }
      );
    }
    
    // 2. Fetch program days
    const daysSnapshot = await adminDb
      .collection('program_days')
      .where('programId', '==', programId)
      .orderBy('dayIndex', 'asc')
      .get();
    
    const programDays = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ProgramDay));
    
    // Validate program has content
    if (programDays.length < 7) {
      return NextResponse.json(
        { error: 'Program must have at least 7 days of content to be submitted as a template' },
        { status: 400 }
      );
    }
    
    const totalTasks = programDays.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
    if (totalTasks < 20) {
      return NextResponse.json(
        { error: 'Program must have at least 20 tasks to be submitted as a template' },
        { status: 400 }
      );
    }
    
    // 3. Check if program was already submitted
    const existingSubmission = await adminDb
      .collection('program_templates')
      .where('sourceOrganizationId', '==', organizationId)
      .where('sourceProgramId', '==', programId)
      .limit(1)
      .get();
    
    if (!existingSubmission.empty) {
      const existing = existingSubmission.docs[0].data();
      return NextResponse.json(
        { error: `This program was already submitted as a template (status: ${existing.status})` },
        { status: 400 }
      );
    }
    
    // 4. Create template document
    const templateRef = adminDb.collection('program_templates').doc();
    const templateId = templateRef.id;
    const now = new Date().toISOString();
    
    // Generate a unique slug
    const baseSlug = program.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40);
    const slug = `${baseSlug}-${templateId.slice(0, 6)}`;
    
    const creatorName = user 
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses?.[0]?.emailAddress?.split('@')[0] || 'Coach'
      : 'Coach';
    
    const newTemplate: Omit<ProgramTemplate, 'id'> & { sourceProgramId: string } = {
      name: program.name,
      slug,
      description: program.description,
      previewDescription,
      coverImageUrl: program.coverImageUrl,
      category,
      tags: tags || [],
      lengthDays: program.lengthDays,
      type: program.type,
      suggestedPriceInCents: suggestedPriceInCents ?? program.priceInCents,
      defaultHabits: program.defaultHabits || [],
      
      // Copy landing page content
      keyOutcomes: program.keyOutcomes,
      features: program.features,
      testimonials: [], // Don't copy testimonials - they should be replaced
      faqs: program.faqs,
      showEnrollmentCount: program.showEnrollmentCount,
      showCurriculum: program.showCurriculum,
      
      // Engagement
      usageCount: 0,
      featured: false,
      
      // Source
      createdBy: userId,
      creatorName,
      sourceOrganizationId: organizationId,
      sourceProgramId: programId,
      
      // Status
      status: 'pending_review',
      isPublished: false,
      
      createdAt: now,
      updatedAt: now,
    };
    
    await templateRef.set({ id: templateId, ...newTemplate });
    
    // 5. Copy all days
    const batch = adminDb.batch();
    
    for (const day of programDays) {
      const dayRef = adminDb.collection('template_days').doc();
      
      const templateDay: Omit<TemplateDay, 'id'> = {
        templateId,
        dayIndex: day.dayIndex,
        title: day.title,
        summary: day.summary,
        dailyPrompt: day.dailyPrompt,
        tasks: day.tasks || [],
        habits: day.habits || [],
      };
      
      batch.set(dayRef, { id: dayRef.id, ...templateDay });
    }
    
    await batch.commit();
    
    console.log(`[SUBMIT_TEMPLATE] Successfully submitted program ${programId} as template ${templateId}`);
    
    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        name: newTemplate.name,
        status: 'pending_review',
      },
      message: 'Your program has been submitted for review. We\'ll notify you once it\'s approved.',
    });
    
  } catch (error) {
    console.error('[SUBMIT_TEMPLATE] Error submitting template:', error);
    
    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (error instanceof Error && error.message.includes('coach role')) {
      return NextResponse.json(
        { error: 'Coach role required' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to submit template' },
      { status: 500 }
    );
  }
}

