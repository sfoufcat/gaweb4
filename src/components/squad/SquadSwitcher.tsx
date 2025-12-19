'use client';

import { Star, Users } from 'lucide-react';
import type { Squad, SquadType } from '@/types';

/**
 * SquadSwitcher Component
 * 
 * A pill-style toggle to switch between Premium and Standard squads
 * for users with dual squad membership.
 * 
 * Shows the squad avatars and names with visual differentiation
 * for premium (gold/orange gradient) vs standard squads.
 */

interface SquadSwitcherProps {
  premiumSquad: Squad;
  standardSquad: Squad;
  activeType: SquadType;
  onSwitch: (type: SquadType) => void;
}

export function SquadSwitcher({ 
  premiumSquad, 
  standardSquad, 
  activeType, 
  onSwitch 
}: SquadSwitcherProps) {
  return (
    <div className="bg-[#f3f1ef] dark:bg-[#11141b] rounded-[40px] p-2 flex gap-2 mb-6">
      {/* Premium Squad Tab */}
      <button
        onClick={() => onSwitch('premium')}
        className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-[32px] transition-all duration-200 ${
          activeType === 'premium'
            ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : ''
        }`}
      >
        {/* Squad Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#FF8A65] to-[#FF6B6B] flex items-center justify-center flex-shrink-0">
          {premiumSquad.avatarUrl ? (
            <img 
              src={premiumSquad.avatarUrl} 
              alt={premiumSquad.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <Star className="w-4 h-4 text-white fill-white" />
          )}
        </div>
        
        {/* Squad Info */}
        <div className="text-left min-w-0">
          <p className={`font-albert text-[14px] font-semibold truncate leading-tight ${
            activeType === 'premium' 
              ? 'text-text-primary dark:text-[#f5f5f8]' 
              : 'text-text-secondary dark:text-[#7d8190]'
          }`}>
            {premiumSquad.name}
          </p>
          <p className="font-albert text-[10px] leading-tight">
            <span className="bg-gradient-to-r from-[#FF8A65] to-[#FF6B6B] bg-clip-text text-transparent font-semibold">
              Premium
            </span>
          </p>
        </div>
      </button>
      
      {/* Standard Squad Tab */}
      <button
        onClick={() => onSwitch('standard')}
        className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-[32px] transition-all duration-200 ${
          activeType === 'standard'
            ? 'bg-white dark:bg-[#171b22] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.1)] dark:shadow-none'
            : ''
        }`}
      >
        {/* Squad Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#F5E6A8] to-[#EDD96C] flex items-center justify-center flex-shrink-0">
          {standardSquad.avatarUrl ? (
            <img 
              src={standardSquad.avatarUrl} 
              alt={standardSquad.name} 
              className="w-full h-full object-cover"
            />
          ) : (
            <Users className="w-4 h-4 text-[#4A5D54]" />
          )}
        </div>
        
        {/* Squad Info */}
        <div className="text-left min-w-0">
          <p className={`font-albert text-[14px] font-semibold truncate leading-tight ${
            activeType === 'standard' 
              ? 'text-text-primary dark:text-[#f5f5f8]' 
              : 'text-text-secondary dark:text-[#7d8190]'
          }`}>
            {standardSquad.name}
          </p>
          <p className={`font-albert text-[10px] leading-tight ${
            activeType === 'standard' 
              ? 'text-text-secondary dark:text-[#b2b6c2]' 
              : 'text-text-secondary/70 dark:text-[#7d8190]/70'
          }`}>
            Standard
          </p>
        </div>
      </button>
    </div>
  );
}

