/**
 * Program API: Get single program
 * 
 * GET /api/programs/[programId] - Get a specific program by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Program } from '@/types';

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
    const program: Program = {
      id: programDoc.id,
      ...programData,
      createdAt: programData?.createdAt?.toDate?.()?.toISOString?.() || programData?.createdAt,
      updatedAt: programData?.updatedAt?.toDate?.()?.toISOString?.() || programData?.updatedAt,
    } as Program;

    return NextResponse.json({ program });
  } catch (error) {
    console.error('[PROGRAM_GET]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}





