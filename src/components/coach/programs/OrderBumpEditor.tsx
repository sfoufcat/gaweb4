'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Plus, Trash2, ChevronDown, Sparkles, AlertCircle, Lock, Zap, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandedCheckbox } from '@/components/ui/checkbox';
import { useBrandingValues } from '@/contexts/BrandingContext';
import { getLimit, getNextTier, TIER_PRICING } from '@/lib/coach-permissions';
import type { OrderBump, OrderBumpConfig, CoachTier } from '@/types';

// =============================================================================
// TYPES
// =============================================================================

interface AvailableProduct {
  id: string;
  type: 'program' | 'squad' | 'content';
  contentType?: 'event' | 'article' | 'course' | 'download' | 'link';
  name: string;
  imageUrl?: string;
  priceInCents: number;
  currency: string;
  description?: string;
}

interface OrderBumpEditorProps {
  /** Current order bumps configuration */
  orderBumps?: OrderBumpConfig;
  /** Called when order bumps change */
  onChange: (config: OrderBumpConfig) => void;
  /** Coach's current tier for limit checking */
  currentTier: CoachTier;
  /** Current product ID (to exclude from selection) */
  excludeProductId?: string;
  /** Current product type (to exclude from selection) */
  excludeProductType?: 'program' | 'squad' | 'content';
}

// =============================================================================
// PRODUCT SELECTOR MODAL
// =============================================================================

interface ProductSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: AvailableProduct) => void;
  excludeIds: string[];
  excludeProductId?: string;
  excludeProductType?: 'program' | 'squad' | 'content';
}

