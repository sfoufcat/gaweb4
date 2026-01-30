/**
 * Recording Storage
 *
 * Downloads recordings from external providers and stores them to Bunny Storage.
 * This ensures recordings are permanently accessible (provider URLs expire).
 */

import { uploadToBunnyStorage, isBunnyStorageConfigured } from './bunny-storage';

/**
 * Download a recording from a source URL and store it to Bunny Storage.
 *
 * @param sourceUrl - The URL to download from (Stream, Zoom, Google Drive, etc.)
 * @param orgId - Organization ID for storage path
 * @param identifier - Unique identifier for the recording (eventId or callId)
 * @param headers - Optional headers for authenticated requests (e.g., Zoom/Google auth)
 * @returns The public Bunny CDN URL for the stored recording
 */
export async function storeRecordingToBunny(
  sourceUrl: string,
  orgId: string,
  identifier: string,
  headers?: Record<string, string>
): Promise<string> {
  if (!isBunnyStorageConfigured()) {
    throw new Error('Bunny Storage is not configured');
  }

  console.log(`[RECORDING_STORAGE] Downloading from ${sourceUrl.substring(0, 80)}...`);

  const response = await fetch(sourceUrl, {
    headers: headers || {},
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'video/mp4';

  // Determine file extension from content type
  let extension = 'mp4';
  if (contentType.includes('webm')) {
    extension = 'webm';
  } else if (contentType.includes('audio/mpeg') || contentType.includes('audio/mp3')) {
    extension = 'mp3';
  } else if (contentType.includes('audio/wav')) {
    extension = 'wav';
  } else if (contentType.includes('audio/m4a') || contentType.includes('audio/mp4')) {
    extension = 'm4a';
  }

  const path = `orgs/${orgId}/recordings/${identifier}.${extension}`;
  const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

  console.log(`[RECORDING_STORAGE] Uploading ${fileSizeMB}MB to Bunny: ${path}`);

  const bunnyUrl = await uploadToBunnyStorage(buffer, path, contentType);

  console.log(`[RECORDING_STORAGE] Successfully stored: ${bunnyUrl}`);

  return bunnyUrl;
}
