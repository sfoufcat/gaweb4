import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { ChatPollState } from '@/types/poll';

/**
 * POST /api/polls/vote
 * Cast or update a vote on a poll
 * 
 * Body: { pollId: string, optionIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { pollId, optionIds } = body;

    // Validation
    if (!pollId) {
      return NextResponse.json({ error: 'Poll ID is required' }, { status: 400 });
    }

    if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json({ error: 'At least one option must be selected' }, { status: 400 });
    }

    // Get poll
    const pollRef = adminDb.collection('chatPolls').doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }

    const pollData = pollDoc.data() as Omit<ChatPollState, 'id'>;

    // Check if poll is closed
    if (pollData.closedAt) {
      return NextResponse.json({ error: 'Poll is closed' }, { status: 400 });
    }

    if (pollData.settings.activeTill && new Date(pollData.settings.activeTill) < new Date()) {
      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 });
    }

    // Validate options exist
    const validOptionIds = optionIds.filter(optId => 
      pollData.options.some(opt => opt.id === optId)
    );

    if (validOptionIds.length === 0) {
      return NextResponse.json({ error: 'Invalid option selected' }, { status: 400 });
    }

    // Check multiple answers setting
    if (!pollData.settings.multipleAnswers && validOptionIds.length > 1) {
      return NextResponse.json({ error: 'This poll only allows one answer' }, { status: 400 });
    }

    // Get user info
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const userName = user.firstName 
      ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
      : user.username || 'Unknown';
    const userImage = user.imageUrl;

    // Get existing votes by this user
    const existingVotesSnapshot = await pollRef
      .collection('votes')
      .where('userId', '==', userId)
      .get();

    const existingVoteOptionIds: string[] = [];
    existingVotesSnapshot.forEach((doc) => {
      existingVoteOptionIds.push(doc.data().optionId);
    });

    // Use batch for atomic operations
    const batch = adminDb.batch();
    const now = new Date().toISOString();

    // If single answer mode, remove all existing votes first
    if (!pollData.settings.multipleAnswers) {
      for (const voteDoc of existingVotesSnapshot.docs) {
        batch.delete(voteDoc.ref);
      }
      
      // Decrement counts for old votes
      const decrements: Record<string, ReturnType<typeof FieldValue.increment>> = {};
      existingVoteOptionIds.forEach((optId) => {
        decrements[`votesByOption.${optId}`] = FieldValue.increment(-1);
      });
      if (existingVoteOptionIds.length > 0) {
        (decrements as Record<string, ReturnType<typeof FieldValue.increment>>).totalVotes = FieldValue.increment(-existingVoteOptionIds.length);
        batch.update(pollRef, decrements);
      }
    } else {
      // Multiple answers mode - remove any votes for options being toggled off
      // and don't re-add votes for options already voted
      const optionsToRemove = existingVoteOptionIds.filter(id => !validOptionIds.includes(id));
      const optionsToAdd = validOptionIds.filter(id => !existingVoteOptionIds.includes(id));

      // Remove votes for deselected options
      for (const voteDoc of existingVotesSnapshot.docs) {
        if (optionsToRemove.includes(voteDoc.data().optionId)) {
          batch.delete(voteDoc.ref);
        }
      }

      if (optionsToRemove.length > 0) {
        const decrements: Record<string, ReturnType<typeof FieldValue.increment>> = { totalVotes: FieldValue.increment(-optionsToRemove.length) };
        optionsToRemove.forEach((optId) => {
          decrements[`votesByOption.${optId}`] = FieldValue.increment(-1);
        });
        batch.update(pollRef, decrements);
      }

      // Add new votes
      const increments: Record<string, ReturnType<typeof FieldValue.increment>> = {};
      for (const optionId of optionsToAdd) {
        const voteData: Record<string, string> = {
          optionId,
          userId,
          createdAt: now,
        };
        if (!pollData.settings.anonymous) {
          voteData.userName = userName;
          voteData.userImage = userImage;
        }
        
        const voteRef = pollRef.collection('votes').doc();
        batch.set(voteRef, voteData);
        increments[`votesByOption.${optionId}`] = FieldValue.increment(1);
      }

      if (optionsToAdd.length > 0) {
        increments.totalVotes = FieldValue.increment(optionsToAdd.length);
        batch.update(pollRef, increments);
      }

      await batch.commit();
      return NextResponse.json({ success: true });
    }

    // Add new votes (single answer mode)
    const singleIncrements: Record<string, ReturnType<typeof FieldValue.increment>> = { totalVotes: FieldValue.increment(validOptionIds.length) };
    for (const optionId of validOptionIds) {
      const voteData: Record<string, string> = {
        optionId,
        userId,
        createdAt: now,
      };
      if (!pollData.settings.anonymous) {
        voteData.userName = userName;
        voteData.userImage = userImage;
      }
      
      const voteRef = pollRef.collection('votes').doc();
      batch.set(voteRef, voteData);
      singleIncrements[`votesByOption.${optionId}`] = FieldValue.increment(1);
    }

    batch.update(pollRef, singleIncrements);

    // Also update the votes array in the main document for real-time display
    if (!pollData.settings.anonymous) {
      batch.update(pollRef, {
        votes: FieldValue.arrayUnion(...validOptionIds.map(optionId => ({
          optionId,
          userId,
          userName,
          userImage,
          createdAt: now,
        }))),
      });
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error voting on poll:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to vote', message },
      { status: 500 }
    );
  }
}

