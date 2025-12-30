'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUser } from '@clerk/nextjs';

/**
 * AuthorSelector Component
 * 
 * Dropdown selector for choosing an author from organization coaches.
 * Defaults to the current user if they are a coach.
 * 
 * Used in admin content forms (articles) to select the author.
 */

interface Coach {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  imageUrl: string;
  orgRole: string;
}

interface AuthorSelectorProps {
  value: string | null; // authorId
  onChange: (author: { authorId: string; authorName: string; authorImageUrl: string }) => void;
  placeholder?: string;
  className?: string;
  /** API endpoint to fetch coaches from. Defaults to /api/coach/org-coaches */
  coachesApiEndpoint?: string;
}

export function AuthorSelector({
  value,
  onChange,
  placeholder = 'Select author...',
  className = '',
  coachesApiEndpoint = '/api/coach/org-coaches',
}: AuthorSelectorProps) {
  const { user: currentUser } = useUser();
  const [open, setOpen] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Fetch coaches on mount
  useEffect(() => {
    const fetchCoaches = async () => {
      try {
        const response = await fetch(coachesApiEndpoint);
        if (response.ok) {
          const data = await response.json();
          setCoaches(data.coaches || []);
        }
      } catch (error) {
        console.error('Failed to fetch coaches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCoaches();
  }, [coachesApiEndpoint]);

  // Auto-select current user as default if no value is set
  useEffect(() => {
    if (!initialized && !loading && coaches.length > 0 && currentUser && !value) {
      const currentCoach = coaches.find(c => c.id === currentUser.id);
      if (currentCoach) {
        onChange({
          authorId: currentCoach.id,
          authorName: currentCoach.name,
          authorImageUrl: currentCoach.imageUrl,
        });
      }
      setInitialized(true);
    }
  }, [initialized, loading, coaches, currentUser, value, onChange]);

  const selectedCoach = coaches.find(c => c.id === value);

  // Filter coaches by search term
  const filteredCoaches = coaches.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (coach: Coach) => {
    onChange({
      authorId: coach.id,
      authorName: coach.name,
      authorImageUrl: coach.imageUrl,
    });
    setOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] font-normal text-left"
          >
            {selectedCoach ? (
              <div className="flex items-center gap-2 flex-1">
                {selectedCoach.imageUrl ? (
                  <Image
                    src={selectedCoach.imageUrl}
                    alt={selectedCoach.name}
                    width={24}
                    height={24}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className="text-[#1a1a1a] dark:text-[#f5f5f8]">{selectedCoach.name}</span>
                {selectedCoach.id === currentUser?.id && (
                  <span className="text-xs text-text-secondary dark:text-[#7d8190]">(you)</span>
                )}
              </div>
            ) : (
              <span className="text-text-secondary dark:text-[#7d8190]">
                {loading ? 'Loading authors...' : placeholder}
              </span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <div className="p-2 border-b border-[#e1ddd8] dark:border-[#262b35]">
            <input
              type="text"
              placeholder="Search authors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#e1ddd8] dark:border-[#262b35] dark:bg-[#11141b] rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent dark:focus:ring-brand-accent text-[#1a1a1a] dark:text-[#f5f5f8]"
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto p-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                Loading...
              </div>
            ) : filteredCoaches.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-secondary dark:text-[#7d8190]">
                {searchTerm ? 'No authors found.' : 'No authors available.'}
              </div>
            ) : (
              filteredCoaches.map(coach => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => handleSelect(coach)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[#f3f1ef] dark:hover:bg-[#262b35] cursor-pointer text-left ${
                    value === coach.id ? 'bg-[#f3f1ef] dark:bg-[#262b35]' : ''
                  }`}
                >
                  {coach.imageUrl ? (
                    <Image
                      src={coach.imageUrl}
                      alt={coach.name}
                      width={32}
                      height={32}
                      className="rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-[#1a1a1a] dark:text-[#f5f5f8] truncate">{coach.name}</span>
                      {coach.id === currentUser?.id && (
                        <span className="text-xs text-text-secondary dark:text-[#7d8190]">(you)</span>
                      )}
                    </div>
                    <span className="text-xs text-text-secondary dark:text-[#7d8190] truncate block">
                      {coach.email}
                    </span>
                  </div>
                  {coach.orgRole === 'super_coach' && (
                    <span className="text-xs text-brand-accent flex-shrink-0">
                      Lead
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}