function ProductSelector({
  isOpen,
  onClose,
  onSelect,
  excludeIds,
  excludeProductId,
  excludeProductType,
}: ProductSelectorProps) {
  const [products, setProducts] = useState<AvailableProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'program' | 'squad' | 'content'>('all');
  const { accentLight } = useBrandingValues();

  // Fetch available products
  useEffect(() => {
    if (!isOpen) return;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/coach/order-bump-products');
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        setProducts(data.products || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [isOpen]);

  // Filter products
  const filteredProducts = products.filter(product => {
    // Exclude already selected products
    if (excludeIds.includes(product.id)) return false;
    
    // Exclude current product being edited
    if (excludeProductId && excludeProductType) {
      if (product.id === excludeProductId && product.type === excludeProductType) {
        return false;
      }
    }
    
    // Filter by type
    if (selectedType !== 'all' && product.type !== selectedType) return false;
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return product.name.toLowerCase().includes(query);
    }
    
    return true;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#171b22] rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#e1ddd8] dark:border-[#262b35]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-albert text-lg font-semibold text-text-primary dark:text-[#f5f5f8]">
              Select a Product
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#f5f2ed] dark:hover:bg-[#262b35] rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-[#e1ddd8] dark:border-[#313746] rounded-lg bg-white dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            />
          </div>
          
          {/* Type filter */}
          <div className="flex gap-2 mt-3">
            {(['all', 'program', 'squad', 'content'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedType === type
                    ? 'text-white'
                    : 'bg-[#f5f2ed] dark:bg-[#262b35] text-text-secondary hover:text-text-primary'
                }`}
                style={selectedType === type ? { backgroundColor: accentLight } : {}}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Products list */}
        <div className="overflow-y-auto max-h-[50vh] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12 text-red-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-text-secondary">
              <p className="font-albert">No products available</p>
              <p className="text-sm mt-1">Create programs, squads, or content first</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product) => (
                <button
                  key={`${product.type}-${product.id}`}
                  onClick={() => {
                    onSelect(product);
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#e1ddd8] dark:border-[#262b35] hover:border-brand-accent dark:hover:border-brand-accent/50 hover:bg-[#faf8f6] dark:hover:bg-[#1d222b] transition-all text-left"
                >
                  {/* Image */}
                  {product.imageUrl ? (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#f5f2ed] dark:bg-[#1d222b] flex-shrink-0">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${accentLight}20` }}
                    >
                      <span className="font-albert font-bold text-lg" style={{ color: accentLight }}>
                        {product.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-albert text-sm font-semibold text-text-primary dark:text-[#f5f5f8] truncate">
                        {product.name}
                      </h4>
                      <span className="px-2 py-0.5 bg-[#f5f2ed] dark:bg-[#262b35] text-text-secondary text-[10px] font-medium rounded-full flex-shrink-0">
                        {product.type}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-text-secondary mt-0.5">
                      {product.priceInCents === 0 
                        ? 'Free' 
                        : `$${(product.priceInCents / 100).toFixed(2)}`
                      }
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// BUMP ITEM EDITOR
// =============================================================================

interface BumpItemEditorProps {
  bump: OrderBump;
  onChange: (bump: OrderBump) => void;
  onRemove: () => void;
}

function BumpItemEditor({ bump, onChange, onRemove }: BumpItemEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { accentLight } = useBrandingValues();
  
  const discountedPrice = bump.discountPercent 
    ? Math.round(bump.priceInCents * (1 - bump.discountPercent / 100))
    : bump.priceInCents;

  return (
    <div className="border border-[#e1ddd8] dark:border-[#262b35] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-[#faf8f6] dark:bg-[#11141b]">
        {/* Image */}
        {bump.productImageUrl ? (
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#f5f2ed] dark:bg-[#1d222b] flex-shrink-0">
            <Image
              src={bump.productImageUrl}
              alt={bump.productName}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accentLight}20` }}
          >
            <span className="font-albert font-bold text-lg" style={{ color: accentLight }}>
              {bump.productName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-albert text-sm font-semibold text-text-primary dark:text-[#f5f5f8] truncate">
            {bump.productName}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-sans text-xs font-medium" style={{ color: accentLight }}>
              +${(discountedPrice / 100).toFixed(2)}
            </span>
            {bump.discountPercent && bump.discountPercent > 0 && (
              <>
                <span className="font-sans text-xs text-text-secondary line-through">
                  ${(bump.priceInCents / 100).toFixed(2)}
                </span>
                <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold rounded">
                  {bump.discountPercent}% OFF
                </span>
              </>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-white dark:hover:bg-[#1d222b] rounded-lg transition-colors"
        >
          <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={onRemove}
          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      </div>
      
      {/* Expanded config */}
      {isExpanded && (
        <div className="p-4 space-y-4 border-t border-[#e1ddd8] dark:border-[#262b35]">
          {/* Headline */}
          <div>
            <label className="block text-xs font-medium text-text-primary dark:text-[#f5f5f8] font-albert mb-1.5">
              Custom Headline (optional)
            </label>
            <input
              type="text"
              value={bump.headline || ''}
              onChange={(e) => onChange({ ...bump, headline: e.target.value || undefined })}
              placeholder="e.g., Add this to your order"
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#313746] rounded-lg bg-white dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            />
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-text-primary dark:text-[#f5f5f8] font-albert mb-1.5">
              Custom Description (optional)
            </label>
            <textarea
              value={bump.description || ''}
              onChange={(e) => onChange({ ...bump, description: e.target.value || undefined })}
              placeholder="Short value proposition for this add-on..."
              rows={2}
              className="w-full px-3 py-2 border border-[#e1ddd8] dark:border-[#313746] rounded-lg bg-white dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] font-albert text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            />
          </div>
          
          {/* Discount */}
          <div>
            <label className="block text-xs font-medium text-text-primary dark:text-[#f5f5f8] font-albert mb-1.5">
              Discount % (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={bump.discountPercent || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseInt(e.target.value) : undefined;
                  onChange({ ...bump, discountPercent: value });
                }}
                placeholder="0"
                className="w-24 px-3 py-2 border border-[#e1ddd8] dark:border-[#313746] rounded-lg bg-white dark:bg-[#11141b] text-text-primary dark:text-[#f5f5f8] font-albert text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              />
              <span className="text-sm text-text-secondary">%</span>
              {bump.discountPercent && bump.discountPercent > 0 && (
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Final: ${(discountedPrice / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function OrderBumpEditor({
  orderBumps,
  onChange,
  currentTier,
  excludeProductId,
  excludeProductType,
}: OrderBumpEditorProps) {
  const [showSelector, setShowSelector] = useState(false);
  const { accentLight } = useBrandingValues();
  
  const maxBumps = getLimit(currentTier, 'max_order_bumps');
  const currentBumps = orderBumps?.bumps || [];
  const isEnabled = orderBumps?.enabled ?? false;
  const canAddMore = currentBumps.length < maxBumps;
  const nextTier = getNextTier(currentTier);
  const nextTierInfo = nextTier ? TIER_PRICING[nextTier] : null;

  const handleToggle = (enabled: boolean) => {
    onChange({
      enabled,
      bumps: currentBumps,
    });
  };

  const handleAddBump = (product: AvailableProduct) => {
    const newBump: OrderBump = {
      id: `bump_${Date.now()}`,
      productType: product.type,
      productId: product.id,
      contentType: product.contentType,
      productName: product.name,
      productImageUrl: product.imageUrl,
      priceInCents: product.priceInCents,
      currency: product.currency || 'usd',
    };
    
    onChange({
      enabled: true,
      bumps: [...currentBumps, newBump],
    });
  };

  const handleUpdateBump = (index: number, updatedBump: OrderBump) => {
    const newBumps = [...currentBumps];
    newBumps[index] = updatedBump;
    onChange({
      enabled: isEnabled,
      bumps: newBumps,
    });
  };

  const handleRemoveBump = (index: number) => {
    const newBumps = currentBumps.filter((_, i) => i !== index);
    onChange({
      enabled: isEnabled,
      bumps: newBumps,
    });
  };

  return (
    <div className="bg-white dark:bg-[#171b22] rounded-xl border border-[#e1ddd8] dark:border-[#262b35] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentLight}15` }}
          >
            <Sparkles className="w-5 h-5" style={{ color: accentLight }} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1a1a1a] dark:text-[#f5f5f8] font-albert">
              Order Bumps
            </h3>
            <p className="text-xs text-[#5f5a55] dark:text-[#b2b6c2] font-albert">
              Offer additional products at checkout
            </p>
          </div>
        </div>
        <BrandedCheckbox
          checked={isEnabled}
          onChange={handleToggle}
        />
      </div>

      {/* Description */}
      <p className="text-sm text-[#5f5a55] dark:text-[#b2b6c2] font-albert mb-4">
        Order bumps appear as add-on offers on your landing page. Customers can add them to their purchase with a single click.
      </p>

      {/* Content */}
      {isEnabled && (
        <div className="space-y-3">
          {/* Current bumps */}
          {currentBumps.map((bump, index) => (
            <BumpItemEditor
              key={bump.id}
              bump={bump}
              onChange={(updated) => handleUpdateBump(index, updated)}
              onRemove={() => handleRemoveBump(index)}
            />
          ))}

          {/* Add button or limit message */}
          {canAddMore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSelector(true)}
              className="w-full flex items-center justify-center gap-2 border-dashed border-brand-accent text-brand-accent hover:bg-brand-accent/10"
            >
              <Plus className="w-4 h-4" />
              Add Order Bump ({currentBumps.length}/{maxBumps})
            </Button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-[#faf8f6] dark:bg-[#11141b] rounded-xl border border-[#e1ddd8] dark:border-[#262b35]">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary dark:text-[#f5f5f8] font-albert">
                  Maximum {maxBumps} order bump{maxBumps > 1 ? 's' : ''} on {TIER_PRICING[currentTier].name}
                </p>
                {nextTierInfo && (
                  <p className="text-xs text-text-secondary font-albert mt-0.5">
                    Upgrade to {nextTierInfo.name} for {getLimit(nextTier!, 'max_order_bumps')} order bumps
                  </p>
                )}
              </div>
              {nextTier && (
                <a
                  href="/coach/plan"
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-accent text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Zap className="w-3 h-3" />
                  Upgrade
                </a>
              )}
            </div>
          )}

          {/* Empty state */}
          {currentBumps.length === 0 && (
            <div className="text-center py-6 text-text-secondary">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-albert">No order bumps added yet</p>
              <p className="text-xs mt-1">Click &quot;Add Order Bump&quot; to get started</p>
            </div>
          )}
        </div>
      )}

      {/* Product Selector Modal */}
      <ProductSelector
        isOpen={showSelector}
        onClose={() => setShowSelector(false)}
        onSelect={handleAddBump}
        excludeIds={currentBumps.map(b => b.productId)}
        excludeProductId={excludeProductId}
        excludeProductType={excludeProductType}
      />
    </div>
  );
}


