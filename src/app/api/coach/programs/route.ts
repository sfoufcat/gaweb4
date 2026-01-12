/**
 * Coach API: Program Management
 *
 * POST /api/coach/programs - Create a new program from scratch
 *
 * Creates a new program with optional modules based on wizard input
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import type { Program } from '@/types';

interface CreateProgramRequest {
  // Step 1: Type
  type: 'individual' | 'group';

  // Step 2: Structure
  durationType?: 'fixed' | 'evergreen'; // default 'fixed' for backward compatibility
  durationWeeks: number;
  numModules: number;
  includeWeekends: boolean;

  // Step 3: Details
  name: string;
  description?: string;
  coverImage?: string;

  // Step 4: Settings
  visibility: 'public' | 'private';
  pricing: 'free' | 'paid';
  price?: number; // in dollars
  status: 'active' | 'draft';
  
  // Subscription settings (only valid for evergreen programs)
  subscriptionEnabled?: boolean;
  billingInterval?: 'monthly' | 'quarterly' | 'yearly';
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w-]+/g, '')     // Remove all non-word chars
    .replace(/--+/g, '-')        // Replace multiple - with single -
    .replace(/^-+/, '')          // Trim - from start of text
    .replace(/-+$/, '');         // Trim - from end of text
}

export async function POST(request: NextRequest) {
  try {
    const { userId, organizationId } = await requireCoachWithOrg();
    const body: CreateProgramRequest = await request.json();

    const {
      type,
      durationType,
      durationWeeks,
      numModules,
      includeWeekends,
      name,
      description,
      coverImage,
      visibility,
      pricing,
      price,
      status,
      subscriptionEnabled,
      billingInterval,
    } = body;

    // Validate required fields
    if (!type || !name || !durationWeeks) {
      return NextResponse.json(
        { error: 'type, name, and durationWeeks are required' },
        { status: 400 }
      );
    }

    // Validate subscription settings: recurring billing is only allowed for evergreen programs
    const effectiveDurationType = durationType || 'fixed';
    if (effectiveDurationType !== 'evergreen' && subscriptionEnabled) {
      return NextResponse.json(
        { error: 'Recurring billing is only available for Evergreen programs. Fixed-duration programs must use one-time billing.' },
        { status: 400 }
      );
    }

    // Validate billing interval is required when subscription is enabled
    if (subscriptionEnabled && !billingInterval) {
      return NextResponse.json(
        { error: 'Billing interval is required when subscription is enabled.' },
        { status: 400 }
      );
    }

    console.log(`[CREATE_PROGRAM] User ${userId} creating program "${name}" for org ${organizationId}`);

    // Generate slug from name
    let slug = slugify(name);

    // Check if slug is already used in this org
    const existingProgram = await adminDb
      .collection('programs')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    // If slug exists, append a random suffix
    if (!existingProgram.empty) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Calculate length in days
    const daysPerWeek = includeWeekends ? 7 : 5;
    const lengthDays = durationWeeks * daysPerWeek;

    // Create new program
    const programRef = adminDb.collection('programs').doc();
    const programId = programRef.id;
    const now = new Date().toISOString();

    const newProgram: Omit<Program, 'id'> = {
      organizationId,
      name,
      slug,
      description: description || '',
      coverImageUrl: coverImage,
      type: type === 'group' ? 'group' : 'individual',
      lengthDays,
      lengthWeeks: durationWeeks,
      durationType: effectiveDurationType,
      priceInCents: pricing === 'paid' && price ? Math.round(price * 100) : 0,
      currency: 'usd',
      // Subscription settings (only for evergreen programs with paid pricing)
      subscriptionEnabled: effectiveDurationType === 'evergreen' && subscriptionEnabled === true,
      billingInterval: effectiveDurationType === 'evergreen' && subscriptionEnabled ? (billingInterval || 'monthly') : undefined,
      defaultHabits: [],
      includeWeekends,
      hasModules: numModules > 1,
      isActive: status === 'active',
      isPublished: visibility === 'public',
      createdAt: now,
      updatedAt: now,
    };

    // Create modules and collect their IDs for week assignment
    const moduleIds: string[] = [];
    const weeksPerModule = Math.max(1, Math.ceil(durationWeeks / (numModules || 1)));

    if (numModules > 0) {
      const batch = adminDb.batch();

      for (let i = 0; i < numModules; i++) {
        const moduleRef = adminDb.collection('program_modules').doc();
        const moduleNumber = i + 1;
        moduleIds.push(moduleRef.id);

        // Calculate start and end weeks for this module
        const startWeek = i * weeksPerModule + 1;
        const endWeek = Math.min((i + 1) * weeksPerModule, durationWeeks);

        batch.set(moduleRef, {
          id: moduleRef.id,
          programId,
          organizationId,
          name: `Module ${moduleNumber}`,
          description: '',
          order: i,
          startWeek,
          endWeek,
          weekCount: endWeek - startWeek + 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();
      console.log(`[CREATE_PROGRAM] Created ${numModules} modules for program ${programId}`);
    }

    // Create weeks and auto-distribute to modules
    const weeks: Array<{
      id: string;
      programId: string;
      organizationId: string;
      moduleId: string;
      order: number;
      weekNumber: number;
      startDayIndex: number;
      endDayIndex: number;
      createdAt: string;
      updatedAt: string;
    }> = [];

    for (let weekNum = 1; weekNum <= durationWeeks; weekNum++) {
      // Calculate which module this week belongs to
      const moduleIndex = Math.floor((weekNum - 1) / weeksPerModule);
      const moduleId = moduleIds[Math.min(moduleIndex, moduleIds.length - 1)] || '';
      const orderWithinModule = ((weekNum - 1) % weeksPerModule) + 1;

      // Calculate day indices
      const startDayIndex = (weekNum - 1) * daysPerWeek + 1;
      const endDayIndex = Math.min(startDayIndex + daysPerWeek - 1, lengthDays);

      weeks.push({
        id: crypto.randomUUID(),
        programId,
        organizationId,
        moduleId,
        order: orderWithinModule,
        weekNumber: weekNum,
        startDayIndex,
        endDayIndex,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Store weeks embedded in the program document
    await programRef.set({
      id: programId,
      ...newProgram,
      weeks,
    });

    console.log(`[CREATE_PROGRAM] Successfully created program ${programId} with ${lengthDays} days and ${weeks.length} weeks distributed across ${numModules} modules`);

    return NextResponse.json({
      success: true,
      program: {
        id: programId,
        name,
        slug,
        lengthDays,
        lengthWeeks: durationWeeks,
        numModules,
      },
    });

  } catch (error) {
    console.error('[CREATE_PROGRAM] Error creating program:', error);

    if (error instanceof Error && error.message.includes('Not authenticated')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message.includes('coach role')) {
      return NextResponse.json(
        { error: 'Coach role required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create program' },
      { status: 500 }
    );
  }
}
