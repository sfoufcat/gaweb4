import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireAdmin, canModifyUserRole } from '@/lib/admin-utils-clerk';
import { createOrganizationForCoach, createManualCoachSubscription, generateSubdomainFromBusinessName } from '@/lib/clerk-organizations';
import { createOrgDomain, isSubdomainAvailable, getOrgDomain, updateOrgSubdomain } from '@/lib/tenant/resolveTenant';
import type { UserRole, CoachTier } from '@/types';
import { validateSubdomain } from '@/types';

interface RoleUpdateBody {
  role: UserRole;
  subdomain?: string; // Optional: explicit subdomain override
  businessName?: string; // Optional: generates subdomain from business name if no explicit subdomain
  // Manual tier assignment (admin override)
  tier?: CoachTier; // 'starter' | 'pro' | 'scale' - defaults to 'starter'
  manualBilling?: boolean; // If true, creates subscription without Stripe payment
  manualExpiresAt?: string | null; // ISO date string - null means unlimited
}

/**
 * PATCH /api/admin/users/[userId]/role
 * Updates a user's role in Clerk publicMetadata (admin/super_admin only, with restrictions)
 * 
 * For coach role assignments, subdomain can be set via:
 * 1. Explicit `subdomain` parameter (takes priority)
 * 2. Generated from `businessName` parameter (e.g., "Omir Delil" -> omirdelil)
 * 3. Re-using existing subdomain (for re-promotions)
 * 4. Falls back to user ID-based subdomain if neither provided
 */
