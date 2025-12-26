import { NextResponse } from 'next/server';

/**
 * GET /api/music/list
 * Lists celebration music files from Firebase Storage
 * Returns array of { id, name, url }
 * 
 * Filename parsing:
 * "ES_All on the Floor (Instrumental Version) - Nyck Caution - 21000-36000.wav"
 * → "All on the Floor"
 */

interface MusicTrack {
  id: string;
  name: string;
  url: string;
}

/**
 * Parse a music filename to extract a clean display name
 * Examples:
 * - "ES_All on the Floor (Instrumental Version) - Nyck Caution - 21000-36000.wav" → "All on the Floor"
 * - "Epic_Victory_Theme.mp3" → "Epic Victory Theme"
 */
function parseDisplayName(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.(wav|mp3|m4a|ogg|webm)$/i, '');
  
  // Remove "ES_" prefix if present
  if (name.startsWith('ES_')) {
    name = name.slice(3);
  }
  
  // Extract text before first " - " or " (" (whichever comes first)
  const dashIndex = name.indexOf(' - ');
  const parenIndex = name.indexOf(' (');
  
  let cutIndex = -1;
  if (dashIndex > 0 && parenIndex > 0) {
    cutIndex = Math.min(dashIndex, parenIndex);
  } else if (dashIndex > 0) {
    cutIndex = dashIndex;
  } else if (parenIndex > 0) {
    cutIndex = parenIndex;
  }
  
  if (cutIndex > 0) {
    name = name.slice(0, cutIndex);
  }
  
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  
  // Trim whitespace
  name = name.trim();
  
  return name || filename;
}

export async function GET() {
  try {
    // Check storage bucket config
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      console.error('[MUSIC_LIST] Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    // Initialize Firebase Admin Storage
    let bucket;
    try {
      const { getStorage } = await import('firebase-admin/storage');
      await import('@/lib/firebase-admin');
      bucket = getStorage().bucket(bucketName);
    } catch (initError) {
      console.error('[MUSIC_LIST] Firebase init error:', initError);
      return NextResponse.json({ error: 'Storage service unavailable' }, { status: 500 });
    }

    // List files in the music folder
    const [files] = await bucket.getFiles({ prefix: 'music/' });
    
    // Filter to only audio files and map to track objects
    const audioExtensions = ['.wav', '.mp3', '.m4a', '.ogg', '.webm'];
    const tracks: MusicTrack[] = files
      .filter(file => {
        const name = file.name.toLowerCase();
        return audioExtensions.some(ext => name.endsWith(ext));
      })
      .map(file => {
        // Extract just the filename from the path (remove "music/" prefix)
        const filename = file.name.replace(/^music\//, '');
        const displayName = parseDisplayName(filename);
        
        return {
          id: filename,
          name: displayName,
          url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ 
      success: true,
      tracks,
    });
  } catch (error) {
    console.error('[MUSIC_LIST] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to list music files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

