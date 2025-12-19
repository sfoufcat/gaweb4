import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thought } = await request.json();

    if (!thought || typeof thought !== 'string' || thought.trim().length === 0) {
      return NextResponse.json({ error: 'Thought is required' }, { status: 400 });
    }

    const systemPrompt = `You are a compassionate mindset coach helping someone start their day with clarity and confidence. 
Your role is to gently reframe negative or anxious thoughts into more empowering, constructive perspectives.

Guidelines:
- Keep responses short (2-3 sentences max)
- Be warm and genuine, not preachy or cliché
- Focus on progress, learning, and personal growth
- Acknowledge the feeling without dismissing it
- Offer a subtle shift in perspective
- Use "I" statements that the user can adopt as their own internal voice
- Avoid toxic positivity - be realistic and grounded
- NEVER use introductory phrases like "I can reframe this as" or "Here's how to think about it"
- Provide the reframed thought DIRECTLY as if it's the user's own empowering internal dialogue
- Write in first person, as the user speaking to themselves`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Transform this thought into an empowering first-person statement (as if I'm speaking to myself): "${thought.trim()}"`,
        },
      ],
    });

    // Extract text from response
    const reframe = message.content[0].type === 'text' 
      ? message.content[0].text 
      : 'Every challenge is an opportunity for growth.';

    return NextResponse.json({ reframe });
  } catch (error: any) {
    console.error('Error reframing thought:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reframe thought' },
      { status: 500 }
    );
  }
}

