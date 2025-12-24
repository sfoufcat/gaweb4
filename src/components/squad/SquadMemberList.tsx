'use client';

import type { SquadMember } from '@/types';
import { SquadMemberRow } from './SquadMemberRow';

/**
 * SquadMemberList Component
 * 
 * Displays the list of squad members.
 * Shows coach first (if exists), then regular members.
 * 
 * Matches Figma Squad tab member list.
 */

interface SquadMemberListProps {
  members: SquadMember[];
}

export function SquadMemberList({ members }: SquadMemberListProps) {
  // Separate coach and regular members
  const coach = members.find(m => m.roleInSquad === 'coach');
  const regularMembers = members.filter(m => m.roleInSquad === 'member');

  return (
    <div>
      {/* Coach (if squad has one) */}
      {coach && (
        <SquadMemberRow member={coach} />
      )}

      {/* Regular Members */}
      {regularMembers.map(member => (
        <SquadMemberRow key={member.id} member={member} />
      ))}
    </div>
  );
}




