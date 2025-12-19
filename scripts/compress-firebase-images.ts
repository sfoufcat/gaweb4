/**
 * Batch compress all quiz images in Firebase Storage
 * 
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/compress-firebase-images.ts
 * 
 * Or with doppler:
 *   doppler run -- npx ts-node --project tsconfig.json scripts/compress-firebase-images.ts
 * 
 * This script:
 * 1. Lists all images in the 'images/' folder of Firebase Storage
 * 2. Downloads each image
 * 3. Compresses using sharp (80% quality, max 1200px width)
 * 4. Re-uploads the compressed version, overwriting the original
 * 5. Reports total size savings
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new Error('Missing Firebase environment variables. Run with doppler or set env vars.');
  }

  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
    storageBucket,
  });

  console.log('✅ Firebase Admin initialized');
}

interface CompressionResult {
  path: string;
  originalSize: number;
  compressedSize: number;
  savings: number;
  savingsPercent: number;
  skipped: boolean;
  error?: string;
}

async function compressImage(bucket: any, filePath: string): Promise<CompressionResult> {
  const file = bucket.file(filePath);
  
  try {
    // Get file metadata for original size
    const [metadata] = await file.getMetadata();
    const originalSize = parseInt(metadata.size, 10);
    const contentType = metadata.contentType || 'image/jpeg';

    // Skip if not an image
    if (!contentType.startsWith('image/')) {
      return {
        path: filePath,
        originalSize,
        compressedSize: originalSize,
        savings: 0,
        savingsPercent: 0,
        skipped: true,
        error: 'Not an image file',
      };
    }

    // Skip SVGs (can't compress with sharp)
    if (contentType === 'image/svg+xml') {
      return {
        path: filePath,
        originalSize,
        compressedSize: originalSize,
        savings: 0,
        savingsPercent: 0,
        skipped: true,
        error: 'SVG files not supported',
      };
    }

    // Download the image
    const [buffer] = await file.download();
    
    // Get image info
    const imageInfo = await sharp(buffer).metadata();
    
    // Compress the image
    let compressedBuffer: Buffer;
    const maxWidth = 1200;
    const quality = 80;

    // Resize if wider than maxWidth, maintaining aspect ratio
    let sharpInstance = sharp(buffer);
    if (imageInfo.width && imageInfo.width > maxWidth) {
      sharpInstance = sharpInstance.resize(maxWidth, null, {
        withoutEnlargement: true,
        fit: 'inside',
      });
    }

    // Output based on original format
    if (contentType === 'image/png') {
      compressedBuffer = await sharpInstance
        .png({ quality, compressionLevel: 9 })
        .toBuffer();
    } else if (contentType === 'image/webp') {
      compressedBuffer = await sharpInstance
        .webp({ quality })
        .toBuffer();
    } else {
      // Default to JPEG for everything else
      compressedBuffer = await sharpInstance
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();
    }

    const compressedSize = compressedBuffer.length;
    const savings = originalSize - compressedSize;
    const savingsPercent = (savings / originalSize) * 100;

    // Only upload if we actually saved space
    if (savings > 0) {
      await file.save(compressedBuffer, {
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000',
        },
      });
      await file.makePublic();
      
      console.log(`✅ ${filePath}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${savingsPercent.toFixed(1)}% smaller)`);
    } else {
      console.log(`⏭️  ${filePath}: Already optimized (${formatBytes(originalSize)})`);
    }

    return {
      path: filePath,
      originalSize,
      compressedSize: savings > 0 ? compressedSize : originalSize,
      savings: Math.max(0, savings),
      savingsPercent: Math.max(0, savingsPercent),
      skipped: savings <= 0,
    };
  } catch (error) {
    console.error(`❌ ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      path: filePath,
      originalSize: 0,
      compressedSize: 0,
      savings: 0,
      savingsPercent: 0,
      skipped: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function main() {
  console.log('🔄 Starting Firebase image compression...\n');
  
  initFirebase();
  
  const bucket = getStorage().bucket();
  
  // List all files in the images/ folder
  console.log('📂 Listing files in images/ folder...');
  const [files] = await bucket.getFiles({ prefix: 'images/' });
  
  const imageFiles = files.filter(file => {
    const ext = file.name.toLowerCase();
    return ext.endsWith('.jpg') || 
           ext.endsWith('.jpeg') || 
           ext.endsWith('.png') || 
           ext.endsWith('.webp');
  });

  console.log(`Found ${imageFiles.length} image files\n`);

  if (imageFiles.length === 0) {
    console.log('No images found to compress.');
    return;
  }

  // Process images sequentially to avoid rate limits
  const results: CompressionResult[] = [];
  for (const file of imageFiles) {
    const result = await compressImage(bucket, file.name);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPRESSION SUMMARY');
  console.log('='.repeat(60));
  
  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const totalSavings = results.reduce((sum, r) => sum + r.savings, 0);
  const processedCount = results.filter(r => !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;
  const errorCount = results.filter(r => r.error).length;

  console.log(`Total files:      ${results.length}`);
  console.log(`Compressed:       ${processedCount}`);
  console.log(`Skipped:          ${skippedCount}`);
  console.log(`Errors:           ${errorCount}`);
  console.log('');
  console.log(`Original size:    ${formatBytes(totalOriginal)}`);
  console.log(`Compressed size:  ${formatBytes(totalCompressed)}`);
  console.log(`Total savings:    ${formatBytes(totalSavings)} (${((totalSavings / totalOriginal) * 100).toFixed(1)}%)`);
  console.log('='.repeat(60));
}

main().catch(console.error);

