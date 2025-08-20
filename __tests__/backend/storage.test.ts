// Database operations tests - ensuring data integrity and consistency  
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestDb, createTestUser, createTestDexaScan, type TestDbInstance } from '../setup/testDb.js';
import { DatabaseStorage } from '../../server/storage.js';

describe('Database Storage Operations - Data Integrity', () => {
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

  describe('User Operations', () => {
    test('should create user with valid data', async () => {
      const userData = {
        username: 'testuser123',
        password: 'hashedpassword123'
      };

      const user = await storage.createUser(userData);

      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.password).toBe(userData.password);
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
      expect(user.isActive).toBe(true);
    });

    test('should enforce unique username constraint', async () => {
      const userData = {
        username: 'duplicateuser',
        password: 'password123'
      };

      // Create first user
      await storage.createUser(userData);

      // Attempt to create second user with same username
      await expect(storage.createUser(userData)).rejects.toThrow();
    });

    test('should retrieve user by username', async () => {
      const userData = {
        username: 'findme',
        password: 'password123'
      };

      const createdUser = await storage.createUser(userData);
      const foundUser = await storage.getUserByUsername('findme');

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.username).toBe('findme');
    });

    test('should retrieve user by ID', async () => {
      const userData = {
        username: 'findbyid',
        password: 'password123'
      };

      const createdUser = await storage.createUser(userData);
      const foundUser = await storage.getUser(createdUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser!.id).toBe(createdUser.id);
      expect(foundUser!.username).toBe('findbyid');
    });

    test('should update user profile data', async () => {
      const user = await createTestUser(testDb.db, {
        name: 'Original Name',
        targetBodyFatPercent: 20
      });

      const updates = {
        name: 'Updated Name',
        targetBodyFatPercent: 15,
        targetLeanMass: 140
      };

      const updatedUser = await storage.updateUser(user.id, updates);

      expect(updatedUser.name).toBe('Updated Name');
      expect(updatedUser.targetBodyFatPercent).toBe(15);
      expect(updatedUser.targetLeanMass).toBe(140);
      expect(updatedUser.updatedAt).toBeDefined();
    });

    test('should handle user not found scenarios', async () => {
      const nonExistentId = 'non-existent-user-id';
      
      const foundUser = await storage.getUser(nonExistentId);
      expect(foundUser).toBeUndefined();

      const foundByUsername = await storage.getUserByUsername('nonexistent');
      expect(foundByUsername).toBeUndefined();
    });
  });

  describe('DEXA Scan Operations', () => {
    test('should create DEXA scan with complete data', async () => {
      const user = await createTestUser(testDb.db);
      
      const scanData = {
        userId: user.id,
        scanDate: new Date('2025-08-15'),
        bodyFatPercent: 18.5,
        leanMass: 135.2,
        totalWeight: 165.8,
        fatMass: 30.6,
        rmr: 1750,
        scanName: 'Mid-Challenge Scan',
        notes: 'Feeling strong!',
        isBaseline: false
      };

      const scan = await storage.createDexaScan(scanData);

      expect(scan).toBeDefined();
      expect(scan.userId).toBe(user.id);
      expect(scan.bodyFatPercent).toBe(18.5);
      expect(scan.leanMass).toBe(135.2);
      expect(scan.scanName).toBe('Mid-Challenge Scan');
      expect(scan.notes).toBe('Feeling strong!');
      expect(scan.id).toBeDefined();
      expect(scan.createdAt).toBeDefined();
    });

    test('should enforce foreign key constraint for user', async () => {
      const scanData = {
        userId: 'non-existent-user',
        scanDate: new Date(),
        bodyFatPercent: 20.0,
        leanMass: 130.0,
        totalWeight: 165.0
      };

      await expect(storage.createDexaScan(scanData)).rejects.toThrow();
    });

    test('should retrieve user scans ordered by date', async () => {
      const user = await createTestUser(testDb.db);

      // Create scans with different dates
      const scan1 = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-01'),
        bodyFatPercent: 25.0
      });

      const scan2 = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-09-01'),
        bodyFatPercent: 22.0
      });

      const scan3 = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-10-01'),
        bodyFatPercent: 20.0
      });

      const userScans = await storage.getUserScans(user.id);

      expect(userScans).toHaveLength(3);
      // Should be ordered by date descending (newest first)
      expect(userScans[0].id).toBe(scan3.id);
      expect(userScans[1].id).toBe(scan2.id);
      expect(userScans[2].id).toBe(scan1.id);
    });

    test('should update DEXA scan data', async () => {
      const user = await createTestUser(testDb.db);
      const scan = await createTestDexaScan(testDb.db, user.id, {
        bodyFatPercent: 20.0,
        notes: 'Initial notes'
      });

      const updates = {
        bodyFatPercent: 19.5,
        notes: 'Updated notes with better measurement'
      };

      const updatedScan = await storage.updateDexaScan(scan.id, updates);

      expect(updatedScan.bodyFatPercent).toBe(19.5);
      expect(updatedScan.notes).toBe('Updated notes with better measurement');
    });

    test('should delete DEXA scan', async () => {
      const user = await createTestUser(testDb.db);
      const scan = await createTestDexaScan(testDb.db, user.id);

      await storage.deleteDexaScan(scan.id);

      const deletedScan = await storage.getDexaScan(scan.id);
      expect(deletedScan).toBeNull();
    });

    test('should cascade delete scans when user is deleted', async () => {
      const user = await createTestUser(testDb.db);
      const scan = await createTestDexaScan(testDb.db, user.id);

      // Delete user (should cascade to scans)
      await storage.deleteUser(user.id);

      // Scan should also be deleted
      const deletedScan = await storage.getDexaScan(scan.id);
      expect(deletedScan).toBeNull();
    });
  });

  describe('Baseline Scan Management', () => {
    test('should retrieve baseline scan correctly', async () => {
      const user = await createTestUser(testDb.db);

      // Create regular scan
      await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-15'),
        isBaseline: false
      });

      // Create baseline scan
      const baselineScan = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-01'),
        isBaseline: true
      });

      const retrievedBaseline = await storage.getBaselineScan(user.id);

      expect(retrievedBaseline).toBeDefined();
      expect(retrievedBaseline!.id).toBe(baselineScan.id);
      expect(retrievedBaseline!.isBaseline).toBe(true);
    });

    test('should retrieve latest scan correctly', async () => {
      const user = await createTestUser(testDb.db);

      // Create scans with different dates
      await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-08-01')
      });

      const latestScan = await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-10-01')
      });

      await createTestDexaScan(testDb.db, user.id, {
        scanDate: new Date('2025-09-01')
      });

      const retrievedLatest = await storage.getLatestScan(user.id);

      expect(retrievedLatest).toBeDefined();
      expect(retrievedLatest!.id).toBe(latestScan.id);
    });
  });

  describe('Leaderboard Generation', () => {
    test('should generate leaderboard with proper rankings', async () => {
      // Create multiple users with different scores
      const user1 = await createTestUser(testDb.db, { name: 'User One' });
      const user2 = await createTestUser(testDb.db, { name: 'User Two' });
      const user3 = await createTestUser(testDb.db, { name: 'User Three' });

      // Create scoring data for each user
      await storage.upsertScoringData({
        userId: user1.id,
        fatLossScore: 45,
        muscleGainScore: 30,
        totalScore: 75
      });

      await storage.upsertScoringData({
        userId: user2.id,
        fatLossScore: 50,
        muscleGainScore: 40,
        totalScore: 90
      });

      await storage.upsertScoringData({
        userId: user3.id,
        fatLossScore: 35,
        muscleGainScore: 25,
        totalScore: 60
      });

      const leaderboard = await storage.getLeaderboard();

      expect(leaderboard).toHaveLength(3);
      
      // Should be ordered by total score descending
      expect(leaderboard[0].user.id).toBe(user2.id);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].totalScore).toBe(90);

      expect(leaderboard[1].user.id).toBe(user1.id);
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[1].totalScore).toBe(75);

      expect(leaderboard[2].user.id).toBe(user3.id);
      expect(leaderboard[2].rank).toBe(3);
      expect(leaderboard[2].totalScore).toBe(60);
    });

    test('should exclude inactive users from leaderboard', async () => {
      const activeUser = await createTestUser(testDb.db, { 
        name: 'Active User',
        isActive: true 
      });
      
      const inactiveUser = await createTestUser(testDb.db, { 
        name: 'Inactive User',
        isActive: false 
      });

      // Create scoring data for both
      await storage.upsertScoringData({
        userId: activeUser.id,
        totalScore: 75
      });

      await storage.upsertScoringData({
        userId: inactiveUser.id,
        totalScore: 90
      });

      const leaderboard = await storage.getLeaderboard();

      // Should only include active user
      expect(leaderboard).toHaveLength(1);
      expect(leaderboard[0].user.id).toBe(activeUser.id);
    });
  });

  describe('Contestants Data', () => {
    test('should retrieve contestants with baseline scans', async () => {
      const user1 = await createTestUser(testDb.db, { 
        name: 'Contestant One',
        targetBodyFatPercent: 15,
        targetLeanMass: 140
      });
      
      const user2 = await createTestUser(testDb.db, { 
        name: 'Contestant Two'
      });

      // Create baseline scans
      await createTestDexaScan(testDb.db, user1.id, {
        bodyFatPercent: 25.0,
        leanMass: 130.0,
        scanDate: new Date('2025-08-04'),
        isBaseline: true
      });

      await createTestDexaScan(testDb.db, user2.id, {
        bodyFatPercent: 22.0,
        leanMass: 125.0,
        scanDate: new Date('2025-08-05'),
        isBaseline: true
      });

      const contestants = await storage.getContestants();

      expect(contestants).toHaveLength(2);
      
      // Verify contestant data structure
      expect(contestants[0].user.name).toBeDefined();
      expect(contestants[0].baselineScan.bodyFatPercent).toBeDefined();
      expect(contestants[0].baselineScan.leanMass).toBeDefined();
      expect(contestants[0].baselineScan.scanDate).toBeDefined();
    });

    test('should order contestants by baseline scan date', async () => {
      const user1 = await createTestUser(testDb.db, { name: 'Second User' });
      const user2 = await createTestUser(testDb.db, { name: 'First User' });

      // Create baseline scans with different dates
      await createTestDexaScan(testDb.db, user1.id, {
        scanDate: new Date('2025-08-10'),
        isBaseline: true
      });

      await createTestDexaScan(testDb.db, user2.id, {
        scanDate: new Date('2025-08-05'),
        isBaseline: true
      });

      const contestants = await storage.getContestants();

      // Should be ordered by scan date ascending (earliest first)
      expect(contestants[0].user.id).toBe(user2.id);
      expect(contestants[1].user.id).toBe(user1.id);
    });
  });

  describe('Data Validation and Constraints', () => {
    test('should enforce required fields for users', async () => {
      // Missing password should fail
      await expect(storage.createUser({
        username: 'testuser'
      } as any)).rejects.toThrow();

      // Missing username should fail  
      await expect(storage.createUser({
        password: 'password123'
      } as any)).rejects.toThrow();
    });

    test('should enforce required fields for DEXA scans', async () => {
      const user = await createTestUser(testDb.db);

      // Missing required fields should fail
      await expect(storage.createDexaScan({
        userId: user.id,
        scanDate: new Date()
        // Missing bodyFatPercent, leanMass, totalWeight
      } as any)).rejects.toThrow();
    });

    test('should handle concurrent operations safely', async () => {
      const user = await createTestUser(testDb.db);

      // Create multiple scans concurrently
      const scanPromises = Array(5).fill(null).map((_, index) =>
        createTestDexaScan(testDb.db, user.id, {
          bodyFatPercent: 20 + index,
          scanDate: new Date(`2025-08-${10 + index}`)
        })
      );

      const scans = await Promise.all(scanPromises);

      expect(scans).toHaveLength(5);
      
      // All scans should be unique
      const scanIds = scans.map(scan => scan.id);
      const uniqueIds = new Set(scanIds);
      expect(uniqueIds.size).toBe(5);
    });
  });
});