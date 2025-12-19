// API route to generate Stream Chat token for authenticated users
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generateStreamToken } from '@/lib/stream-server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await generateStreamToken(userId);
    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    
    if (!apiKey) {
      throw new Error('NEXT_PUBLIC_STREAM_API_KEY is not defined');
    }
    
    return NextResponse.json({ token, userId, apiKey });
  } catch (error) {
    console.error('Error generating Stream token:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

