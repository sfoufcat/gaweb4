import { clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { requireAdmin, canModifyUserRole } from '@/lib/admin-utils-clerk';
import { createOrganizationForCoach } from '@/lib/clerk-organizations';
import { createOrgDomain, isSubdomainAvailable, getOrgDomain, updateOrgSubdomain } from '@/lib/tenant/resolveTenant';
import type { UserRole } from '@/types';
import { validateSubdomain } from '@/types';

interface RoleUpdateBody {
  role: UserRole;
  subdomain?: string; // Required when assigning coach role (unless re-promoting with existing subdomain)
}

/**
 * PATCH /api/admin/users/[userId]/role
 * Updates a user's role in Clerk publicMetadata (admin/super_admin only, with restrictions)
 * 
 * For coach role assignments, a subdomain is required and will be set up for the organization.
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
    const { role: newRole, subdomain } = body;

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

    // If assigning coach role, validate subdomain requirements
    if (newRole === 'coach') {
      // Re-promotion case: user has existing org with subdomain and no new subdomain provided
      if (existingOrgId && existingSubdomain && !subdomain) {
        console.log(`[ADMIN_USER_ROLE] Re-promoting coach ${targetUserId} - reusing existing subdomain: ${existingSubdomain}`);
        // Will reuse existing org and subdomain below
      } else if (!subdomain) {
        // New coach without subdomain
        return NextResponse.json({ 
          error: 'Subdomain is required when assigning coach role',
          requiresSubdomain: true,
        }, { status: 400 });
      } else {
        // Subdomain provided - validate format
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
        // If same as existing, skip availability check (reclaiming own subdomain)
      }
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

    // If assigning coach role, handle organization and subdomain
    if (newRole === 'coach') {
      try {
        const coachName = targetUser.firstName 
          ? `${targetUser.firstName}${targetUser.lastName ? ' ' + targetUser.lastName : ''}`
          : targetUser.emailAddresses[0]?.emailAddress?.split('@')[0] || 'Coach';
        
        // createOrganizationForCoach already handles existing org detection
        organizationId = await createOrganizationForCoach(targetUserId, coachName);
        
        if (existingOrgId && existingSubdomain && !subdomain) {
          // Re-promotion: reuse existing subdomain
          tenantUrl = `https://${existingSubdomain}.growthaddicts.com`;
          console.log(`[ADMIN_USER_ROLE] Re-promoted coach ${targetUserId} with existing subdomain ${existingSubdomain}`);
        } else if (subdomain) {
          const normalizedSubdomain = subdomain.toLowerCase();
          
          if (existingSubdomain && normalizedSubdomain !== existingSubdomain) {
            // Update to new subdomain
            await updateOrgSubdomain(organizationId, subdomain);
            console.log(`[ADMIN_USER_ROLE] Updated subdomain from ${existingSubdomain} to ${subdomain} for org:${organizationId}`);
          } else if (!existingSubdomain) {
            // Create new subdomain mapping
            await createOrgDomain(organizationId, subdomain);
            console.log(`[ADMIN_USER_ROLE] Created subdomain ${subdomain} -> org:${organizationId}`);
          }
          // If same subdomain, nothing to do
          
          tenantUrl = `https://${normalizedSubdomain}.growthaddicts.com`;
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
      existingSubdomain: existingSubdomain || undefined, // Included for re-promotions
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
