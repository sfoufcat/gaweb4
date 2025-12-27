/**
 * Coach API: Organization Article Categories Management
 * 
 * GET /api/coach/org-article-categories - List article categories for the organization
 * POST /api/coach/org-article-categories - Add a new category to the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * GET /api/coach/org-article-categories
 * Returns the list of article categories for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[ORG_ARTICLE_CATEGORIES] Fetching categories for organization: ${organizationId}`);

    // Get org settings document
    const settingsDoc = await adminDb
      .collection('org_settings')
      .doc(organizationId)
      .get();

    const categories: string[] = settingsDoc.exists
      ? (settingsDoc.data()?.articleCategories || [])
      : [];

    return NextResponse.json({
      categories,
      organizationId,
    });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }

    console.error('[ORG_ARTICLE_CATEGORIES_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

/**
 * POST /api/coach/org-article-categories
 * Adds a new category to the organization's article categories
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await request.json();
    const { category } = body;

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const trimmedCategory = category.trim();

    // Validate category length
    if (trimmedCategory.length > 50) {
      return NextResponse.json(
        { error: 'Category name must be 50 characters or less' },
        { status: 400 }
      );
    }

    console.log(`[ORG_ARTICLE_CATEGORIES] Adding category "${trimmedCategory}" for organization: ${organizationId}`);

    const settingsRef = adminDb.collection('org_settings').doc(organizationId);
    const settingsDoc = await settingsRef.get();

    let categories: string[] = [];

    if (settingsDoc.exists) {
      categories = settingsDoc.data()?.articleCategories || [];
      
      // Check if category already exists (case-insensitive)
      const existingCategory = categories.find(
        c => c.toLowerCase() === trimmedCategory.toLowerCase()
      );
      
      if (existingCategory) {
        return NextResponse.json(
          { error: 'Category already exists', categories },
          { status: 400 }
        );
      }

      // Add new category
      await settingsRef.update({
        articleCategories: FieldValue.arrayUnion(trimmedCategory),
        updatedAt: new Date().toISOString(),
      });
      
      categories = [...categories, trimmedCategory];
    } else {
      // Create org_settings document if it doesn't exist
      await settingsRef.set({
        id: organizationId,
        organizationId,
        articleCategories: [trimmedCategory],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Default settings
        billingMode: 'platform',
        allowExternalBilling: true,
        defaultTrack: null,
        stripeConnectAccountId: null,
        stripeConnectStatus: 'not_connected',
        platformFeePercent: 1,
        requireApproval: false,
        autoJoinSquadId: null,
        welcomeMessage: null,
        feedEnabled: false,
      });
      
      categories = [trimmedCategory];
    }

    console.log(`[ORG_ARTICLE_CATEGORIES] Added category "${trimmedCategory}". Total categories: ${categories.length}`);

    return NextResponse.json({
      success: true,
      category: trimmedCategory,
      categories,
      organizationId,
    }, { status: 201 });
  } catch (error) {
    // Handle tenant required error
    if (error instanceof TenantRequiredError) {
      return NextResponse.json({
        error: 'tenant_required',
        message: 'Please access this feature from your organization domain',
        tenantUrl: error.tenantUrl,
        subdomain: error.subdomain,
      }, { status: 403 });
    }

    console.error('[ORG_ARTICLE_CATEGORIES_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}


