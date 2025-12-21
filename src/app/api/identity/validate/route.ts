import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { validateIdentityStatement } from '@/lib/anthropic';

export async function POST(req: Request) {
  try {
    // Get the statement and optional flow session from request body
    const { statement, flowSessionId } = await req.json();

    // Check for authenticated user OR flow session
    const { userId } = await auth();
    
    // Allow if authenticated OR has valid flow session ID (for funnel guest flow)
    if (!userId && !flowSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!statement || typeof statement !== 'string') {
      return NextResponse.json(
        { error: 'Identity statement is required' },
        { status: 400 }
      );
    }

    // Validate with Claude
    const validation = await validateIdentityStatement(statement.trim());

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error in identity validation API:', error);
    return NextResponse.json(
      { error: 'Failed to validate identity statement' },
      { status: 500 }
    );
  }
}

