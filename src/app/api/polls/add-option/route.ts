import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import type { ChatPollState, ChatPollOption } from '@/types/poll';

/**
 * POST /api/polls/add-option
 * Add a new option to a poll (if settings allow)
 * Verifies the poll belongs to the user's current organization
 * 
 * Body: { pollId: string, optionText: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current organization from tenant context
    const organizationId = await getEffectiveOrgId();

    const body = await request.json();
    const { pollId, optionText } = body;

    // Validation
    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID is required' }, { status: 400 });
    }

    if (!optionText || !optionText.trim()) {
      return NextResponse.json({ error: 'Option text is required' }, { status: 400 });
    }

    // Get poll
    const pollRef = adminDb.collection('chatPolls').doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    const pollData = pollDoc.data() as Omit<ChatPollState, 'id'>;
    
    // Verify poll belongs to the current organization (multi-tenancy check)
    if (organizationId && pollData.organizationId && pollData.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    // Check if poll allows adding options
    if (!pollData.settings.participantsCanAddOptions) {
      return NextResponse.json({ error: 'This poll does not allow adding options' }, { status: 403 });
    }

    // Check if poll is closed
    if (pollData.closedAt) {
      return NextResponse.json({ error: 'Poll is closed' }, { status: 400 });
    }

    if (pollData.settings.activeTill && new Date(pollData.settings.activeTill) < new Date()) {
      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 });
    }

    // Check for duplicate option text
    const normalizedText = optionText.trim().toLowerCase();
    const isDuplicate = pollData.options.some(
      opt => opt.text.toLowerCase() === normalizedText
    );

    if (isDuplicate) {
      return NextResponse.json({ error: 'This option already exists' }, { status: 400 });
    }

    // Create new option
    const newOption: ChatPollOption = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: optionText.trim(),
    };

    // Update poll with new option
    await pollRef.update({
      options: [...pollData.options, newOption],
      [`votesByOption.${newOption.id}`]: 0,
    });

    return NextResponse.json({ option: newOption }, { status: 201 });
  } catch (error) {
    console.error('Error adding option to poll:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add option', message: errorMessage },
      { status: 500 }
    );
  }
}

