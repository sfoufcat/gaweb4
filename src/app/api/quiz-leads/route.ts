/**
 * Quiz Leads API
 * 
 * Captures quiz data from landing page before signup.
 * This is a public endpoint (no auth required) since users
 * fill out the quiz before creating an account.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import type { QuizLead } from '@/types';

// Rate limiting: simple in-memory store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5; // 5 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || record.resetAt < now) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * POST /api/quiz-leads
 * Save quiz responses from landing page
 */
export async function POST(request: Request) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown';
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { 
      email, 
      name, 
      clientCount, 
      frustrations, 
      impactFeatures,
      referralCode,
      source,
      utmData,
      referrer,
      landingPage,
    } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if lead already exists
    const existingLeads = await adminDb
      .collection('quiz_leads')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingLeads.empty) {
      // Update existing lead with new data
      const existingDoc = existingLeads.docs[0];
      const existingData = existingDoc.data();
      await existingDoc.ref.update({
        name: name || existingData.name,
        clientCount: clientCount || existingData.clientCount,
        frustrations: frustrations || existingData.frustrations,
        impactFeatures: impactFeatures || existingData.impactFeatures,
        referralCode: referralCode || existingData.referralCode,
        source: source || existingData.source,
        // Preserve original UTM data (don't overwrite with empty)
        utmData: utmData && Object.values(utmData).some(v => v) ? utmData : existingData.utmData,
        referrer: referrer || existingData.referrer,
        landingPage: landingPage || existingData.landingPage,
        updatedAt: new Date().toISOString(),
      });

      return NextResponse.json({ 
        success: true, 
        leadId: existingDoc.id,
        updated: true 
      });
    }

    // Create new lead
    const now = new Date().toISOString();
    const leadData: Omit<QuizLead, 'id'> = {
      email: email.toLowerCase(),
      name: name || undefined,
      clientCount: clientCount || '',
      frustrations: Array.isArray(frustrations) ? frustrations : [],
      impactFeatures: Array.isArray(impactFeatures) ? impactFeatures : [],
      referralCode: referralCode || undefined,
      source: source || undefined,
      utmData: utmData && Object.values(utmData).some(v => v) ? utmData : undefined,
      referrer: referrer || undefined,
      landingPage: landingPage || undefined,
      createdAt: now,
    };

    const docRef = await adminDb.collection('quiz_leads').add(leadData);

    console.log(`[QUIZ_LEADS] Created lead ${docRef.id} for ${email}`);

    return NextResponse.json({ 
      success: true, 
      leadId: docRef.id,
      updated: false 
    });

  } catch (error) {
    console.error('[QUIZ_LEADS] Error saving lead:', error);
    return NextResponse.json(
      { error: 'Failed to save quiz data' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quiz-leads
 * Get quiz lead by email (for checking if already exists)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }

    const leads = await adminDb
      .collection('quiz_leads')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (leads.empty) {
      return NextResponse.json({ exists: false });
    }

    const lead = leads.docs[0];
    return NextResponse.json({ 
      exists: true,
      leadId: lead.id,
      converted: !!lead.data().convertedAt,
    });

  } catch (error) {
    console.error('[QUIZ_LEADS] Error checking lead:', error);
    return NextResponse.json(
      { error: 'Failed to check lead' },
      { status: 500 }
    );
  }
}

