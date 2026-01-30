/**
 * Bunny Stream Client Library
 *
 * Handles video uploads, encoding status, and CDN URL generation for Bunny Stream.
 * Used for event recordings and course lesson videos.
 *
 * Environment variables required:
 * - BUNNY_API_KEY: API key from Bunny dashboard
 * - BUNNY_LIBRARY_ID: Stream library ID
 * - BUNNY_CDN_HOSTNAME: CDN hostname (e.g., xxx.b-cdn.net)
 */

const BUNNY_API_BASE = 'https://video.bunnycdn.com/library';

interface BunnyVideoResponse {
  guid: string;
  title: string;
  status: number; // 0=created, 1=uploaded, 2=processing, 3=transcoding, 4=finished, 5=error, 6=failed
  length: number; // Duration in seconds
  width: number; // Original video width (0 for audio-only)
  height: number; // Original video height (0 for audio-only)
  thumbnailFileName: string;
  dateUploaded: string;
  encodeProgress: number;
}

interface CreateVideoResult {
  videoId: string;
  tusUploadUrl: string;
  libraryId: string;
}

interface VideoStatus {
  videoId: string;
  status: 'created' | 'uploaded' | 'processing' | 'transcoding' | 'finished' | 'error' | 'failed';
  encodeProgress: number;
  durationSeconds: number;
  playbackUrl: string | null;
  thumbnailUrl: string | null;
  /** True if video has no video track (width/height are 0) */
  isAudioOnly: boolean;
}

/**
 * Map Bunny status codes to readable status strings
 */
function mapBunnyStatus(status: number): VideoStatus['status'] {
  switch (status) {
    case 0:
      return 'created';
    case 1:
      return 'uploaded';
    case 2:
      return 'processing';
    case 3:
      return 'transcoding';
    case 4:
      return 'finished';
    case 5:
      return 'error';
    case 6:
      return 'failed';
    default:
      return 'error';
  }
}

/**
 * Get Bunny configuration from environment
 *
 * BUNNY_API_KEY must be the Stream/Video Library API key.
 * Find at: Dashboard > Stream > [Your Library Name] > API > API Key
 *
 * This same key is used for:
 * - Video management (create, delete, status)
 * - Collection management
 * - TUS upload authentication (SHA256 signature)
 */
function getBunnyConfig() {
  const apiKey = process.env.BUNNY_API_KEY;
  const libraryId = process.env.BUNNY_LIBRARY_ID;
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;

  if (!apiKey || !libraryId || !cdnHostname) {
    throw new Error(
      'Missing Bunny Stream configuration. Required: BUNNY_API_KEY (from Stream > Video Library > API), BUNNY_LIBRARY_ID, BUNNY_CDN_HOSTNAME'
    );
  }

  return { apiKey, libraryId, cdnHostname };
}

/**
 * Create a new video in Bunny Stream library
 *
 * @param title - Video title (usually filename)
 * @param collectionId - Optional collection ID for organization (can use orgId)
 * @returns Video ID and TUS upload URL
 */
export async function createBunnyVideo(
  title: string,
  collectionId?: string
): Promise<CreateVideoResult> {
  const { apiKey, libraryId } = getBunnyConfig();

  console.log('[BUNNY] Creating video:', { title, collectionId, libraryId });

  const response = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      AccessKey: apiKey,
    },
    body: JSON.stringify({
      title,
      collectionId: collectionId || undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[BUNNY] Create video failed:', { status: response.status, error });
    throw new Error(`Failed to create Bunny video: ${error}`);
  }

  const video: BunnyVideoResponse = await response.json();
  console.log('[BUNNY] Video created successfully:', { videoId: video.guid });

  // TUS upload URL format for Bunny Stream
  const tusUploadUrl = `https://video.bunnycdn.com/tusupload?libraryId=${libraryId}&videoId=${video.guid}&expirationTime=${Date.now() + 24 * 60 * 60 * 1000}`;

  return {
    videoId: video.guid,
    tusUploadUrl,
    libraryId,
  };
}

