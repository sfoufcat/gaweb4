/**
 * Apple Pay Domain Verification
 * 
 * This route serves the Apple Pay domain association file required for
 * Apple Pay web payments. Apple's servers fetch this file to verify
 * that the domain is authorized to process Apple Pay transactions.
 * 
 * The file content is provided by Stripe and is the same for all
 * merchants using Stripe as their payment processor.
 * 
 * GET /.well-known/apple-developer-merchantid-domain-association
 */

import { NextResponse } from 'next/server';
import { getApplePayVerificationFileContent } from '@/lib/stripe-domains';

export async function GET() {
  const content = getApplePayVerificationFileContent();
  
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      // Cache for 1 day - this file rarely changes
      'Cache-Control': 'public, max-age=86400',
    },
  });
}




