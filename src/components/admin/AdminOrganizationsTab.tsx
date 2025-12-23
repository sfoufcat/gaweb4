'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Building2, Users, Globe, ArrowLeft, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import type { UserRole } from '@/types';
import { AdminUsersTab } from './AdminUsersTab';
import { Button } from '@/components/ui/button';

interface CustomDomain {
  id: string;
  domain: string;
  status: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  membersCount: number;
  createdAt: string;
  subdomain: string | null;
  customDomains: CustomDomain[];
  tenantUrl: string | null;
}

interface AdminOrganizationsTabProps {
  currentUserRole: UserRole;
}

/**
 * AdminOrganizationsTab
 * 
 * Lists all Clerk organizations with domain info.
 * When an org is selected, shows the users in that org with org-scoped org role management.
 */
export function AdminOrganizationsTab({ currentUserRole }: AdminOrganizationsTabProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<string | null>(null);

  const handleDeleteDomain = async (orgId: string, domainId: string, domainName: string) => {
    if (!confirm(`Are you sure you want to delete the domain "${domainName}"?\n\nThis will remove it from:\n- Clerk (authentication)\n- Vercel (hosting)\n- Stripe (Apple Pay)\n- Edge Config (caching)\n\nThis action cannot be undone.`)) {
      return;
    }

    setDeletingDomain(domainId);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/domains/${domainId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete domain');
      }

      // Refresh the organizations list
      await fetchOrganizations();
    } catch (err) {
      console.error('Error deleting domain:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete domain');
    } finally {
      setDeletingDomain(null);
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/organizations');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  // If an org is selected, show users tab for that org
  if (selectedOrg) {
    return (
      <div>
        {/* Back button and org header */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedOrg(null)}
            className="inline-flex items-center gap-2 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-[#1a1a1a] dark:hover:text-[#f5f5f8] font-albert transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to organizations
          </button>
          
          <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-6">
            <div className="flex items-center gap-4">
              {selectedOrg.imageUrl ? (
                <Image
                  src={selectedOrg.imageUrl}
                  alt={selectedOrg.name}
                  width={64}
                  height={64}
                  className="rounded-xl object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-[#a07855]" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                  {selectedOrg.name}
                </h2>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {selectedOrg.membersCount} members
                  </span>
                  {selectedOrg.tenantUrl && (
                    <a
                      href={selectedOrg.tenantUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a07855] dark:text-[#b8896a] hover:underline font-albert text-sm flex items-center gap-1"
                    >
                      <Globe className="w-4 h-4" />
                      {selectedOrg.subdomain}.growthaddicts.com
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Users for this org */}
        <AdminUsersTab
          currentUserRole={currentUserRole}
          orgMode={{ organizationId: selectedOrg.id }}
          headerTitle={`Users in ${selectedOrg.name}`}
          showOrgRole={true}
        />
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#a07855] dark:border-[#b8896a] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert">Loading organizations...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center text-red-600 dark:text-red-400">
          <p className="font-albert font-semibold mb-2">Error</p>
          <p className="font-albert text-sm">{error}</p>
          <Button 
            onClick={fetchOrganizations} 
            className="mt-4 bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Organizations list
  return (
    <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#e1ddd8]/50 dark:border-[#262b35]/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Organizations
            </h3>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-sm mt-1">
              {organizations.length} organization{organizations.length !== 1 ? 's' : ''} total. Select one to manage users and org roles.
            </p>
          </div>
          <Button
            onClick={fetchOrganizations}
            variant="outline"
            className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Organizations Grid */}
      <div className="p-6">
        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#a07855]/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#a07855]" />
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No organizations found</p>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
              Organizations are created when users are assigned the coach role.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => setSelectedOrg(org)}
                className="p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 bg-white/40 dark:bg-white/5 hover:bg-[#faf8f6] dark:hover:bg-white/10 transition-colors text-left group"
              >
                <div className="flex items-start gap-3">
                  {org.imageUrl ? (
                    <Image
                      src={org.imageUrl}
                      alt={org.name}
                      width={48}
                      height={48}
                      className="rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#a07855]/20 to-[#8c6245]/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-[#a07855]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate group-hover:text-[#a07855] dark:group-hover:text-[#b8896a] transition-colors">
                      {org.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {org.membersCount}
                      </span>
                      {org.subdomain && (
                        <span className="text-[#a07855] dark:text-[#b8896a] font-albert text-xs flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {org.subdomain}
                        </span>
                      )}
                    </div>
                    {org.customDomains.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {org.customDomains.slice(0, 2).map((cd) => (
                          <span
                            key={cd.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-albert ${
                              cd.status === 'verified'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}
                          >
                            {cd.domain}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDomain(org.id, cd.id, cd.domain);
                              }}
                              disabled={deletingDomain === cd.id}
                              className="ml-1 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                              title={`Delete ${cd.domain}`}
                            >
                              {deletingDomain === cd.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        ))}
                        {org.customDomains.length > 2 && (
                          <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-xs">
                            +{org.customDomains.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

