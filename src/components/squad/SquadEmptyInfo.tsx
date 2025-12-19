'use client';

/**
 * SquadEmptyInfo Component
 * 
 * Reusable info block showing "Finding your growth teammates" message.
 * Extracted from original SquadEmptyState for reuse in discovery page, coach view, etc.
 * 
 * Matches Figma design:
 * https://www.figma.com/design/8y6xbjQJTnzqNEFpfB4Wyi/GrowthAddicts--Backup-?node-id=751-9578
 */

interface SquadEmptyInfoProps {
  className?: string;
  showInviteButton?: boolean;
  onInviteFriend?: () => void;
  compact?: boolean;
}

export function SquadEmptyInfo({ 
  className = '',
  showInviteButton = false,
  onInviteFriend,
  compact = false,
}: SquadEmptyInfoProps) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {/* Large Circular Gradient Avatar */}
      <div className={`relative ${compact ? 'w-24 h-24 mb-4' : 'w-40 h-40 mb-8'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#F5E6A8] via-[#EDD96C] to-[#E8C547] opacity-90" />
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#a07855]/20 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg 
            className={`${compact ? 'w-12 h-12' : 'w-20 h-20'} text-[#4A5D54]`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      {/* Heading */}
      <h2 className={`font-albert text-text-primary leading-[1.2] tracking-[-2px] ${
        compact ? 'text-[24px] mb-3 max-w-[280px]' : 'text-[36px] mb-6 max-w-[330px]'
      }`}>
        Finding your growth teammates
      </h2>

      {/* Subtext */}
      <p className={`font-albert text-text-primary leading-[1.3] tracking-[-1.5px] ${
        compact ? 'text-[16px] mb-6 max-w-[280px]' : 'text-[24px] mb-12 max-w-[330px]'
      }`}>
        Keep your streak alive while we assemble your crew.
      </p>

      {/* Invite Button (optional) */}
      {showInviteButton && onInviteFriend && (
        <button
          onClick={onInviteFriend}
          className="bg-white border-[0.3px] border-[rgba(215,210,204,0.5)] rounded-[32px] px-6 py-4 w-full max-w-[354px] shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
        >
          <span className="font-bold text-[16px] text-[#2c2520] leading-[1.4] tracking-[-0.5px]">
            Invite a friend to join your squad
          </span>
        </button>
      )}
    </div>
  );
}











