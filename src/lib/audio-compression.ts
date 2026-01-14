/**
 * Client-side Audio Compression
 *
 * Compresses audio files to MP3 format using the Web Audio API and lamejs.
 * This allows large audio files to be compressed in the browser before upload,
 * avoiding server-side FFmpeg dependencies and staying under API limits.
 */

import lamejs from 'lamejs';

// Target settings for compressed audio
const TARGET_SAMPLE_RATE = 16000; // 16kHz is sufficient for speech recognition
const TARGET_BITRATE = 64; // 64kbps mono is good for speech
const MAX_FILE_SIZE_MB = 24; // Stay under 25MB Groq limit with some buffer

export interface CompressionResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  durationSeconds: number;
}

export interface CompressionProgress {
  stage: 'decoding' | 'resampling' | 'encoding' | 'complete';
  progress: number; // 0-100
}

/**
 * Compress an audio file to MP3 format
 *
 * @param file - The audio file to compress
 * @param onProgress - Optional callback for progress updates
 * @returns The compressed audio as a Blob
 */
export async function compressAudioFile(
  file: File,
  onProgress?: (progress: CompressionProgress) => void
): Promise<CompressionResult> {
  const originalSize = file.size;

  onProgress?.({ stage: 'decoding', progress: 0 });

  // Create audio context
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ stage: 'decoding', progress: 30 });

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  onProgress?.({ stage: 'resampling', progress: 50 });

  // Get audio data (convert to mono if stereo)
  const numberOfChannels = audioBuffer.numberOfChannels;
  let samples: Float32Array;

  if (numberOfChannels === 1) {
    samples = audioBuffer.getChannelData(0);
  } else {
    // Mix down to mono
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    samples = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) {
      samples[i] = (left[i] + right[i]) / 2;
    }
  }

  // Resample to target sample rate
  const resampledSamples = resample(
    samples,
    audioBuffer.sampleRate,
    TARGET_SAMPLE_RATE
  );

  onProgress?.({ stage: 'encoding', progress: 70 });

  // Convert float samples to 16-bit PCM
  const pcmSamples = new Int16Array(resampledSamples.length);
  for (let i = 0; i < resampledSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, resampledSamples[i]));
    pcmSamples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Encode to MP3 using lamejs
  const mp3Encoder = new lamejs.Mp3Encoder(1, TARGET_SAMPLE_RATE, TARGET_BITRATE);
  const mp3Data: ArrayBuffer[] = [];

  const blockSize = 1152; // Must be a multiple of 576 for lamejs
  for (let i = 0; i < pcmSamples.length; i += blockSize) {
    const chunk = pcmSamples.subarray(i, i + blockSize);
    const mp3buf = mp3Encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      // Convert to ArrayBuffer for Blob compatibility
      const buffer = new ArrayBuffer(mp3buf.length);
      const view = new Uint8Array(buffer);
      view.set(mp3buf);
      mp3Data.push(buffer);
    }

    // Update progress
    const encodeProgress = 70 + (i / pcmSamples.length) * 25;
    onProgress?.({ stage: 'encoding', progress: Math.min(95, encodeProgress) });
  }

  // Flush encoder
  const mp3End = mp3Encoder.flush();
  if (mp3End.length > 0) {
    const buffer = new ArrayBuffer(mp3End.length);
    const view = new Uint8Array(buffer);
    view.set(mp3End);
    mp3Data.push(buffer);
  }

  // Combine all MP3 chunks into a single Blob
  const blob = new Blob(mp3Data, { type: 'audio/mp3' });

  onProgress?.({ stage: 'complete', progress: 100 });

  // Close audio context
  await audioContext.close();

  const durationSeconds = audioBuffer.duration;
  const compressedSize = blob.size;
  const compressionRatio = originalSize / compressedSize;

  return {
    blob,
    originalSize,
    compressedSize,
    compressionRatio,
    durationSeconds,
  };
}

/**
 * Simple linear resampling
 * For better quality, consider using a library like libsamplerate-js
 */
function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) {
    return samples;
  }

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
    const t = srcIndex - srcIndexFloor;

    // Linear interpolation
    result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t;
  }

  return result;
}

/**
 * Check if a file needs compression based on size
 */
export function needsCompression(file: File): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB > MAX_FILE_SIZE_MB;
}

/**
 * Check if a file is an audio/video type that can be compressed
 */
export function canCompress(file: File): boolean {
  const compressibleTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/flac',
    'video/mp4',
    'video/webm',
    'video/quicktime',
  ];

  return compressibleTypes.some(type =>
    file.type.includes(type.split('/')[1]) || file.type === type
  );
}

/**
 * Estimate compressed size (rough approximation)
 * MP3 at 64kbps mono = 8KB per second
 */
export function estimateCompressedSize(durationSeconds: number): number {
  return Math.ceil(durationSeconds * (TARGET_BITRATE * 1000 / 8));
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