/**
 * Get video status and playback URL
 *
 * @param videoId - Bunny video GUID
 * @returns Video status, encoding progress, and playback URL if ready
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatus> {
  const { apiKey, libraryId, cdnHostname } = getBunnyConfig();

  const response = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      AccessKey: apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get video status: ${error}`);
  }

  const video: BunnyVideoResponse = await response.json();
  const status = mapBunnyStatus(video.status);

  // Playback URL is only available when encoding is finished
  const playbackUrl =
    status === 'finished' ? `https://${cdnHostname}/${videoId}/playlist.m3u8` : null;

  // Thumbnail URL
  const thumbnailUrl =
    video.thumbnailFileName && status === 'finished'
      ? `https://${cdnHostname}/${videoId}/${video.thumbnailFileName}`
      : null;

  // Audio-only files have width/height of 0
  const isAudioOnly = (video.width === 0 || !video.width) && (video.height === 0 || !video.height);

  return {
    videoId,
    status,
    encodeProgress: video.encodeProgress || 0,
    durationSeconds: video.length || 0,
    playbackUrl,
    thumbnailUrl,
    isAudioOnly,
  };
}

/**
 * Get direct MP4 download URL for a video
 * Useful for transcription services that need a direct file URL
 *
 * @param videoId - Bunny video GUID
 * @returns Direct MP4 URL or null if not ready
 */
export async function getDirectVideoUrl(videoId: string): Promise<string | null> {
  const { apiKey, libraryId, cdnHostname } = getBunnyConfig();

  const response = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoId}`, {
    method: 'GET',
    headers: {
      AccessKey: apiKey,
    },
  });

  if (!response.ok) {
    return null;
  }

  const video: BunnyVideoResponse = await response.json();

  if (video.status !== 4) {
    // Not finished encoding
    return null;
  }

  // Return the original quality MP4 for transcription
  // Format: https://cdn.hostname/videoId/play_720p.mp4
  return `https://${cdnHostname}/${videoId}/original`;
}

/**
 * Get a transcription-compatible URL for a recording.
 * Groq's Whisper API cannot process HLS streams (.m3u8), so we need direct MP4 URLs.
 *
 * @param bunnyVideoId - Optional Bunny video GUID
 * @param recordingUrl - Existing recording URL (may be HLS or direct)
 * @returns Direct MP4 URL suitable for transcription, or null if unavailable
 */
export async function getTranscriptionUrl(
  bunnyVideoId: string | undefined,
  recordingUrl: string | undefined
): Promise<string | null> {
  // If we have a bunnyVideoId, get the direct MP4 URL
  if (bunnyVideoId) {
    const directUrl = await getDirectVideoUrl(bunnyVideoId);
    if (directUrl) {
      return directUrl;
    }
  }

  // Fall back to recordingUrl only if it's not an HLS playlist
  if (recordingUrl && !recordingUrl.endsWith('.m3u8')) {
    return recordingUrl;
  }

  return null;
}

/**
 * Delete a video from Bunny Stream
 *
 * @param videoId - Bunny video GUID
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const { apiKey, libraryId } = getBunnyConfig();

  const response = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoId}`, {
    method: 'DELETE',
    headers: {
      AccessKey: apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete video: ${error}`);
  }
}

/**
 * Get or create a collection for an organization
 * Collections help organize videos by tenant
 *
 * @param organizationId - Organization ID to use as collection name
 * @returns Collection ID
 */
