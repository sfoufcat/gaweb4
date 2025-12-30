'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Sparkles } from 'lucide-react';
import { useBrandingValues } from '@/contexts/BrandingContext';
import type { OrderBump } from '@/types';

interface OrderBumpCardProps {
  bump: OrderBump;
  isSelected: boolean;
  onToggle: (selected: boolean) => void;
  disabled?: boolean;
}

/**
 * Format price from cents to display string
 */
function formatPrice(cents: number, currency = 'usd'): string {
  if (cents === 0) return 'Free';
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate discounted price
 */
function getDiscountedPrice(priceInCents: number, discountPercent?: number): number {
  if (!discountPercent || discountPercent <= 0) return priceInCents;
  return Math.round(priceInCents * (1 - discountPercent / 100));
}

/**
 * OrderBumpCard - A compact card for order bump products
 * 
 * Displays a product with checkbox that users can add to their cart
 * before checkout. Supports optional discounts and custom copy.
 */
export function OrderBumpCard({
  bump,
  isSelected,
  onToggle,
  disabled = false,
}: OrderBumpCardProps) {
  const { colors } = useBrandingValues();
  const accentLight = colors.accentLight;
  const [isHovered, setIsHovered] = useState(false);
  
  const hasDiscount = bump.discountPercent && bump.discountPercent > 0;
  const finalPrice = getDiscountedPrice(bump.priceInCents, bump.discountPercent);
  const originalPrice = bump.priceInCents;
  
  const headline = bump.headline || 'Add this to your order';
  
  return (
    <motion.button
      type="button"
      onClick={() => !disabled && onToggle(!isSelected)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={disabled}
      className={`
        w-full text-left p-4 rounded-2xl border-2 transition-all duration-200
        ${isSelected
          ? 'border-brand-accent bg-gradient-to-r from-brand-accent/5 to-brand-accent/10 dark:from-brand-accent/10 dark:to-brand-accent/15'
          : 'border-[#e1ddd8] dark:border-[#313746] bg-white dark:bg-[#171b22] hover:border-brand-accent/50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      whileTap={disabled ? {} : { scale: 0.995 }}
    >
      {/* Header with badge */}
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ 
            backgroundColor: `${accentLight}15`,
            color: accentLight,
          }}
        >
          <Sparkles className="w-3 h-3" />
          <span>{headline}</span>
        </div>
        {hasDiscount && (
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[11px] font-semibold rounded-full">
            {bump.discountPercent}% OFF
          </span>
        )}
      </div>
      
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div 
          className={`
            w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-0.5
            transition-all duration-200
            ${isSelected 
              ? 'border-brand-accent bg-brand-accent' 
              : 'border-[#d1cdc8] dark:border-[#3a4150] bg-white dark:bg-[#1d222b]'
            }
          `}
        >
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
          {!isSelected && isHovered && !disabled && (
            <Plus className="w-3.5 h-3.5 text-[#d1cdc8] dark:text-[#5a6475]" strokeWidth={2} />
          )}
        </div>
        
        {/* Product Image */}
        {bump.productImageUrl && (
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#f5f3f0] dark:bg-[#1d222b] flex-shrink-0">
            <Image
              src={bump.productImageUrl}
              alt={bump.productName}
              width={56}
              height={56}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-albert text-[15px] font-semibold text-text-primary dark:text-[#f5f5f8] truncate">
            {bump.productName}
          </h4>
          
          {bump.description && (
            <p className="font-sans text-[13px] text-text-secondary dark:text-[#9ca3af] mt-0.5 line-clamp-2">
              {bump.description}
            </p>
          )}
          
          {/* Price */}
          <div className="flex items-center gap-2 mt-2">
            <span 
              className="font-albert text-[16px] font-bold"
              style={{ color: accentLight }}
            >
              {finalPrice === 0 ? 'FREE' : `+${formatPrice(finalPrice, bump.currency)}`}
            </span>
            {hasDiscount && originalPrice > 0 && (
              <span className="font-sans text-[13px] text-text-secondary line-through">
                {formatPrice(originalPrice, bump.currency)}
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Selected indicator */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 pt-3 border-t border-brand-accent/20"
          >
            <div className="flex items-center gap-2 text-brand-accent">
              <Check className="w-4 h-4" />
              <span className="font-sans text-[13px] font-medium">Added to your order</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/**
 * OrderBumpList - Renders multiple order bump cards
 */
interface OrderBumpListProps {
  bumps: OrderBump[];
  selectedBumpIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function OrderBumpList({
  bumps,
  selectedBumpIds,
  onSelectionChange,
  disabled = false,
  className = '',
}: OrderBumpListProps) {
  const handleToggle = (bumpId: string, selected: boolean) => {
    if (selected) {
      onSelectionChange([...selectedBumpIds, bumpId]);
    } else {
      onSelectionChange(selectedBumpIds.filter(id => id !== bumpId));
    }
  };
  
  if (bumps.length === 0) return null;
  
  return (
    <div className={`space-y-3 ${className}`}>
      {bumps.map((bump) => (
        <OrderBumpCard
          key={bump.id}
          bump={bump}
          isSelected={selectedBumpIds.includes(bump.id)}
          onToggle={(selected) => handleToggle(bump.id, selected)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

/**
 * Calculate total price for selected bumps
 */
export function calculateBumpTotal(bumps: OrderBump[], selectedBumpIds: string[]): number {
  return bumps
    .filter(bump => selectedBumpIds.includes(bump.id))
    .reduce((total, bump) => {
      const price = getDiscountedPrice(bump.priceInCents, bump.discountPercent);
      return total + price;
    }, 0);
}


