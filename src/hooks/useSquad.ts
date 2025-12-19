import { useSquadContext } from '@/contexts/SquadContext';

/**
 * useSquad Hook
 * 
 * Returns the current user's squad data from the global cache.
 * Supports dual squad membership for premium users.
 * 
 * OPTIMIZED: Uses global SquadContext which fetches data once at app startup.
 * No API calls on navigation - data is instantly available from cache.
 * 
 * Returns:
 * - `squad`, `members`, `stats` - The currently active squad data
 * - `premiumSquad`, `standardSquad` - Direct access to both squads
 * - `activeSquadType` - Which squad is currently being viewed ('premium' | 'standard')
 * - `setActiveSquadType` - Function to switch between squads
 * - `hasBothSquads` - True if user has dual membership
 * - `hasPremiumSquad`, `hasStandardSquad` - Individual membership checks
 * 
 * Returns null for squad if user is not in any squad (shows empty state).
 */
export function useSquad() {
  return useSquadContext();
}
