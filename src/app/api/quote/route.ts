/**
 * Quote API
 * 
 * GET /api/quote?index=0
 * 
 * Returns a quote from the CMS for the quote card.
 * Fetches from dynamic_prompts collection (generic quotes).
 * 
 * Query params:
 * - index: Cycle index for rotating through quotes (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';

/**
 * Get a quote from the CMS
 * 
 * @param index - Cycle index for rotating through quotes (uses modulo)
 * @returns Quote with text and author
 */
async function getQuoteFromCMS(
  index: number = 0
): Promise<{ text: string; author: string } | null> {
  try {
    // Fetch active quotes from dynamic_prompts collection
    const quotesSnapshot = await adminDb
      .collection('dynamic_prompts')
      .where('slot', '==', 'quote')
      .where('isActive', '==', true)
      .orderBy('priority', 'asc')
      .get();

    if (quotesSnapshot.empty) {
      return null;
    }

    // Select quote based on index (cycles through available quotes)
    const quotes = quotesSnapshot.docs;
    const selectedIndex = index % quotes.length;
    const dbQuote = quotes[selectedIndex].data();

    // Quote body format: "Quote text" or "Quote text — Author"
    const body = dbQuote.body;
    
    // Try to extract author if present (format: "text — author" or "text - author")
    const authorMatch = body.match(/\s*[—–-]\s*([^—–-]+)$/);
    if (authorMatch) {
      return {
        text: body.replace(authorMatch[0], '').trim(),
        author: authorMatch[1].trim(),
      };
    }
    
    // Use title as author if no author in body
    return {
      text: body,
      author: dbQuote.title || 'Unknown',
    };
  } catch (error) {
    console.error('[QUOTE_API] Error fetching quote from CMS:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication is optional - public endpoint
    await auth();
    
    // Get params from query
    const { searchParams } = new URL(request.url);
    const indexStr = searchParams.get('index');
    const index = indexStr ? parseInt(indexStr, 10) : 0;

    // Get quote from CMS with cycling support
    const quote = await getQuoteFromCMS(index);

    return NextResponse.json({ quote });
  } catch (error) {
    console.error('[QUOTE_API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    );
  }
}
