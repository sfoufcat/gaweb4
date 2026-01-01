/**
 * Admin Quiz Leads API
 * 
 * GET: List all quiz leads with filtering and pagination
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isSuperAdmin } from '@/lib/admin-utils-shared';
import { adminDb } from '@/lib/firebase-admin';
import type { QuizLead, ClerkPublicMetadata } from '@/types';

/**
 * GET /api/admin/quiz-leads
 * List quiz leads with optional filtering
 */
export async function GET(request: Request) {
  try {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.publicMetadata as ClerkPublicMetadata)?.role;
    
    if (!isSuperAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const converted = searchParams.get('converted'); // 'true', 'false', or null for all
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = adminDb.collection('quiz_leads').orderBy('createdAt', 'desc');
    
    // Get all docs for filtering (Firestore doesn't support complex queries well)
    const snapshot = await query.get();
    
    let leads: QuizLead[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as QuizLead));
    
    // Apply converted filter
    if (converted === 'true') {
      leads = leads.filter(lead => !!lead.convertedAt);
    } else if (converted === 'false') {
      leads = leads.filter(lead => !lead.convertedAt);
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      leads = leads.filter(lead => 
        lead.email.toLowerCase().includes(searchLower) ||
        lead.name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Get total before pagination
    const total = leads.length;
    
    // Apply pagination
    leads = leads.slice(offset, offset + limit);
    
    // Calculate stats
    const stats = {
      total: snapshot.size,
      converted: snapshot.docs.filter(doc => doc.data().convertedAt).length,
      notConverted: snapshot.docs.filter(doc => !doc.data().convertedAt).length,
    };
    
    return NextResponse.json({
      leads,
      stats,
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + leads.length < total,
      },
    });
    
  } catch (error) {
    console.error('[ADMIN_QUIZ_LEADS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quiz leads' },
      { status: 500 }
    );
  }
}

