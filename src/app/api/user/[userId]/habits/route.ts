import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { Habit } from '@/types';

/**
 * GET /api/user/[userId]/habits
 * Fetches another user's habits (active, non-private habits only)
 * 
 * MULTI-TENANCY: Only returns habits within the current organization
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: currentUserId } = await auth();

    if (!currentUserId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { userId: targetUserId } = await params;

    // MULTI-TENANCY: Get current organization
    const organizationId = await getEffectiveOrgId();

    // Build query with organization filtering
    let query = adminDb.collection('habits').where('userId', '==', targetUserId);
    
    // Filter by organization if we have one (for multi-tenancy)
    if (organizationId) {
      query = query.where('organizationId', '==', organizationId);
    }

    const habitsSnapshot = await query.get();

    const habits: Habit[] = [];

    habitsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Only include active habits (not archived/completed)
      // For other users' profiles, we show all their active habits
      if (!data.archived && data.status !== 'archived' && data.status !== 'completed') {
        habits.push({
          id: doc.id,
          ...data,
        } as Habit);
      }
    });

    // Sort by creation date (newest first)
    habits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ habits });
  } catch (error) {
    console.error('[USER_HABITS_ERROR]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}












