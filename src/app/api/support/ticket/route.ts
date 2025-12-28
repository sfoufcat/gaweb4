/**
 * API Route: Support Ticket
 * 
 * POST /api/support/ticket - Create a Freshdesk support ticket
 * 
 * Body: {
 *   type: 'support' | 'feedback'
 *   subject?: string (required for support)
 *   message: string
 *   category?: 'general' | 'bug' | 'improvement' | 'other' (for feedback)
 * }
 * 
 * Creates a ticket in Freshdesk with user metadata attached.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { createSupportTicket, createFeedbackTicket, isFreshdeskConfigured } from '@/lib/freshdesk';
import { getEffectiveOrgId } from '@/lib/tenant/context';

// =============================================================================
// REQUEST TYPES
// =============================================================================

interface SupportTicketRequest {
  type: 'support';
  subject: string;
  message: string;
}

interface FeedbackTicketRequest {
  type: 'feedback';
  message: string;
  category: 'general' | 'bug' | 'improvement' | 'other';
}

type TicketRequest = SupportTicketRequest | FeedbackTicketRequest;

// =============================================================================
// POST - Create Support/Feedback Ticket
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Freshdesk configuration
    if (!isFreshdeskConfigured()) {
      console.error('[SUPPORT_TICKET] Freshdesk not configured');
      return NextResponse.json(
        { error: 'Support system is not configured' },
        { status: 503 }
      );
    }

    const body = await request.json() as TicketRequest;

    // Validate request
    if (!body.type || !['support', 'feedback'].includes(body.type)) {
      return NextResponse.json(
        { error: 'Invalid ticket type. Use "support" or "feedback"' },
        { status: 400 }
      );
    }

    if (!body.message || body.message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Message must be at least 10 characters' },
        { status: 400 }
      );
    }

    if (body.type === 'support' && !body.subject) {
      return NextResponse.json(
        { error: 'Subject is required for support tickets' },
        { status: 400 }
      );
    }

    if (body.type === 'feedback') {
      const validCategories = ['general', 'bug', 'improvement', 'other'];
      if (!body.category || !validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: 'Invalid feedback category' },
          { status: 400 }
        );
      }
    }

    // Get user info from Clerk
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress;
    const name = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.username || 'Unknown User';

    if (!email) {
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 400 }
      );
    }

    // Get organization context
    const organizationId = await getEffectiveOrgId();

    // Get page context from referrer
    const referer = request.headers.get('referer');
    const page = referer ? new URL(referer).pathname : undefined;

    // Create ticket based on type
    let result;
    
    if (body.type === 'support') {
      result = await createSupportTicket(
        email,
        name,
        body.subject,
        body.message,
        {
          userId,
          organizationId: organizationId || undefined,
          page,
        }
      );
    } else {
      result = await createFeedbackTicket(
        email,
        name,
        body.message,
        body.category,
        {
          userId,
          organizationId: organizationId || undefined,
        }
      );
    }

    if (!result.success) {
      console.error('[SUPPORT_TICKET] Failed to create ticket:', result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to create ticket' },
        { status: 500 }
      );
    }

    console.log(`[SUPPORT_TICKET] Created ${body.type} ticket #${result.ticket?.id} for user ${userId}`);

    return NextResponse.json({
      success: true,
      ticketId: result.ticket?.id,
      message: body.type === 'support' 
        ? 'Your support request has been submitted. We\'ll get back to you soon!'
        : 'Thank you for your feedback! We appreciate you taking the time to help us improve.',
    });

  } catch (error) {
    console.error('[SUPPORT_TICKET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit ticket' },
      { status: 500 }
    );
  }
}

