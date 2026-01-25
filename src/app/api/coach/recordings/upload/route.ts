/**
 * Recording Upload API
 *
 * Handles uploading external call recordings for AI summary generation.
 * Uploads to Firebase Storage, triggers transcription, then generates summary.
 */

import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { canAccessCoachDashboard } from '@/lib/admin-utils-shared';
import { getEffectiveOrgId } from '@/lib/tenant/context';
import { transcribeCallWithGroq, checkCreditsAvailable, deductCredits, refundCredits } from '@/lib/platform-transcription';
import { processCallSummary } from '@/lib/ai/call-summary';
import { extractTextFromPdfBuffer } from '@/lib/pdf-extraction';
import { uploadToBunnyStorage, isBunnyStorageConfigured } from '@/lib/bunny-storage';
import type { UserRole, OrgRole, ClerkPublicMetadata, UploadedRecording } from '@/types';

// Max file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// Accepted audio formats
const ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a', // macOS/Safari often reports m4a files with this MIME type
  'audio/aac', // AAC audio (sometimes reported for m4a)
  'audio/x-aac', // AAC variant
  'audio/wav',
  'audio/x-wav', // WAV variant
  'audio/webm',
  'audio/ogg',
  'video/mp4', // Allow video files (will only use audio)
  'video/webm',
  'video/quicktime', // MOV files
  'application/pdf', // PDF documents for text extraction
];

// Helper to check if file is a PDF
const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

/**
 * POST /api/coach/recordings/upload
 *
 * Upload an external call recording or PDF for AI summary generation.
 *
 * Form data:
 * - file: Audio/video file or PDF document
 * - clientUserId: Client user ID
 * - programEnrollmentId?: Optional enrollment context
 *
 * Note: PDFs are FREE (no credits charged). Audio/video uses credits.
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
    // Cohort-specific fields (for group programs)
    const cohortId = formData.get('cohortId') as string | null;
    const programId = formData.get('programId') as string | null;
    const weekId = formData.get('weekId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Either clientUserId (individual) OR cohortId (group) is required
    if (!clientUserId && !cohortId) {
      return NextResponse.json({ error: 'clientUserId or cohortId is required' }, { status: 400 });
    }

    // Validate file type
    // Also check by file extension as a fallback for browsers that report wrong MIME types
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['.mp3', '.m4a', '.wav', '.webm', '.ogg', '.mp4', '.mov', '.pdf'];

    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !validExtensions.includes(fileExtension)) {
      console.log(`[RECORDING_UPLOAD] Rejected file type: ${file.type}, extension: ${fileExtension}`);
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Accepted formats: ${validExtensions.join(', ')}` },
        { status: 400 }
      );
    }

    // Log actual MIME type for debugging
    console.log(`[RECORDING_UPLOAD] Accepting file: ${file.name}, type: ${file.type}, extension: ${fileExtension}`);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 500MB.' },
        { status: 400 }
      );
    }

    const isFilePdf = isPdf(file.type);
    
    // For audio/video: check and deduct credits
    // For PDFs: FREE, skip credit check
    let estimatedMinutes = 0;
    if (!isFilePdf) {
      // Estimate duration (rough estimate, 1 MB per minute for audio)
      estimatedMinutes = Math.max(1, Math.ceil(file.size / (1024 * 1024)));

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

    // Generate unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `orgs/${organizationId}/recordings/${timestamp}-${sanitizedFileName}`;

    // Upload to Bunny Storage (12x cheaper bandwidth than Firebase)
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    if (!isBunnyStorageConfigured()) {
      return NextResponse.json(
        { error: 'Storage not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const fileUrl = await uploadToBunnyStorage(fileBuffer, storagePath, file.type);

    // Create uploaded recording record
    const recordingsRef = adminDb
      .collection('organizations')
      .doc(organizationId)
      .collection('uploaded_recordings');

    // Determine file type for the record
    const fileType: 'audio' | 'video' | 'pdf' = isFilePdf 
      ? 'pdf' 
      : file.type.startsWith('video/') 
        ? 'video' 
        : 'audio';

    const recordingData: Omit<UploadedRecording, 'id'> = {
      organizationId,
      uploadedBy: userId,
      clientUserId: clientUserId || undefined,
      programEnrollmentId: programEnrollmentId || undefined,
      // Cohort-specific fields
      cohortId: cohortId || undefined,
      programId: programId || undefined,
      weekId: weekId || undefined,
      fileName: file.name,
      fileUrl,
      fileSizeBytes: file.size,
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
        fileBuffer,
        fileUrl,
        userId,
        clientUserId,
        programEnrollmentId,
        cohortContext
      ).catch((error) => {
        console.error(`[RECORDING_UPLOAD] Error processing PDF ${recordingId}:`, error);
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
        console.error(`[RECORDING_UPLOAD] Error processing ${recordingId}:`, error);
      });
    }

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
 * Process PDF upload - extract text and generate summary
 * PDFs are FREE (no credits used)
 */
async function processPdfUpload(
  orgId: string,
  recordingId: string,
  fileBuffer: Buffer,
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
    // Update status to processing (we call it 'transcribing' for consistency)
    await recordingRef.update({ status: 'transcribing' });

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

    console.log(`[RECORDING_UPLOAD] Completed processing PDF ${recordingId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await recordingRef.update({
      status: 'failed',
      processingError: errorMessage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // No credits to refund for PDFs

    console.error(`[RECORDING_UPLOAD] Failed processing PDF ${recordingId}:`, error);
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
