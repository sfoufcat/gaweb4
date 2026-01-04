'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Building2, ExternalLink } from 'lucide-react';

interface TenantDomain {
  organizationId: string;
  name: string;
  subdomain: string | null;
  customDomain: string | null;
  imageUrl: string | null;
  tenantUrl: string | null;
}

/**
 * PlatformEmptyState Component
 * 
 * Shown on the platform domain (app.coachful.co) when user tries to access
 * tenant-specific features like Programs or Squad.
 * 
 * Displays a message explaining they need to visit their coach's domain,
 * with links to any tenant domains they belong to.
 */
export function PlatformEmptyState() {
  const [tenantDomains, setTenantDomains] = useState<TenantDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTenantDomains() {
      try {
        const response = await fetch('/api/user/tenant-domains');
        if (!response.ok) throw new Error('Failed to fetch');
        
        const data = await response.json();
        setTenantDomains(data.tenantDomains || []);
      } catch (error) {
        console.error('[PLATFORM_EMPTY_STATE] Error fetching tenant domains:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchTenantDomains();
  }, []);

  const domainsWithUrls = tenantDomains.filter(d => d.tenantUrl);

  return (
    <div className="relative flex flex-col items-center justify-center py-20 px-4 min-h-[60vh]">
      {/* Gradient orb background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-30 dark:opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(100, 140, 180, 0.5) 0%, rgba(100, 140, 180, 0) 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-white/80 dark:bg-[#171b22]/80 backdrop-blur-sm flex items-center justify-center mb-8 shadow-lg">
          <Building2 className="w-10 h-10 text-[#648cb4]" />
        </div>

        {/* Title */}
        <h1 className="font-albert text-[32px] md:text-[36px] font-normal text-text-primary dark:text-[#f5f5f8] tracking-[-2px] leading-[1.2] text-center mb-4">
          Platform Admin Area
        </h1>

        {/* Description */}
        <p className="font-sans text-[16px] text-text-secondary dark:text-[#b2b6c2] leading-[1.5] tracking-[-0.3px] text-center max-w-[400px] mb-8">
          To view your programs and squad, visit your coach&apos;s domain. 
          Programs and team content are specific to each coach&apos;s platform.
        </p>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-text-secondary">
            <div className="w-4 h-4 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
            <span>Loading your organizations...</span>
          </div>
        )}

        {/* Tenant domain links */}
        {!isLoading && domainsWithUrls.length > 0 && (
          <div className="w-full max-w-md">
            <p className="text-sm text-text-secondary text-center mb-4">
              Visit your coach&apos;s platform:
            </p>
            <div className="space-y-3">
              {domainsWithUrls.map(domain => (
                <a
                  key={domain.organizationId}
                  href={domain.tenantUrl!}
                  className="flex items-center gap-4 p-4 bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#2a2f38] hover:border-brand-accent dark:hover:border-brand-accent transition-colors group"
                >
                  {/* Org logo */}
                  <div className="w-12 h-12 rounded-lg bg-[#f3f1ef] dark:bg-[#11141b] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {domain.imageUrl ? (
                      <Image
                        src={domain.imageUrl}
                        alt={domain.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-text-secondary" />
                    )}
                  </div>
                  
                  {/* Org info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary dark:text-[#f5f5f8] truncate">
                      {domain.name}
                    </div>
                    <div className="text-sm text-text-secondary truncate">
                      {domain.customDomain || `${domain.subdomain}.coachful.co`}
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <ExternalLink className="w-5 h-5 text-text-secondary group-hover:text-brand-accent transition-colors flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* No domains state */}
        {!isLoading && domainsWithUrls.length === 0 && (
          <div className="text-center">
            <p className="text-text-secondary mb-4">
              You&apos;re not enrolled in any programs yet.
            </p>
            <p className="text-sm text-text-secondary/70">
              Ask your coach for their platform link to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

