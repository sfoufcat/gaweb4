import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { getOrgCoachingPromo, DEFAULT_COACHING_PROMO } from '@/lib/org-channels';

/**
 * GET /api/user/org-coaching-promo
 * 
 * Fetch the coaching promo settings for the current user's organization.
 * Returns default promo if user doesn't belong to an organization.
 * 
 * This is used by regular users to display the coaching promo in the chat sidebar.
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
      // User doesn't belong to an org - return default promo
      const now = new Date().toISOString();
      return NextResponse.json({
        promo: {
          id: 'default',
          organizationId: null,
          ...DEFAULT_COACHING_PROMO,
          createdAt: now,
          updatedAt: now,
        },
        organizationId: null,
      });
    }

    // Fetch org coaching promo settings
    const promo = await getOrgCoachingPromo(organizationId);

    return NextResponse.json({
      promo,
      organizationId,
    });
  } catch (error) {
    console.error('[USER_ORG_COACHING_PROMO_ERROR]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

