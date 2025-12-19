import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';
import type { UserRole, UserTier } from '@/types';

interface UserWithoutSquad {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  role: UserRole;
  tier: UserTier;
  createdAt: string;
}

/**
 * GET /api/admin/users/without-squad
 * Get all users who are NOT in any squad
 * 
 * Query params:
 * - tier: Filter by tier ('free' | 'standard' | 'premium' | 'all')
 *         Note: Coaching is NOT a tier - it's a separate product
 * - search: Filter by name or email
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const tierFilter = url.searchParams.get('tier') || 'all';
    const search = url.searchParams.get('search') || '';

    // Get all users who are already in squads
    const membershipsSnapshot = await adminDb.collection('squadMembers').get();
    const usersInSquads = new Set<string>();
    
    membershipsSnapshot.forEach((doc) => {
      const data = doc.data();
      usersInSquads.add(data.userId);
    });

    // Fetch all users from Clerk
    const client = await clerkClient();
    const { data: allUsers } = await client.users.getUserList({
      limit: 500,
      orderBy: '-created_at',
    });

    // Get Firebase user data for tier information
    const firebaseUsersSnapshot = await adminDb.collection('users').get();
    const firebaseUsers = new Map<string, { tier?: UserTier }>();
    
    firebaseUsersSnapshot.forEach((doc) => {
      firebaseUsers.set(doc.id, { tier: doc.data().tier });
    });

    // Filter and transform users
    const usersWithoutSquad: UserWithoutSquad[] = allUsers
      .filter((user) => !usersInSquads.has(user.id))
      .map((user) => {
        const firebaseData = firebaseUsers.get(user.id);
        return {
          id: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unnamed User',
          imageUrl: user.imageUrl || '',
          role: (user.publicMetadata?.role as UserRole) || 'user',
          tier: (firebaseData?.tier as UserTier) || 'standard',
          createdAt: new Date(user.createdAt).toISOString(),
        };
      })
      .filter((user) => {
        // Apply tier filter
        if (tierFilter !== 'all' && user.tier !== tierFilter) {
          return false;
        }
        
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          const matchesName = user.name.toLowerCase().includes(searchLower);
          const matchesEmail = user.email.toLowerCase().includes(searchLower);
          return matchesName || matchesEmail;
        }
        
        return true;
      });

    return NextResponse.json({ 
      users: usersWithoutSquad,
      totalCount: usersWithoutSquad.length,
    });
  } catch (error) {
    console.error('[ADMIN_USERS_WITHOUT_SQUAD_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/without-squad
 * Update a user's tier
 * 
 * Body: { userId: string, tier: UserTier }
 */
export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { userId, tier } = body as { userId: string; tier: UserTier };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Coaching is NOT a tier - only free/standard/premium are valid tiers
    if (!tier || !['free', 'standard', 'premium'].includes(tier)) {
      return NextResponse.json({ error: 'Valid tier is required (free, standard, or premium)' }, { status: 400 });
    }

    // Update the user's tier in Firebase
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create the user document if it doesn't exist
      await userRef.set({
        tier,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      await userRef.update({
        tier,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, tier });
  } catch (error) {
    console.error('[ADMIN_USERS_UPDATE_TIER_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}





