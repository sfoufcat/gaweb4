'use client';

import type { SquadMember } from '@/types';
import { SquadMemberRow } from './SquadMemberRow';

/**
 * SquadMemberList Component
 * 
 * Displays the list of squad members.
 * If hasCoach is true, shows coach first, then members.
 * Otherwise, shows all members.
 * 
 * Matches Figma Squad tab member list.
 */

interface SquadMemberListProps {
  members: SquadMember[];
  hasCoach?: boolean;
  /** @deprecated Use hasCoach instead */
  isPremium?: boolean;
}

export function SquadMemberList({ members, hasCoach, isPremium }: SquadMemberListProps) {
  // Support both new hasCoach and legacy isPremium
  const showCoach = hasCoach ?? isPremium ?? false;
  
  // Separate coach and regular members
  const coach = members.find(m => m.roleInSquad === 'coach');
  const regularMembers = members.filter(m => m.roleInSquad === 'member');

  return (
    <div>
      {/* Coach (if squad has a coach) */}
      {showCoach && coach && (
        <SquadMemberRow member={coach} />
      )}

      {/* Regular Members */}
      {regularMembers.map(member => (
        <SquadMemberRow key={member.id} member={member} />
      ))}
    </div>
  );
}




