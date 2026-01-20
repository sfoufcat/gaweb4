'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Building2, Users, Globe, ArrowLeft, ExternalLink, Trash2, Loader2, Settings } from 'lucide-react';
import type { UserRole, CoachTier } from '@/types';
import { AdminUsersTab } from './AdminUsersTab';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { BrandedCheckbox } from '@/components/ui/checkbox';

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
  // Tier information (fetched separately)
  tier?: CoachTier;
  subscriptionStatus?: string;
  manualBilling?: boolean;
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
  
  // Organization deletion state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [deletingOrg, setDeletingOrg] = useState(false);
  
  // Tier management state
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<CoachTier>('starter');
  const [editingManualBilling, setEditingManualBilling] = useState(true);
  const [editingManualExpiresAt, setEditingManualExpiresAt] = useState('');
  const [editingCreditsToAdd, setEditingCreditsToAdd] = useState('');
  const [savingTier, setSavingTier] = useState(false);
  const [loadingTier, setLoadingTier] = useState(false);

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

  // Fetch tier info for a specific organization
  const fetchOrgTier = async (orgId: string) => {
    try {
      setLoadingTier(true);
      const response = await fetch(`/api/admin/organizations/${orgId}/tier`);
      if (response.ok) {
        const data = await response.json();
        setEditingTier(data.tier || 'starter');
        setEditingManualBilling(data.manualBilling ?? true);
        setEditingManualExpiresAt(data.manualExpiresAt ? data.manualExpiresAt.split('T')[0] : '');
        setEditingCreditsToAdd(''); // Reset credits field on dialog open
        
        // Update the selected org with tier info
        if (selectedOrg && selectedOrg.id === orgId) {
          setSelectedOrg({
            ...selectedOrg,
            tier: data.tier,
            subscriptionStatus: data.status,
            manualBilling: data.manualBilling,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching org tier:', err);
    } finally {
      setLoadingTier(false);
    }
  };

  // Open tier edit dialog
  const openTierDialog = async () => {
    if (!selectedOrg) return;
    setTierDialogOpen(true);
    await fetchOrgTier(selectedOrg.id);
  };

  // Save tier changes
  const handleSaveTier = async () => {
    if (!selectedOrg) return;
    
    setSavingTier(true);
    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: editingTier,
          manualBilling: editingManualBilling,
          manualExpiresAt: editingManualExpiresAt || null,
          creditsToAdd: editingCreditsToAdd ? parseInt(editingCreditsToAdd, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update tier');
      }

      // Update local state
      setSelectedOrg({
        ...selectedOrg,
        tier: editingTier,
        manualBilling: editingManualBilling,
      });
      
      setTierDialogOpen(false);
      setEditingCreditsToAdd(''); // Reset credits field
      const creditsMsg = editingCreditsToAdd ? ` (+${editingCreditsToAdd} credits added)` : '';
      alert(`Successfully updated ${selectedOrg.name} to ${editingTier.charAt(0).toUpperCase() + editingTier.slice(1)} tier!${creditsMsg}`);
    } catch (err) {
      console.error('Error updating tier:', err);
      alert(err instanceof Error ? err.message : 'Failed to update tier');
    } finally {
      setSavingTier(false);
    }
  };

  // Get tier badge color
  const getTierBadgeColor = (tier: CoachTier | undefined) => {
    switch (tier) {
      case 'scale':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'pro':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400';
    }
  };

  // Handle organization deletion
  const handleDeleteOrganization = async () => {
    if (!orgToDelete) return;
    
    setDeletingOrg(true);
    try {
      const response = await fetch(`/api/admin/organizations/${orgToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete organization');
      }

      const result = await response.json();
      
      // Close dialog and refresh list
      setDeleteDialogOpen(false);
      setOrgToDelete(null);
      
      // Show success message with details
      if (result.errors && result.errors.length > 0) {
        alert(`Organization "${result.organizationName}" was deleted, but some cleanup operations had issues:\n\n${result.errors.join('\n')}`);
      } else {
        alert(`Organization "${result.organizationName}" has been successfully deleted.`);
      }
      
      // Refresh the organizations list
      await fetchOrganizations();
    } catch (err) {
      console.error('Error deleting organization:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete organization');
    } finally {
      setDeletingOrg(false);
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
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-accent/20 to-[#8c6245]/10 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-brand-accent" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    {selectedOrg.name}
                  </h2>
                  {/* Tier Badge */}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium font-albert ${getTierBadgeColor(selectedOrg.tier)}`}>
                    {selectedOrg.tier ? selectedOrg.tier.charAt(0).toUpperCase() + selectedOrg.tier.slice(1) : 'Starter'}
                  </span>
                  {selectedOrg.manualBilling && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-albert bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      Manual
                    </span>
                  )}
                </div>
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
                      className="text-brand-accent hover:underline font-albert text-sm flex items-center gap-1"
                    >
                      <Globe className="w-4 h-4" />
                      {selectedOrg.subdomain}.coachful.co
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              
              {/* Edit Tier Button */}
              <Button
                onClick={openTierDialog}
                variant="outline"
                className="border-[#e1ddd8] dark:border-[#262b35] hover:bg-[#faf8f6] dark:hover:bg-white/5"
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage Tier
              </Button>
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
        
        {/* Tier Edit Dialog */}
        <AlertDialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
          <AlertDialogContent className="sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-albert">Manage Plan Tier</AlertDialogTitle>
              <AlertDialogDescription className="font-albert" asChild>
                <div>
                  <p className="mb-4">
                    Edit the plan tier for <strong>{selectedOrg.name}</strong>.
                  </p>
                  
                  {loadingTier ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Tier Selector */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Plan Tier
                        </label>
                        <Select
                          value={editingTier}
                          onValueChange={(value: string) => setEditingTier(value as CoachTier)}
                          disabled={savingTier}
                        >
                          <SelectTrigger className="w-full font-albert">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[10001]">
                            <SelectItem value="starter" className="font-albert">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                Starter - 15 clients, 2 programs
                              </span>
                            </SelectItem>
                            <SelectItem value="pro" className="font-albert">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Pro - 150 clients, custom domain
                              </span>
                            </SelectItem>
                            <SelectItem value="scale" className="font-albert">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Scale - 500 clients, team features
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Manual Billing Toggle */}
                      <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-lg border border-[#e1ddd8] dark:border-[#262b35]">
                        <BrandedCheckbox
                          checked={editingManualBilling}
                          onChange={(checked) => setEditingManualBilling(checked)}
                          disabled={savingTier}
                        />
                        <div>
                          <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Manual billing (no Stripe required)
                          </label>
                          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                            Grant access without payment
                          </p>
                        </div>
                      </div>
                      
                      {/* Expiration Date */}
                      {editingManualBilling && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                            Expiration Date (optional)
                          </label>
                          <DatePicker
                            value={editingManualExpiresAt}
                            onChange={(date) => setEditingManualExpiresAt(date)}
                            minDate={new Date()}
                            placeholder="Select expiry date"
                            disabled={savingTier}
                          />
                          <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                            Leave empty for unlimited access
                          </p>
                        </div>
                      )}

                      {/* Add Credits */}
                      <div className="space-y-2 pt-2 border-t border-[#e1ddd8] dark:border-[#262b35]">
                        <label className="text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                          Add Call Credits (optional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={editingCreditsToAdd}
                          onChange={(e) => setEditingCreditsToAdd(e.target.value)}
                          placeholder="0"
                          className="w-full h-10 px-3 py-2 rounded-lg border border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#1e222a] text-sm text-[#1a1a1a] dark:text-[#f5f5f8] focus:outline-none focus:ring-2 focus:ring-brand-accent dark:ring-brand-accent/20 focus:border-brand-accent font-albert disabled:opacity-50"
                          disabled={savingTier}
                        />
                        <p className="text-xs text-[#8c8c8c] dark:text-[#7d8190] font-albert">
                          Each credit = 1 AI call summary (60 min). Added to purchased credits.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={savingTier}
                className="font-albert"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  handleSaveTier();
                }}
                disabled={savingTier || loadingTier}
                className="bg-brand-accent hover:bg-brand-accent/90 text-white font-albert"
              >
                {savingTier ? 'Saving...' : 'Save Changes'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-white/60 dark:bg-[#171b22]/60 backdrop-blur-xl border border-[#e1ddd8] dark:border-[#262b35]/50 rounded-2xl p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
            className="mt-4 bg-brand-accent hover:bg-brand-accent/90 text-white"
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-accent/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-brand-accent" />
            </div>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-lg mb-2">No organizations found</p>
            <p className="text-[#5f5a55] dark:text-[#b2b6c2]/70 font-albert text-sm">
              Organizations are created when users are assigned the coach role.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="relative p-4 rounded-xl border border-[#e1ddd8] dark:border-[#262b35]/50 bg-white/40 dark:bg-white/5 hover:bg-[#faf8f6] dark:hover:bg-white/10 transition-colors text-left group"
              >
                {/* Delete button - top right corner */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOrgToDelete(org);
                    setDeleteDialogOpen(true);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-[#5f5a55] dark:text-[#b2b6c2] hover:text-red-600 dark:hover:text-red-400 transition-all z-10"
                  title={`Delete ${org.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                {/* Clickable area for selecting org */}
                <button
                  onClick={() => {
                    setSelectedOrg(org);
                    // Fetch tier info when selecting org
                    fetchOrgTier(org.id);
                  }}
                  className="w-full text-left"
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
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-brand-accent/20 to-[#8c6245]/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-brand-accent" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert truncate group-hover:text-brand-accent dark:group-hover:text-brand-accent transition-colors">
                        {org.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[#5f5a55] dark:text-[#b2b6c2] font-albert text-xs flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {org.membersCount}
                        </span>
                        {org.subdomain && (
                          <span className="text-brand-accent font-albert text-xs flex items-center gap-1">
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
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Delete Organization Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-albert text-red-600 dark:text-red-400">
              Delete Organization
            </AlertDialogTitle>
            <AlertDialogDescription className="font-albert" asChild>
              <div className="space-y-4">
                <p>
                  Are you sure you want to delete <strong className="text-[#1a1a1a] dark:text-[#f5f5f8]">{orgToDelete?.name}</strong>?
                </p>
                
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
                    This action will permanently delete:
                  </p>
                  <ul className="text-sm text-red-600 dark:text-red-300 space-y-1 list-disc list-inside">
                    <li>All {orgToDelete?.membersCount || 0} user memberships</li>
                    <li>All custom domains and subdomains</li>
                    <li>Organization branding and settings</li>
                    <li>All community channels</li>
                    <li>Subscription information</li>
                  </ul>
                </div>
                
                <p className="text-sm text-[#8c8c8c] dark:text-[#7d8190]">
                  This action cannot be undone. User accounts will not be deleted, but they will lose access to this organization.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletingOrg}
              className="font-albert"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleDeleteOrganization();
              }}
              disabled={deletingOrg}
              className="bg-red-600 hover:bg-red-700 text-white font-albert"
            >
              {deletingOrg ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

