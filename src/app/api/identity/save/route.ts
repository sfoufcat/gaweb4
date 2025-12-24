import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';

export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the statement from request body
    const { statement } = await req.json();

    if (!statement || typeof statement !== 'string') {
      return NextResponse.json(
        { error: 'Identity statement is required' },
        { status: 400 }
      );
    }

    const trimmedStatement = statement.trim();
    const now = new Date().toISOString();

    // Get existing user data to preserve history
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const existingData = userDoc.data() || {};

    // Build identity history
    const identityHistory = existingData.identityHistory || [];
    if (existingData.identity) {
      // Add previous identity to history
      identityHistory.push({
        statement: existingData.identity,
        setAt: existingData.identitySetAt || now,
      });
    }

    // Update user document with new identity
    await userRef.set(
      {
        identity: trimmedStatement,
        identitySetAt: now,
        identityHistory: identityHistory,
        updatedAt: now,
      },
      { merge: true }
    );

    // MULTI-TENANCY: Also update org_memberships if user is in an org
    // This ensures identity changes appear immediately on profile (org data takes priority)
    const organizationId = await getEffectiveOrgId();
    if (organizationId) {
      const membershipRef = adminDb.collection('org_memberships').doc(`${organizationId}_${userId}`);
      const membershipDoc = await membershipRef.get();
      
      if (membershipDoc.exists) {
        await membershipRef.update({
          identity: trimmedStatement,
          updatedAt: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      identity: trimmedStatement,
      setAt: now,
    });
  } catch (error) {
    console.error('Error saving identity:', error);
    return NextResponse.json(
      { error: 'Failed to save identity statement' },
      { status: 500 }
    );
  }
}

