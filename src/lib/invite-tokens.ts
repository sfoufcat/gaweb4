import { SignJWT, jwtVerify } from 'jose';

/**
 * Invite Token System
 * 
 * Smart invite links that encode squad information and handle different squad types:
 * - Private squads: include joinCode for automatic joining
 * - Public squads: auto-add user to squad after signup/login
 * - Premium squads: enforce premium tier before joining
 * 
 * Now uses short 8-character codes stored in Firestore instead of long JWTs.
 * JWT verification is kept for backward compatibility with existing links.
 */

// Token payload structure
export interface InviteTokenPayload {
  inviterUserId: string;
  inviterSquadId: string;
  squadName: string;
  squadType: 'private' | 'public' | 'premium';
  joinCode?: string;           // Only for private squads
  requiresPremium?: boolean;   // Only for premium squads
  timestamp: number;
}

// Invite link stored in Firestore
export interface InviteLinkData {
  code: string;
  inviterUserId: string;
  inviterSquadId: string;
  squadName: string;
  squadType: 'private' | 'public' | 'premium';
  joinCode?: string;
  requiresPremium?: boolean;
  createdAt: string;
  expiresAt: string;
}

// Decoded token with validation status
export interface DecodedInviteToken {
  valid: boolean;
  payload?: InviteTokenPayload;
  error?: string;
}

// Get secret key for JWT signing
function getSecretKey(): Uint8Array {
  const secret = process.env.INVITE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error('No secret key configured for invite tokens');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Generate an invite token for a squad
 */
export async function generateInviteToken(payload: Omit<InviteTokenPayload, 'timestamp'>): Promise<string> {
  const secretKey = getSecretKey();
  
  const tokenPayload: InviteTokenPayload = {
    ...payload,
    timestamp: Date.now(),
  };

  const token = await new SignJWT(tokenPayload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Token expires in 30 days
    .sign(secretKey);

  return token;
}

/**
 * Verify and decode an invite token
 */
export async function verifyInviteToken(token: string): Promise<DecodedInviteToken> {
  try {
    const secretKey = getSecretKey();
    
    const { payload } = await jwtVerify(token, secretKey);
    
    // Validate required fields
    if (!payload.inviterUserId || !payload.inviterSquadId || !payload.squadType) {
      return { valid: false, error: 'Invalid token structure' };
    }

    // Check if token is not too old (extra safety beyond JWT expiry)
    const timestamp = payload.timestamp as number;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    if (timestamp < thirtyDaysAgo) {
      return { valid: false, error: 'Invite link has expired' };
    }

    return {
      valid: true,
      payload: {
        inviterUserId: payload.inviterUserId as string,
        inviterSquadId: payload.inviterSquadId as string,
        squadName: payload.squadName as string,
        squadType: payload.squadType as 'private' | 'public' | 'premium',
        joinCode: payload.joinCode as string | undefined,
        requiresPremium: payload.requiresPremium as boolean | undefined,
        timestamp,
      },
    };
  } catch (error) {
    console.error('[INVITE_TOKEN_VERIFY_ERROR]', error);
    
    if (error instanceof Error && error.name === 'JWTExpired') {
      return { valid: false, error: 'Invite link has expired' };
    }
    
    return { valid: false, error: 'Invalid invite link' };
  }
}

/**
 * Get the base URL for invite links
 */
export function getInviteBaseUrl(): string {
  // Use NEXT_PUBLIC_APP_URL if set, otherwise fallback to common patterns
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Local development fallback
  return 'http://localhost:3000';
}

/**
 * Generate a full invite URL
 */
export async function generateInviteUrl(payload: Omit<InviteTokenPayload, 'timestamp'>): Promise<string> {
  const token = await generateInviteToken(payload);
  const baseUrl = getInviteBaseUrl();
  return `${baseUrl}/invite/${token}`;
}

/**
 * Determine squad type based on squad data
 * 
 * @deprecated The 'premium' type is deprecated. Use hasCoach to determine if a squad has a coach.
 * This function is kept for backward compatibility with existing invite links.
 */
export function determineSquadType(squad: {
  visibility?: 'public' | 'private';
  coachId?: string | null;
  inviteCode?: string;
}): 'private' | 'public' | 'premium' {
  // Check if squad has a coach
  if (squad.coachId) {
    return 'premium';
  }
  
  if (squad.visibility === 'private') {
    return 'private';
  }
  
  return 'public';
}

// ============================================================================
// SHORT CODE SYSTEM (New - Firestore-based)
// ============================================================================

/**
 * Generate an 8-character alphanumeric short code
 */
export function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded similar chars: 0, O, I, 1
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Check if a token is a short code (8 alphanumeric chars) or a JWT
 */
export function isShortCode(token: string): boolean {
  // Short codes are exactly 8 alphanumeric characters
  return /^[A-Z0-9]{8}$/i.test(token);
}

/**
 * Create invite link data object (to be stored in Firestore)
 */
export function createInviteLinkData(
  payload: Omit<InviteTokenPayload, 'timestamp'>
): Omit<InviteLinkData, 'code'> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  return {
    inviterUserId: payload.inviterUserId,
    inviterSquadId: payload.inviterSquadId,
    squadName: payload.squadName,
    squadType: payload.squadType,
    joinCode: payload.joinCode,
    requiresPremium: payload.requiresPremium,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Convert InviteLinkData to InviteTokenPayload for compatibility
 */
export function inviteLinkToPayload(link: InviteLinkData): InviteTokenPayload {
  return {
    inviterUserId: link.inviterUserId,
    inviterSquadId: link.inviterSquadId,
    squadName: link.squadName,
    squadType: link.squadType,
    joinCode: link.joinCode,
    requiresPremium: link.requiresPremium,
    timestamp: new Date(link.createdAt).getTime(),
  };
}

/**
 * Check if an invite link has expired
 */
export function isInviteLinkExpired(link: InviteLinkData): boolean {
  return new Date(link.expiresAt) < new Date();
}

