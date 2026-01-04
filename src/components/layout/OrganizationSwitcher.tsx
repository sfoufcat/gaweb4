'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronDown, Check, Building2, ExternalLink } from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { DEMO_ORGANIZATION } from '@/lib/demo-utils';

interface TenantDomain {
  organizationId: string;
  name: string;
  subdomain: string | null;
  customDomain: string | null;
  imageUrl: string | null;
  tenantUrl: string | null;
}

interface OrganizationSwitcherProps {
  compact?: boolean;
}

/**
 * OrganizationSwitcher Component
 * 
 * On web: Shows user's organizations with links to their tenant domains.
 * Clicking an org navigates to its tenant domain (external redirect).
 * 
 * Future mobile: Will switch in-app context instead.
 */
export function OrganizationSwitcher({ compact = false }: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tenantDomains, setTenantDomains] = useState<TenantDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isDemoMode } = useDemoMode();
  
  // Determine current tenant from URL
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  
  useEffect(() => {
    // Try to identify current tenant from the current domain
    const hostname = window.location.hostname;
    // This will be set after we fetch tenant domains
    if (tenantDomains.length > 0) {
      const matchingTenant = tenantDomains.find(t => {
        if (t.customDomain && hostname === t.customDomain) return true;
        if (t.subdomain && (hostname === `${t.subdomain}.coachful.co` || hostname === `${t.subdomain}.growthaddicts.app`)) return true;
        return false;
      });
      setCurrentOrgId(matchingTenant?.organizationId || null);
    }
  }, [tenantDomains]);
  
  const currentOrg = tenantDomains.find(d => d.organizationId === currentOrgId) || tenantDomains[0];
  
  // Fetch tenant domains on mount
  useEffect(() => {
    async function fetchTenantDomains() {
      // Demo mode: use mock tenant data
      if (isDemoMode) {
        setTenantDomains([{
          organizationId: DEMO_ORGANIZATION.id,
          name: DEMO_ORGANIZATION.name,
          subdomain: DEMO_ORGANIZATION.slug,
          customDomain: null,
          imageUrl: DEMO_ORGANIZATION.imageUrl,
          tenantUrl: 'http://demo.localhost:3000',
        }]);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/user/tenant-domains');
        if (!response.ok) throw new Error('Failed to fetch tenant domains');
        
        const data = await response.json();
        setTenantDomains(data.tenantDomains || []);
      } catch (error) {
        console.error('[ORG_SWITCHER] Error fetching tenant domains:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchTenantDomains();
  }, [isDemoMode]);
  
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
  
  // Filter to only orgs with tenant URLs
  const orgsWithUrls = tenantDomains.filter(d => d.tenantUrl);
  
  // Don't show if only one or no orgs with URLs
  if (isLoading || orgsWithUrls.length <= 1) {
    return null;
  }
  
  const handleOrgClick = (org: TenantDomain) => {
    if (!org.tenantUrl) return;
    
    // Check if this is the current tenant
    const hostname = window.location.hostname;
    const isCurrent = (org.customDomain && hostname === org.customDomain) ||
                      (org.subdomain && (hostname === `${org.subdomain}.coachful.co` || hostname === `${org.subdomain}.growthaddicts.app`));
    
    if (isCurrent) {
      // Already on this tenant, just close dropdown
      setIsOpen(false);
      return;
    }
    
    // Navigate to the tenant domain (external redirect on web)
    // This preserves the current path, so user stays on same page type
    const currentPath = window.location.pathname;
    window.location.href = `${org.tenantUrl}${currentPath}`;
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 w-full p-2 rounded-xl transition-colors
          hover:bg-[#f5f3f0] dark:hover:bg-[#333]
          ${isOpen ? 'bg-[#f5f3f0] dark:bg-[#333]' : ''}
        `}
      >
        {/* Org Logo/Icon */}
        <div className="w-8 h-8 rounded-lg bg-[#e1ddd8] dark:bg-[#444] flex items-center justify-center overflow-hidden flex-shrink-0">
          {currentOrg?.imageUrl ? (
            <Image
              src={currentOrg.imageUrl}
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
                {currentOrg?.name || 'Select Organization'}
              </div>
              <div className="text-xs text-text-secondary">
                {orgsWithUrls.length} organization{orgsWithUrls.length === 1 ? '' : 's'}
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
          <div className="px-3 py-2 border-b border-[#e1ddd8] dark:border-[#333]">
            <p className="text-xs text-text-secondary">Switch to another coach</p>
          </div>
          <div className="py-1 max-h-64 overflow-y-auto">
            {orgsWithUrls.map(org => {
              const hostname = window.location.hostname;
              const isCurrent = (org.customDomain && hostname === org.customDomain) ||
                                (org.subdomain && (hostname === `${org.subdomain}.coachful.co` || hostname === `${org.subdomain}.growthaddicts.app`));
              
              return (
                <button
                  key={org.organizationId}
                  onClick={() => handleOrgClick(org)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-left
                    hover:bg-[#f5f3f0] dark:hover:bg-[#333] transition-colors
                    ${isCurrent ? 'bg-[#f5f3f0] dark:bg-[#333]' : ''}
                  `}
                >
                  {/* Org Logo */}
                  <div className="w-8 h-8 rounded-lg bg-[#e1ddd8] dark:bg-[#444] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {org.imageUrl ? (
                      <Image
                        src={org.imageUrl}
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
                      {org.name}
                    </div>
                    <div className="text-xs text-text-secondary truncate">
                      {org.customDomain || `${org.subdomain}.coachful.co`}
                    </div>
                  </div>
                  
                  {/* Current indicator or external link icon */}
                  {isCurrent ? (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <ExternalLink className="w-4 h-4 text-text-secondary flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
