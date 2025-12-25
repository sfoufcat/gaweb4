'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Copy, Tag, Percent, DollarSign, Calendar, Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import type { DiscountCode, DiscountType, DiscountApplicableTo } from '@/types';

interface DiscountCodesTabProps {
  apiBasePath?: string;
}

export function DiscountCodesTab({ apiBasePath = '/api/coach/discount-codes' }: DiscountCodesTabProps) {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DiscountCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    type: DiscountType;
    value: number;
    applicableTo: DiscountApplicableTo;
    maxUses: number | '';
    expiresAt: string;
    isActive: boolean;
  }>({
    code: '',
    name: '',
    type: 'percentage',
    value: 10,
    applicableTo: 'all',
    maxUses: '',
    expiresAt: '',
    isActive: true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDiscountCodes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(apiBasePath);
      if (!response.ok) {
        throw new Error('Failed to fetch discount codes');
      }

      const data = await response.json();
      setDiscountCodes(data.discountCodes || []);
    } catch (err) {
      console.error('Error fetching discount codes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch discount codes');
    } finally {
      setLoading(false);
    }
  }, [apiBasePath]);

  useEffect(() => {
    fetchDiscountCodes();
  }, [fetchDiscountCodes]);

  const handleOpenModal = (code?: DiscountCode) => {
    if (code) {
      setEditingCode(code);
      setFormData({
        code: code.code,
        name: code.name || '',
        type: code.type,
        value: code.value,
        applicableTo: code.applicableTo,
        maxUses: code.maxUses || '',
        expiresAt: code.expiresAt ? code.expiresAt.split('T')[0] : '',
        isActive: code.isActive,
      });
    } else {
      setEditingCode(null);
      // Generate a random code
      const randomCode = `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(1000 + Math.random() * 9000)}`;
      setFormData({
        code: randomCode,
        name: '',
        type: 'percentage',
        value: 10,
        applicableTo: 'all',
        maxUses: '',
        expiresAt: '',
        isActive: true,
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setFormError(null);

      const url = editingCode 
        ? `${apiBasePath}/${editingCode.id}`
        : apiBasePath;
      
      const response = await fetch(url, {
        method: editingCode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          maxUses: formData.maxUses || null,
          expiresAt: formData.expiresAt || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save discount code');
      }

      await fetchDiscountCodes();
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error saving discount code:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      setDeleting(true);

      const response = await fetch(`${apiBasePath}/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      await fetchDiscountCodes();
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting discount code:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDiscountValue = (code: DiscountCode) => {
    if (code.type === 'percentage') {
      return `${code.value}%`;
    }
    return `$${(code.value / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
          <div className="h-10 w-32 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[#e1ddd8]/50 dark:bg-[#272d38]/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
            Discount Codes
          </h2>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
            Create and manage discount codes for your programs and squads
          </p>
        </div>
        <Button
          onClick={() => handleOpenModal()}
          className="bg-[#a07855] hover:bg-[#8c6245] text-white flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Code
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-albert">{error}</p>
        </div>
      )}

      {/* Discount Codes List */}
      {discountCodes.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl">
          <Tag className="w-12 h-12 text-[#5f5a55] mx-auto mb-3" />
          <h3 className="font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-1">
            No discount codes yet
          </h3>
          <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
            Create discount codes to offer special pricing to your clients
          </p>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-[#a07855] hover:bg-[#8c6245] text-white"
          >
            Create Your First Code
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {discountCodes.map((code) => (
            <div
              key={code.id}
              className={`bg-white dark:bg-[#171b22] border rounded-xl p-4 ${
                code.isActive 
                  ? 'border-[#e1ddd8] dark:border-[#262b35]' 
                  : 'border-gray-300 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Code badge */}
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1.5 rounded-lg font-mono font-bold text-sm ${
                      code.isActive
                        ? 'bg-[#a07855]/10 text-[#a07855] dark:bg-[#b8896a]/10 dark:text-[#b8896a]'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {code.code}
                    </div>
                    <button
                      onClick={() => handleCopyCode(code.code, code.id)}
                      className="p-1.5 text-[#5f5a55] hover:text-[#a07855] rounded transition-colors"
                      title="Copy code"
                    >
                      {copiedId === code.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Discount value */}
                  <div className="flex items-center gap-1.5 text-[#1a1a1a] dark:text-[#f5f5f8]">
                    {code.type === 'percentage' ? (
                      <Percent className="w-4 h-4 text-[#a07855]" />
                    ) : (
                      <DollarSign className="w-4 h-4 text-[#a07855]" />
                    )}
                    <span className="font-semibold font-albert">
                      {formatDiscountValue(code)}
                    </span>
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">off</span>
                  </div>

                  {/* Name if set */}
                  {code.name && (
                    <span className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
                      {code.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{code.useCount} used</span>
                      {code.maxUses && <span className="text-xs">/ {code.maxUses}</span>}
                    </div>
                    {code.expiresAt && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(code.expiresAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    code.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {code.isActive ? 'Active' : 'Inactive'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenModal(code)}
                      className="p-1.5 text-[#5f5a55] hover:text-[#a07855] rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(code)}
                      className="p-1.5 text-[#5f5a55] hover:text-red-500 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Applicability info */}
              <div className="mt-2 flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  code.applicableTo === 'all'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : code.applicableTo === 'programs'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {code.applicableTo === 'all' ? 'All Products' : 
                   code.applicableTo === 'programs' ? 'Programs Only' : 'Squads Only'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !saving && setIsModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-4">
                    {editingCode ? 'Edit Discount Code' : 'Create Discount Code'}
                  </Dialog.Title>

                  <div className="space-y-4">
                    {/* Code */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Code *
                      </label>
                      <input
                        type="text"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                        placeholder="e.g., SAVE20"
                        disabled={!!editingCode}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-mono font-albert disabled:opacity-50"
                      />
                    </div>

                    {/* Name (optional) */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Name (optional)
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Summer Sale"
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      />
                    </div>

                    {/* Type and Value */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Type
                        </label>
                        <select
                          value={formData.type}
                          onChange={(e) => setFormData({ ...formData, type: e.target.value as DiscountType })}
                          disabled={editingCode && editingCode.useCount > 0}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert disabled:opacity-50"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Value
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f5a55]">
                            {formData.type === 'percentage' ? '%' : '$'}
                          </span>
                          <input
                            type="number"
                            value={formData.type === 'fixed' ? formData.value / 100 : formData.value}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              value: formData.type === 'fixed' 
                                ? Math.round(parseFloat(e.target.value || '0') * 100)
                                : parseInt(e.target.value || '0')
                            })}
                            min="0"
                            max={formData.type === 'percentage' ? 100 : undefined}
                            disabled={editingCode && editingCode.useCount > 0}
                            className="w-full pl-8 pr-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Applicable To */}
                    <div>
                      <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                        Applies To
                      </label>
                      <select
                        value={formData.applicableTo}
                        onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value as DiscountApplicableTo })}
                        className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                      >
                        <option value="all">All Programs & Squads</option>
                        <option value="programs">Programs Only</option>
                        <option value="squads">Squads Only</option>
                      </select>
                    </div>

                    {/* Max Uses and Expiration */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Max Uses
                        </label>
                        <input
                          type="number"
                          value={formData.maxUses}
                          onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : '' })}
                          placeholder="Unlimited"
                          min="1"
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-1">
                          Expires
                        </label>
                        <input
                          type="date"
                          value={formData.expiresAt}
                          onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                          className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#262b35] rounded-lg bg-white dark:bg-[#11141b] text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                        />
                      </div>
                    </div>

                    {/* Active toggle */}
                    <div className="flex items-center justify-between p-3 bg-[#f5f3f0] dark:bg-[#11141b] rounded-lg">
                      <div>
                        <span className="font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">Active</span>
                        <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2]">Code can be redeemed</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                        className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                          formData.isActive ? 'bg-[#a07855]' : 'bg-[#d1ccc6] dark:bg-[#3a3f4a]'
                        }`}
                      >
                        <span
                          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            formData.isActive ? 'translate-x-5' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {formError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 font-albert">{formError}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsModalOpen(false)}
                        disabled={saving}
                        className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving || !formData.code.trim()}
                        className="flex-1 bg-[#a07855] hover:bg-[#8c6245] text-white"
                      >
                        {saving ? 'Saving...' : editingCode ? 'Update' : 'Create'}
                      </Button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirmation Modal */}
      <Transition appear show={!!deleteConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setDeleteConfirm(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-[#171b22] p-6 shadow-xl transition-all">
                  <Dialog.Title className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-3">
                    Delete Discount Code?
                  </Dialog.Title>
                  
                  <p className="text-[15px] text-[#5f5a55] dark:text-[#b2b6c2] leading-relaxed mb-4">
                    Are you sure you want to delete the discount code <strong>{deleteConfirm?.code}</strong>?
                    {deleteConfirm && deleteConfirm.useCount > 0 && (
                      <span className="block mt-2 text-amber-600 dark:text-amber-400">
                        This code has been used {deleteConfirm.useCount} time(s).
                      </span>
                    )}
                  </p>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setDeleteConfirm(null)}
                      disabled={deleting}
                      className="flex-1 border-[#e1ddd8] dark:border-[#262b35]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}

