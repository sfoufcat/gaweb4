import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { Invoice } from '@/types';

/**
 * GET /api/client/invoices
 * Get all invoices for the current authenticated user
 *
 * Query params:
 * - limit: Max results (default 50)
 * - cursor: Pagination cursor (invoice ID)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor');

    // Build query - only invoices for this user
    let query = adminDb
      .collection('invoices')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc');

    // Pagination
    if (cursor) {
      const cursorDoc = await adminDb.collection('invoices').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }

    query = query.limit(limit + 1);

    const snapshot = await query.get();
    const invoices: Invoice[] = [];
    let hasMore = false;
    let nextCursor: string | null = null;

    snapshot.docs.forEach((doc, index) => {
      if (index < limit) {
        invoices.push({ id: doc.id, ...doc.data() } as Invoice);
      } else {
        hasMore = true;
        nextCursor = invoices[invoices.length - 1]?.id || null;
      }
    });

    return NextResponse.json({
      invoices,
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error('[CLIENT_INVOICES_GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}
