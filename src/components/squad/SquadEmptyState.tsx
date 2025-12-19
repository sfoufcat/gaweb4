'use client';

import { SquadDiscovery } from './SquadDiscovery';

/**
 * SquadEmptyState Component
 * 
 * Displays when user is not yet assigned to a squad.
 * Now renders the Squad Discovery page instead of static waiting state.
 * 
 * The original "Finding your growth teammates" UI has been extracted to 
 * SquadEmptyInfo component for reuse in other contexts (e.g., coach view).
 * 
 * Matches Figma design:
 * https://www.figma.com/design/8y6xbjQJTnzqNEFpfB4Wyi/GrowthAddicts--Backup-?node-id=751-9578
 */

export function SquadEmptyState() {
  return <SquadDiscovery />;
}





