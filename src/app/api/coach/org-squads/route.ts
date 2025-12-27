import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireCoachWithOrg } from '@/lib/admin-utils-clerk';
import { getStreamServerClient } from '@/lib/stream-server';
import type { Squad, SquadVisibility } from '@/types';

interface SquadWithDetails extends Squad {
  coachName?: string;
  coachImageUrl?: string;
  memberCount: number;
}

/**
 * GET /api/coach/org-squads
 * Fetches all squads belonging to the coach's organization
 * 
 * For multi-tenancy: Only returns squads with matching organizationId
 */
export async function GET() {
  try {
    // Check authorization and get organizationId
    const { organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_SQUADS] Fetching squads for organization: ${organizationId}`);

    // Fetch squads that belong to this organization
    // Note: For backwards compatibility, also include squads where coachId matches
    // a user in this organization (migration path for existing data)
    const squadsSnapshot = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .get();

    const squads: SquadWithDetails[] = [];
    const squadIds = squadsSnapshot.docs.map(doc => doc.id);

    console.log(`[COACH_ORG_SQUADS] Found ${squadIds.length} squads in organization ${organizationId}`);

    // Fetch member counts for these squads
    const memberCounts = new Map<string, number>();
    if (squadIds.length > 0) {
      // Batch in chunks of 10
      for (let i = 0; i < squadIds.length; i += 10) {
        const chunk = squadIds.slice(i, i + 10);
        const membersSnapshot = await adminDb
          .collection('squadMembers')
          .where('squadId', 'in', chunk)
          .get();
        
        membersSnapshot.forEach((doc) => {
          const data = doc.data();
          const squadId = data.squadId;
          memberCounts.set(squadId, (memberCounts.get(squadId) || 0) + 1);
        });
      }
    }

    // Collect all coach IDs to fetch their names
    const coachIds = new Set<string>();
    squadsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.coachId) {
        coachIds.add(data.coachId);
      }
    });

    // Fetch coach details from Clerk
    const coachDetails = new Map<string, { name: string; imageUrl: string }>();
    if (coachIds.size > 0) {
      const client = await clerkClient();
      for (const coachId of coachIds) {
        try {
          const user = await client.users.getUser(coachId);
          const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
          coachDetails.set(coachId, {
            name,
            imageUrl: user.imageUrl || '',
          });
        } catch (err) {
          console.error(`[COACH_ORG_SQUADS] Failed to fetch coach ${coachId}:`, err);
          coachDetails.set(coachId, { name: 'Unknown', imageUrl: '' });
        }
      }
    }

    // Build squads array and auto-generate slugs for squads missing them
    const slugUpdates: Promise<void>[] = [];
    
    for (const doc of squadsSnapshot.docs) {
      const data = doc.data();
      const coachInfo = data.coachId ? coachDetails.get(data.coachId) : null;
      
      // Auto-generate slug if missing
      let slug = data.slug || '';
      if (!slug && data.name) {
        slug = generateSlug(data.name);
        
        // Save the generated slug to the database (fire and forget, don't block response)
        if (slug) {
          slugUpdates.push(
            adminDb.collection('squads').doc(doc.id).update({
              slug,
              updatedAt: new Date().toISOString(),
            }).then(() => {
              console.log(`[COACH_ORG_SQUADS] Auto-generated slug "${slug}" for squad ${doc.id}`);
            }).catch((err) => {
              console.error(`[COACH_ORG_SQUADS] Failed to save slug for squad ${doc.id}:`, err);
            })
          );
        }
      }
      
      squads.push({
        id: doc.id,
        name: data.name || '',
        slug,
        avatarUrl: data.avatarUrl || '',
        description: data.description,
        visibility: (data.visibility as SquadVisibility) || 'public',
        timezone: data.timezone || 'UTC',
        memberIds: data.memberIds || [],
        inviteCode: data.inviteCode,
        hasCoach: !!data.coachId,
        coachId: data.coachId || null,
        organizationId: data.organizationId,
        programId: data.programId || null,
        capacity: data.capacity,
        priceInCents: data.priceInCents || 0,
        currency: data.currency || 'usd',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        streak: data.streak,
        avgAlignment: data.avgAlignment,
        chatChannelId: data.chatChannelId,
        coachName: coachInfo?.name,
        coachImageUrl: coachInfo?.imageUrl,
        memberCount: memberCounts.get(doc.id) || 0,
      } as SquadWithDetails);
    }
    
    // Wait for slug updates to complete (don't block the response too long)
    if (slugUpdates.length > 0) {
      Promise.all(slugUpdates).catch(() => {
        // Errors already logged individually
      });
    }

    // Sort by creation date (newest first)
    squads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ 
      squads,
      totalCount: squads.length,
      organizationId,
    });
  } catch (error) {
    console.error('[COACH_ORG_SQUADS_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

/**
 * Generate a unique invite code for private squads
 * Format: GA-XXXXXX (6 alphanumeric characters)
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars: I, O, 0, 1
  let code = 'GA-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate a URL-friendly slug from a name
 * Converts to lowercase, replaces spaces with hyphens, removes special characters
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
}

/**
 * POST /api/coach/org-squads
 * Creates a new squad within the coach's organization
 * 
 * For multi-tenancy: Automatically sets organizationId from the coach's organization
 */
export async function POST(req: Request) {
  try {
    // Check authorization and get organizationId
    const { userId, organizationId } = await requireCoachWithOrg();

    console.log(`[COACH_ORG_SQUADS] Creating squad for organization: ${organizationId}`);

    const body = await req.json();
    const { name, slug: providedSlug, description, avatarUrl, visibility, timezone, coachId, programId, capacity, priceInCents, currency } = body as {
      name: string;
      slug?: string;
      description?: string;
      avatarUrl?: string;
      visibility?: SquadVisibility;
      timezone?: string;
      coachId?: string | null;
      programId?: string | null;
      capacity?: number | null;
      priceInCents?: number;
      currency?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Squad name is required' }, { status: 400 });
    }

    // Generate slug from name if not provided
    const slug = providedSlug?.trim() || generateSlug(name);
    
    if (!slug) {
      return NextResponse.json({ error: 'Could not generate a valid slug from the squad name' }, { status: 400 });
    }

    // Check if slug already exists in this organization
    const existingSlug = await adminDb
      .collection('squads')
      .where('organizationId', '==', organizationId)
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (!existingSlug.empty) {
      return NextResponse.json(
        { error: `Squad with slug "${slug}" already exists in your organization` },
        { status: 400 }
      );
    }

    // Generate invite code for private squads
    let inviteCode: string | undefined;
    const squadVisibility = (visibility || 'public') as SquadVisibility;
    if (squadVisibility === 'private') {
      // Ensure unique invite code
      let isUnique = false;
      while (!isUnique) {
        inviteCode = generateInviteCode();
        const existing = await adminDb.collection('squads')
          .where('inviteCode', '==', inviteCode)
          .limit(1)
          .get();
        isUnique = existing.empty;
      }
    }

    // Create squad in Firestore first to get the ID
    const now = new Date().toISOString();
    const squadRef = await adminDb.collection('squads').add({
      name: name.trim(),
      slug, // URL-friendly identifier for funnel links
      description: description?.trim() || '',
      avatarUrl: avatarUrl || '',
      visibility: squadVisibility,
      timezone: timezone || 'UTC',
      memberIds: [],
      inviteCode: inviteCode || undefined,
      hasCoach: !!coachId, // hasCoach based on whether a coach is assigned
      coachId: coachId || null,
      programId: programId || null, // Attach to program
      capacity: capacity || null, // Squad cap
      priceInCents: priceInCents || 0, // Price to join
      currency: currency || 'usd',
      organizationId, // Multi-tenancy: scope to coach's organization
      createdAt: now,
      updatedAt: now,
    });

    // Create Stream Chat channel for the squad
    const streamClient = await getStreamServerClient();
    const channelId = `squad-${squadRef.id}`;

    // Get creator's details from Clerk
    const clerk = await clerkClient();
    const creatorClerkUser = await clerk.users.getUser(userId);

    // Create the creator user in Stream if they don't exist
    await streamClient.upsertUser({
      id: userId,
      name: `${creatorClerkUser.firstName || ''} ${creatorClerkUser.lastName || ''}`.trim() || 'Coach',
      image: creatorClerkUser.imageUrl,
    });

    // If there's a coach and it's different from creator, upsert them in Stream too
    const initialMembers = [userId];
    if (coachId && coachId !== userId) {
      const coachClerkUser = await clerk.users.getUser(coachId);
      await streamClient.upsertUser({
        id: coachId,
        name: `${coachClerkUser.firstName || ''} ${coachClerkUser.lastName || ''}`.trim() || 'Coach',
        image: coachClerkUser.imageUrl,
      });
      initialMembers.push(coachId);
    }

    // Create the squad group chat channel
    const channel = streamClient.channel('messaging', channelId, {
      members: initialMembers,
      created_by_id: userId,
      name: name.trim(),
      image: avatarUrl || undefined,
      isSquadChannel: true,
    } as Record<string, unknown>);
    await channel.create();

    // Update squad with chatChannelId
    await squadRef.update({
      chatChannelId: channelId,
    });

    // If a coach is assigned, add them as a proper Firebase member
    const memberIds: string[] = [];
    if (coachId) {
      // Get coach details from Clerk (may already have it if coachId === userId)
      const coachClerkUser = coachId === userId 
        ? creatorClerkUser 
        : await clerk.users.getUser(coachId);
      
      // Add coach to memberIds
      memberIds.push(coachId);
      await squadRef.update({
        memberIds: [coachId],
        updatedAt: now,
      });
      
      // Create squadMember document for the coach
      await adminDb.collection('squadMembers').add({
        squadId: squadRef.id,
        userId: coachId,
        roleInSquad: 'coach',
        firstName: coachClerkUser.firstName || '',
        lastName: coachClerkUser.lastName || '',
        imageUrl: coachClerkUser.imageUrl || '',
        createdAt: now,
        updatedAt: now,
      });
      
      // Update coach's user document with squadIds array
      // Check if user doc exists, create if not
      const coachUserDoc = await adminDb.collection('users').doc(coachId).get();
      const coachUserData = coachUserDoc.exists ? coachUserDoc.data() : null;
      const existingSquadIds: string[] = coachUserData?.squadIds || [];
      
      if (!existingSquadIds.includes(squadRef.id)) {
        if (coachUserDoc.exists) {
          await adminDb.collection('users').doc(coachId).update({
            squadIds: [...existingSquadIds, squadRef.id],
            updatedAt: now,
          });
        } else {
          await adminDb.collection('users').doc(coachId).set({
            squadIds: [squadRef.id],
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      
      console.log(`[COACH_ORG_SQUADS] Added coach ${coachId} as member of squad ${squadRef.id}`);
    }

    const squadData: Partial<Squad> = {
      name: name.trim(),
      slug,
      description: description?.trim() || '',
      avatarUrl: avatarUrl || '',
      visibility: squadVisibility,
      timezone: timezone || 'UTC',
      memberIds,
      inviteCode,
      hasCoach: !!coachId,
      coachId: coachId || null,
      programId: programId || null,
      capacity: capacity || undefined,
      priceInCents: priceInCents || 0,
      currency: currency || 'usd',
      chatChannelId: channelId,
      organizationId,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`[COACH_ORG_SQUADS] Created squad ${squadRef.id} in organization ${organizationId}`);

    return NextResponse.json({ 
      success: true, 
      squad: { id: squadRef.id, ...squadData } 
    });
  } catch (error) {
    console.error('[COACH_ORG_SQUADS_CREATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (message.includes('Forbidden') || message.includes('Coach access')) {
      return NextResponse.json({ error: 'Forbidden: Coach access required' }, { status: 403 });
    }
    if (message.includes('Organization not found')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
