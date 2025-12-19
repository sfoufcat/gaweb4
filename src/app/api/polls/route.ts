import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import type { ChatPollState } from '@/types/poll';

/**
 * POST /api/polls
 * Creates a new poll and returns the poll ID
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, options, settings, channelId } = body;

    // Validation
    if (!question || !question.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: 'At least 2 options are required' }, { status: 400 });
    }

    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 });
    }

    // Validate options have text
    const validOptions = options.filter((opt: any) => opt.text && opt.text.trim());
    if (validOptions.length < 2) {
      return NextResponse.json({ error: 'At least 2 valid options are required' }, { status: 400 });
    }

    // Get user info for creator details
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.username || 'Unknown';
    const userImage = user.imageUrl;

    const now = new Date().toISOString();

    // Create poll document
    const pollData: Omit<ChatPollState, 'id'> = {
      channelId,
      question: question.trim(),
      options: validOptions.map((opt: any) => ({
        id: opt.id || `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text: opt.text.trim(),
      })),
      settings: {
        activeTill: settings?.activeTill || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        anonymous: settings?.anonymous ?? true,
        multipleAnswers: settings?.multipleAnswers ?? false,
        participantsCanAddOptions: settings?.participantsCanAddOptions ?? false,
      },
      createdByUserId: userId,
      createdByUserName: userName,
      createdByUserImage: userImage,
      createdAt: now,
      votes: [],
      votesByOption: {},
      totalVotes: 0,
    };

    // Initialize votesByOption
    pollData.options.forEach((opt) => {
      pollData.votesByOption[opt.id] = 0;
    });

    const docRef = await adminDb.collection('chatPolls').add(pollData);
    
    const poll: ChatPollState = {
      id: docRef.id,
      ...pollData,
    };

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    console.error('Error creating poll:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create poll', message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls?id=pollId
 * Get a poll by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pollId = searchParams.get('id');

    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID is required' }, { status: 400 });
    }

    const pollDoc = await adminDb.collection('chatPolls').doc(pollId).get();

    if (!pollDoc.exists) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    const pollData = pollDoc.data() as Omit<ChatPollState, 'id'>;
    
    // Get user's own votes
    const userVotesSnapshot = await adminDb
      .collection('chatPolls')
      .doc(pollId)
      .collection('votes')
      .where('userId', '==', userId)
      .get();

    const userVotes: string[] = [];
    userVotesSnapshot.forEach((doc) => {
      userVotes.push(doc.data().optionId);
    });

    const poll: ChatPollState = {
      id: pollDoc.id,
      ...pollData,
      userVotes,
    };

    return NextResponse.json({ poll });
  } catch (error) {
    console.error('Error fetching poll:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch poll', message },
      { status: 500 }
    );
  }
}

