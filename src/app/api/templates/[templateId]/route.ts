/**
 * Public API: Single Template Detail
 * 
 * GET /api/templates/[templateId] - Get template with all days
 * 
 * Returns full template details including all template_days for preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramTemplate, TemplateDay } from '@/types';

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    
    console.log(`[TEMPLATE_DETAIL] Fetching template: ${templateId}`);
    
    // Get template document
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
    
    const templateData = templateDoc.data();
    
    // Only return published templates to public
    if (!templateData?.isPublished || templateData?.status !== 'published') {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }
    
    const template: ProgramTemplate = {
      id: templateDoc.id,
      ...templateData,
      createdAt: templateData.createdAt?.toDate?.()?.toISOString?.() || templateData.createdAt,
      updatedAt: templateData.updatedAt?.toDate?.()?.toISOString?.() || templateData.updatedAt,
    } as ProgramTemplate;
    
    // Get all template days ordered by dayIndex
    const daysSnapshot = await adminDb
      .collection('template_days')
      .where('templateId', '==', templateId)
      .orderBy('dayIndex', 'asc')
      .get();
    
    const days: TemplateDay[] = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TemplateDay));
    
    // Calculate total tasks
    const totalTasks = days.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
    const totalHabits = template.defaultHabits?.length || 0;
    
    console.log(`[TEMPLATE_DETAIL] Returning template ${template.name} with ${days.length} days, ${totalTasks} tasks`);
    
    return NextResponse.json({
      template,
      days,
      stats: {
        totalDays: days.length,
        totalTasks,
        totalHabits,
        suggestedPrice: template.suggestedPriceInCents,
      },
    });
    
  } catch (error) {
    console.error('[TEMPLATE_DETAIL] Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template details' },
      { status: 500 }
    );
  }
}

