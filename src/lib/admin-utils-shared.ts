import type { UserRole, UserTier, CoachingStatus, CoachingPlan, OrgRole } from '@/types';

/**
 * Shared Admin Authorization Utilities
 * 
 * These functions are safe to use in both Client and Server Components.
 * NO server-side imports (auth, database) - pure logic only.
 */

/**
 * Check if a user is an editor (can access the editor panel)
 */
export function isEditor(role?: UserRole): boolean {
  return role === 'editor';
}

/**
 * Check if a user has admin access (can access the admin panel)
 */
export function isAdmin(role?: UserRole): boolean {
  return role === 'admin' || role === 'super_admin';
}

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(role?: UserRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if a user can access the Editor section
 * Only editors and superadmins can access
 */
export function canAccessEditorSection(role?: UserRole): boolean {
  return role === 'editor' || role === 'super_admin';
}

/**
 * Check if a role is a staff role (bypasses billing/Stripe gateway)
 * Staff roles: editor, coach, admin, super_admin
 */
export function isStaffRole(role?: UserRole): boolean {
  return role === 'editor' || role === 'coach' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if a user can manage discover content (articles, events, courses)
 * Coaches, editors, admins, and super_admins can manage discover content
 */
export function canManageDiscoverContent(role?: UserRole): boolean {
  return role === 'coach' || role === 'editor' || role === 'admin' || role === 'super_admin';
}

/**
 * Check if an admin user can modify a target user's role
 * 
 * Rules:
 * - super_admin can modify anyone's role
 * - admin cannot modify super_admin roles
 * - admin cannot promote anyone to super_admin
 */
export function canModifyUserRole(
  adminRole: UserRole,
  targetUserRole: UserRole,
  newRole: UserRole
): boolean {
  // Super admin can do anything
  if (isSuperAdmin(adminRole)) {
    return true;
  }

  // Regular admin restrictions
  if (adminRole === 'admin') {
    // Cannot modify super_admin users
    if (targetUserRole === 'super_admin') {
      return false;
    }
    // Cannot promote anyone to super_admin
    if (newRole === 'super_admin') {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Check if an admin user can delete a target user
 * 
 * Rules:
 * - super_admin can delete anyone
 * - admin cannot delete super_admin users
 */
export function canDeleteUser(
  adminRole: UserRole,
  targetUserRole: UserRole
): boolean {
  // Super admin can delete anyone
  if (isSuperAdmin(adminRole)) {
    return true;
  }

  // Regular admin cannot delete super_admin users
  if (adminRole === 'admin') {
    return targetUserRole !== 'super_admin';
  }

  return false;
}

/**
 * Check if an admin user can manage squads
 * 
 * Rules:
 * - Both admin and super_admin can manage squads
 */
export function canManageSquads(role?: UserRole): boolean {
  return isAdmin(role);
}

/**
 * Check if a user can access the Coach Dashboard
 * 
 * Rules:
 * - Global role: coach, admin, and super_admin can access
 * - Org role: super_coach and coach can access (with limited features for coach)
 */
export function canAccessCoachDashboard(role?: UserRole, orgRole?: OrgRole): boolean {
  // Global coach/admin roles have full access
  if (role === 'coach' || role === 'admin' || role === 'super_admin') return true;
  // Org-level roles can access (coach has limited features)
  if (orgRole === 'super_coach' || orgRole === 'coach') return true;
  return false;
}

/**
 * Get a list of roles that a user can assign
 */
export function getAssignableRoles(adminRole: UserRole): UserRole[] {
  if (isSuperAdmin(adminRole)) {
    return ['user', 'editor', 'coach', 'admin', 'super_admin'];
  }
  
  if (adminRole === 'admin') {
    return ['user', 'editor', 'coach', 'admin'];
  }
  
  return [];
}

/**
 * Format role name for display
 */
export function formatRoleName(role: UserRole): string {
  const roleMap: Record<UserRole, string> = {
    user: 'User',
    editor: 'Editor',
    coach: 'Coach',
    admin: 'Admin',
    super_admin: 'Super Admin',
  };
  
  return roleMap[role] || role;
}

/**
 * Get role badge color
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colorMap: Record<UserRole, string> = {
    user: 'bg-gray-100 text-gray-700',
    editor: 'bg-teal-100 text-teal-700',
    coach: 'bg-blue-100 text-blue-700',
    admin: 'bg-purple-100 text-purple-700',
    super_admin: 'bg-red-100 text-red-700',
  };
  
  return colorMap[role] || 'bg-gray-100 text-gray-700';
}

/**
 * Format tier name for display
 * Note: Coaching is NOT a tier - it's a separate product
 */
export function formatTierName(tier: UserTier): string {
  const tierMap: Record<UserTier, string> = {
    free: 'Free',
    standard: 'Standard',
    premium: 'Premium',
  };
  
  return tierMap[tier] || tier;
}

/**
 * Get tier badge color
 * Note: Coaching is NOT a tier - it's a separate product
 */
export function getTierBadgeColor(tier: UserTier): string {
  const colorMap: Record<UserTier, string> = {
    free: 'bg-slate-100 text-slate-600',
    standard: 'bg-gray-100 text-gray-700',
    premium: 'bg-amber-100 text-amber-700',
  };
  
  return colorMap[tier] || 'bg-slate-100 text-slate-600';
}

// ============================================================================
// COACHING STATUS HELPERS (Client-safe)
// ============================================================================

/**
 * Format coaching status for display
 */
export function formatCoachingStatus(status: CoachingStatus): string {
  const statusMap: Record<CoachingStatus, string> = {
    none: 'No Coaching',
    active: 'Active',
    canceled: 'Canceled',
    past_due: 'Past Due',
  };
  
  return statusMap[status] || status;
}

/**
 * Get coaching status badge color
 */
export function getCoachingStatusBadgeColor(status: CoachingStatus): string {
  const colorMap: Record<CoachingStatus, string> = {
    none: 'bg-slate-100 text-slate-600',
    active: 'bg-emerald-100 text-emerald-700',
    canceled: 'bg-red-100 text-red-600',
    past_due: 'bg-orange-100 text-orange-700',
  };
  
  return colorMap[status] || 'bg-slate-100 text-slate-600';
}

/**
 * Format coaching plan for display
 */
export function formatCoachingPlan(plan: CoachingPlan): string {
  if (!plan) return 'N/A';
  const planMap: Record<NonNullable<CoachingPlan>, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
  };
  
  return planMap[plan] || plan;
}

/**
 * Check if user has active coaching access (client-safe helper)
 */
export function userHasActiveCoaching(
  coachingStatus?: CoachingStatus,
  legacyCoachingFlag?: boolean
): boolean {
  // New field takes precedence
  if (coachingStatus === 'active') return true;
  // Fall back to legacy flag
  if (legacyCoachingFlag === true) return true;
  return false;
}

// ============================================================================
// ORGANIZATION ROLE HELPERS (Client-safe)
// ============================================================================

/**
 * Check if user is a Super Coach (organization leader)
 */
export function isSuperCoach(orgRole?: OrgRole): boolean {
  return orgRole === 'super_coach';
}

/**
 * Check if user can coach within an organization
 * Both super_coach and coach can be assigned to squads
 */
export function isOrgCoach(orgRole?: OrgRole): boolean {
  return orgRole === 'super_coach' || orgRole === 'coach';
}

/**
 * Check if a Super Coach can assign a specific org role to a user
 * 
 * Rules:
 * - Only super_coach can assign org roles
 * - super_coach can assign: coach, member
 * - super_coach cannot demote themselves (handled in API)
 */
export function canAssignOrgRole(
  currentUserOrgRole?: OrgRole,
  targetOrgRole?: OrgRole
): boolean {
  // Only super_coach can assign org roles
  if (!isSuperCoach(currentUserOrgRole)) {
    return false;
  }
  
  // super_coach can assign any role except super_coach (there's only one leader)
  return targetOrgRole === 'coach' || targetOrgRole === 'member';
}

/**
 * Get a list of org roles that can be assigned by a super coach
 * Note: super_coach cannot be assigned by other super_coaches
 */
export function getAssignableOrgRoles(): OrgRole[] {
  return ['coach', 'member'];
}

/**
 * Get a list of ALL org roles that can be assigned by a platform super_admin
 * Super admins can assign any org role including super_coach
 */
export function getAssignableOrgRolesForAdmin(): OrgRole[] {
  return ['super_coach', 'coach', 'member'];
}

/**
 * Format org role name for display
 */
export function formatOrgRoleName(orgRole?: OrgRole): string {
  if (!orgRole) return 'Member';
  
  const roleMap: Record<OrgRole, string> = {
    super_coach: 'Superadmin',
    coach: 'Coach',
    member: 'Member',
  };
  
  return roleMap[orgRole] || 'Member';
}

/**
 * Get org role badge color
 */
export function getOrgRoleBadgeColor(orgRole?: OrgRole): string {
  if (!orgRole) return 'bg-gray-100 text-gray-700';
  
  const colorMap: Record<OrgRole, string> = {
    super_coach: 'bg-purple-100 text-purple-700',
    coach: 'bg-blue-100 text-blue-700',
    member: 'bg-gray-100 text-gray-700',
  };
  
  return colorMap[orgRole] || 'bg-gray-100 text-gray-700';
}
