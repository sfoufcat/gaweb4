/**
 * API Route: Platform Settings Management
 * 
 * GET /api/admin/platform-settings - Get global platform settings
 * POST /api/admin/platform-settings - Update platform settings
 * 
 * Only accessible by super_admin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ClerkPublicMetadata, PlatformSettings } from '@/types';

const PLATFORM_SETTINGS_DOC_ID = 'global';

/**
 * Default platform settings
 */
const DEFAULT_SETTINGS: PlatformSettings = {
  id: 'global',
  marketplaceDecoysEnabled: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

// =============================================================================
// GET - Get platform settings
// =============================================================================

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check super_admin access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    // Fetch platform settings
    const settingsDoc = await adminDb
      .collection('platform_settings')
      .doc(PLATFORM_SETTINGS_DOC_ID)
      .get();

    if (!settingsDoc.exists) {
      // Return default settings if not found
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    const settings = settingsDoc.data() as PlatformSettings;

    return NextResponse.json({ settings });

  } catch (error) {
    console.error('[PLATFORM_SETTINGS_GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform settings' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Update platform settings
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check super_admin access
    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata;
    const role = publicMetadata?.role;
    
    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { marketplaceDecoysEnabled } = body;

    const now = new Date().toISOString();

    // Get existing settings or use defaults
    const settingsDoc = await adminDb
      .collection('platform_settings')
      .doc(PLATFORM_SETTINGS_DOC_ID)
      .get();

    const existingSettings = settingsDoc.exists 
      ? (settingsDoc.data() as PlatformSettings)
      : DEFAULT_SETTINGS;

    // Update settings (only update provided fields)
    const updatedSettings: PlatformSettings = {
      ...existingSettings,
      id: 'global',
      updatedAt: now,
      updatedBy: userId,
    };

    // Update marketplace decoys toggle if provided
    if (typeof marketplaceDecoysEnabled === 'boolean') {
      updatedSettings.marketplaceDecoysEnabled = marketplaceDecoysEnabled;
    }

    // Save to Firestore
    await adminDb
      .collection('platform_settings')
      .doc(PLATFORM_SETTINGS_DOC_ID)
      .set(updatedSettings, { merge: true });

    console.log(`[PLATFORM_SETTINGS_POST] Super admin ${userId} updated settings:`, {
      marketplaceDecoysEnabled: updatedSettings.marketplaceDecoysEnabled,
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });

  } catch (error) {
    console.error('[PLATFORM_SETTINGS_POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings' },
      { status: 500 }
    );
  }
}

