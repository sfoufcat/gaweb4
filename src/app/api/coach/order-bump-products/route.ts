/**
 * Coach API: Order Bump Products
 * 
 * GET /api/coach/order-bump-products - List available products for order bumps
 * 
 * Returns all products (programs, squads, content) that can be used as order bumps
 * in the coach's organization.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg, TenantRequiredError } from '@/lib/admin-utils-clerk';

interface AvailableProduct {
  id: string;
  type: 'program' | 'squad' | 'content';
  contentType?: 'event' | 'article' | 'course' | 'download' | 'link';
  name: string;
  imageUrl?: string;
  priceInCents: number;
  currency: string;
  description?: string;
}

export async function GET() {
  try {
    const { organizationId } = await requireCoachWithOrg();
    
    console.log(`[ORDER_BUMP_PRODUCTS] Fetching products for organization: ${organizationId}`);
    
    const products: AvailableProduct[] = [];
    
    // Fetch programs
    const programsSnapshot = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('isPublished', '==', true)
      .get();
    
    programsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        type: 'program',
        name: data.name || 'Untitled Program',
        imageUrl: data.coverImageUrl,
        priceInCents: data.priceInCents || 0,
        currency: data.currency || 'usd',
        description: data.description,
      });
    });
    
    // Fetch squads (standalone, with pricing)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .where('isActive', '==', true)
      .where('isAutoCreated', '==', false) // Only standalone squads
      .get();
    
    squadsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      // Only include squads with pricing
      if (data.priceInCents || data.subscriptionEnabled) {
        products.push({
          id: doc.id,
          type: 'squad',
          name: data.name || 'Untitled Squad',
          imageUrl: data.avatarUrl || data.landingPageCoverImageUrl,
          priceInCents: data.priceInCents || 0,
          currency: data.currency || 'usd',
          description: data.description,
        });
      }
    });
    
    // Fetch articles with pricing
    const articlesSnapshot = await adminDb
      .collection('discover_articles')
      .where('organizationId', '==', organizationId)
      .get();
    
    articlesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.priceInCents && data.priceInCents > 0) {
        products.push({
          id: doc.id,
          type: 'content',
          contentType: 'article',
          name: data.title || 'Untitled Article',
          imageUrl: data.coverImageUrl || data.thumbnailUrl,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
        });
      }
    });
    
    // Fetch courses with pricing
    const coursesSnapshot = await adminDb
      .collection('discover_courses')
      .where('organizationId', '==', organizationId)
      .get();
    
    coursesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.priceInCents && data.priceInCents > 0) {
        products.push({
          id: doc.id,
          type: 'content',
          contentType: 'course',
          name: data.title || 'Untitled Course',
          imageUrl: data.coverImageUrl,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
          description: data.shortDescription,
        });
      }
    });
    
    // Fetch events with pricing
    const eventsSnapshot = await adminDb
      .collection('discover_events')
      .where('organizationId', '==', organizationId)
      .get();
    
    eventsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.priceInCents && data.priceInCents > 0) {
        products.push({
          id: doc.id,
          type: 'content',
          contentType: 'event',
          name: data.title || 'Untitled Event',
          imageUrl: data.coverImageUrl,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
          description: data.shortDescription,
        });
      }
    });
    
    // Fetch downloads with pricing
    const downloadsSnapshot = await adminDb
      .collection('discover_downloads')
      .where('organizationId', '==', organizationId)
      .get();
    
    downloadsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.priceInCents && data.priceInCents > 0) {
        products.push({
          id: doc.id,
          type: 'content',
          contentType: 'download',
          name: data.title || 'Untitled Download',
          imageUrl: data.thumbnailUrl,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
          description: data.description,
        });
      }
    });
    
    // Fetch links with pricing (rare but possible)
    const linksSnapshot = await adminDb
      .collection('discover_links')
      .where('organizationId', '==', organizationId)
      .get();
    
    linksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.priceInCents && data.priceInCents > 0) {
        products.push({
          id: doc.id,
          type: 'content',
          contentType: 'link',
          name: data.title || 'Untitled Link',
          imageUrl: data.thumbnailUrl,
          priceInCents: data.priceInCents,
          currency: data.currency || 'usd',
          description: data.description,
        });
      }
    });
    
    console.log(`[ORDER_BUMP_PRODUCTS] Found ${products.length} products`);
    
    return NextResponse.json({ products });
  } catch (error) {
    console.error('[ORDER_BUMP_PRODUCTS] Error:', error);
    
    if (error instanceof TenantRequiredError) {
      return NextResponse.json(
        { error: 'Tenant required', tenantUrl: error.tenantUrl, subdomain: error.subdomain },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}




