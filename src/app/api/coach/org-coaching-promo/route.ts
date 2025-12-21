import { NextResponse } from 'next/server';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import {
  getOrgCoachingPromo,
  updateOrgCoachingPromo,
  type UpdateOrgCoachingPromoInput,
} from '@/lib/org-channels';

/**
 * GET /api/coach/org-coaching-promo
 * 
 * Fetch coaching promo settings for the coach's organization
 */
export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const promo = await getOrgCoachingPromo(organizationId);

    return NextResponse.json({
      promo,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_COACHING_PROMO_GET_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/org-coaching-promo
 * 
 * Update coaching promo settings for the coach's organization
 * 
 * Body:
 * - title?: string
 * - subtitle?: string
 * - imageUrl?: string
 * - isVisible?: boolean
 */
export async function PUT(req: Request) {
  try {
    const { organizationId } = await requireCoachWithOrg();

    const body = await req.json();
    const {
      title,
      subtitle,
      imageUrl,
      isVisible,
    } = body as UpdateOrgCoachingPromoInput;

    // Build updates object, only including provided fields
    const updates: UpdateOrgCoachingPromoInput = {};
    
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return NextResponse.json({ error: 'Title must be a non-empty string' }, { status: 400 });
      }
      updates.title = title.trim();
    }
    
    if (subtitle !== undefined) {
      if (typeof subtitle !== 'string') {
        return NextResponse.json({ error: 'Subtitle must be a string' }, { status: 400 });
      }
      updates.subtitle = subtitle.trim();
    }
    
    if (imageUrl !== undefined) {
      if (typeof imageUrl !== 'string') {
        return NextResponse.json({ error: 'Image URL must be a string' }, { status: 400 });
      }
      updates.imageUrl = imageUrl.trim();
    }
    
    if (isVisible !== undefined) {
      if (typeof isVisible !== 'boolean') {
        return NextResponse.json({ error: 'isVisible must be a boolean' }, { status: 400 });
      }
      updates.isVisible = isVisible;
    }

    // Check if any updates were provided
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    const promo = await updateOrgCoachingPromo(organizationId, updates);

    return NextResponse.json({
      success: true,
      promo,
    });
  } catch (error) {
    console.error('[COACH_ORG_COACHING_PROMO_PUT_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';

    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