export async function PATCH(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Check authorization (throws if not admin)
    const currentUserRole = await requireAdmin();

    const { userId: targetUserId } = await context.params;
    const body = await req.json() as RoleUpdateBody;
    const { role: newRole, subdomain, businessName, tier, manualBilling, manualExpiresAt } = body;

    if (!newRole) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }

    // Validate role value
    const validRoles: UserRole[] = ['user', 'editor', 'coach', 'admin', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Fetch target user from Clerk first (needed for re-promotion check)
    const client = await clerkClient();
    const targetUser = await client.users.getUser(targetUserId);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    const targetUserRole = (targetUser.publicMetadata?.role as UserRole) || 'user';

    // Check for existing organization (for re-promotion scenarios)
    const existingOrgId = (targetUser.publicMetadata as { organizationId?: string })?.organizationId;
    let existingSubdomain: string | null = null;
    
    if (existingOrgId) {
      const existingOrgDomain = await getOrgDomain(existingOrgId);
      existingSubdomain = existingOrgDomain?.subdomain || null;
    }

    // Resolve final subdomain for coach role
    // Priority: explicit subdomain > generated from businessName > existing > auto-generated
    let finalSubdomain: string | null = null;
    
    if (newRole === 'coach') {
      if (subdomain) {
        // Explicit subdomain provided - validate format
        const validation = validateSubdomain(subdomain);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }
        
        // Check if subdomain is different from existing (if any)
        const normalizedSubdomain = subdomain.toLowerCase();
        if (normalizedSubdomain !== existingSubdomain) {
          // Different subdomain - check availability
          const isAvailable = await isSubdomainAvailable(subdomain);
          if (!isAvailable) {
            return NextResponse.json({ error: 'This subdomain is already taken' }, { status: 400 });
          }
        }
        finalSubdomain = normalizedSubdomain;
        console.log(`[ADMIN_USER_ROLE] Using explicit subdomain: ${finalSubdomain}`);
      } else if (businessName) {
        // Generate subdomain from business name
        try {
          finalSubdomain = await generateSubdomainFromBusinessName(businessName);
          console.log(`[ADMIN_USER_ROLE] Generated subdomain "${finalSubdomain}" from business name "${businessName}"`);
        } catch (genError) {
          console.error(`[ADMIN_USER_ROLE] Failed to generate subdomain from business name:`, genError);
          return NextResponse.json({ 
            error: 'Failed to generate subdomain from business name. Please provide an explicit subdomain.',
            requiresSubdomain: true,
          }, { status: 400 });
        }
      } else if (existingOrgId && existingSubdomain) {
        // Re-promotion case: user has existing org with subdomain
        finalSubdomain = existingSubdomain;
        console.log(`[ADMIN_USER_ROLE] Re-promoting coach ${targetUserId} - reusing existing subdomain: ${existingSubdomain}`);
      }
      // If no subdomain resolved, the org creation will generate one from user ID (fallback)
    }

    // Check if current user can modify target user's role
    if (!canModifyUserRole(currentUserRole, targetUserRole, newRole)) {
      return NextResponse.json(
        { error: 'You do not have permission to make this role change' },
        { status: 403 }
      );
    }

    // Update the role in Clerk publicMetadata
    await client.users.updateUserMetadata(targetUserId, {
      publicMetadata: {
        ...targetUser.publicMetadata,
        role: newRole,
      },
    });

    let organizationId: string | null = null;
    let tenantUrl: string | null = null;

    // If assigning coach role, handle organization, subdomain, and subscription
    if (newRole === 'coach') {
      try {
        const coachName = businessName?.trim() || (targetUser.firstName 
          ? `${targetUser.firstName}${targetUser.lastName ? ' ' + targetUser.lastName : ''}`
          : targetUser.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach');
        
        // createOrganizationForCoach already handles existing org detection
        organizationId = await createOrganizationForCoach(targetUserId, coachName);
        
        if (finalSubdomain) {
          // We have a resolved subdomain (explicit, generated from businessName, or existing)
          if (existingSubdomain && finalSubdomain !== existingSubdomain) {
            // Update to new subdomain
            await updateOrgSubdomain(organizationId, finalSubdomain);
            console.log(`[ADMIN_USER_ROLE] Updated subdomain from ${existingSubdomain} to ${finalSubdomain} for org:${organizationId}`);
          } else if (!existingSubdomain) {
            // Create new subdomain mapping
            await createOrgDomain(organizationId, finalSubdomain);
            console.log(`[ADMIN_USER_ROLE] Created subdomain ${finalSubdomain} -> org:${organizationId}`);
          }
          // If same subdomain, nothing to do
          
          tenantUrl = `https://${finalSubdomain}.growthaddicts.com`;
        } else {
          // No subdomain resolved - org will have auto-generated one from createOrganizationForCoach
          const orgDomain = await getOrgDomain(organizationId);
          if (orgDomain?.subdomain) {
            finalSubdomain = orgDomain.subdomain;
            tenantUrl = `https://${orgDomain.subdomain}.growthaddicts.com`;
          }
        }
        
        // Create manual subscription if tier is specified or manualBilling is true
        // This allows admins to set a coach's plan tier without requiring Stripe payment
        if (organizationId && (tier || manualBilling)) {
          try {
            await createManualCoachSubscription(organizationId, {
              tier: tier || 'starter',
              manualBilling: manualBilling ?? true, // Default to manual billing when creating from admin
              manualExpiresAt: manualExpiresAt ?? null,
              userId: targetUserId,
            });
            console.log(`[ADMIN_USER_ROLE] Created manual subscription for coach ${targetUserId} org:${organizationId} tier:${tier || 'starter'}`);
          } catch (subError) {
            // Log but don't fail - subscription can be fixed later
            console.error(`[ADMIN_USER_ROLE] Failed to create subscription for org ${organizationId}:`, subError);
          }
        }
      } catch (orgError) {
        // Log but don't fail the role update - org can be created later
        console.error(`[ADMIN_USER_ROLE] Failed to create/update organization for coach ${targetUserId}:`, orgError);
      }
    }

    return NextResponse.json({ 
      success: true,
      organizationId,
      tenantUrl,
      subdomain: finalSubdomain || undefined,
      existingSubdomain: existingSubdomain || undefined, // Included for re-promotions
      tier: newRole === 'coach' ? (tier || 'starter') : undefined,
      manualBilling: newRole === 'coach' ? (manualBilling ?? true) : undefined,
    });
  } catch (error) {
    console.error('[ADMIN_USER_ROLE_UPDATE_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Internal Error';
    
    if (message === 'Unauthorized') {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (message.includes('Forbidden')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return new NextResponse('Internal Error', { status: 500 });
  }
}
