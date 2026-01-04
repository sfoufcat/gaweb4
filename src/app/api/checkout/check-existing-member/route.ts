import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import type { BillingStatus, ClerkPublicMetadata } from '@/lib/admin-utils-clerk';

/**
 * POST /api/checkout/check-existing-member
 * Checks if an email belongs to an existing paying Coachful member
 * 
 * Used during guest checkout to prevent duplicate accounts
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    // Validate email
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const client = await clerkClient();
    
    // Look up users by email
    const users = await client.users.getUserList({
      emailAddress: [email.toLowerCase().trim()],
      limit: 1,
    });

    if (users.data.length === 0) {
      // No existing user with this email
      return NextResponse.json({ 
        isExistingMember: false 
      });
    }

    const user = users.data[0];
    const publicMetadata = user.publicMetadata as ClerkPublicMetadata | undefined;
    
    const billingStatus = publicMetadata?.billingStatus as BillingStatus | undefined;
    const billingPeriodEnd = publicMetadata?.billingPeriodEnd;

    // Check if user has active billing
    let hasActiveBilling = false;
    
    if (billingStatus === 'active' || billingStatus === 'trialing') {
      hasActiveBilling = true;
    } else if (billingStatus === 'canceled' && billingPeriodEnd) {
      // Check if still in grace period (access until period end)
      const periodEndDate = new Date(billingPeriodEnd);
      if (periodEndDate > new Date()) {
        hasActiveBilling = true;
      }
    }

    if (hasActiveBilling) {
      return NextResponse.json({ 
        isExistingMember: true,
        message: 'You are already a Coachful paying member.',
      });
    }

    // User exists but doesn't have active billing - they can proceed
    return NextResponse.json({ 
      isExistingMember: false 
    });

  } catch (error) {
    console.error('[CHECK_EXISTING_MEMBER_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Failed to check membership status';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

