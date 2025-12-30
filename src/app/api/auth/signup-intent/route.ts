/**
 * Signup Intent API
 * 
 * Stores the signup domain for an email address before Clerk user creation.
 * This allows the email webhook to resolve the correct organization for
 * tenant-branded verification emails (since user_id is null at that point).
 * 
 * Intents are automatically cleaned up after 1 hour.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { parseHost } from '@/lib/tenant/parseHost';

/**
 * POST /api/auth/signup-intent
 * 
 * Store signup intent before Clerk user creation.
 * Called by SignUpForm to enable tenant-branded verification emails.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, domain } = body;

    if (!email || !domain) {
      return NextResponse.json(
        { error: 'Missing required fields: email, domain' },
        { status: 400 }
      );
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Resolve organization from domain
    let organizationId: string | null = null;
    const parsed = parseHost(domain);

    if (parsed.type === 'subdomain' && parsed.subdomain) {
      // Look up subdomain in org_domains
      const snapshot = await adminDb
        .collection('org_domains')
        .where('subdomain', '==', parsed.subdomain.toLowerCase())
        .limit(1)
        .get();

      if (!snapshot.empty) {
        organizationId = snapshot.docs[0].data().organizationId;
      }
    } else if (parsed.type === 'custom_domain') {
      // Look up custom domain in org_custom_domains
      const snapshot = await adminDb
        .collection('org_custom_domains')
        .where('domain', '==', parsed.hostname.toLowerCase())
        .where('status', '==', 'verified')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        organizationId = snapshot.docs[0].data().organizationId;
      }
    }

    // Store the signup intent
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    await adminDb.collection('signup_intents').doc(normalizedEmail).set({
      email: normalizedEmail,
      domain,
      organizationId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    console.log('[SIGNUP_INTENT] Stored intent:', {
      email: normalizedEmail,
      domain,
      organizationId,
    });

    return NextResponse.json({ 
      success: true,
      organizationId,
    });
  } catch (error) {
    console.error('[SIGNUP_INTENT] Error:', error);
    return NextResponse.json(
      { error: 'Failed to store signup intent' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/signup-intent
 * 
 * Look up a signup intent by email.
 * Used by the email webhook to get tenant info.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const doc = await adminDb.collection('signup_intents').doc(normalizedEmail).get();

    if (!doc.exists) {
      return NextResponse.json({ found: false });
    }

    const data = doc.data();
    
    // Check if expired
    if (data?.expiresAt && new Date(data.expiresAt) < new Date()) {
      // Clean up expired intent
      await doc.ref.delete();
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      domain: data?.domain,
      organizationId: data?.organizationId,
    });
  } catch (error) {
    console.error('[SIGNUP_INTENT] Error looking up intent:', error);
    return NextResponse.json(
      { error: 'Failed to lookup signup intent' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/signup-intent
 * 
 * Clean up a signup intent after successful signup.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    await adminDb.collection('signup_intents').doc(normalizedEmail).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[SIGNUP_INTENT] Error deleting intent:', error);
    return NextResponse.json(
      { error: 'Failed to delete signup intent' },
      { status: 500 }
    );
  }
}

