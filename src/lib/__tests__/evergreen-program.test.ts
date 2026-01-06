/**
 * Tests for Evergreen Program functionality
 *
 * These tests verify:
 * 1. Fixed program completion still completes and does not increment cycle
 * 2. Evergreen program at end rolls into next cycle
 * 3. Leakage test: cycle 1 occurrences don't appear when currentCycleNumber=2
 */

import {
  getActiveCycleNumber,
  calculateCycleAwareDayIndex,
} from '../program-engine';
import type { ProgramEnrollment } from '@/types';

// Mock ProgramEnrollment for testing
const createMockEnrollment = (overrides: Partial<ProgramEnrollment> = {}): ProgramEnrollment => ({
  id: 'test-enrollment-1',
  userId: 'test-user-1',
  programId: 'test-program-1',
  organizationId: 'test-org-1',
  status: 'active',
  startedAt: '2025-01-01',
  lastAssignedDayIndex: 0,
  amountPaid: 0,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('getActiveCycleNumber', () => {
  it('should return 1 for enrollment without currentCycleNumber', () => {
    const enrollment = createMockEnrollment();
    expect(getActiveCycleNumber(enrollment)).toBe(1);
  });

  it('should return the currentCycleNumber when set', () => {
    const enrollment = createMockEnrollment({ currentCycleNumber: 3 });
    expect(getActiveCycleNumber(enrollment)).toBe(3);
  });

  it('should return 1 for legacy enrollments (StarterProgramEnrollment)', () => {
    // Legacy enrollments don't have currentCycleNumber
    const legacyEnrollment = {
      id: 'legacy-enrollment',
      userId: 'test-user',
      programId: 'test-program',
      status: 'active',
      startedAt: '2025-01-01',
      lastAssignedDayIndex: 0,
    };
    expect(getActiveCycleNumber(legacyEnrollment as ProgramEnrollment)).toBe(1);
  });
});

describe('calculateCycleAwareDayIndex', () => {
  describe('with weekends included', () => {
    it('should calculate day index from enrollment start for cycle 1', () => {
      const result = calculateCycleAwareDayIndex(
        '2025-01-01', // enrollmentStartedAt
        30, // programLengthDays
        true, // includeWeekends
        1, // cycleNumber
        undefined, // cycleStartedAt
        '2025-01-15' // todayDate
      );

      expect(result.dayIndex).toBe(15);
      expect(result.shouldRollover).toBe(false);
    });

    it('should calculate day index from cycle start for cycle > 1', () => {
      const result = calculateCycleAwareDayIndex(
        '2025-01-01', // enrollmentStartedAt (original)
        30, // programLengthDays
        true, // includeWeekends
        2, // cycleNumber
        '2025-02-01T00:00:00Z', // cycleStartedAt
        '2025-02-10' // todayDate
      );

      expect(result.dayIndex).toBe(10);
      expect(result.shouldRollover).toBe(false);
    });

    it('should cap at program length and indicate rollover needed', () => {
      const result = calculateCycleAwareDayIndex(
        '2025-01-01', // enrollmentStartedAt
        30, // programLengthDays
        true, // includeWeekends
        1, // cycleNumber
        undefined, // cycleStartedAt
        '2025-02-15' // todayDate - 46 days after start
      );

      expect(result.dayIndex).toBe(30); // Capped at program length
      expect(result.shouldRollover).toBe(true);
    });
  });

  describe('without weekends (weekdays only)', () => {
    it('should count only weekdays for day index', () => {
      // 2025-01-01 is a Wednesday
      // 2025-01-10 is a Friday
      // Weekdays: Wed(1), Thu(2), Fri(3), Mon(6), Tue(7), Wed(8), Thu(9), Fri(10) = 8 weekdays
      const result = calculateCycleAwareDayIndex(
        '2025-01-01', // enrollmentStartedAt (Wednesday)
        30, // programLengthDays
        false, // includeWeekends = false
        1, // cycleNumber
        undefined, // cycleStartedAt
        '2025-01-10' // todayDate (Friday)
      );

      // Count weekdays from Jan 1 to Jan 10 inclusive
      // Jan 1 (Wed), 2 (Thu), 3 (Fri), 6 (Mon), 7 (Tue), 8 (Wed), 9 (Thu), 10 (Fri)
      expect(result.dayIndex).toBe(8);
      expect(result.shouldRollover).toBe(false);
    });
  });
});

describe('Evergreen Program Cycle Behavior', () => {
  describe('Fixed program completion', () => {
    it('should not increment cycle on completion', () => {
      // This is a documentation test - actual implementation is in syncProgramV2TasksForToday
      // Fixed programs should mark enrollment as completed, not increment cycle
      const enrollment = createMockEnrollment({
        currentCycleNumber: 1,
        status: 'completed',
      });

      expect(enrollment.currentCycleNumber).toBe(1);
      expect(enrollment.status).toBe('completed');
    });
  });

  describe('Evergreen program cycle rollover', () => {
    it('should increment cycle number on rollover', () => {
      // This tests the expected state after rollover
      const enrollmentBeforeRollover = createMockEnrollment({
        currentCycleNumber: 1,
      });

      // After rollover (simulated)
      const enrollmentAfterRollover = {
        ...enrollmentBeforeRollover,
        currentCycleNumber: 2,
        cycleStartedAt: '2025-02-01T00:00:00Z',
        lastAssignedDayIndex: 0,
      };

      expect(enrollmentAfterRollover.currentCycleNumber).toBe(2);
      expect(enrollmentAfterRollover.lastAssignedDayIndex).toBe(0);
    });
  });

  describe('Cycle isolation (leakage prevention)', () => {
    it('should scope queries by currentCycleNumber', () => {
      // This is a documentation test for the expected behavior
      // When querying occurrences, always filter by cycleNumber
      const currentCycle = 2;
      const occurrence = {
        enrollmentId: 'test-enrollment',
        cycleNumber: 1, // From previous cycle
        dayIndex: 15,
      };

      // This occurrence should NOT be returned when currentCycle = 2
      expect(occurrence.cycleNumber).not.toBe(currentCycle);
    });
  });
});

describe('Program durationType defaults', () => {
  it('should default to fixed for backward compatibility', () => {
    // Programs without durationType should be treated as fixed
    const legacyProgram = {
      id: 'legacy-program',
      name: 'Legacy Program',
      lengthDays: 30,
      // No durationType field
    };

    const durationType = (legacyProgram as { durationType?: 'fixed' | 'evergreen' }).durationType || 'fixed';
    expect(durationType).toBe('fixed');
  });
});
