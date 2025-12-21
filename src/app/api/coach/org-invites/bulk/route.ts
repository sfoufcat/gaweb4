import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyCoachRole, getCoachOrganizationId } from '@/lib/admin-utils-clerk';
import { nanoid } from 'nanoid';
import type { ProgramInvite, Funnel } from '@/types';

interface BulkInviteEntry {
  email: string;
  name?: string;
}

/**
 * POST /api/coach/org-invites/bulk
 * Create multiple invites at once (bulk import)
 * 
 * Body:
 * - funnelId: string (required)
 * - entries: Array<{ email: string, name?: string }>
 * - paymentStatus?: 'required' | 'pre_paid' | 'free'
 * - prePaidNote?: string
 * - sendEmail?: boolean (default: false)
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isCoach = await verifyCoachRole(userId);
    if (!isCoach) {
      return NextResponse.json({ error: 'Forbidden - Coach access required' }, { status: 403 });
    }

    const organizationId = await getCoachOrganizationId(userId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    const body = await req.json();
    const { 
      funnelId, 
      entries,
      paymentStatus = 'required',
      prePaidNote,
      sendEmail = false,
    } = body;

    if (!funnelId) {
      return NextResponse.json({ error: 'Funnel ID is required' }, { status: 400 });
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'Entries array is required' }, { status: 400 });
    }

    if (entries.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 entries per request' }, { status: 400 });
    }

    // Verify funnel belongs to org and get programId
    const funnelDoc = await adminDb.collection('funnels').doc(funnelId).get();
    if (!funnelDoc.exists) {
      return NextResponse.json({ error: 'Funnel not found' }, { status: 404 });
    }
    const funnel = funnelDoc.data() as Funnel;
    if (funnel.organizationId !== organizationId) {
      return NextResponse.json({ error: 'Funnel not in your organization' }, { status: 403 });
    }

    // Validate and dedupe entries
    const validEntries: BulkInviteEntry[] = [];
    const seenEmails = new Set<string>();
    const errors: Array<{ index: number; error: string }> = [];

    entries.forEach((entry: BulkInviteEntry, index: number) => {
      const email = entry.email?.trim().toLowerCase();
      
      if (!email) {
        errors.push({ index, error: 'Email is required' });
        return;
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ index, error: 'Invalid email format' });
        return;
      }

      if (seenEmails.has(email)) {
        errors.push({ index, error: 'Duplicate email in this batch' });
        return;
      }

      seenEmails.add(email);
      validEntries.push({
        email,
        name: entry.name?.trim() || undefined,
      });
    });

    if (validEntries.length === 0) {
      return NextResponse.json({
        success: false,
        created: 0,
        errors,
      }, { status: 400 });
    }

    // Check for existing invites with these emails
    const existingInvites = await adminDb
      .collection('program_invites')
      .where('organizationId', '==', organizationId)
      .where('funnelId', '==', funnelId)
      .get();

    const existingEmails = new Set(
      existingInvites.docs
        .map(doc => (doc.data() as ProgramInvite).email)
        .filter(Boolean)
    );

    // Create invites
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    const createdInvites: ProgramInvite[] = [];

    validEntries.forEach(entry => {
      if (existingEmails.has(entry.email)) {
        // Skip if already invited
        return;
      }

      const inviteCode = nanoid(8).toUpperCase();
      const inviteRef = adminDb.collection('program_invites').doc(inviteCode);

      const inviteData: ProgramInvite = {
        id: inviteCode,
        funnelId,
        programId: funnel.programId,
        organizationId,
        createdBy: userId,
        email: entry.email,
        name: entry.name,
        paymentStatus,
        prePaidNote: prePaidNote?.trim() || undefined,
        useCount: 0,
        createdAt: now,
      };

      batch.set(inviteRef, inviteData);
      createdInvites.push(inviteData);
    });

    await batch.commit();

    // TODO: Send emails if sendEmail is true
    // This would integrate with a transactional email service like Resend or SendGrid
    if (sendEmail && createdInvites.length > 0) {
      console.log(`[BULK_INVITE] Would send ${createdInvites.length} invite emails`);
      // await sendInviteEmails(createdInvites, funnel, program);
    }

    console.log(`[COACH_ORG_INVITES_BULK] Created ${createdInvites.length} invites for funnel ${funnelId}`);

    return NextResponse.json({
      success: true,
      created: createdInvites.length,
      skipped: validEntries.length - createdInvites.length,
      errors,
      invites: createdInvites,
    });
  } catch (error) {
    console.error('[COACH_ORG_INVITES_BULK]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

