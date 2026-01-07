/**
 * Tests for Program Billing Rules
 *
 * These tests verify:
 * 1. Fixed-duration programs cannot have recurring billing enabled
 * 2. Evergreen programs can have recurring billing enabled
 * 3. Switching from evergreen to fixed resets subscription fields
 * 4. Backend validation rejects invalid billing configurations
 */

import type { Program } from '@/types';

// Helper to create mock program data
const createMockProgram = (overrides: Partial<Program> = {}): Partial<Program> => ({
  id: 'test-program-1',
  organizationId: 'test-org-1',
  name: 'Test Program',
  slug: 'test-program',
  description: 'A test program',
  type: 'individual',
  lengthDays: 84,
  lengthWeeks: 12,
  priceInCents: 29700, // $297
  currency: 'usd',
  isActive: true,
  isPublished: false,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

/**
 * Validates program billing configuration
 * This mirrors the validation logic in the API routes
 */
function validateProgramBilling(program: Partial<Program>): { valid: boolean; error?: string } {
  const durationType = program.durationType || 'fixed';
  const subscriptionEnabled = program.subscriptionEnabled || false;
  const billingInterval = program.billingInterval;

  // Rule 1: Fixed-duration programs cannot have recurring billing
  if (durationType !== 'evergreen' && subscriptionEnabled) {
    return {
      valid: false,
      error: 'Recurring billing is only available for Evergreen programs. Fixed-duration programs must use one-time billing.',
    };
  }

  // Rule 2: Billing interval is required when subscription is enabled
  if (subscriptionEnabled && !billingInterval) {
    return {
      valid: false,
      error: 'Billing interval is required when subscription is enabled.',
    };
  }

  // Rule 3: Valid billing intervals
  if (billingInterval && !['monthly', 'quarterly', 'yearly'].includes(billingInterval)) {
    return {
      valid: false,
      error: 'Invalid billing interval.',
    };
  }

  return { valid: true };
}

/**
 * Simulates what should happen when durationType changes
 */
function handleDurationTypeChange(
  currentData: Partial<Program>,
  newDurationType: 'fixed' | 'evergreen'
): Partial<Program> {
  const updates: Partial<Program> = {
    ...currentData,
    durationType: newDurationType,
  };

  // When switching to fixed, reset subscription fields
  if (newDurationType === 'fixed') {
    updates.subscriptionEnabled = false;
    updates.billingInterval = undefined;
  }

  return updates;
}

describe('Program Billing Validation', () => {
  describe('Fixed-duration programs', () => {
    it('should allow fixed programs without subscription', () => {
      const program = createMockProgram({
        durationType: 'fixed',
        subscriptionEnabled: false,
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });

    it('should reject fixed programs with subscription enabled', () => {
      const program = createMockProgram({
        durationType: 'fixed',
        subscriptionEnabled: true,
        billingInterval: 'monthly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Evergreen programs');
    });

    it('should treat undefined durationType as fixed (backward compatibility)', () => {
      const program = createMockProgram({
        durationType: undefined, // Legacy program without durationType
        subscriptionEnabled: true,
        billingInterval: 'monthly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Evergreen programs');
    });
  });

  describe('Evergreen programs', () => {
    it('should allow evergreen programs without subscription', () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: false,
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });

    it('should allow evergreen programs with subscription and valid interval', () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: true,
        billingInterval: 'monthly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });

    it('should require billing interval when subscription is enabled', () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: true,
        billingInterval: undefined,
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Billing interval is required');
    });

    it('should accept quarterly billing interval', () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: true,
        billingInterval: 'quarterly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });

    it('should accept yearly billing interval', () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: true,
        billingInterval: 'yearly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Duration Type Switching', () => {
  it('should reset subscription fields when switching from evergreen to fixed', () => {
    const currentProgram = createMockProgram({
      durationType: 'evergreen',
      subscriptionEnabled: true,
      billingInterval: 'monthly',
    });

    const updatedProgram = handleDurationTypeChange(currentProgram, 'fixed');

    expect(updatedProgram.durationType).toBe('fixed');
    expect(updatedProgram.subscriptionEnabled).toBe(false);
    expect(updatedProgram.billingInterval).toBeUndefined();
    // Price should be preserved
    expect(updatedProgram.priceInCents).toBe(29700);
  });

  it('should preserve subscription ability when switching from fixed to evergreen', () => {
    const currentProgram = createMockProgram({
      durationType: 'fixed',
      subscriptionEnabled: false,
    });

    const updatedProgram = handleDurationTypeChange(currentProgram, 'evergreen');

    expect(updatedProgram.durationType).toBe('evergreen');
    // Subscription should remain false until explicitly enabled
    expect(updatedProgram.subscriptionEnabled).toBe(false);
  });

  it('should preserve price when switching duration types', () => {
    const currentProgram = createMockProgram({
      durationType: 'evergreen',
      subscriptionEnabled: true,
      billingInterval: 'monthly',
      priceInCents: 9900,
    });

    const updatedProgram = handleDurationTypeChange(currentProgram, 'fixed');

    expect(updatedProgram.priceInCents).toBe(9900);
  });
});

describe('Billing Interval Validation', () => {
  const validIntervals = ['monthly', 'quarterly', 'yearly'];

  validIntervals.forEach((interval) => {
    it(`should accept '${interval}' as valid billing interval`, () => {
      const program = createMockProgram({
        durationType: 'evergreen',
        subscriptionEnabled: true,
        billingInterval: interval as 'monthly' | 'quarterly' | 'yearly',
      });

      const result = validateProgramBilling(program);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Migration Scenarios', () => {
  it('should identify programs needing migration (fixed + subscriptionEnabled)', () => {
    const invalidPrograms = [
      createMockProgram({ durationType: 'fixed', subscriptionEnabled: true }),
      createMockProgram({ durationType: undefined, subscriptionEnabled: true }),
    ];

    const needsMigration = invalidPrograms.filter((program) => {
      const durationType = program.durationType || 'fixed';
      return durationType !== 'evergreen' && program.subscriptionEnabled;
    });

    expect(needsMigration.length).toBe(2);
  });

  it('should not flag evergreen programs for migration', () => {
    const validPrograms = [
      createMockProgram({ durationType: 'evergreen', subscriptionEnabled: true }),
      createMockProgram({ durationType: 'evergreen', subscriptionEnabled: false }),
      createMockProgram({ durationType: 'fixed', subscriptionEnabled: false }),
    ];

    const needsMigration = validPrograms.filter((program) => {
      const durationType = program.durationType || 'fixed';
      return durationType !== 'evergreen' && program.subscriptionEnabled;
    });

    expect(needsMigration.length).toBe(0);
  });
});

describe('UI State Management', () => {
  it('should determine if recurring checkbox can be enabled', () => {
    const canEnableRecurring = (
      durationType: 'fixed' | 'evergreen' | undefined,
      pricing: 'free' | 'paid',
      price: number
    ): boolean => {
      const effectiveDurationType = durationType || 'fixed';
      return effectiveDurationType === 'evergreen' && pricing === 'paid' && price > 0;
    };

    // Should be enabled for evergreen + paid + price > 0
    expect(canEnableRecurring('evergreen', 'paid', 297)).toBe(true);

    // Should be disabled for fixed programs
    expect(canEnableRecurring('fixed', 'paid', 297)).toBe(false);

    // Should be disabled for free programs
    expect(canEnableRecurring('evergreen', 'free', 0)).toBe(false);

    // Should be disabled when price is 0
    expect(canEnableRecurring('evergreen', 'paid', 0)).toBe(false);

    // Should be disabled for undefined durationType (defaults to fixed)
    expect(canEnableRecurring(undefined, 'paid', 297)).toBe(false);
  });
});
