import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Funnel, FunnelStep, Program } from '@/types';

/**
 * GET /api/funnel/by-program
 * Get funnel by program slug and optional funnel slug
 * 
 * Query params:
 * - programSlug: string (required) - Program slug
 * - funnelSlug?: string (optional) - Specific funnel slug, otherwise returns default
 * - organizationId?: string (optional) - Filter by organization
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const programSlug = searchParams.get('programSlug');
    const funnelSlug = searchParams.get('funnelSlug');
    const organizationId = searchParams.get('organizationId');

    if (!programSlug) {
      return NextResponse.json(
        { error: 'Program slug is required' },
        { status: 400 }
      );
    }

    // Find program by slug
    let programQuery = adminDb.collection('programs').where('slug', '==', programSlug);
    
    if (organizationId) {
      programQuery = programQuery.where('organizationId', '==', organizationId);
    }

    const programsSnapshot = await programQuery.limit(1).get();

    if (programsSnapshot.empty) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const programDoc = programsSnapshot.docs[0];
    const program = { id: programDoc.id, ...programDoc.data() } as Program;

    // Find funnel
    let funnelQuery = adminDb
      .collection('funnels')
      .where('programId', '==', program.id)
      .where('isActive', '==', true);

    if (funnelSlug) {
      funnelQuery = funnelQuery.where('slug', '==', funnelSlug);
    } else {
      // Get default funnel
      funnelQuery = funnelQuery.where('isDefault', '==', true);
    }

    const funnelsSnapshot = await funnelQuery.limit(1).get();

    if (funnelsSnapshot.empty) {
      // If no default found and no specific slug, get any active funnel
      if (!funnelSlug) {
        const anyFunnelSnapshot = await adminDb
          .collection('funnels')
          .where('programId', '==', program.id)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (anyFunnelSnapshot.empty) {
          return NextResponse.json(
            { error: 'No active funnel found for this program' },
            { status: 404 }
          );
        }

        const funnelDoc = anyFunnelSnapshot.docs[0];
        const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

        // Get steps
        const stepsSnapshot = await adminDb
          .collection('funnels')
          .doc(funnel.id)
          .collection('steps')
          .orderBy('order', 'asc')
          .get();

        const steps: FunnelStep[] = stepsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as FunnelStep[];

        return NextResponse.json({
          funnel,
          steps,
          program: {
            id: program.id,
            name: program.name,
            slug: program.slug,
            description: program.description,
            coverImageUrl: program.coverImageUrl,
            type: program.type,
            lengthDays: program.lengthDays,
            priceInCents: program.priceInCents,
            currency: program.currency,
            stripePriceId: program.stripePriceId,
          },
        });
      }

      return NextResponse.json(
        { error: 'Funnel not found' },
        { status: 404 }
      );
    }

    const funnelDoc = funnelsSnapshot.docs[0];
    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    // Get funnel steps
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnel.id)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps: FunnelStep[] = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];

    return NextResponse.json({
      funnel,
      steps,
      program: {
        id: program.id,
        name: program.name,
        slug: program.slug,
        description: program.description,
        coverImageUrl: program.coverImageUrl,
        type: program.type,
        lengthDays: program.lengthDays,
        priceInCents: program.priceInCents,
        currency: program.currency,
        stripePriceId: program.stripePriceId,
      },
    });
  } catch (error) {
    console.error('[FUNNEL_BY_PROGRAM_GET]', error);
    return NextResponse.json(
      { error: 'Failed to get funnel' },
      { status: 500 }
    );
  }
}

