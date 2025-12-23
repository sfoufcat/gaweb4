/**
 * Admin API: Program Templates Management
 * 
 * GET /api/admin/templates - List all templates (including pending)
 * POST /api/admin/templates - Create new platform template
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { ProgramTemplate, TemplateCategory, TemplateStatus } from '@/types';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as TemplateStatus | null;
    const category = searchParams.get('category') as TemplateCategory | null;
    
    console.log('[ADMIN_TEMPLATES] Fetching templates', { status, category });
    
    let query = adminDb.collection('program_templates').orderBy('createdAt', 'desc');
    
    // We'll filter in memory to avoid composite index requirements
    const snapshot = await query.get();
    
    let templates: ProgramTemplate[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
      } as ProgramTemplate;
    });
    
    // Apply filters
    if (status) {
      templates = templates.filter(t => t.status === status);
    }
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    // Group by status for admin view
    const grouped = {
      pending_review: templates.filter(t => t.status === 'pending_review'),
      published: templates.filter(t => t.status === 'published'),
      draft: templates.filter(t => t.status === 'draft'),
      rejected: templates.filter(t => t.status === 'rejected'),
    };
    
    console.log(`[ADMIN_TEMPLATES] Returning ${templates.length} templates`);
    
    return NextResponse.json({
      templates,
      grouped,
      counts: {
        total: templates.length,
        pending_review: grouped.pending_review.length,
        published: grouped.published.length,
        draft: grouped.draft.length,
        rejected: grouped.rejected.length,
      },
    });
    
  } catch (error) {
    console.error('[ADMIN_TEMPLATES] Error fetching templates:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    
    const {
      name,
      slug,
      description,
      previewDescription,
      coverImageUrl,
      category,
      tags,
      lengthDays,
      type,
      suggestedPriceInCents,
      defaultHabits,
      keyOutcomes,
      features,
      faqs,
      featured,
    } = body;
    
    // Validate required fields
    if (!name || !slug || !description || !previewDescription || !category || !lengthDays || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Check slug uniqueness
    const existingSlug = await adminDb
      .collection('program_templates')
      .where('slug', '==', slug)
      .limit(1)
      .get();
    
    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: 'A template with this slug already exists' },
        { status: 400 }
      );
    }
    
    const templateRef = adminDb.collection('program_templates').doc();
    const templateId = templateRef.id;
    const now = new Date().toISOString();
    
    const newTemplate: Omit<ProgramTemplate, 'id'> = {
      name,
      slug,
      description,
      previewDescription,
      coverImageUrl: coverImageUrl || null,
      category,
      tags: tags || [],
      lengthDays,
      type,
      suggestedPriceInCents: suggestedPriceInCents || 0,
      defaultHabits: defaultHabits || [],
      keyOutcomes: keyOutcomes || [],
      features: features || [],
      testimonials: [],
      faqs: faqs || [],
      showEnrollmentCount: true,
      showCurriculum: true,
      usageCount: 0,
      featured: featured || false,
      createdBy: 'platform',
      status: 'draft',
      isPublished: false,
      createdAt: now,
      updatedAt: now,
    };
    
    await templateRef.set({ id: templateId, ...newTemplate });
    
    console.log(`[ADMIN_TEMPLATES] Created template ${templateId}`);
    
    return NextResponse.json({
      success: true,
      template: { id: templateId, ...newTemplate },
    });
    
  } catch (error) {
    console.error('[ADMIN_TEMPLATES] Error creating template:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

