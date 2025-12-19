import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/admin-utils-clerk';

/**
 * Generate a unique invite code for private squads
 * Format: GA-XXXXXX (6 alphanumeric characters)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = 'GA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/admin/squads/[squadId]/regenerate-code
 * Regenerates the invite code for a squad (admin/super_admin only)
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ squadId: string }> }
) {
  try {
    // Check authorization (throws if not admin)
    await requireAdmin();

    const { squadId } = await context.params;

    // Check if squad exists
    const squadRef = adminDb.collection('squads').doc(squadId);
    const squadDoc = await squadRef.get();
    
    if (!squadDoc.exists) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Generate a unique invite code
    let isUnique = false;
    let newCode = '';
    while (!isUnique) {
      newCode = generateInviteCode();
      const existing = await adminDb.collection('squads')
        .where('inviteCode', '==', newCode)
        .limit(1)
        .get();
      isUnique = existing.empty;
    }

    // Update squad with new invite code
    await squadRef.update({
      inviteCode: newCode,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      inviteCode: newCode,
    });
  } catch (error) {
    console.error('[ADMIN_SQUAD_REGENERATE_CODE_ERROR]', error);
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