export async function getOrCreateCollection(organizationId: string): Promise<string | undefined> {
  const { apiKey, libraryId } = getBunnyConfig();

  try {
    // First, try to find existing collection
    const listResponse = await fetch(`${BUNNY_API_BASE}/${libraryId}/collections?search=${organizationId}`, {
      method: 'GET',
      headers: {
        AccessKey: apiKey,
      },
    });

    if (listResponse.ok) {
      const collections = await listResponse.json();
      if (collections.items && collections.items.length > 0) {
        const existing = collections.items.find(
          (c: { name: string }) => c.name === organizationId
        );
        if (existing) {
          return existing.guid;
        }
      }
    }

    // Create new collection
    const createResponse = await fetch(`${BUNNY_API_BASE}/${libraryId}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        AccessKey: apiKey,
      },
      body: JSON.stringify({
        name: organizationId,
      }),
    });

    if (!createResponse.ok) {
      // Log error but don't throw - collections are optional for organization
      console.warn(`[BUNNY] Could not create collection for ${organizationId}, proceeding without collection`);
      return undefined;
    }

    const collection = await createResponse.json();
    return collection.guid;
  } catch (error) {
    // Collections are optional - videos can exist without collections
    console.warn(`[BUNNY] Collection operation failed for ${organizationId}, proceeding without collection:`, error);
    return undefined;
  }
}

/**
 * Generate SHA256 hash for Bunny TUS authentication
 * Signature = SHA256(library_id + api_key + expiration_time + video_id)
 *
 * Per Bunny docs: https://docs.bunny.net/reference/tus-resumable-uploads
 */
async function generateTusSignature(
  libraryId: string,
  apiKey: string,
  expirationTime: number,
  videoId: string
): Promise<string> {
  // Per Bunny docs: SHA256(library_id + api_key + expiration_time + video_id)
  const data = `${libraryId}${apiKey}${expirationTime}${videoId}`;
  console.log('[BUNNY_TUS] Raw signature components:', { libraryId, apiKeyLen: apiKey.length, expirationTime, videoId });
  // Debug: Log the exact string being hashed (with key masked)
  const maskedData = `${libraryId}${'*'.repeat(apiKey.length)}${expirationTime}${videoId}`;
  console.log('[BUNNY_TUS] Signature input (masked):', maskedData);
  console.log('[BUNNY_TUS] Signature input length:', data.length);

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate TUS upload configuration with proper SHA256 signature
 *
 * @param videoId - Bunny video GUID
 * @param expirationHours - How long the URL should be valid (default 24 hours)
 * @returns TUS upload configuration for client
 */
export async function generateTusUploadConfig(videoId: string, expirationHours = 24) {
  const { apiKey, libraryId } = getBunnyConfig();

  // Expiration time must be in seconds (Unix timestamp), not milliseconds
  const expirationTime = Math.floor(Date.now() / 1000) + expirationHours * 60 * 60;

  // Per Bunny docs: signature = SHA256(library_id + api_key + expiration_time + video_id)
  const signature = await generateTusSignature(libraryId, apiKey, expirationTime, videoId);

  // Debug logging - remove after confirming it works
  console.log('[BUNNY_TUS] Generating TUS config:', {
    libraryId,
    videoId,
    expirationTime,
    signaturePreview: signature.substring(0, 20) + '...',
  });

  return {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    headers: {
      AuthorizationSignature: signature,
      AuthorizationExpire: expirationTime.toString(),
      VideoId: videoId,
      LibraryId: libraryId,
    },
    metadata: {
      filetype: 'video/*',
      title: videoId,
    },
  };
}

/**
 * Get the CDN playback URL for a finished video
 *
 * @param videoId - Bunny video GUID
 * @returns HLS playlist URL
 */
export function getPlaybackUrl(videoId: string): string {
  const { cdnHostname } = getBunnyConfig();
  return `https://${cdnHostname}/${videoId}/playlist.m3u8`;
}

/**
 * Get the thumbnail URL for a video
 *
 * @param videoId - Bunny video GUID
 * @returns Thumbnail URL
 */
export function getThumbnailUrl(videoId: string): string {
  const { cdnHostname } = getBunnyConfig();
  return `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
}

/**
 * Upload a video buffer directly to Bunny Stream (server-side)
 *
 * This is used when the server receives the file and needs to upload it to Bunny.
 * The video will be encoded by Bunny and the webhook will notify when ready.
 *
 * @param videoId - Bunny video GUID (from createBunnyVideo)
 * @param arrayBuffer - Video file as ArrayBuffer
 * @returns Success status
 */
export async function uploadVideoBuffer(videoId: string, arrayBuffer: ArrayBuffer): Promise<void> {
  const { apiKey, libraryId } = getBunnyConfig();

  const response = await fetch(`${BUNNY_API_BASE}/${libraryId}/videos/${videoId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      AccessKey: apiKey,
    },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload video to Bunny: ${error}`);
  }
}
