/**
 * Compress a single image more aggressively
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';

// Initialize Firebase
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const bucket = getStorage().bucket();
const filePath = 'images/Gemini_Generated_Image_5aa6tu5aa6tu5aa6.png';
const file = bucket.file(filePath);

async function compress() {
  const [metadata] = await file.getMetadata();
  const originalSize = parseInt(String(metadata.size), 10);
  console.log('Original size:', (originalSize / 1024).toFixed(2), 'KB');
  
  const [buffer] = await file.download();
  
  // More aggressive compression: 60% quality, max 800px width
  const compressed = await sharp(buffer)
    .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
    .png({ quality: 60, compressionLevel: 9 })
    .toBuffer();
  
  console.log('Compressed size:', (compressed.length / 1024).toFixed(2), 'KB');
  console.log('Savings:', ((1 - compressed.length / originalSize) * 100).toFixed(1), '%');
  
  await file.save(compressed, {
    metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
  });
  await file.makePublic();
  console.log('✅ Uploaded!');
}

compress().catch(console.error);

