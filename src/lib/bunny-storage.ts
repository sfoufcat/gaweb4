/**
 * Bunny Storage Client Library
 *
 * Handles image and file uploads to Bunny Storage (not Stream).
 * Used for images, avatars, logos, and other static files.
 * ~5x cheaper storage and ~12x cheaper bandwidth than Firebase Storage.
 *
 * Environment variables required:
 * - BUNNY_STORAGE_API_KEY: Storage zone API key from Bunny dashboard
 * - BUNNY_STORAGE_ZONE_NAME: Storage zone name
 * - BUNNY_STORAGE_HOSTNAME: Storage hostname (e.g., ny.storage.bunnycdn.com)
 * - NEXT_PUBLIC_BUNNY_STORAGE_CDN: Pull zone CDN hostname (e.g., xxx.b-cdn.net)
 */

interface BunnyStorageConfig {
  apiKey: string;
  storageZone: string;
  hostname: string;
  cdnUrl: string;
}

/**
 * Get Bunny Storage configuration from environment
 */
function getBunnyStorageConfig(): BunnyStorageConfig {
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME;
  const hostname = process.env.BUNNY_STORAGE_HOSTNAME;
  const cdnUrl = process.env.NEXT_PUBLIC_BUNNY_STORAGE_CDN;

  if (!apiKey || !storageZone || !hostname || !cdnUrl) {
    throw new Error(
      'Missing Bunny Storage configuration. Required: BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_HOSTNAME, NEXT_PUBLIC_BUNNY_STORAGE_CDN'
    );
  }

  return { apiKey, storageZone, hostname, cdnUrl };
}

/**
 * Check if Bunny Storage is configured
 */
export function isBunnyStorageConfigured(): boolean {
  return !!(
    process.env.BUNNY_STORAGE_API_KEY &&
    process.env.BUNNY_STORAGE_ZONE_NAME &&
    process.env.BUNNY_STORAGE_HOSTNAME &&
    process.env.NEXT_PUBLIC_BUNNY_STORAGE_CDN
  );
}

/**
 * Upload a file to Bunny Storage
 *
 * @param buffer - File contents as Buffer
 * @param path - Storage path (e.g., "orgs/org123/images/photo.jpg")
 * @param contentType - MIME type (e.g., "image/jpeg")
 * @returns Public CDN URL for the uploaded file
 */
export async function uploadToBunnyStorage(
  buffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  const { apiKey, storageZone, hostname, cdnUrl } = getBunnyStorageConfig();

  // Normalize path - remove leading slash if present
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  // Bunny Storage API endpoint
  const uploadUrl = `https://${hostname}/${storageZone}/${normalizedPath}`;

  console.log('[BUNNY_STORAGE] Uploading:', {
    path: normalizedPath,
    contentType,
    size: buffer.length,
  });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: apiKey,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[BUNNY_STORAGE] Upload failed:', {
      status: response.status,
      error,
      path: normalizedPath,
    });
    throw new Error(`Failed to upload to Bunny Storage: ${error}`);
  }

  // Return the public CDN URL
  const publicUrl = `https://${cdnUrl}/${normalizedPath}`;
  console.log('[BUNNY_STORAGE] Upload successful:', { url: publicUrl });

  return publicUrl;
}

/**
 * Delete a file from Bunny Storage
 *
 * @param path - Storage path (e.g., "orgs/org123/images/photo.jpg")
 */
export async function deleteFromBunnyStorage(path: string): Promise<void> {
  const { apiKey, storageZone, hostname } = getBunnyStorageConfig();

  // Normalize path
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  const deleteUrl = `https://${hostname}/${storageZone}/${normalizedPath}`;

  console.log('[BUNNY_STORAGE] Deleting:', { path: normalizedPath });

  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      AccessKey: apiKey,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    console.error('[BUNNY_STORAGE] Delete failed:', {
      status: response.status,
      error,
      path: normalizedPath,
    });
    throw new Error(`Failed to delete from Bunny Storage: ${error}`);
  }

  console.log('[BUNNY_STORAGE] Delete successful:', { path: normalizedPath });
}

/**
 * Get the public CDN URL for a storage path
 *
 * @param path - Storage path
 * @returns Public CDN URL
 */
export function getBunnyStorageUrl(path: string): string {
  const { cdnUrl } = getBunnyStorageConfig();
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `https://${cdnUrl}/${normalizedPath}`;
}
