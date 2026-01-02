/**
 * Coach API: Google Analytics Configuration
 * 
 * GET /api/coach/analytics/ga-config
 * Returns the current GA configuration for the org
 * 
 * POST /api/coach/analytics/ga-config
 * Updates GA configuration (measurement ID)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { ANALYTICS_COLLECTIONS } from '@/lib/analytics/constants';

// GA4 Measurement ID format: G-XXXXXXXXXX
const GA4_ID_REGEX = /^G-[A-Z0-9]{10}$/;

export async function GET(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const configDoc = await adminDb
      .collection(ANALYTICS_COLLECTIONS.gaConfig)
      .doc(organizationId)
      .get();

    if (!configDoc.exists) {
      return NextResponse.json({
        configured: false,
        measurementId: null,
      });
    }

    const data = configDoc.data();
    return NextResponse.json({
      configured: !!data?.measurementId,
      measurementId: data?.measurementId || null,
      updatedAt: data?.updatedAt || null,
    });
  } catch (error) {
    console.error('[GA_CONFIG_GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch GA config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { organizationId } = await requireCoachWithOrg();
    const body = await request.json();
    const { measurementId } = body;

    // Allow clearing the measurement ID
    if (measurementId === null || measurementId === '') {
      await adminDb
        .collection(ANALYTICS_COLLECTIONS.gaConfig)
        .doc(organizationId)
        .set({
          organizationId,
          measurementId: null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

      return NextResponse.json({
        success: true,
        configured: false,
        measurementId: null,
      });
    }

    // Validate format
    if (!GA4_ID_REGEX.test(measurementId)) {
      return NextResponse.json(
        { error: 'Invalid GA4 Measurement ID format. Should be like G-XXXXXXXXXX' },
        { status: 400 }
      );
    }

    // Save configuration
    await adminDb
      .collection(ANALYTICS_COLLECTIONS.gaConfig)
      .doc(organizationId)
      .set({
        organizationId,
        measurementId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

    return NextResponse.json({
      success: true,
      configured: true,
      measurementId,
    });
  } catch (error) {
    console.error('[GA_CONFIG_POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Failed to save GA config' }, { status: 500 });
  }
}








