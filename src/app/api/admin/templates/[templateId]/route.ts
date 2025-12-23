/**
 * Admin API: Single Template Management
 * 
 * GET /api/admin/templates/[templateId] - Get template with all details
 * PUT /api/admin/templates/[templateId] - Update template (edit, approve, reject, publish)
 * DELETE /api/admin/templates/[templateId] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { ProgramTemplate, TemplateDay, TemplateStatus } from '@/types';

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAdmin();
    
    const { templateId } = await params;
    
    console.log(`[ADMIN_TEMPLATE] Fetching template: ${templateId}`);
    
    const templateDoc = await adminDb
      .collection('program_templates')
      .doc(templateId)
      .get();
    
    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    const templateData = templateDoc.data();
    const template: ProgramTemplate = {
      id: templateDoc.id,
      ...templateData,
      createdAt: templateData?.createdAt?.toDate?.()?.toISOString?.() || templateData?.createdAt,
      updatedAt: templateData?.updatedAt?.toDate?.()?.toISOString?.() || templateData?.updatedAt,
    } as ProgramTemplate;
    
    // Get all days
    const daysSnapshot = await adminDb
      .collection('template_days')
      .where('templateId', '==', templateId)
      .orderBy('dayIndex', 'asc')
      .get();
    
    const days: TemplateDay[] = daysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as TemplateDay));
    
    // Calculate stats
    const totalTasks = days.reduce((sum, day) => sum + (day.tasks?.length || 0), 0);
    
    return NextResponse.json({
      template,
      days,
      stats: {
        totalDays: days.length,
        totalTasks,
        totalHabits: template.defaultHabits?.length || 0,
      },
    });
    
  } catch (error) {
    console.error('[ADMIN_TEMPLATE] Error fetching template:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAdmin();
    
    const { templateId } = await params;
    const body = await request.json();
    
    console.log(`[ADMIN_TEMPLATE] Updating template: ${templateId}`, body);
    
    const templateRef = adminDb.collection('program_templates').doc(templateId);
    const templateDoc = await templateRef.get();
    
    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    const currentData = templateDoc.data() as ProgramTemplate;
    const now = new Date().toISOString();
    
    // Handle status changes
    const { action, ...updateData } = body;
    
    let updates: Partial<ProgramTemplate> = {
      ...updateData,
      updatedAt: now,
    };
    
    // Special actions
    if (action === 'approve') {
      updates.status = 'published';
      updates.isPublished = true;
    } else if (action === 'reject') {
      updates.status = 'rejected';
      updates.isPublished = false;
    } else if (action === 'publish') {
      updates.status = 'published';
      updates.isPublished = true;
    } else if (action === 'unpublish') {
      updates.isPublished = false;
    } else if (action === 'feature') {
      updates.featured = true;
    } else if (action === 'unfeature') {
      updates.featured = false;
    }
    
    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates];
      }
    });
    
    await templateRef.update(updates);
    
    console.log(`[ADMIN_TEMPLATE] Updated template ${templateId}`, { action, updates });
    
    return NextResponse.json({
      success: true,
      template: { id: templateId, ...currentData, ...updates },
    });
    
  } catch (error) {
    console.error('[ADMIN_TEMPLATE] Error updating template:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireAdmin();
    
    const { templateId } = await params;
    
    console.log(`[ADMIN_TEMPLATE] Deleting template: ${templateId}`);
    
    const templateRef = adminDb.collection('program_templates').doc(templateId);
    const templateDoc = await templateRef.get();
    
    if (!templateDoc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    
    // Delete all template days
    const daysSnapshot = await adminDb
      .collection('template_days')
      .where('templateId', '==', templateId)
      .get();
    
    const batch = adminDb.batch();
    
    daysSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    batch.delete(templateRef);
    
    await batch.commit();
    
    console.log(`[ADMIN_TEMPLATE] Deleted template ${templateId} with ${daysSnapshot.size} days`);
    
    return NextResponse.json({
      success: true,
      message: `Template and ${daysSnapshot.size} days deleted`,
    });
    
  } catch (error) {
    console.error('[ADMIN_TEMPLATE] Error deleting template:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}

