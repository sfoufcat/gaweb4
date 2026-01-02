/**
 * API Route: Get Discover Categories
 * 
 * GET /api/discover/categories - Get coach-defined categories for the organization
 * 
 * Categories are created by coaches via the article creation form and stored
 * in org_settings.articleCategories. This replaces the old hardcoded
 * discoverCategories collection.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { isDemoRequest, demoResponse } from '@/lib/demo-api';

export async function GET() {
  try {
    // Demo mode: return demo categories
    const isDemo = await isDemoRequest();
    if (isDemo) {
      return demoResponse({
        categories: [
          { id: 'productivity', name: 'Productivity' },
          { id: 'mindset', name: 'Mindset' },
          { id: 'habits', name: 'Habits' },
          { id: 'success', name: 'Success' },
        ],
      });
    }
    
    // Get the user's organization ID
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      // No organization context - return empty categories
      return NextResponse.json({ categories: [] });
    }

    // Fetch articleCategories from org_settings
    const settingsDoc = await adminDb
      .collection('org_settings')
      .doc(organizationId)
      .get();

    const articleCategories: string[] = settingsDoc.exists
      ? (settingsDoc.data()?.articleCategories || [])
      : [];

    // Transform to DiscoverCategory format
    // Use a slugified version of the name as the ID for URL-friendliness
    const categories = articleCategories.map((name: string) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name,
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[DISCOVER_CATEGORIES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', categories: [] },
      { status: 500 }
    );
  }
}











