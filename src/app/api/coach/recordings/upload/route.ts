/**
 * Recording Upload API
 *
 * Handles uploading external call recordings for AI summary generation.
 * Uploads to Firebase Storage, triggers transcription, then generates summary.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { transcribeCallWithGroq, checkCreditsAvailable, deductCredits, refundCredits } from '@/lib/platform-transcription';
import { processCallSummary } from '@/lib/ai/call-summary';
import type { UserRole, OrgRole, ClerkPublicMetadata, UploadedRecording } from '@/types';

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Accepted audio formats
const ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/wav',
  'audio/webm',
  'audio/ogg',
  'video/mp4', // Allow video files (will only use audio)
  'video/webm',
];

/**
 * POST /api/coach/recordings/upload
 *
 * Upload an external call recording for AI summary generation.
 *
 * Form data:
 * - file: Audio/video file
 * - clientUserId: Client user ID
 * - programEnrollmentId?: Optional enrollment context
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const publicMetadata = sessionClaims?.publicMetadata as ClerkPublicMetadata & { role?: UserRole; orgRole?: OrgRole };
    const role = publicMetadata?.role;
    const orgRole = publicMetadata?.orgRole;

    if (!canAccessCoachDashboard(role, orgRole)) {
      return NextResponse.json({ error: 'Coach access required' }, { status: 403 });
    }

    const organizationId = await getEffectiveOrgId();
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientUserId = formData.get('clientUserId') as string | null;
    const programEnrollmentId = formData.get('programEnrollmentId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!clientUserId) {
      return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 });
    }

    // Validate file type
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }

    // Estimate duration (rough estimate, 1 MB per minute for audio)
    const estimatedMinutes = Math.max(1, Math.ceil(file.size / (1024 * 1024)));

    // Check credits availability
    const { available, remainingMinutes } = await checkCreditsAvailable(
      organizationId,
      estimatedMinutes
    );

    if (!available) {
      return NextResponse.json(
        {
          error: `Insufficient credits. Need ~${estimatedMinutes} minutes, have ${remainingMinutes} remaining.`,
        },
        { status: 402 }
      );
    }

    // Generate unique file path
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'mp3';
    const storagePath = `organizations/${organizationId}/recordings/${timestamp}_${file.name}`;

    // Upload to Firebase Storage
    const bucket = adminStorage.bucket();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileRef = bucket.file(storagePath);

    await fileRef.save(fileBuffer, {
      contentType: file.type,
      metadata: {
        organizationId,
        uploadedBy: userId,
        clientUserId,
      },
    });

    // Make file publicly accessible (or use signed URLs)
    await fileRef.makePublic();
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Create uploaded recording record
    const recordingsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings');

    const recordingData: Omit<UploadedRecording, 'id'> = {
      organizationId,
      uploadedBy: userId,
      clientUserId,
      programEnrollmentId: programEnrollmentId || undefined,
      fileName: file.name,
      fileUrl,
      fileSizeBytes: file.size,
      status: 'uploaded',
      createdAt: FieldValue.serverTimestamp() as unknown as string,
      updatedAt: FieldValue.serverTimestamp() as unknown as string,
    };

    const recordingRef = await recordingsRef.add(recordingData);
    const recordingId = recordingRef.id;

    // Deduct credits (will refund on failure)
    const deductResult = await deductCredits(organizationId, estimatedMinutes);
    if (!deductResult.success) {
      await recordingRef.update({ status: 'failed', processingError: 'Failed to deduct credits' });
      return NextResponse.json({ error: 'Failed to process credits' }, { status: 500 });
    }

    // Process asynchronously
    processRecording(
      organizationId,
      recordingId,
      fileUrl,
      userId,
      clientUserId,
      programEnrollmentId,
      estimatedMinutes
    ).catch((error) => {
      console.error(`[RECORDING_UPLOAD] Error processing ${recordingId}:`, error);
    });

    return NextResponse.json({
      success: true,
      recordingId,
      message: 'Recording uploaded. Processing will begin shortly.',
    });
  } catch (error) {
    console.error('[RECORDING_UPLOAD] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Process uploaded recording (async)
 */
async function processRecording(
  orgId: string,
  recordingId: string,
  fileUrl: string,
  coachUserId: string,
  clientUserId: string,
  programEnrollmentId: string | null,
  estimatedMinutes: number
): Promise<void> {
  const recordingRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('uploaded_recordings')
    .doc(recordingId);

  try {
    // Update status to transcribing
    await recordingRef.update({ status: 'transcribing' });

    // Generate a unique call ID for this uploaded recording
    const callId = `upload_${recordingId}`;

    // Transcribe
    const transcriptionResult = await transcribeCallWithGroq(
      orgId,
      callId,
      fileUrl
    );

    if (!transcriptionResult.success || !transcriptionResult.transcriptionId) {
      throw new Error(transcriptionResult.error || 'Transcription failed');
    }

    // Wait for transcription to complete
    await waitForTranscription(orgId, transcriptionResult.transcriptionId);

    // Get transcription to extract duration
    const transcriptionDoc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions')
      .doc(transcriptionResult.transcriptionId)
      .get();

    const transcriptionData = transcriptionDoc.data();
    const actualDuration = transcriptionData?.durationSeconds || 0;

    // Update recording with duration
    await recordingRef.update({
      status: 'summarizing',
      durationSeconds: actualDuration,
    });

    // Get coach and client info for summary
    const [coachDoc, clientDoc] = await Promise.all([
      adminDb.collection('users').doc(coachUserId).get(),
      adminDb.collection('users').doc(clientUserId).get(),
    ]);

    const coachName = coachDoc.data()?.displayName || 'Coach';
    const clientName = clientDoc.data()?.displayName || 'Client';

    // Get program info if applicable
    let programName: string | undefined;
    let programId: string | undefined;
    if (programEnrollmentId) {
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(programEnrollmentId)
        .get();
      if (enrollmentDoc.exists) {
        programId = enrollmentDoc.data()?.programId;
        if (programId) {
          const programDoc = await adminDb.collection('programs').doc(programId).get();
          programName = programDoc.data()?.title;
        }
      }
    }

    // Generate summary
    const summaryResult = await processCallSummary(
      orgId,
      callId,
      transcriptionResult.transcriptionId,
      {
        hostUserId: coachUserId,
        hostName: coachName,
        clientUserId,
        clientName,
        programId,
        programEnrollmentId: programEnrollmentId || undefined,
        programName,
        recordingUrl: fileUrl,
        callStartedAt: new Date().toISOString(),
        callEndedAt: new Date().toISOString(),
      }
    );

    if (!summaryResult.success) {
      throw new Error(summaryResult.error || 'Summary generation failed');
    }

    // Update recording with summary ID
    await recordingRef.update({
      status: 'completed',
      callSummaryId: summaryResult.summaryId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[RECORDING_UPLOAD] Completed processing ${recordingId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await recordingRef.update({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Refund credits on failure
    await refundCredits(orgId, estimatedMinutes);

    console.error(`[RECORDING_UPLOAD] Failed processing ${recordingId}:`, error);
  }
}

/**
 * Wait for transcription to complete
 */
async function waitForTranscription(
  orgId: string,
  transcriptionId: string,
  maxAttempts = 120,
  intervalMs = 5000
): Promise<void> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const doc = await adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions')
      .doc(transcriptionId)
      .get();

    if (!doc.exists) {
      throw new Error('Transcription not found');
    }

    const status = doc.data()?.status;

    if (status === 'completed') {
      return;
    }

    if (status === 'failed') {
      throw new Error(doc.data()?.error || 'Transcription failed');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Transcription timeout');
}
