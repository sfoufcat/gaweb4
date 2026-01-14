'use client';

import { useState, useCallback } from 'react';
import { DiscountCode, DiscountContentType } from '@/types';

export interface DiscountValidationResult {
  valid: boolean;
  discountCode?: DiscountCode;
  discountAmountCents: number;
  finalAmountCents: number;
  error?: string;
  isAlumniDiscount?: boolean;
}

export interface UseDiscountCodeOptions {
  organizationId: string;
  originalAmountCents: number;
  // Context for what the discount is being applied to
  programId?: string;
  squadId?: string;
  contentId?: string;
  contentType?: DiscountContentType;
}

export interface UseDiscountCodeReturn {
  // State
  code: string;
  setCode: (code: string) => void;
  isValidating: boolean;
  validationResult: DiscountValidationResult | null;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;

  // Actions
  validateCode: () => Promise<DiscountValidationResult>;
  clearDiscount: () => void;

  // Computed
  hasValidDiscount: boolean;
  displayDiscount: string;
  finalPrice: number;
}

export function useDiscountCode(options: UseDiscountCodeOptions): UseDiscountCodeReturn {
  const {
    organizationId,
    originalAmountCents,
    programId,
    squadId,
    contentId,
    contentType,
  } = options;

  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<DiscountValidationResult | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const validateCode = useCallback(async (): Promise<DiscountValidationResult> => {
    if (!code.trim()) {
      const result: DiscountValidationResult = {
        valid: false,
        discountAmountCents: 0,
        finalAmountCents: originalAmountCents,
        error: 'Please enter a discount code',
      };
      setValidationResult(result);
      return result;
    }

    setIsValidating(true);

    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          organizationId,
          originalAmountCents,
          programId,
          squadId,
          contentId,
          contentType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const result: DiscountValidationResult = {
          valid: false,
          discountAmountCents: 0,
          finalAmountCents: originalAmountCents,
          error: data.error || 'Invalid discount code',
        };
        setValidationResult(result);
        return result;
      }

      const result: DiscountValidationResult = {
        valid: data.valid,
        discountCode: data.discountCode,
        discountAmountCents: data.discountAmountCents || 0,
        finalAmountCents: data.finalAmountCents || originalAmountCents,
        isAlumniDiscount: data.isAlumniDiscount,
        error: data.valid ? undefined : (data.error || 'Invalid discount code'),
      };
      setValidationResult(result);
      return result;
    } catch (error) {
      console.error('Error validating discount code:', error);
      const result: DiscountValidationResult = {
        valid: false,
        discountAmountCents: 0,
        finalAmountCents: originalAmountCents,
        error: 'Failed to validate discount code',
      };
      setValidationResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [code, organizationId, originalAmountCents, programId, squadId, contentId, contentType]);

  const clearDiscount = useCallback(() => {
    setCode('');
    setValidationResult(null);
    setIsExpanded(false);
  }, []);

  // Computed values
  const hasValidDiscount = validationResult?.valid === true && validationResult.discountAmountCents > 0;

  const displayDiscount = hasValidDiscount && validationResult?.discountCode
    ? validationResult.discountCode.type === 'percentage'
      ? `${validationResult.discountCode.value}% off`
      : `$${(validationResult.discountCode.value / 100).toFixed(2)} off`
    : '';

  const finalPrice = hasValidDiscount
    ? validationResult!.finalAmountCents
    : originalAmountCents;

  return {
    code,
    setCode,
    isValidating,
    validationResult,
    isExpanded,
    setIsExpanded,
    validateCode,
    clearDiscount,
    hasValidDiscount,
    displayDiscount,
    finalPrice,
  };
}
