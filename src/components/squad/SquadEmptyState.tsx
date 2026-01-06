'use client';

import { SquadDiscovery } from './SquadDiscovery';
import { useSquad } from '@/hooks/useSquad';

/**
 * SquadEmptyState Component
 *
 * @deprecated Replaced by Program Enrollment flow. Users now get squads automatically
 * when enrolling in a group program. Use `ProgramEmptyState` instead.
 *
 * Displays when user is not yet assigned to a squad.
 * Now renders the Squad Discovery page instead of static waiting state.
 *
 * The original "Finding your growth teammates" UI has been extracted to
 * SquadEmptyInfo component for reuse in other contexts (e.g., coach view).
 *
 * Matches Figma design:
 * https://www.figma.com/design/8y6xbjQJTnzqNEFpfB4Wyi/Coachful--Backup-?node-id=751-9578
 */

export function SquadEmptyState() {
  const { discoverySquads } = useSquad();
  return <SquadDiscovery discoverySquads={discoverySquads} />;
}





