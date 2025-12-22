import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

/**
 * GET /api/admin/programs
 * 
 * Get all programs for the current organization.
 * Used by admin content forms for program selection.
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // MULTI-TENANCY: Get org from tenant domain (null on platform domain)
    const organizationId = await getEffectiveOrgId();

    if (!organizationId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 });
    }

    // Fetch all programs for this organization
    const programsSnapshot = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .orderBy('name', 'asc')
      .get();

    const programs = programsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      type: doc.data().type,
      slug: doc.data().slug,
    }));

    return NextResponse.json({
      success: true,
      programs,
    });
  } catch (error) {
    console.error('[API_ADMIN_PROGRAMS_GET_ERROR]', error);
    
    // Handle missing index gracefully
    if (error instanceof Error && error.message.includes('index')) {
      return NextResponse.json({
        success: true,
        programs: [],
      });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

