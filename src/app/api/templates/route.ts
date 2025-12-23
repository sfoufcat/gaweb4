/**
 * Public API: Program Templates
 * 
 * GET /api/templates - List published templates for gallery
 * 
 * Supports filtering by:
 * - category: 'business' | 'habits' | 'mindset' | 'health' | 'productivity' | 'relationships'
 * - duration: 'short' (7-14 days), 'medium' (21-30 days), 'long' (60+ days)
 * - search: text search on name/description
 * - featured: 'true' to show only featured templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ProgramTemplate, TemplateCategory } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query params
    const category = searchParams.get('category') as TemplateCategory | null;
    const duration = searchParams.get('duration') as 'short' | 'medium' | 'long' | null;
    const search = searchParams.get('search')?.toLowerCase();
    const featuredOnly = searchParams.get('featured') === 'true';
    
    console.log('[TEMPLATES_API] Fetching templates with filters:', { category, duration, search, featuredOnly });
    
    // Build base query - only published templates
    let query = adminDb
      .collection('program_templates')
      .where('isPublished', '==', true)
      .where('status', '==', 'published');
    
    // Add category filter if specified
    if (category) {
      query = query.where('category', '==', category);
    }
    
    // Add featured filter if specified
    if (featuredOnly) {
      query = query.where('featured', '==', true);
    }
    
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
    
    // Apply duration filter in memory (to avoid composite index)
    if (duration) {
      templates = templates.filter(t => {
        switch (duration) {
          case 'short': return t.lengthDays >= 7 && t.lengthDays <= 14;
          case 'medium': return t.lengthDays >= 21 && t.lengthDays <= 30;
          case 'long': return t.lengthDays >= 60;
          default: return true;
        }
      });
    }
    
    // Apply search filter in memory
    if (search) {
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search) ||
        t.previewDescription.toLowerCase().includes(search) ||
        t.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }
    
    // Sort: featured first, then by usage count
    templates.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.usageCount - a.usageCount;
    });
    
    // Calculate total tasks for each template (lightweight - just count from template metadata)
    // Note: Actual task count would require reading template_days, but we'll add that to ProgramTemplate later
    
    console.log(`[TEMPLATES_API] Returning ${templates.length} templates`);
    
    return NextResponse.json({
      templates,
      count: templates.length,
    });
    
  } catch (error) {
    console.error('[TEMPLATES_API] Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

