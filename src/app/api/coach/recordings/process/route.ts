/**
 * Process Uploaded Recording API
 *
 * Called after a file has been directly uploaded to Firebase Storage.
 * Triggers transcription and summary generation.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { transcribeCallWithGroq, checkCreditsAvailable, deductCredits, refundCredits } from '@/lib/platform-transcription';
import { processCallSummary } from '@/lib/ai/call-summary';
import { extractTextFromPdfBuffer } from '@/lib/pdf-extraction';
import type { UserRole, OrgRole, ClerkPublicMetadata, UploadedRecording } from '@/types';

// Helper to check if file is a PDF
const isPdf = (fileName: string): boolean => fileName.toLowerCase().endsWith('.pdf');

/**
 * POST /api/coach/recordings/process
 *
 * Process an uploaded recording (transcription + summary).
 *
 * Request body:
 * - storagePath: Path in Firebase Storage
 * - fileName: Original file name
 * - fileSize: File size in bytes
 * - clientUserId?: Client user ID (for individual programs)
 * - cohortId?: Cohort ID (for group programs)
 * - programEnrollmentId?: Enrollment context
 * - programId?: Program ID (for cohort mode)
 * - weekId?: Week ID (for cohort mode)
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

    const body = await request.json();
    const {
      storagePath,
      fileName,
      fileSize,
      clientUserId,
      cohortId,
      programEnrollmentId,
      programId,
      weekId,
    } = body;

    if (!storagePath || !fileName || !fileSize) {
      return NextResponse.json(
        { error: 'storagePath, fileName, and fileSize are required' },
        { status: 400 }
      );
    }

    // Either clientUserId (individual) OR cohortId (group) is required
    if (!clientUserId && !cohortId) {
      return NextResponse.json({ error: 'clientUserId or cohortId is required' }, { status: 400 });
    }

    const isFilePdf = isPdf(fileName);

    // For audio/video: check file size and credits
    // For PDFs: FREE, skip credit and size checks
    // Note: Groq supports up to 100MB via URL, but client compresses large files
    // to reduce upload time and bandwidth costs
    const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB max (Groq URL limit)
    let estimatedMinutes = 0;
    if (!isFilePdf) {
      // Sanity check - reject files over Groq's limit
      if (fileSize > MAX_UPLOAD_SIZE) {
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
        return NextResponse.json(
          {
            error: `File size (${fileSizeMB}MB) exceeds the 100MB limit.`,
          },
          { status: 413 }
        );
      }

      // Estimate duration (rough estimate, 1 MB per minute for audio)
      estimatedMinutes = Math.max(1, Math.ceil(fileSize / (1024 * 1024)));

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
    }

    // Get the public URL for the uploaded file
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    // Make file publicly accessible
    await fileRef.makePublic();
    const fileUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    // Create uploaded recording record
    const recordingsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings');

    // Determine file type for the record
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const fileType: 'audio' | 'video' | 'pdf' = isFilePdf
      ? 'pdf'
      : ['mp4', 'mov', 'webm'].includes(fileExtension || '')
        ? 'video'
        : 'audio';

    const recordingData: Omit<UploadedRecording, 'id'> = {
      organizationId,
      uploadedBy: userId,
      clientUserId: clientUserId || undefined,
      programEnrollmentId: programEnrollmentId || undefined,
      cohortId: cohortId || undefined,
      programId: programId || undefined,
      weekId: weekId || undefined,
      fileName,
      fileUrl,
      fileSizeBytes: fileSize,
      fileType,
      status: 'uploaded',
      createdAt: FieldValue.serverTimestamp() as unknown as string,
      updatedAt: FieldValue.serverTimestamp() as unknown as string,
    };

    const recordingRef = await recordingsRef.add(recordingData);
    const recordingId = recordingRef.id;

    // Deduct credits for audio/video only (PDFs are free)
    if (!isFilePdf) {
      const deductResult = await deductCredits(organizationId, estimatedMinutes);
      if (!deductResult.success) {
        await recordingRef.update({ status: 'failed', processingError: 'Failed to deduct credits' });
        return NextResponse.json({ error: 'Failed to process credits' }, { status: 500 });
      }
    }

    // Context for cohort-specific processing
    const cohortContext = cohortId && programId && weekId
      ? { cohortId, programId, weekId }
      : null;

    // Process asynchronously based on file type
    if (isFilePdf) {
      processPdfUpload(
        organizationId,
        recordingId,
        storagePath,
        fileUrl,
        userId,
        clientUserId,
        programEnrollmentId,
        cohortContext
      ).catch((error) => {
        console.error(`[RECORDING_PROCESS] Error processing PDF ${recordingId}:`, error);
      });
    } else {
      processRecording(
        organizationId,
        recordingId,
        fileUrl,
        userId,
        clientUserId,
        programEnrollmentId,
        estimatedMinutes,
        cohortContext
      ).catch((error) => {
        console.error(`[RECORDING_PROCESS] Error processing ${recordingId}:`, error);
      });
    }

    return NextResponse.json({
      success: true,
      recordingId,
      message: 'Recording received. Processing will begin shortly.',
    });
  } catch (error) {
    console.error('[RECORDING_PROCESS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Cohort context type for processing
type CohortContext = {
  cohortId: string;
  programId: string;
  weekId: string;
};

/**
 * Process uploaded recording (async)
 */
