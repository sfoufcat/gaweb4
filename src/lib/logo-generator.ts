/**
 * Logo Generator
 * 
 * Server-side utility for generating default organization logos
 * using initials from the business name.
 * 
 * Features:
 * - Extracts initials from business name (max 2 characters)
 * - Generates consistent color based on name hash
 * - Creates SVG and converts to PNG
 * - Uploads to Firebase Storage
 */

import sharp from 'sharp';

// Color palette for generated logos (professional, brand-safe colors)
const LOGO_COLORS = [
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#dc2626', // Red
  '#ea580c', // Orange
  '#ca8a04', // Yellow
  '#16a34a', // Green
  '#0d9488', // Teal
  '#0891b2', // Cyan
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#a855f7', // Fuchsia
  '#059669', // Emerald
  '#0284c7', // Sky
  '#4f46e5', // Blue-violet
  '#9333ea', // Purple-violet
];

/**
 * Extract initials from a business name
 * Examples:
 * - "John Doe Coaching" -> "JD"
 * - "Growth Addicts" -> "GA"
 * - "Acme" -> "AC"
 * - "A" -> "A"
 */
export function extractInitials(name: string): string {
  if (!name || !name.trim()) {
    return 'ORG';
  }
  
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) {
    return 'ORG';
  }
  
  if (words.length === 1) {
    // Single word - take first 2 characters
    const word = words[0];
    return word.length >= 2 
      ? (word[0] + word[1]).toUpperCase() 
      : word[0].toUpperCase();
  }
  
  // Multiple words - take first letter of first two words
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Generate a consistent color based on the name hash
 * Same name will always produce the same color
 */
export function getColorForName(name: string): string {
  if (!name) {
    return LOGO_COLORS[0];
  }
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % LOGO_COLORS.length;
  return LOGO_COLORS[index];
}

/**
 * Generate an SVG logo with initials
 */
export function generateLogoSvg(initials: string, backgroundColor: string): string {
  // Calculate text size based on initials length
  const fontSize = initials.length === 1 ? 220 : 180;
  
  return `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="${backgroundColor}"/>
  <text 
    x="256" 
    y="256" 
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
    font-size="${fontSize}" 
    font-weight="600" 
    fill="white" 
    text-anchor="middle" 
    dominant-baseline="central"
  >${initials}</text>
</svg>
`.trim();
}

/**
 * Generate a PNG logo buffer from SVG
 */
export async function generateLogoPng(initials: string, backgroundColor: string): Promise<Buffer> {
  const svg = generateLogoSvg(initials, backgroundColor);
  const svgBuffer = Buffer.from(svg);
  
  // Convert SVG to PNG using sharp
  const pngBuffer = await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 90 })
    .toBuffer();
  
  return pngBuffer;
}

/**
 * Generate and upload a default logo for an organization
 * 
 * @param organizationId - The Clerk organization ID
 * @param businessName - The business name to generate initials from
 * @returns The public URL of the uploaded logo
 */
export async function generateAndUploadDefaultLogo(
  organizationId: string,
  businessName: string
): Promise<string> {
  // Extract initials and get consistent color
  const initials = extractInitials(businessName);
  const backgroundColor = getColorForName(businessName);
  
  console.log(`[LOGO_GENERATOR] Generating logo for "${businessName}": initials="${initials}", color="${backgroundColor}"`);
  
  // Generate PNG buffer
  const pngBuffer = await generateLogoPng(initials, backgroundColor);
  
  // Check storage bucket config
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET env var');
  }
  
  // Initialize Firebase Admin Storage
  const { getStorage } = await import('firebase-admin/storage');
  await import('@/lib/firebase-admin');
  const bucket = getStorage().bucket(bucketName);
  
  // Create unique filename
  const timestamp = Date.now();
  const storagePath = `org-branding/${organizationId}/default-logo-${timestamp}.png`;
  const fileRef = bucket.file(storagePath);
  
  // Upload the logo
  await fileRef.save(pngBuffer, {
    metadata: {
      contentType: 'image/png',
      cacheControl: 'public, max-age=31536000',
      customMetadata: {
        generatedFrom: businessName,
        initials: initials,
        isGenerated: 'true',
      },
    },
  });
  
  // Make the file publicly accessible
  await fileRef.makePublic();
  
  const url = `https://storage.googleapis.com/${bucketName}/${storagePath}`;
  console.log(`[LOGO_GENERATOR] Uploaded default logo: ${url}`);
  
  return url;
}

/**
 * Delete old generated logos for an organization
 * Called before generating a new logo to clean up
 */
export async function deleteOldGeneratedLogos(organizationId: string): Promise<void> {
  try {
    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) {
      return;
    }
    
    const { getStorage } = await import('firebase-admin/storage');
    await import('@/lib/firebase-admin');
    const bucket = getStorage().bucket(bucketName);
    
    // List files matching the default-logo pattern
    const prefix = `org-branding/${organizationId}/default-logo-`;
    const [files] = await bucket.getFiles({ prefix });
    
    // Delete each old generated logo
    for (const file of files) {
      await file.delete();
      console.log(`[LOGO_GENERATOR] Deleted old logo: ${file.name}`);
    }
  } catch (error) {
    // Log but don't fail - cleanup is best effort
    console.error('[LOGO_GENERATOR] Error deleting old logos:', error);
  }
}

/**
 * Regenerate a logo for an organization (deletes old, creates new)
 */
export async function regenerateDefaultLogo(
  organizationId: string,
  businessName: string
): Promise<string> {
  // Delete old generated logos first
  await deleteOldGeneratedLogos(organizationId);
  
  // Generate and upload new logo
  return generateAndUploadDefaultLogo(organizationId, businessName);
}



