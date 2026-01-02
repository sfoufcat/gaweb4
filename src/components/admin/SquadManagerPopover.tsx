'use client';

import { useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
            <span className="inline-flex items-center px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded-full text-xs font-medium font-albert truncate max-w-[140px]">
              {displayText}
            </span>
            {extraCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={`flex items-center gap-1.5 max-w-[200px] px-2 py-1 rounded-lg border border-transparent hover:border-[#e1ddd8] dark:hover:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-[#11141b] transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {userSquadIds.length > 0 ? (
            <>
              <span className="inline-flex items-center px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded-full text-xs font-medium font-albert truncate max-w-[120px]">
                {displayText}
              </span>
              {extraCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-[#e1ddd8]/50 dark:bg-[#262b35]/50 text-[#5f5a55] dark:text-[#b2b6c2] rounded-full text-xs font-medium font-albert whitespace-nowrap">
                  +{extraCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#8c8c8c] dark:text-[#7d8190] text-sm font-albert">None</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-[#5f5a55] dark:text-[#b2b6c2] flex-shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[280px] p-0 bg-white dark:bg-[#171b22] border-[#e1ddd8] dark:border-[#262b35]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <h4 className="font-albert font-medium text-sm text-[#1a1a1a] dark:text-[#f5f5f8]">
            Manage Squads
          </h4>
          <p className="font-albert text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-0.5">
            {userSquadIds.length} squad{userSquadIds.length !== 1 ? 's' : ''} assigned
          </p>
        </div>

        {/* Current squads list */}
        <div className="max-h-[200px] overflow-y-auto">
          {userSquads.length > 0 ? (
            <div className="p-2 space-y-1">
              {userSquads.map((squad) => (
                <div
                  key={squad.id}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-[#faf8f6] dark:bg-[#11141b] group"
                >
                  <span className="font-albert text-sm text-[#1a1a1a] dark:text-[#f5f5f8] truncate flex-1">
                    {squad.name}
                  </span>
                  <button
                    onClick={() => onRemoveSquad(squad.id)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-[#8c8c8c] hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from squad"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="font-albert text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                No squads assigned
              </p>
            </div>
          )}

          {/* Unknown squads (IDs not found in squad list) */}
          {userSquadIds
            .filter((id) => !squads.find((s) => s.id === id))
            .map((id) => (
              <div
                key={id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 mx-2 mb-1 rounded-md bg-amber-50 dark:bg-amber-900/20 group"
              >
                <span className="font-albert text-sm text-amber-700 dark:text-amber-400 truncate flex-1 italic">
                  Unknown squad
                </span>
                <button
                  onClick={() => onRemoveSquad(id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-amber-600 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from squad"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
        </div>

        {/* Add squad section */}
        {availableSquads.length > 0 && (
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <Select
              value=""
              onValueChange={(squadId) => {
                onAddSquad(squadId);
              }}
            >
              <SelectTrigger className="w-full h-8 font-albert text-sm border-dashed">
                <div className="flex items-center gap-1.5 text-[#5f5a55] dark:text-[#b2b6c2]">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to squad</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {availableSquads.map((squad) => (
                  <SelectItem key={squad.id} value={squad.id} className="font-albert text-sm">
                    {squad.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* No more squads to add */}
        {availableSquads.length === 0 && squads.length > 0 && (
          <div className="p-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
            <p className="font-albert text-xs text-[#8c8c8c] dark:text-[#7d8190] text-center">
              Member of all available squads
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}