async function processRecording(
  orgId: string,
  recordingId: string,
  fileUrl: string,
  coachUserId: string,
  clientUserId: string | null,
  programEnrollmentId: string | null,
  estimatedMinutes: number,
  cohortContext: CohortContext | null
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

    // Get coach info
    const coachDoc = await adminDb.collection('users').doc(coachUserId).get();
    const coachName = coachDoc.data()?.displayName || 'Coach';

    // Get client info (only for individual programs)
    let clientName = 'Group Session';
    if (clientUserId) {
      const clientDoc = await adminDb.collection('users').doc(clientUserId).get();
      clientName = clientDoc.data()?.displayName || 'Client';
    }

    // Get program info - from cohort context or enrollment
    let programName: string | undefined;
    let programId: string | undefined = cohortContext?.programId;

    if (programEnrollmentId) {
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(programEnrollmentId)
        .get();
      if (enrollmentDoc.exists) {
        programId = enrollmentDoc.data()?.programId;
      }
    }

    if (programId) {
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      programName = programDoc.data()?.title;
    }

    // Generate summary
    const summaryResult = await processCallSummary(
      orgId,
      callId,
      transcriptionResult.transcriptionId,
      {
        hostUserId: coachUserId,
        hostName: coachName,
        clientUserId: clientUserId || undefined,
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

    // Update cohort_week_content if this is a cohort upload
    if (cohortContext && summaryResult.summaryId) {
      await updateCohortWeekContent(
        orgId,
        cohortContext,
        fileUrl,
        summaryResult.summaryId
      );
    }

    console.log(`[RECORDING_PROCESS] Completed processing ${recordingId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await recordingRef.update({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Refund credits on failure
    await refundCredits(orgId, estimatedMinutes);

    console.error(`[RECORDING_PROCESS] Failed processing ${recordingId}:`, error);
  }
}

/**
 * Process PDF upload - extract text and generate summary
 * PDFs are FREE (no credits used)
 */
async function processPdfUpload(
  orgId: string,
  recordingId: string,
  storagePath: string,
  fileUrl: string,
  coachUserId: string,
  clientUserId: string | null,
  programEnrollmentId: string | null,
  cohortContext: CohortContext | null
): Promise<void> {
  const recordingRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('uploaded_recordings')
    .doc(recordingId);

  try {
    // Update status to processing
    await recordingRef.update({ status: 'transcribing' });

    // Download file from storage
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);
    const [fileBuffer] = await fileRef.download();

    // Extract text from PDF
    const pdfResult = await extractTextFromPdfBuffer(fileBuffer);

    if (!pdfResult.text || pdfResult.text.length < 50) {
      throw new Error('PDF appears to be empty or contains too little text');
    }

    // Update with extracted text
    await recordingRef.update({
      status: 'summarizing',
      extractedText: pdfResult.text,
      pageCount: pdfResult.pageCount,
    });

    // Generate a unique call ID for this PDF
    const callId = `pdf_${recordingId}`;

    // Create a "transcription" record for the PDF (for consistency with audio flow)
    const transcriptionsRef = adminDb
      .collection('organizations')
      .doc(orgId)
      .collection('platform_transcriptions');

    const transcriptionDoc = await transcriptionsRef.add({
      organizationId: orgId,
      callId,
      recordingUrl: fileUrl,
      status: 'completed',
      transcript: pdfResult.text,
      durationSeconds: 0, // PDFs don't have duration
      language: 'en',
      segments: [],
      createdAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
    });

    // Get coach info
    const coachDoc = await adminDb.collection('users').doc(coachUserId).get();
    const coachName = coachDoc.data()?.displayName || 'Coach';

    // Get client info (only for individual programs)
    let clientName = 'Group Session';
    if (clientUserId) {
      const clientDoc = await adminDb.collection('users').doc(clientUserId).get();
      clientName = clientDoc.data()?.displayName || 'Client';
    }

    // Get program info - from cohort context or enrollment
    let programName: string | undefined;
    let programId: string | undefined = cohortContext?.programId;

    if (programEnrollmentId) {
      const enrollmentDoc = await adminDb
        .collection('program_enrollments')
        .doc(programEnrollmentId)
        .get();
      if (enrollmentDoc.exists) {
        programId = enrollmentDoc.data()?.programId;
      }
    }

    if (programId) {
      const programDoc = await adminDb.collection('programs').doc(programId).get();
      programName = programDoc.data()?.title;
    }

    // Generate summary using the same AI service
    const summaryResult = await processCallSummary(
      orgId,
      callId,
      transcriptionDoc.id,
      {
        hostUserId: coachUserId,
        hostName: coachName,
        clientUserId: clientUserId || undefined,
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

    // Update cohort_week_content if this is a cohort upload
    if (cohortContext && summaryResult.summaryId) {
      await updateCohortWeekContent(
        orgId,
        cohortContext,
        fileUrl,
        summaryResult.summaryId
      );
    }

    console.log(`[RECORDING_PROCESS] Completed processing PDF ${recordingId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await recordingRef.update({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // No credits to refund for PDFs

    console.error(`[RECORDING_PROCESS] Failed processing PDF ${recordingId}:`, error);
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

/**
 * Update cohort_week_content with recording URL and summary ID
 */
async function updateCohortWeekContent(
  orgId: string,
  cohortContext: CohortContext,
  recordingUrl: string,
  summaryId: string
): Promise<void> {
  try {
    const { cohortId, programId, weekId } = cohortContext;

    // Check if content already exists
    const existingQuery = await adminDb
      .collection('cohort_week_content')
      .where('cohortId', '==', cohortId)
      .where('programWeekId', '==', weekId)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      // Update existing content
      const docId = existingQuery.docs[0].id;
      const existingData = existingQuery.docs[0].data();

      // Add summary ID to linked summaries if not already present
      const linkedSummaryIds = existingData.linkedSummaryIds || [];
      if (!linkedSummaryIds.includes(summaryId)) {
        linkedSummaryIds.push(summaryId);
      }

      await adminDb.collection('cohort_week_content').doc(docId).update({
        coachRecordingUrl: recordingUrl,
        linkedSummaryIds,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[COHORT_WEEK_CONTENT] Updated content ${docId} with recording`);
    } else {
      // Create new content
      const newContent = {
        cohortId,
        programWeekId: weekId,
        programId,
        organizationId: orgId,
        coachRecordingUrl: recordingUrl,
        coachRecordingNotes: null,
        linkedSummaryIds: [summaryId],
        linkedCallEventIds: [],
        manualNotes: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const docRef = await adminDb.collection('cohort_week_content').add(newContent);
      console.log(`[COHORT_WEEK_CONTENT] Created content ${docRef.id} with recording`);
    }
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT] Error updating content:', error);
    // Don't throw - this is a secondary operation and shouldn't fail the main upload
  }
}
