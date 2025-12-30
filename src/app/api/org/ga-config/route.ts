/**
 * Public API: Get GA Configuration for current org
 * 
 * GET /api/org/ga-config
 * Returns the GA measurement ID for the current organization (based on domain)
 * This is a public API - no auth required - as it only returns the measurement ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { ANALYTICS_COLLECTIONS } from '@/lib/analytics/constants';

export async function GET(request: NextRequest) {
  try {
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      return NextResponse.json({
        configured: false,
        measurementId: null,
      });
    }

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
    });
  } catch (error) {
    console.error('[GA_CONFIG_PUBLIC] Error:', error);
    return NextResponse.json({
      configured: false,
      measurementId: null,
    });
  }
}







