import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Funnel, FunnelStep, Program } from '@/types';

/**
 * GET /api/funnel/[funnelId]
 * Get funnel details with steps and program info
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ funnelId: string }> }
) {
  try {
    const { funnelId } = await params;

    if (!funnelId) {
      return NextResponse.json(
        { error: 'Funnel ID is required' },
        { status: 400 }
      );
    }

    // Get funnel
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();

    if (!funnelDoc.exists) {
      return NextResponse.json(
        { error: 'Funnel not found' },
        { status: 404 }
      );
    }

    const funnel = { id: funnelDoc.id, ...funnelDoc.data() } as Funnel;

    // Get funnel steps
    const stepsSnapshot = await adminDb
      .collection('funnels')
      .doc(funnelId)
      .collection('steps')
      .orderBy('order', 'asc')
      .get();

    const steps: FunnelStep[] = stepsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as FunnelStep[];

    // Get program info
    let program: Partial<Program> | null = null;
    if (funnel.programId) {
      const programDoc = await adminDb.collection('programs').doc(funnel.programId).get();
      if (programDoc.exists) {
        const programData = programDoc.data() as Program;
        program = {
          id: programDoc.id,
          name: programData.name,
          slug: programData.slug,
          description: programData.description,
          coverImageUrl: programData.coverImageUrl,
          type: programData.type,
          lengthDays: programData.lengthDays,
          priceInCents: programData.priceInCents,
          currency: programData.currency,
          stripePriceId: programData.stripePriceId,
        };
      }
    }

    return NextResponse.json({
      funnel,
      steps,
      program,
    });
  } catch (error) {
    console.error('[FUNNEL_GET]', error);
    return NextResponse.json(
      { error: 'Failed to get funnel' },
      { status: 500 }
    );
  }
}



