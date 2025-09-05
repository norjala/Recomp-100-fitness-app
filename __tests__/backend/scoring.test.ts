// Critical scoring system tests - ensuring fair competition results
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestDb, createTestUser, createTestDexaScan, type TestDbInstance } from '../setup/testDb.js';
import { DatabaseStorage } from '../../server/storage.js';

describe('Scoring System - Critical Business Logic', () => {
  let testDb: TestDbInstance;
  let storage: DatabaseStorage;

  beforeEach(() => {
    testDb = createTestDb();
    storage = new DatabaseStorage();
    // Override storage's db instance with test db
    (storage as any).db = testDb.db;
  });

  afterEach(() => {
    testDb.cleanup();
  });

  describe('Fat Loss Score Calculation', () => {
    test('should calculate correct fat loss score for percentage improvement', () => {
      // Use private method directly for unit testing
      const calculateFatLossScore = (storage as any).calculateFatLossScoreFromPercent.bind(storage);
      
      // Test: 5% body fat reduction (25% -> 20% = -20% change)
      const bodyFatChange = -20; // 20% reduction
      const score = calculateFatLossScore(bodyFatChange, 'male');
      
      // Expected: 20% * 10 points = 200 points, capped at 50
      expect(score).toBe(50); // Capped at maximum
    });

    test('should return 0 for no fat loss or fat gain', () => {
      const calculateFatLossScore = (storage as any).calculateFatLossScoreFromPercent.bind(storage);
      
      // No change
      expect(calculateFatLossScore(0, 'male')).toBe(0);
      
      // Fat gain (positive change)
      expect(calculateFatLossScore(5, 'male')).toBe(0);
    });

    test('should handle realistic fat loss scenarios', () => {
      const calculateFatLossScore = (storage as any).calculateFatLossScoreFromPercent.bind(storage);
      
      // 2% body fat loss (realistic for 100 days)
      const bodyFatChange = -10; // 10% reduction 
      const score = calculateFatLossScore(bodyFatChange, 'male');
      
      // Expected: 10% * 10 points = 100 points, capped at 50
      expect(score).toBe(50);
      
      // 1% body fat loss (conservative progress)
      const smallChange = -5; // 5% reduction
      const smallScore = calculateFatLossScore(smallChange, 'male');
      
      // Expected: 5% * 10 = 50 points
      expect(smallScore).toBe(50);
    });

    test('should handle small improvements correctly', () => {
      const calculateFatLossScore = (storage as any).calculateFatLossScoreFromPercent.bind(storage);
      
      // 0.5% body fat loss (small but real progress)
      const bodyFatChange = -2.5; // 2.5% reduction
      const score = calculateFatLossScore(bodyFatChange, 'male');
      
      // Expected: 2.5% * 10 = 25 points
      expect(score).toBe(25);
    });
  });

  describe('Muscle Gain Score Calculation', () => {
    test('should calculate correct muscle gain score for males', () => {
      const calculateMuscleGainScore = (storage as any).calculateMuscleGainScoreFromPercent.bind(storage);
      
      // 2% lean mass gain (realistic for males)
      const leanMassChange = 2; // 2% increase
      const score = calculateMuscleGainScore(leanMassChange, 'male');
      
      // Expected: 2% * 17 points * 1.0 multiplier = 34 points
      expect(score).toBe(34);
    });

    test('should apply female bonus multiplier for muscle gain', () => {
      const calculateMuscleGainScore = (storage as any).calculateMuscleGainScoreFromPercent.bind(storage);
      
      // 1.5% lean mass gain for female (harder to build muscle)
      const leanMassChange = 1.5; // 1.5% increase
      const score = calculateMuscleGainScore(leanMassChange, 'female');
      
      // Expected: 1.5% * 17 points * 2.0 multiplier = 51 points, capped at 50
      expect(score).toBe(50);
    });

    test('should cap muscle gain score at maximum', () => {
      const calculateMuscleGainScore = (storage as any).calculateMuscleGainScoreFromPercent.bind(storage);
      
      // Unrealistic but possible large gain
      const largeLeanMassChange = 10; // 10% increase
      const score = calculateMuscleGainScore(largeLeanMassChange, 'male');
      
      // Expected: Capped at 50 points maximum
      expect(score).toBe(50);
    });

    test('should return 0 for no muscle gain or muscle loss', () => {
      const calculateMuscleGainScore = (storage as any).calculateMuscleGainScoreFromPercent.bind(storage);
      
      // No change
      expect(calculateMuscleGainScore(0, 'male')).toBe(0);
      
      // Muscle loss (negative change)
      expect(calculateMuscleGainScore(-2, 'male')).toBe(0);
    });
  });

  describe('End-to-End Scoring Integration', () => {
    test('should calculate complete user score with baseline and progress scans', async () => {
      // Create test user
      const user = await createTestUser(testDb.db, {
        gender: 'male',
        targetBodyFatPercent: 15,
        targetLeanMass: 140
      });

      // Create baseline scan
      const baselineScan = await createTestDexaScan(testDb.db, user.id, {
        bodyFatPercent: 25.0,
        leanMass: 130.0,
        totalWeight: 175.0,
        fatMass: 43.75, // 25% of 175
        isBaseline: true,
        scanDate: new Date('2025-08-04') // Competition start
      });

      // Create progress scan after 50 days
      const progressScan = await createTestDexaScan(testDb.db, user.id, {
        bodyFatPercent: 20.0, // 5% absolute reduction (20% relative improvement)
        leanMass: 135.0, // 5 lbs gain (~3.8% relative improvement)
        totalWeight: 170.0,
        fatMass: 34.0, // 20% of 170
        isBaseline: false,
        scanDate: new Date('2025-09-23') // 50 days later
      });

      // Calculate scores
      await (storage as any).calculateAndUpdateUserScore(user.id);

      // Verify scoring data was created
      const scoringData = await storage.getScoringData(user.id);
      expect(scoringData).toBeDefined();
      expect(scoringData!.totalScore).toBeGreaterThan(0);

      // Verify fat loss score (20% improvement = 200 points, capped at 50)
      expect(scoringData!.fatLossScore).toBe(50);

      // Verify muscle gain score (~3.8% * 17 * 1.0 = ~65, capped at 50)
      expect(scoringData!.muscleGainScore).toBe(50);

      // Total should be fat loss + muscle gain
      expect(scoringData!.totalScore).toBe(100);
    });

    test('should handle user with only baseline scan (no scoring)', async () => {
      const user = await createTestUser(testDb.db);
      
      // Create only baseline scan
      await createTestDexaScan(testDb.db, user.id, {
        isBaseline: true
      });

      // Attempt to calculate scores
      await (storage as any).calculateAndUpdateUserScore(user.id);

      // Should not create scoring data with only baseline
      const scoringData = await storage.getScoringData(user.id);
      expect(scoringData).toBeUndefined();
    });

    test('should update scores when scan data changes', async () => {
      const user = await createTestUser(testDb.db, { gender: 'female' });

      // Create baseline
      await createTestDexaScan(testDb.db, user.id, {
        bodyFatPercent: 30.0,
        leanMass: 100.0,
        isBaseline: true
      });

      // Create initial progress scan
      const progressScan = await createTestDexaScan(testDb.db, user.id, {
        bodyFatPercent: 28.0, // Small improvement
        leanMass: 102.0, // Small gain
        isBaseline: false
      });

      // Calculate initial scores
      await (storage as any).calculateAndUpdateUserScore(user.id);
      const initialScoring = await storage.getScoringData(user.id);

      // Update progress scan with better results
      await storage.updateDexaScan(progressScan.id, {
        bodyFatPercent: 25.0, // Better fat loss
        leanMass: 105.0 // Better muscle gain
      });

      // Scores should be recalculated and improved
      const updatedScoring = await storage.getScoringData(user.id);
      expect(updatedScoring!.totalScore).toBeGreaterThan(initialScoring!.totalScore);
    });
  });

  describe('Baseline Scan Management', () => {
    test('should automatically assign earliest scan as baseline', async () => {
      const user = await createTestUser(testDb.db);

      // Create scans in non-chronological order
      const laterScan = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-09-01'),
        isBaseline: false
      });

      const earlierScan = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-01'),
        isBaseline: false
      });

      // Auto-manage baseline for this user
      await (storage as any).autoManageBaselineScan(user.id);

      // Fetch updated scans
      const userScans = await storage.getUserScans(user.id);
      const baselineScans = userScans.filter(scan => scan.isBaseline);

      // Should have exactly one baseline scan
      expect(baselineScans).toHaveLength(1);
      
      // Earliest scan should be marked as baseline
      expect(baselineScans[0].id).toBe(earlierScan.id);
    });

    test('should handle baseline reassignment correctly', async () => {
      const user = await createTestUser(testDb.db);

      // Create scan marked as baseline
      const manualBaseline = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-15'),
        isBaseline: true
      });

      // Create earlier scan (should become new baseline)
      const earlierScan = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-01'),
        isBaseline: false
      });

      // Auto-manage baseline
      await (storage as any).autoManageBaselineScan(user.id);

      // Check that earliest scan is now baseline
      const userScans = await storage.getUserScans(user.id);
      const baselineScans = userScans.filter(scan => scan.isBaseline);

      expect(baselineScans).toHaveLength(1);
      expect(baselineScans[0].id).toBe(earlierScan.id);
      
      // Original baseline should no longer be baseline
      const originalScan = userScans.find(scan => scan.id === manualBaseline.id);
      expect(originalScan!.isBaseline).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extreme body fat percentages', async () => {
      const calculateFatLossScore = (storage as any).calculateFatLossScoreFromPercent.bind(storage);
      
      // Very low starting body fat (edge case)
      const extremeChange = -50; // 50% reduction (e.g., 10% -> 5%)
      const score = calculateFatLossScore(extremeChange, 'male');
      
      // Should still cap at maximum
      expect(score).toBe(50);
    });

    test('should handle zero lean mass scenarios', () => {
      const calculateMuscleGainScore = (storage as any).calculateMuscleGainScoreFromPercent.bind(storage);
      
      // Edge case: very small lean mass change
      const tinyChange = 0.1; // 0.1% increase
      const score = calculateMuscleGainScore(tinyChange, 'male');
      
      // Expected: 0.1% * 17 = 1.7 points (rounded to 2)
      expect(score).toBe(2);
    });

    test('should handle missing baseline scan gracefully', async () => {
      const user = await createTestUser(testDb.db);
      
      // Create progress scan without baseline
      await createTestDexaScan(testDb.db, user.id, {
        isBaseline: false
      });

      // Should not crash when trying to calculate scores
      await expect((storage as any).calculateAndUpdateUserScore(user.id)).resolves.not.toThrow();
      
      // Should not create scoring data
      const scoringData = await storage.getScoringData(user.id);
      expect(scoringData).toBeUndefined();
    });
  });
});