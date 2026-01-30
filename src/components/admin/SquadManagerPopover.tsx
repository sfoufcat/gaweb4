'use client';

import { useState } from 'react';
import { X, Plus, ChevronDown, Users } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SquadOption {
  id: string;
  name: string;
}

interface SquadManagerPopoverProps {
  userSquadIds: string[];
  squads: SquadOption[];
  onAddSquad: (squadId: string) => void;
  onRemoveSquad: (squadId: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function SquadManagerPopover({
  userSquadIds,
  squads,
  onAddSquad,
  onRemoveSquad,
  disabled = false,
  readOnly = false,
}: SquadManagerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Get squad objects for user's squads
  const userSquads = userSquadIds
    .map((id) => squads.find((s) => s.id === id))
    .filter((s): s is SquadOption => s !== undefined);

  // Squads available to add (not already a member)
  const availableSquads = squads.filter((s) => !userSquadIds.includes(s.id));

  // Get display text for trigger
  const getDisplayText = () => {
    if (userSquadIds.length === 0) {
      return null;
    }
    const firstName = userSquads[0]?.name || 'Unknown';
    return firstName;
  };

  const displayText = getDisplayText();
  const extraCount = userSquadIds.length - 1;

  // Read-only mode - just show badges inline
  if (readOnly) {
    return (
      <div className="flex items-center gap-1.5 max-w-[200px]">
        {userSquadIds.length > 0 ? (
          <>
            <span className="inline-flex items-center px-2.5 py-1 bg-brand-accent/10 text-brand-accent rounded-full text-xs font-medium font-albert truncate max-w-[140px]">
              {displayText}
            </span>
            {extraCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
                +{extraCount}
              </span>
            )}
          </>
        ) : (
          <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">-</span>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setShowAddDropdown(false);
    }}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={`flex items-center gap-1.5 max-w-[220px] pr-2.5 py-1.5 rounded-xl border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#faf8f6]/80 dark:hover:bg-[#11141b]/80 transition-all duration-200 ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${open ? 'bg-[#faf8f6] dark:bg-[#11141b] border-[#e1ddd8] dark:border-[#262b35]' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          {userSquadIds.length > 0 ? (
            <>
              <span className="inline-flex items-center px-2.5 py-1 bg-brand-accent/10 text-brand-accent rounded-full text-xs font-medium font-albert truncate max-w-[130px]">
                {displayText}
              </span>
              {extraCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-[#e1ddd8]/60 dark:bg-[#262b35]/60 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">None</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[300px] p-0 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-2xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-b from-[#faf8f6] to-white dark:from-[#1a1f2a] dark:to-[#171b22]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-accent/10">
              <Users className="w-4 h-4 text-brand-accent" />
            </div>
            <div>
              <h4 className="font-albert font-semibold text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
                Communities
              </h4>
              <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2]">
                {userSquadIds.length} {userSquadIds.length === 1 ? 'community' : 'communities'} assigned
              </p>
            </div>
          </div>
        </div>

        {/* Current communities list */}
        <div className="max-h-[220px] overflow-y-auto">
          {userSquads.length > 0 ? (
            <div className="p-2 space-y-1">
              {userSquads.map((squad) => (
                <div
                  key={squad.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#faf8f6] dark:bg-[#11141b] group hover:bg-[#f5f2ef] dark:hover:bg-[#1a1f2a] transition-colors"
                >
                  <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate flex-1">
                    {squad.name}
                  </span>
                  <button
                    onClick={() => onRemoveSquad(squad.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-[#8c8c8c] hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
                    title="Remove from community"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#e1ddd8]/30 dark:bg-[#262b35]/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-[#8c8c8c] dark:text-[#7d8190]" />
              </div>
              <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                No communities assigned
              </p>
            </div>
          )}

          {/* Unknown communities (IDs not found in squad list) */}
          {userSquadIds
            .filter((id) => !squads.find((s) => s.id === id))
            .map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 mx-2 mb-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 group"
              >
                <span className="font-albert text-sm text-amber-700 dark:text-amber-400 truncate flex-1 italic">
                  Unknown community
                </span>
                <button
                  onClick={() => onRemoveSquad(id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-amber-600 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 opacity-0 group-hover:opacity-100"
                  title="Remove from community"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
        </div>

        {/* Add community section */}
        {availableSquads.length > 0 && (
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <div className="relative">
              <button
                onClick={() => setShowAddDropdown(!showAddDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all duration-200 group"
              >
                <div className="flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-colors">
                  <Plus className="w-4 h-4" />
                  <span className="font-albert text-sm font-medium">Add to community</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-[#5f5a55] dark:text-[#b2b6c2] group-hover:text-brand-accent transition-all duration-200 ${showAddDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showAddDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl shadow-lg overflow-hidden z-10">
                  <div className="max-h-[160px] overflow-y-auto py-1">
                    {availableSquads.map((squad) => (
                      <button
                        key={squad.id}
                        onClick={() => {
                          onAddSquad(squad.id);
                          setShowAddDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors"
                      >
                        {squad.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No more communities to add */}
        {availableSquads.length === 0 && squads.length > 0 && (
          <div className="p-3 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] text-center">
              Member of all available communities
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}










