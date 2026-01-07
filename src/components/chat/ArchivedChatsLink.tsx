'use client';

import { Archive, ChevronRight } from 'lucide-react';

interface ArchivedChatsLinkProps {
  count: number;
  onClick: () => void;
}

export function ArchivedChatsLink({ count, onClick }: ArchivedChatsLinkProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="w-full px-5 py-4 flex items-center gap-3 border-t border-[#e8e4df] dark:border-[#262b35] hover:bg-[#f3f1ef] dark:hover:bg-[#1e222a] transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-[#f3f1ef] dark:bg-[#272d38] flex items-center justify-center flex-shrink-0">
        <Archive className="w-5 h-5 text-text-secondary" />
      </div>
      <div className="flex-1 text-left">
        <p className="font-albert text-[15px] text-text-primary">
          Archived
        </p>
        <p className="font-sans text-[13px] text-text-muted">
          {count} conversation{count !== 1 ? 's' : ''}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
    </button>
  );
}
