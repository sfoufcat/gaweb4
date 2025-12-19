// API route to generate Stream Video token for authenticated users
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('Stream API key and secret must be defined');
    }

    // Import StreamChat to generate token (video uses the same tokens)
    const { StreamChat } = await import('stream-chat');
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    
    // Stream Video uses the same token as Stream Chat
    const token = serverClient.createToken(userId);
    
    return NextResponse.json({ token, userId, apiKey });
  } catch (error) {
    console.error('Error generating Stream Video token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}











