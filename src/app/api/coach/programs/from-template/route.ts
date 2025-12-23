/**
 * Coach API: Clone Program from Template
 * 
 * POST /api/coach/programs/from-template - Clone a template into coach's organization
 * 
 * Creates a new program with all days copied from the template
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';
import type { ProgramTemplate, TemplateDay, Program, ProgramDay } from '@/types';

interface CloneRequest {
  templateId: string;
  name: string;
  slug: string;
  priceInCents?: number;
  description?: string;
  copyHabits?: boolean;
  copyCoverImage?: boolean;
  copyLandingPage?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body: CloneRequest = await request.json();
    
    const {
      templateId,
      name,
      slug,
      priceInCents,
      description,
      copyHabits = true,
      copyCoverImage = true,
      copyLandingPage = true,
    } = body;
    
    // Validate required fields
    if (!templateId || !name || !slug) {
      return NextResponse.json(
        { error: 'templateId, name, and slug are required' },
        { status: 400 }
      );
    }
    
    console.log(`[CLONE_TEMPLATE] User ${userId} cloning template ${templateId} for org ${organizationId}`);
    
    // 1. Fetch template
    const templateDoc = await adminDb
      .collection('program_templates')
      .doc(templateId)
      .get();
    
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    const template = templateDoc.data() as ProgramTemplate;
    
    // Verify template is published
    if (!template.isPublished || template.status !== 'published') {
      return NextResponse.json(
        { error: 'Template is not available' },
        { status: 400 }
      );
    }
    
    // 2. Check if slug is already used in this org
    const existingProgram = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (!existingProgram.empty) {
      return NextResponse.json(
        { error: 'A program with this URL slug already exists' },
        { status: 400 }
      );
    }
    
    // 3. Fetch template days
    const templateDaysSnapshot = await adminDb
      .collection('template_days')
      .where('templateId', '==', templateId)
      .orderBy('dayIndex', 'asc')
      .get();
    
    const templateDays = templateDaysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TemplateDay));
    
    // 4. Create new program
    const programRef = adminDb.collection('programs').doc();
    const programId = programRef.id;
    const now = new Date().toISOString();
    
    const newProgram: Omit<Program, 'id'> & { clonedFromTemplateId: string } = {
      organizationId,
      name,
      slug,
      description: description || template.description,
      coverImageUrl: copyCoverImage ? template.coverImageUrl : undefined,
      type: template.type,
      lengthDays: template.lengthDays,
      priceInCents: priceInCents ?? template.suggestedPriceInCents,
      currency: 'usd',
      defaultHabits: copyHabits ? template.defaultHabits : [],
      isActive: true,
      isPublished: false, // Coach can publish when ready
      clonedFromTemplateId: templateId, // Track origin
      createdAt: now,
      updatedAt: now,
      // Copy landing page content if requested
      ...(copyLandingPage ? {
        keyOutcomes: template.keyOutcomes,
        features: template.features,
        testimonials: template.testimonials,
        faqs: template.faqs,
        showEnrollmentCount: template.showEnrollmentCount,
        showCurriculum: template.showCurriculum,
      } : {}),
    };
    
    await programRef.set(newProgram);
    
    // 5. Copy all days using batch write
    const batch = adminDb.batch();
    
    for (const templateDay of templateDays) {
      const dayRef = adminDb.collection('program_days').doc();
      
      const newDay: Omit<ProgramDay, 'id'> = {
        programId,
        dayIndex: templateDay.dayIndex,
        title: templateDay.title,
        summary: templateDay.summary,
        dailyPrompt: templateDay.dailyPrompt,
        tasks: templateDay.tasks || [],
        habits: templateDay.habits || [],
        createdAt: now,
        updatedAt: now,
      };
      
      batch.set(dayRef, { id: dayRef.id, ...newDay });
    }
    
    await batch.commit();
    
    // 6. Increment template usage count
    await adminDb
      .collection('program_templates')
      .doc(templateId)
      .update({
        usageCount: FieldValue.increment(1),
      });
    
    console.log(`[CLONE_TEMPLATE] Successfully cloned template ${templateId} to program ${programId} with ${templateDays.length} days`);
    
    return NextResponse.json({
      success: true,
      program: {
        id: programId,
        name,
        slug,
        lengthDays: template.lengthDays,
        daysCreated: templateDays.length,
      },
    });
    
  } catch (error) {
    console.error('[CLONE_TEMPLATE] Error cloning template:', error);
    
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
      { error: 'Failed to clone template' },
      { status: 500 }
    );
  }
}

