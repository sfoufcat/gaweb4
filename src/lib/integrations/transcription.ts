/**
 * Transcription Integration
 * 
 * Handles transcription of coaching calls and squad calls using
 * Deepgram or AssemblyAI.
 */

import { 
  getIntegration, 
  getApiKey,
  updateSyncStatus,
} from './token-manager';
import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { 
  TranscriptionSettings, 
  CallTranscription,
  TranscriptionSegment,
  TranscriptionSpeaker,
} from './types';

// =============================================================================
// TRANSCRIPTION SERVICE INTERFACE
// =============================================================================

interface TranscriptionResult {
  transcript: string;
  segments?: TranscriptionSegment[];
  speakers?: TranscriptionSpeaker[];
  summary?: string;
  keyPoints?: string[];
  actionItems?: string[];
  durationSeconds?: number;
  confidence?: number;
}

// =============================================================================
// DEEPGRAM TRANSCRIPTION
// =============================================================================

/**
 * Transcribe audio using Deepgram
 */
async function transcribeWithDeepgram(
  audioUrl: string,
  apiKey: string,
  settings: TranscriptionSettings
): Promise<TranscriptionResult> {
  const params = new URLSearchParams({
    model: 'nova-2',
    smart_format: 'true',
    punctuate: String(settings.punctuation),
    diarize: String(settings.speakerDiarization),
    language: settings.language || 'en',
    paragraphs: 'true',
    utterances: 'true',
  });

  if (settings.summarize) {
    params.set('summarize', 'v2');
    params.set('detect_topics', 'true');
  }

  const response = await fetch(
    `https://api.deepgram.com/v1/listen?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: audioUrl,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err_msg || 'Deepgram transcription failed');
  }

  const result = await response.json();
  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    throw new Error('No transcription result');
  }

  // Build segments from words or utterances
  const segments: TranscriptionSegment[] = [];
  if (alternative.paragraphs?.paragraphs) {
    for (const para of alternative.paragraphs.paragraphs) {
      for (const sentence of para.sentences || []) {
        segments.push({
          text: sentence.text,
          startTime: sentence.start,
          endTime: sentence.end,
          speakerId: para.speaker !== undefined ? String(para.speaker) : undefined,
          confidence: 1,
        });
      }
    }
  } else if (alternative.words) {
    // Fall back to word-level
    let currentSegment = { text: '', startTime: 0, endTime: 0 };
    for (const word of alternative.words) {
      if (currentSegment.text.length === 0) {
        currentSegment.startTime = word.start;
      }
      currentSegment.text += (currentSegment.text ? ' ' : '') + word.word;
      currentSegment.endTime = word.end;
      
      // Break on sentence-ending punctuation
      if (word.word.match(/[.!?]$/)) {
        segments.push({
          ...currentSegment,
          confidence: word.confidence,
        });
        currentSegment = { text: '', startTime: 0, endTime: 0 };
      }
    }
    if (currentSegment.text) {
      segments.push({ ...currentSegment, confidence: 1 });
    }
  }

  // Extract speakers
  const speakers: TranscriptionSpeaker[] = [];
  if (settings.speakerDiarization && alternative.paragraphs?.paragraphs) {
    const speakerIds = new Set<number>();
    for (const para of alternative.paragraphs.paragraphs) {
      if (para.speaker !== undefined) {
        speakerIds.add(para.speaker);
      }
    }
    for (const id of speakerIds) {
      speakers.push({
        id: String(id),
        label: `Speaker ${id + 1}`,
      });
    }
  }

  // Extract summary if requested
  let summary: string | undefined;
  let keyPoints: string[] | undefined;
  
  if (result.results?.summary?.short) {
    summary = result.results.summary.short;
  }
  
  if (result.results?.topics?.segments) {
    keyPoints = result.results.topics.segments
      .map((s: { topic: string }) => s.topic)
      .filter((t: string, i: number, arr: string[]) => arr.indexOf(t) === i);
  }

  return {
    transcript: alternative.transcript || '',
    segments,
    speakers,
    summary,
    keyPoints,
    durationSeconds: result.metadata?.duration,
    confidence: alternative.confidence,
  };
}

// =============================================================================
// ASSEMBLYAI TRANSCRIPTION
// =============================================================================

/**
 * Transcribe audio using AssemblyAI
 */
async function transcribeWithAssemblyAI(
  audioUrl: string,
  apiKey: string,
  settings: TranscriptionSettings
): Promise<TranscriptionResult> {
  // Submit transcription request
  const submitResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: settings.language || 'en',
      punctuate: settings.punctuation,
      format_text: true,
      speaker_labels: settings.speakerDiarization,
      auto_chapters: settings.summarize,
      entity_detection: true,
      sentiment_analysis: false,
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.json();
    throw new Error(error.error || 'AssemblyAI submission failed');
  }

  const submitResult = await submitResponse.json();
  const transcriptId = submitResult.id;

  // Poll for completion
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max
  
  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const pollResponse = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!pollResponse.ok) {
      throw new Error('Failed to poll AssemblyAI status');
    }

    const pollResult = await pollResponse.json();

    if (pollResult.status === 'completed') {
      // Build result
      const segments: TranscriptionSegment[] = [];
      
      if (pollResult.utterances) {
        for (const utterance of pollResult.utterances) {
          segments.push({
            text: utterance.text,
            startTime: utterance.start / 1000,
            endTime: utterance.end / 1000,
            speakerId: utterance.speaker,
            confidence: utterance.confidence,
          });
        }
      } else if (pollResult.words) {
        let currentSegment = { text: '', startTime: 0, endTime: 0, speaker: '' };
        for (const word of pollResult.words) {
          if (currentSegment.text.length === 0) {
            currentSegment.startTime = word.start / 1000;
            currentSegment.speaker = word.speaker;
          }
          currentSegment.text += (currentSegment.text ? ' ' : '') + word.text;
          currentSegment.endTime = word.end / 1000;
          
          if (word.text.match(/[.!?]$/)) {
            segments.push({
              text: currentSegment.text,
              startTime: currentSegment.startTime,
              endTime: currentSegment.endTime,
              speakerId: currentSegment.speaker,
              confidence: word.confidence,
            });
            currentSegment = { text: '', startTime: 0, endTime: 0, speaker: '' };
          }
        }
        if (currentSegment.text) {
          segments.push({
            text: currentSegment.text,
            startTime: currentSegment.startTime,
            endTime: currentSegment.endTime,
            confidence: 1,
          });
        }
      }

      // Extract speakers
      const speakers: TranscriptionSpeaker[] = [];
      if (settings.speakerDiarization && pollResult.utterances) {
        const speakerIds = new Set<string>();
        for (const utterance of pollResult.utterances) {
          if (utterance.speaker) {
            speakerIds.add(utterance.speaker);
          }
        }
        let index = 1;
        for (const id of speakerIds) {
          speakers.push({
            id,
            label: `Speaker ${index}`,
          });
          index++;
        }
      }

      // Extract summary from chapters
      let summary: string | undefined;
      let keyPoints: string[] | undefined;
      
      if (pollResult.chapters && pollResult.chapters.length > 0) {
        summary = pollResult.chapters.map((c: { summary: string }) => c.summary).join(' ');
        keyPoints = pollResult.chapters.map((c: { headline: string }) => c.headline);
      }

      return {
        transcript: pollResult.text || '',
        segments,
        speakers,
        summary,
        keyPoints,
        durationSeconds: pollResult.audio_duration,
        confidence: pollResult.confidence,
      };
    }

    if (pollResult.status === 'error') {
      throw new Error(pollResult.error || 'Transcription failed');
    }

    attempts++;
  }

  throw new Error('Transcription timeout');
}

// =============================================================================
// MAIN TRANSCRIPTION FUNCTIONS
// =============================================================================

/**
 * Transcribe a call recording
 */
export async function transcribeCall(
  orgId: string,
  callType: 'coaching' | 'squad' | 'video_message',
  callId: string,
  recordingUrl: string
): Promise<{ success: boolean; transcriptionId?: string; error?: string }> {
  try {
    // Check for Deepgram integration
    let integration = await getIntegration(orgId, 'deepgram');
    let provider: 'deepgram' | 'assemblyai' = 'deepgram';

    // Fall back to AssemblyAI if Deepgram not connected
    if (!integration || integration.status !== 'connected') {
      integration = await getIntegration(orgId, 'assemblyai');
      provider = 'assemblyai';
    }

    if (!integration || integration.status !== 'connected') {
      return { success: false, error: 'No transcription service connected' };
    }

    const apiKey = await getApiKey(orgId, integration.id);
    if (!apiKey) {
      return { success: false, error: 'Unable to get API key' };
    }

    const settings = integration.settings as TranscriptionSettings;

    // Create transcription record
    const transcriptionRef = await createTranscriptionRecord(
      orgId,
      integration.id,
      provider,
      callType,
      callId,
      recordingUrl
    );

    // Start transcription asynchronously
    processTranscription(
      orgId,
      transcriptionRef.id,
      integration.id,
      provider,
      recordingUrl,
      apiKey,
      settings
    ).catch((error) => {
      console.error(`[TRANSCRIPTION] Error processing transcription ${transcriptionRef.id}:`, error);
    });

    return { success: true, transcriptionId: transcriptionRef.id };
  } catch (error) {
    console.error('[TRANSCRIPTION] Error starting transcription:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process transcription (async)
 */
async function processTranscription(
  orgId: string,
  transcriptionId: string,
  integrationId: string,
  provider: 'deepgram' | 'assemblyai',
  audioUrl: string,
  apiKey: string,
  settings: TranscriptionSettings
): Promise<void> {
  const transcriptionRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions')
    .doc(transcriptionId);

  try {
    // Update status to processing
    await transcriptionRef.update({
      status: 'processing',
    });

    // Perform transcription
    let result: TranscriptionResult;
    
    if (provider === 'deepgram') {
      result = await transcribeWithDeepgram(audioUrl, apiKey, settings);
    } else {
      result = await transcribeWithAssemblyAI(audioUrl, apiKey, settings);
    }

    // Update with results
    await transcriptionRef.update({
      status: 'completed',
      transcript: result.transcript,
      segments: result.segments || [],
      speakers: result.speakers || [],
      summary: result.summary || null,
      keyPoints: result.keyPoints || [],
      actionItems: result.actionItems || [],
      durationSeconds: result.durationSeconds || null,
      confidence: result.confidence || null,
      completedAt: FieldValue.serverTimestamp(),
    });

    await updateSyncStatus(orgId, integrationId, 'success');

    console.log(`[TRANSCRIPTION] Completed transcription ${transcriptionId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await transcriptionRef.update({
      status: 'failed',
      error: errorMessage,
    });

    await updateSyncStatus(orgId, integrationId, 'error', errorMessage);

    console.error(`[TRANSCRIPTION] Failed transcription ${transcriptionId}:`, error);
  }
}

/**
 * Create a transcription record
 */
async function createTranscriptionRecord(
  orgId: string,
  integrationId: string,
  provider: 'deepgram' | 'assemblyai',
  callType: 'coaching' | 'squad' | 'video_message',
  callId: string,
  recordingUrl: string
): Promise<FirebaseFirestore.DocumentReference> {
  const transcriptionsRef = adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions');

  const data: Omit<CallTranscription, 'id'> = {
    integrationId,
    provider,
    callType,
    callId,
    callRecordingUrl: recordingUrl,
    status: 'pending',
    createdAt: FieldValue.serverTimestamp() as unknown as string,
  };

  return await transcriptionsRef.add(data);
}

/**
 * Get a transcription by call ID
 */
export async function getTranscription(
  orgId: string,
  callType: 'coaching' | 'squad' | 'video_message',
  callId: string
): Promise<CallTranscription | null> {
  const snapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions')
    .where('callType', '==', callType)
    .where('callId', '==', callId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as CallTranscription;
}

/**
 * Get transcription by ID
 */
export async function getTranscriptionById(
  orgId: string,
  transcriptionId: string
): Promise<CallTranscription | null> {
  const doc = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions')
    .doc(transcriptionId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as CallTranscription;
}

/**
 * List transcriptions for an organization
 */
export async function listTranscriptions(
  orgId: string,
  limit = 50
): Promise<CallTranscription[]> {
  const snapshot = await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CallTranscription[];
}

/**
 * Delete a transcription
 */
export async function deleteTranscription(
  orgId: string,
  transcriptionId: string
): Promise<void> {
  await adminDb
    .collection('organizations')
    .doc(orgId)
    .collection('transcriptions')
    .doc(transcriptionId)
    .delete();
}


