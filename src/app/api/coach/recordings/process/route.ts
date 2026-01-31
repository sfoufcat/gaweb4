/**
 * Process Uploaded Recording API
 *
 * Called after a file has been directly uploaded to Firebase Storage.
 * Triggers transcription and summary generation.
 */

// Allow up to 5 minutes for processing (transcription + summary generation)
export const maxDuration = 300;

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { transcribeCallWithGroq, checkCreditsAvailable, deductCredits, refundCredits } from '@/lib/platform-transcription';
import { processCallSummary, autoFillWeekFromSummary } from '@/lib/ai/call-summary';
import { extractTextFromPdfBuffer } from '@/lib/pdf-extraction';
import { uploadToBunnyStorage } from '@/lib/bunny-storage';
import type { UserRole, OrgRole, ClerkPublicMetadata, UploadedRecording, Program, ProgramEnrollment, ProgramInstance } from '@/types';

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
 * - eventId?: Event ID to link the summary to (for calendar integration)
 * - squadId?: Squad ID (for squad calls)
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
      durationSeconds, // Actual duration from client (if available from compression)
      clientUserId,
      cohortId,
      programEnrollmentId,
      programId,
      weekId,
      eventId,
      squadId,
    } = body;

    if (!storagePath || !fileName || !fileSize) {
      return NextResponse.json(
        { error: 'storagePath, fileName, and fileSize are required' },
        { status: 400 }
      );
    }

    // Either clientUserId (individual) OR cohortId (group) OR eventId (calendar) is required
    if (!clientUserId && !cohortId && !eventId) {
      return NextResponse.json({ error: 'clientUserId, cohortId, or eventId is required' }, { status: 400 });
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

      // Use actual duration if provided (from client-side compression)
      // Otherwise fall back to file size estimate (will be corrected after transcription)
      if (durationSeconds && durationSeconds > 0) {
        estimatedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
      } else {
        // Fallback: rough estimate based on file size (1 MB per minute for uncompressed audio)
        estimatedMinutes = Math.max(1, Math.ceil(fileSize / (1024 * 1024)));
      }

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

    // Get a signed read URL for the uploaded file
    // Using signed URL instead of makePublic() for reliability - doesn't require public bucket policies
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(storagePath);

    // Generate signed URL for reading (expires in 1 hour - enough time for transcription)
    const [fileUrl] = await fileRef.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    console.log(`[RECORDING_PROCESS] Generated signed read URL for transcription: ${storagePath}`);

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

    const recordingData: Omit<UploadedRecording, 'id'> & { eventId?: string; squadId?: string } = {
      organizationId,
      uploadedBy: userId,
      clientUserId: clientUserId || undefined,
      programEnrollmentId: programEnrollmentId || undefined,
      cohortId: cohortId || undefined,
      programId: programId || undefined,
      weekId: weekId || undefined,
      eventId: eventId || undefined,
      squadId: squadId || undefined,
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

    // Process synchronously (awaited) so Vercel keeps the function alive
    // The client polls for status updates while this runs
    try {
      if (isFilePdf) {
        await processPdfUpload(
          organizationId,
          recordingId,
          storagePath,
          fileUrl,
          userId,
          clientUserId,
          programEnrollmentId,
          cohortContext,
          eventId
        );
      } else {
        await processRecording(
          organizationId,
          recordingId,
          fileUrl,
          userId,
          clientUserId,
          programEnrollmentId,
          estimatedMinutes,
          cohortContext,
          eventId
        );
      }

      // Get the final status to return
      const finalDoc = await recordingsRef.doc(recordingId).get();
      const finalData = finalDoc.data();

      return NextResponse.json({
        success: finalData?.status === 'completed',
        recordingId,
        summaryId: finalData?.callSummaryId || null,
        callSummaryId: finalData?.callSummaryId || null, // Keep for backwards compat
        status: finalData?.status || 'unknown',
        message: finalData?.status === 'completed'
          ? 'Recording processed successfully.'
          : finalData?.processingError || 'Processing completed with issues.',
      });
    } catch (processError) {
      console.error(`[RECORDING_PROCESS] Processing error for ${recordingId}:`, processError);
      // Return success: true because the recording was created, even if processing failed
      // The status endpoint will show the failure
      return NextResponse.json({
        success: true,
        recordingId,
        message: 'Recording received but processing encountered an error.',
      });
    }
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
  cohortContext: CohortContext | null,
  eventId?: string
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

    // Transcription is now complete (transcribeCallWithGroq awaits by default)
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

    // Link summary to event if eventId provided (calendar integration)
    if (eventId && summaryResult.summaryId) {
      await linkSummaryToEvent(eventId, summaryResult.summaryId);
    }

    // Check if program has autoGenerateSummary enabled - if so, auto-fill week
    if (programId && summaryResult.summaryId) {
      await tryAutoFillFromProgramSetting(
        orgId,
        programId,
        programEnrollmentId,
        cohortContext,
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
  cohortContext: CohortContext | null,
  eventId?: string
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

    // Generate a unique call ID for this PDF
    const callId = `pdf_${recordingId}`;

    // Store extracted text in Bunny Storage (avoids Firestore 1MB limit, 18x cheaper)
    const extractedTextUrl = await uploadToBunnyStorage(
      Buffer.from(pdfResult.text, 'utf-8'),
      `orgs/${orgId}/text/${recordingId}-extracted.txt`,
      'text/plain'
    );

    // Update with extracted text URL (not the full text)
    await recordingRef.update({
      status: 'summarizing',
      extractedTextUrl, // URL to Bunny Storage
      pageCount: pdfResult.pageCount,
    });

    // Store transcript in Bunny Storage as well
    const transcriptUrl = await uploadToBunnyStorage(
      Buffer.from(pdfResult.text, 'utf-8'),
      `orgs/${orgId}/transcripts/${callId}.txt`,
      'text/plain'
    );

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
      transcriptUrl, // URL to Bunny Storage instead of full text
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

    // Link summary to event if eventId provided (calendar integration)
    if (eventId && summaryResult.summaryId) {
      await linkSummaryToEvent(eventId, summaryResult.summaryId);
    }

    // Check if program has autoGenerateSummary enabled - if so, auto-fill week
    if (programId && summaryResult.summaryId) {
      await tryAutoFillFromProgramSetting(
        orgId,
        programId,
        programEnrollmentId,
        cohortContext,
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
 * Update program_instances week with recording URL and summary ID
 * Uses the new instance-based system instead of cohort_week_content
 */
async function updateCohortWeekContent(
  _orgId: string,
  cohortContext: CohortContext,
  recordingUrl: string,
  summaryId: string
): Promise<void> {
  try {
    const { cohortId, programId, weekId } = cohortContext;

    // Find the program instance for this cohort
    const instanceQuery = await adminDb
      .collection('program_instances')
      .where('cohortId', '==', cohortId)
      .where('programId', '==', programId)
      .limit(1)
      .get();

    if (instanceQuery.empty) {
      console.log(`[COHORT_WEEK_CONTENT] No instance found for cohort ${cohortId}, skipping link`);
      return;
    }

    const instanceDoc = instanceQuery.docs[0];
    const instanceData = instanceDoc.data();
    const weeks = instanceData.weeks || [];

    // Find the week by weekId (can be weekNumber as string or week.id)
    let weekIndex = -1;
    if (/^\d+$/.test(weekId)) {
      // weekId is a weekNumber
      const weekNum = parseInt(weekId, 10);
      weekIndex = weeks.findIndex((w: { weekNumber: number }) => w.weekNumber === weekNum);
    } else {
      // weekId is the week's id field
      weekIndex = weeks.findIndex((w: { id?: string }) => w.id === weekId);
    }

    if (weekIndex === -1) {
      console.log(`[COHORT_WEEK_CONTENT] Week ${weekId} not found in instance ${instanceDoc.id}`);
      return;
    }

    // Update the week with recording URL and summary ID
    const existingLinkedSummaryIds = weeks[weekIndex].linkedSummaryIds || [];
    if (!existingLinkedSummaryIds.includes(summaryId)) {
      existingLinkedSummaryIds.push(summaryId);
    }

    weeks[weekIndex] = {
      ...weeks[weekIndex],
      coachRecordingUrl: recordingUrl,
      linkedSummaryIds: existingLinkedSummaryIds,
      updatedAt: new Date().toISOString(),
    };

    // Update the instance
    await adminDb.collection('program_instances').doc(instanceDoc.id).update({
      weeks,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[COHORT_WEEK_CONTENT] Updated instance ${instanceDoc.id} week ${weekId} with recording and summary ${summaryId}`);
  } catch (error) {
    console.error('[COHORT_WEEK_CONTENT] Error updating instance:', error);
    // Don't throw - this is a secondary operation and shouldn't fail the main upload
  }
}

/**
 * Link a call summary to a calendar event
 * Updates the event's callSummaryId field
 */
async function linkSummaryToEvent(
  eventId: string,
  summaryId: string
): Promise<void> {
  try {
    await adminDb.collection('events').doc(eventId).update({
      callSummaryId: summaryId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`[RECORDING_PROCESS] Linked summary ${summaryId} to event ${eventId}`);
  } catch (error) {
    console.error(`[RECORDING_PROCESS] Failed to link summary to event:`, error);
    // Don't throw - the summary was still created successfully
  }
}

/**
 * Check if program has autoGenerateSummary enabled and trigger auto-fill if so
 */
async function tryAutoFillFromProgramSetting(
  orgId: string,
  programId: string,
  enrollmentId: string | null,
  cohortContext: CohortContext | null,
  summaryId: string
): Promise<void> {
  try {
    // Check program setting
    const programDoc = await adminDb.collection('programs').doc(programId).get();
    const program = programDoc.data() as Program | undefined;

    if (!program?.autoGenerateSummary) {
      return; // Auto-fill not enabled for this program
    }

    console.log(`[RECORDING_PROCESS] Program ${programId} has autoGenerateSummary enabled, triggering auto-fill`);

    // Find the instance ID
    let instanceId: string | undefined;
    let enrollment: ProgramEnrollment | undefined;

    if (enrollmentId) {
      // Individual program - find instance by enrollment
      const enrollmentDoc = await adminDb.collection('program_enrollments').doc(enrollmentId).get();
      if (enrollmentDoc.exists) {
        enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() } as ProgramEnrollment;
      }

      const instanceQuery = await adminDb
        .collection('program_instances')
        .where('enrollmentId', '==', enrollmentId)
        .where('programId', '==', programId)
        .limit(1)
        .get();

      if (!instanceQuery.empty) {
        instanceId = instanceQuery.docs[0].id;
      }
    } else if (cohortContext?.cohortId) {
      // Group program - find instance by cohort
      const instanceQuery = await adminDb
        .collection('program_instances')
        .where('cohortId', '==', cohortContext.cohortId)
        .where('programId', '==', programId)
        .limit(1)
        .get();

      if (!instanceQuery.empty) {
        instanceId = instanceQuery.docs[0].id;
      }
    }

    if (!instanceId) {
      console.log(`[RECORDING_PROCESS] No instance found for auto-fill`);
      return;
    }

    // Get instance to determine current week
    const instanceDoc = await adminDb.collection('program_instances').doc(instanceId).get();
    const instance = instanceDoc.data() as ProgramInstance | undefined;

    // Calculate current week index based on enrollment start date
    let weekIndex = 0;
    if (enrollment?.startedAt) {
      const startDate = new Date(enrollment.startedAt);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      weekIndex = Math.floor(daysSinceStart / 7);
      // Clamp to valid range
      if (instance?.weeks) {
        weekIndex = Math.min(weekIndex, instance.weeks.length - 1);
        weekIndex = Math.max(weekIndex, 0);
      }
    }

    // Determine auto-fill target
    // Rules:
    // 1. If next call exists → fill until next call
    // 2. If no next call → day-of-week logic: Mon-Wed = current week, Thu-Fri = next week
    let autoFillTarget: 'current' | 'next' | 'until_call' = 'until_call';

    // Check if there's a next call scheduled
    const now = new Date();
    const nextCallQuery = await adminDb
      .collection('events')
      .where('programId', '==', programId)
      .where('startDateTime', '>', now.toISOString())
      .where('status', '==', 'confirmed')
      .orderBy('startDateTime', 'asc')
      .limit(1)
      .get();

    if (nextCallQuery.empty) {
      // No next call - use day-of-week logic
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      autoFillTarget =
        dayOfWeek >= 4 && dayOfWeek <= 5 ? 'next' : // Thu-Fri
        'current'; // Mon-Wed and weekends default to current
      console.log(`[RECORDING_PROCESS] No next call found, using day-of-week logic: ${autoFillTarget}`);
    } else {
      console.log(`[RECORDING_PROCESS] Next call found, using until_call target`);
    }

    // Trigger auto-fill
    const fillResult = await autoFillWeekFromSummary(
      orgId,
      summaryId,
      {
        programId,
        instanceId,
        weekIndex,
        autoFillTarget,
        cohortId: cohortContext?.cohortId,
        enrollment,
      }
    );

    if (fillResult.success) {
      console.log(`[RECORDING_PROCESS] Auto-filled ${fillResult.daysUpdated} days, ${fillResult.weeksUpdated} weeks from summary ${summaryId}`);
    } else {
      console.error(`[RECORDING_PROCESS] Auto-fill failed:`, fillResult.error);
    }
  } catch (error) {
    console.error(`[RECORDING_PROCESS] Error in tryAutoFillFromProgramSetting:`, error);
    // Don't throw - auto-fill is a secondary operation
  }
}
