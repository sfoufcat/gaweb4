'use client';

import type { SquadMember } from '@/types';
import { SquadMemberRow } from './SquadMemberRow';

/**
 * SquadMemberList Component
 * 
 * Displays the list of squad members.
 * If premium, shows coach first, then members.
 * Otherwise, shows all members.
 * 
 * Matches Figma Squad tab member list.
 */

interface SquadMemberListProps {
  members: SquadMember[];
  isPremium: boolean;
}

export function SquadMemberList({ members, isPremium }: SquadMemberListProps) {
  // Separate coach and regular members
  const coach = members.find(m => m.roleInSquad === 'coach');
  const regularMembers = members.filter(m => m.roleInSquad === 'member');

  return (
    <div>
      {/* Coach (if premium) */}
      {isPremium && coach && (
        <SquadMemberRow member={coach} />
      )}

      {/* Regular Members */}
      {regularMembers.map(member => (
        <SquadMemberRow key={member.id} member={member} />
      ))}
    </div>
  );
}




