'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronDown, Check, Building2 } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  membership: {
    id: string;
    orgRole: string;
    tier: string;
    track: string | null;
    joinedAt: string;
  };
  branding?: {
    logoUrl: string | null;
    appTitle: string;
  };
  isPrimary: boolean;
}

interface OrganizationSwitcherProps {
  compact?: boolean;
}

export function OrganizationSwitcher({ compact = false }: OrganizationSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentOrg = organizations.find(org => org.isPrimary) || organizations[0];
  
  // Fetch organizations on mount
  useEffect(() => {
    async function fetchOrgs() {
      try {
        const response = await fetch('/api/user/organizations');
        if (!response.ok) throw new Error('Failed to fetch organizations');
        
        const data = await response.json();
        setOrganizations(data.organizations || []);
      } catch (error) {
        console.error('[ORG_SWITCHER] Error fetching orgs:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchOrgs();
  }, []);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Don't show if only one or no orgs
  if (isLoading || organizations.length <= 1) {
    return null;
  }
  
  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?.id || isSwitching) return;
    
    setIsSwitching(true);
    
    try {
      const response = await fetch('/api/user/organizations/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      
      if (!response.ok) throw new Error('Failed to switch organization');
      
      // Update local state
      setOrganizations(prev => 
        prev.map(org => ({
          ...org,
          isPrimary: org.id === orgId,
        }))
      );
      
      setIsOpen(false);
      
      // Reload the page to apply new org context
      router.refresh();
    } catch (error) {
      console.error('[ORG_SWITCHER] Error switching org:', error);
    } finally {
      setIsSwitching(false);
    }
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`
          flex items-center gap-2 w-full p-2 rounded-xl transition-colors
          hover:bg-[#f5f3f0] dark:hover:bg-[#333]
          ${isOpen ? 'bg-[#f5f3f0] dark:bg-[#333]' : ''}
          ${isSwitching ? 'opacity-50 cursor-wait' : ''}
        `}
      >
        {/* Org Logo/Icon */}
        <div className="w-8 h-8 rounded-lg bg-[#e1ddd8] dark:bg-[#444] flex items-center justify-center overflow-hidden flex-shrink-0">
          {currentOrg?.imageUrl || currentOrg?.branding?.logoUrl ? (
            <Image
              src={currentOrg.branding?.logoUrl || currentOrg.imageUrl || ''}
              alt={currentOrg.name}
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="w-4 h-4 text-text-secondary" />
          )}
        </div>
        
        {!compact && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">
                {currentOrg?.branding?.appTitle || currentOrg?.name || 'Select Organization'}
              </div>
              <div className="text-xs text-text-secondary capitalize">
                {currentOrg?.membership?.orgRole?.replace('_', ' ') || 'Member'}
              </div>
            </div>
            
            <ChevronDown 
              className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            />
          </>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-[#1a1a1a] rounded-xl shadow-lg border border-[#e1ddd8] dark:border-[#333] overflow-hidden z-50">
          <div className="py-1 max-h-64 overflow-y-auto">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                disabled={isSwitching}
                className={`
                  w-full flex items-center gap-3 px-3 py-2 text-left
                  hover:bg-[#f5f3f0] dark:hover:bg-[#333] transition-colors
                  ${org.isPrimary ? 'bg-[#f5f3f0] dark:bg-[#333]' : ''}
                `}
              >
                {/* Org Logo */}
                <div className="w-8 h-8 rounded-lg bg-[#e1ddd8] dark:bg-[#444] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {org.imageUrl || org.branding?.logoUrl ? (
                    <Image
                      src={org.branding?.logoUrl || org.imageUrl || ''}
                      alt={org.name}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-4 h-4 text-text-secondary" />
                  )}
                </div>
                
                {/* Org Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {org.branding?.appTitle || org.name}
                  </div>
                  <div className="text-xs text-text-secondary capitalize">
                    {org.membership?.orgRole?.replace('_', ' ') || 'Member'} • {org.membership?.tier || 'Free'}
                  </div>
                </div>
                
                {/* Check mark for current */}
                {org.isPrimary && (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

