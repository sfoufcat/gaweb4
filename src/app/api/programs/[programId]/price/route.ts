/**
 * Program Price API: Get the current price of a program
 * 
 * GET /api/programs/[programId]/price - Get the current price of a program
 * 
 * This is a lightweight endpoint used by upsell/downsell steps to fetch
 * the real program price dynamically instead of using cached/static values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params;

    if (!programId) {
      return NextResponse.json(
        { error: 'Program ID is required' },
        { status: 400 }
      );
    }

    const programDoc = await adminDb.collection('programs').doc(programId).get();

    if (!programDoc.exists) {
      return NextResponse.json(
        { error: 'Program not found' },
        { status: 404 }
      );
    }

    const programData = programDoc.data();

    return NextResponse.json({
      priceInCents: programData?.priceInCents ?? 0,
      currency: programData?.currency ?? 'usd',
    });
  } catch (error) {
    console.error('[PROGRAM_PRICE_GET]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}




