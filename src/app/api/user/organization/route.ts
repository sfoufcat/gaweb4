/**
 * User Organization API
 * 
 * GET /api/user/organization - Get the user's current/primary organization ID
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { ClerkPublicMetadata } from '@/types';

/**
 * GET /api/user/organization
 * Get the user's current organization ID from their Clerk metadata
 */
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get organization ID from session claims publicMetadata
    const metadata = sessionClaims?.publicMetadata as ClerkPublicMetadata | undefined;
    const organizationId = metadata?.organizationId || null;
    
    return NextResponse.json({
      organizationId,
      userId,
    });
  } catch (error) {
    console.error('[USER_ORG_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

