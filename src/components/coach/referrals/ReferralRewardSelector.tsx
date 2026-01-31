'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, BookOpen, Percent, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ReferralReward, ReferralRewardType, ReferralResourceType, Program } from '@/types';
import type { DiscoverArticle, DiscoverCourse, DiscoverVideo } from '@/types/discover';

interface Resource {
  id: string;
  title: string;
  type: ReferralResourceType;
}

interface ReferralRewardSelectorProps {
  value: ReferralReward | undefined;
  onChange: (reward: ReferralReward | undefined) => void;
  organizationId?: string;
}

/**
 * ReferralRewardSelector Component
 *
 * Allows coaches to configure rewards for successful referrals:
 * - No reward: Track referrals only
 * - Free product: Grant access to a program or resource
 * - Discount code: Auto-generate a discount code
 * - Cash reward: Coach pays referrer directly
 */
export function ReferralRewardSelector({
  value,
  onChange,
  organizationId,
}: ReferralRewardSelectorProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Fetch programs and resources for the free_program reward option
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        // Fetch programs
        const programsRes = await fetch('/api/coach/org-programs');
        if (programsRes.ok) {
          const data = await programsRes.json();
          setPrograms(data.programs || []);
        }

        // Fetch resources in parallel
        const [coursesRes, articlesRes, videosRes, downloadsRes, linksRes] = await Promise.all([
          fetch('/api/coach/org-discover/courses'),
          fetch('/api/coach/org-discover/articles'),
          fetch('/api/coach/org-discover/videos'),
          fetch('/api/coach/org-discover/downloads'),
          fetch('/api/coach/org-discover/links'),
        ]);

        const allResources: Resource[] = [];

        if (coursesRes.ok) {
          const data = await coursesRes.json();
          (data.courses || []).forEach((c: DiscoverCourse) => {
            allResources.push({ id: c.id, title: c.title, type: 'course' });
          });
        }
        if (articlesRes.ok) {
          const data = await articlesRes.json();
          (data.articles || []).forEach((a: DiscoverArticle) => {
            allResources.push({ id: a.id, title: a.title, type: 'article' });
          });
        }
        if (videosRes.ok) {
          const data = await videosRes.json();
          (data.videos || []).forEach((v: DiscoverVideo) => {
            allResources.push({ id: v.id, title: v.title, type: 'video' });
          });
        }
        if (downloadsRes.ok) {
          const data = await downloadsRes.json();
          (data.downloads || []).forEach((d: { id: string; title: string }) => {
            allResources.push({ id: d.id, title: d.title, type: 'download' });
          });
        }
        if (linksRes.ok) {
          const data = await linksRes.json();
          (data.links || []).forEach((l: { id: string; title: string }) => {
            allResources.push({ id: l.id, title: l.title, type: 'link' });
          });
        }

        setResources(allResources);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [organizationId]);

  // Group resources by type for the dropdown
  const resourcesByType = useMemo(() => {
    const grouped: Record<ReferralResourceType, Resource[]> = {
      course: [],
      article: [],
      video: [],
      download: [],
      link: [],
    };
    resources.forEach((r) => {
      grouped[r.type].push(r);
    });
    return grouped;
  }, [resources]);

  const handleRewardTypeChange = (type: ReferralRewardType | 'none') => {
    if (type === 'none') {
      onChange(undefined);
      return;
    }

    const baseReward: ReferralReward = { type };

    // Set defaults based on type
    switch (type) {
      case 'free_program':
        // Don't set a default - user must select
        break;
      case 'discount_code':
        baseReward.discountType = 'percentage';
        baseReward.discountValue = 20; // Default 20%
        break;
      case 'monetary':
        baseReward.monetaryAmount = 1000; // Default $10.00
        break;
    }

    onChange(baseReward);
  };

  const handleProductSelect = (productValue: string) => {
    if (!value || value.type !== 'free_program') return;

    // Parse the value (format: "program:id" or "resource:type:id")
    const parts = productValue.split(':');
    if (parts[0] === 'program') {
      onChange({
        ...value,
        freeProgramId: parts[1],
        freeResourceId: undefined,
        freeResourceType: undefined,
      });
    } else if (parts[0] === 'resource') {
      onChange({
        ...value,
        freeProgramId: undefined,
        freeResourceId: parts[2],
        freeResourceType: parts[1] as ReferralResourceType,
      });
    }
  };

  // Get current product value for the select
  const currentProductValue = useMemo(() => {
    if (!value || value.type !== 'free_program') return '';
    if (value.freeProgramId) return `program:${value.freeProgramId}`;
    if (value.freeResourceId && value.freeResourceType) {
      return `resource:${value.freeResourceType}:${value.freeResourceId}`;
    }
    return '';
  }, [value]);

  // Get product display name
  const getProductDisplayName = () => {
    if (!value || value.type !== 'free_program') return '';
    if (value.freeProgramId) {
      const program = programs.find((p) => p.id === value.freeProgramId);
      return program?.name || 'Unknown program';
    }
    if (value.freeResourceId && value.freeResourceType) {
      const resource = resources.find((r) => r.id === value.freeResourceId);
      return resource?.title || 'Unknown resource';
    }
    return '';
  };

  const rewardType = value?.type || 'none';

  const hasProducts = programs.length > 0 || resources.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-base font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
          Referral Reward (Optional)
        </label>
        <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
          Incentivize referrals by offering a reward when a friend completes enrollment
        </p>

        {/* Reward Type Selection - 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* No Reward */}
          <button
            type="button"
            onClick={() => handleRewardTypeChange('none')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              rewardType === 'none'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Gift
                className={`w-4 h-4 ${rewardType === 'none' ? 'text-brand-accent' : 'text-[#5f5a55]'}`}
              />
              <span
                className={`text-base font-medium ${
                  rewardType === 'none' ? 'text-brand-accent' : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}
              >
                No Reward
              </span>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Track referrals only</p>
          </button>

          {/* Free Product */}
          <button
            type="button"
            onClick={() => handleRewardTypeChange('free_program')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              rewardType === 'free_program'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <BookOpen
                className={`w-4 h-4 ${
                  rewardType === 'free_program' ? 'text-brand-accent' : 'text-[#5f5a55]'
                }`}
              />
              <span
                className={`text-base font-medium ${
                  rewardType === 'free_program'
                    ? 'text-brand-accent'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}
              >
                Free Product
              </span>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Program or resource</p>
          </button>

          {/* Discount Code */}
          <button
            type="button"
            onClick={() => handleRewardTypeChange('discount_code')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              rewardType === 'discount_code'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Percent
                className={`w-4 h-4 ${
                  rewardType === 'discount_code' ? 'text-brand-accent' : 'text-[#5f5a55]'
                }`}
              />
              <span
                className={`text-base font-medium ${
                  rewardType === 'discount_code'
                    ? 'text-brand-accent'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}
              >
                Discount Code
              </span>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Auto-generate discount</p>
          </button>

          {/* Cash Reward */}
          <button
            type="button"
            onClick={() => handleRewardTypeChange('monetary')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              rewardType === 'monetary'
                ? 'border-brand-accent bg-brand-accent/5'
                : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b] hover:border-brand-accent/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <DollarSign
                className={`w-4 h-4 ${
                  rewardType === 'monetary' ? 'text-brand-accent' : 'text-[#5f5a55]'
                }`}
              />
              <span
                className={`text-base font-medium ${
                  rewardType === 'monetary'
                    ? 'text-brand-accent'
                    : 'text-[#1a1a1a] dark:text-[#f5f5f8]'
                }`}
              >
                Cash Reward
              </span>
            </div>
            <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">Pay referrers directly</p>
          </button>
        </div>
      </div>

      {/* Reward Configuration - Animated expand/collapse */}
      <AnimatePresence mode="wait">
        {value && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-[#f8f6f4] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] relative">
              <AnimatePresence mode="wait">
                {/* Free Product Configuration */}
                {value?.type === 'free_program' && (
                  <motion.div
                    key="free_program"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                Select Product to Grant
              </label>
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-sm text-[#5f5a55]">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading products...
                </div>
              ) : !hasProducts ? (
                <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2]">
                  No programs or resources available
                </p>
              ) : (
                <Select value={currentProductValue} onValueChange={handleProductSelect}>
                  <SelectTrigger className="w-full h-12 px-4 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
                    <SelectValue placeholder="Select a product...">
                      {getProductDisplayName() || 'Select a product...'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {/* Programs */}
                    {programs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2">
                          Programs
                        </SelectLabel>
                        {programs.map((program) => (
                          <SelectItem
                            key={program.id}
                            value={`program:${program.id}`}
                            className="px-2"
                          >
                            <span className="font-albert">{program.name}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Courses */}
                    {resourcesByType.course.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2 mt-2">
                          Courses
                        </SelectLabel>
                        {resourcesByType.course.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={`resource:course:${r.id}`}
                            className="px-2"
                          >
                            <span className="font-albert">{r.title}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Articles */}
                    {resourcesByType.article.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2 mt-2">
                          Articles
                        </SelectLabel>
                        {resourcesByType.article.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={`resource:article:${r.id}`}
                            className="px-2"
                          >
                            <span className="font-albert">{r.title}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Videos */}
                    {resourcesByType.video.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2 mt-2">
                          Videos
                        </SelectLabel>
                        {resourcesByType.video.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={`resource:video:${r.id}`}
                            className="px-2"
                          >
                            <span className="font-albert">{r.title}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Downloads */}
                    {resourcesByType.download.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2 mt-2">
                          Downloads
                        </SelectLabel>
                        {resourcesByType.download.map((r) => (
                          <SelectItem
                            key={r.id}
                            value={`resource:download:${r.id}`}
                            className="px-2"
                          >
                            <span className="font-albert">{r.title}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}

                    {/* Links */}
                    {resourcesByType.link.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs uppercase text-[#5f5a55] dark:text-[#b2b6c2] font-semibold px-2 mt-2">
                          Links
                        </SelectLabel>
                        {resourcesByType.link.map((r) => (
                          <SelectItem key={r.id} value={`resource:link:${r.id}`} className="px-2">
                            <span className="font-albert">{r.title}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                The referrer will get free access to this product when their friend enrolls
              </p>
            </div>
                  </motion.div>
                )}

                {/* Discount Code Configuration */}
                {value?.type === 'discount_code' && (
                  <motion.div
                    key="discount_code"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Discount Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => value && onChange({ ...value, discountType: 'percentage' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      value?.discountType === 'percentage'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b]'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span className="text-sm font-medium font-albert">Percentage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => value && onChange({ ...value, discountType: 'fixed' })}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                      value?.discountType === 'fixed'
                        ? 'border-brand-accent bg-brand-accent/5'
                        : 'border-[#e1ddd8] dark:border-[#262b35] bg-white dark:bg-[#1d222b]'
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium font-albert">Fixed Amount</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Discount Value
                </label>
                <div className="flex items-center gap-2">
                  {value?.discountType === 'fixed' && (
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">$</span>
                  )}
                  <input
                    type="number"
                    min={1}
                    max={value?.discountType === 'percentage' ? 100 : 10000}
                    value={
                      value?.discountType === 'fixed'
                        ? ((value?.discountValue || 0) / 100).toFixed(2)
                        : value?.discountValue || 20
                    }
                    onChange={(e) => {
                      if (!value) return;
                      const val = parseFloat(e.target.value) || 0;
                      onChange({
                        ...value,
                        discountValue:
                          value.discountType === 'fixed'
                            ? Math.round(val * 100)
                            : Math.min(100, val),
                      });
                    }}
                    className="w-28 px-4 py-2.5 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                  />
                  {value?.discountType === 'percentage' && (
                    <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">%</span>
                  )}
                </div>
                <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] mt-2">
                  A unique discount code will be auto-generated for each successful referral
                </p>
              </div>
            </div>
                  </motion.div>
                )}

                {/* Cash Reward Configuration */}
                {value?.type === 'monetary' && (
                  <motion.div
                    key="monetary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1a1a1a] dark:text-[#f5f5f8] font-albert mb-2">
                  Amount Per Referral
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[#1a1a1a] dark:text-[#f5f5f8] font-medium">$</span>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step="0.01"
                    value={((value?.monetaryAmount || 0) / 100).toFixed(2)}
                    onChange={(e) => {
                      if (!value) return;
                      const val = parseFloat(e.target.value) || 0;
                      onChange({
                        ...value,
                        monetaryAmount: Math.round(val * 100),
                      });
                    }}
                    className="w-28 px-4 py-2.5 bg-white dark:bg-[#171b22] border border-[#e1ddd8] dark:border-[#262b35] rounded-xl text-[#1a1a1a] dark:text-[#f5f5f8] font-albert"
                  />
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-albert">
                  You must arrange payment to referrers directly. We&apos;ll track how much you owe
                  each referrer.
                </p>
              </div>
            </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
