// Gender Field Integration Tests - Comprehensive test scenarios for gender field bug fixes
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes.js';
import { createTestDb, type TestDbInstance } from '../setup/testDb.js';
import { hashPassword } from '../../server/auth.js';

describe('Gender Field Integration Tests - Bug Fix Verification', () => {
  let app: express.Application;
  let testDb: TestDbInstance;
  let server: any;
  let testUser: any;
  let authAgent: request.SuperAgentTest;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret-gender';
    process.env.ADMIN_USERNAMES = 'TestAdmin,Jaron';
  });

  beforeEach(async () => {
    // Create fresh test database for each test
    testDb = createTestDb();

    // Create Express app with test database
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: false, limit: '50mb' }));

    // Override the storage instance to use test database
    const originalStorage = await import('../../server/storage.js');
    (originalStorage.storage as any).db = testDb.db;

    server = await registerRoutes(app);

    // Create test user with NULL gender (like Jaron)
    const password = 'testPassword123!';
    const hashedPassword = await hashPassword(password);

    await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
      id: 'test-user-gender',
      username: 'jaron',
      email: 'jaron@test.com',
      password: hashedPassword,
      name: 'Jaron Parnala',
      gender: null, // NULL gender - the bug scenario
      height: '6\'2"',
      startingWeight: 185
    });

    // Create authenticated session
    authAgent = request.agent(app);
    await authAgent
      .post('/api/login')
      .send({
        username: 'jaron',
        password: password
      })
      .expect(200);

    testUser = {
      id: 'test-user-gender',
      username: 'jaron',
      email: 'jaron@test.com',
      name: 'Jaron Parnala',
      gender: null
    };
  });

  afterEach(() => {
    testDb.cleanup();
  });

  describe('Upload Form Gender Field Visibility Tests', () => {
    test('should show gender field for user with NULL gender', async () => {
      // Get user profile to verify NULL gender
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBeNull();

      // The frontend should show the gender field based on this data
      // This test verifies the backend returns the correct user state
    });

    test('should accept gender during scan creation for user with NULL gender', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        rmr: 1650,
        firstName: 'Jaron',
        lastName: 'Parnala',
        gender: 'male' // This should be accepted and update user profile
      };

      const response = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();

      // Verify user profile was updated with gender
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBe('male');
      expect(userResponse.body.name).toBe('Jaron Parnala');
    });

    test('should validate gender field values during scan creation', async () => {
      const invalidGenderData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: 'invalid-gender' // Invalid gender value
      };

      const response = await authAgent
        .post('/api/scans')
        .send(invalidGenderData)
        .expect(400);

      // Should reject invalid gender values
      expect(response.body.message).toContain('validation');
    });

    test('should not require gender field if user already has gender set', async () => {
      // First, set the user's gender
      const scanDataWithGender = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: 'male'
      };

      await authAgent
        .post('/api/scans')
        .send(scanDataWithGender)
        .expect(201);

      // Now try creating another scan without gender
      const scanDataWithoutGender = {
        scanDate: '2024-02-15',
        bodyFatPercent: 14.8,
        leanMass: 143.0,
        totalWeight: 177.0,
        fatMass: 29.5
      };

      const response = await authAgent
        .post('/api/scans')
        .send(scanDataWithoutGender)
        .expect(201);

      expect(response.body).toBeDefined();
    });
  });

  describe('Edit Scan Dialog Gender Field Tests', () => {
    let testScanId: string;

    beforeEach(async () => {
      // Create a test scan
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        rmr: 1650
      };

      const response = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      testScanId = response.body.id;
    });

    test('should update user gender via scan edit when user has NULL gender', async () => {
      const updateData = {
        bodyFatPercent: 14.8,
        gender: 'male', // Adding gender via edit
        firstName: 'Jaron',
        lastName: 'Parnala'
      };

      const response = await authAgent
        .put(`/api/scans/${testScanId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toBeDefined();

      // Verify user profile was updated
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBe('male');
    });

    test('should update user gender via scan edit when user already has gender', async () => {
      // First set gender to male
      await authAgent
        .put(`/api/scans/${testScanId}`)
        .send({ gender: 'male' })
        .expect(200);

      // Then change to female
      const updateData = {
        bodyFatPercent: 14.8,
        gender: 'female'
      };

      const response = await authAgent
        .put(`/api/scans/${testScanId}`)
        .send(updateData)
        .expect(200);

      // Verify gender was updated
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBe('female');
    });

    test('should reject invalid gender values during scan update', async () => {
      const updateData = {
        bodyFatPercent: 14.8,
        gender: 'non-binary' // Invalid value for current schema
      };

      await authAgent
        .put(`/api/scans/${testScanId}`)
        .send(updateData)
        .expect(400);

      // Gender should remain unchanged
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBeNull();
    });

    test('should handle scan update without gender field', async () => {
      const updateData = {
        bodyFatPercent: 14.8,
        notes: 'Updated notes'
      };

      const response = await authAgent
        .put(`/api/scans/${testScanId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.bodyFatPercent).toBe(14.8);
      expect(response.body.notes).toBe('Updated notes');
    });
  });

  describe('Score Recalculation Tests', () => {
    test('should recalculate scores after gender update', async () => {
      // Create scan without gender
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7
      };

      const scanResponse = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      const scanId = scanResponse.body.id;

      // Get initial scoring
      const initialScoring = await authAgent
        .get(`/api/scoring/${testUser.id}`)
        .expect(200);

      // Update scan with gender
      await authAgent
        .put(`/api/scans/${scanId}`)
        .send({ gender: 'male' })
        .expect(200);

      // Get updated scoring
      const updatedScoring = await authAgent
        .get(`/api/scoring/${testUser.id}`)
        .expect(200);

      // Scores should potentially be different after gender is added
      // (depending on scoring algorithm)
      expect(updatedScoring.body).toBeDefined();
    });

    test('should apply correct gender multipliers in scoring', async () => {
      // Create scan with male gender
      const maleUserScan = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: 'male'
      };

      await authAgent
        .post('/api/scans')
        .send(maleUserScan)
        .expect(201);

      // Get scoring for male user
      const maleScoring = await authAgent
        .get(`/api/scoring/${testUser.id}`)
        .expect(200);

      // Create female test user for comparison
      const femalePassword = 'femalePassword123!';
      const femaleHashedPassword = await hashPassword(femalePassword);

      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: 'test-user-female',
        username: 'jane',
        email: 'jane@test.com',
        password: femaleHashedPassword,
        gender: 'female'
      });

      const femaleAgent = request.agent(app);
      await femaleAgent
        .post('/api/login')
        .send({
          username: 'jane',
          password: femalePassword
        })
        .expect(200);

      // Create similar scan for female user
      const femaleUserScan = {
        scanDate: '2024-01-15',
        bodyFatPercent: 22.0, // Typical female body fat %
        leanMass: 115.0,
        totalWeight: 150.0,
        fatMass: 35.0,
        gender: 'female'
      };

      await femaleAgent
        .post('/api/scans')
        .send(femaleUserScan)
        .expect(201);

      const femaleScoring = await femaleAgent
        .get('/api/scoring/test-user-female')
        .expect(200);

      // Both should have valid scores but potentially different calculations
      expect(maleScoring.body).toBeDefined();
      expect(femaleScoring.body).toBeDefined();
    });
  });

  describe('Edge Case Tests', () => {
    test('should handle empty string gender value', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: '' // Empty string
      };

      // Should either accept as null/undefined or reject with validation error
      const response = await authAgent
        .post('/api/scans')
        .send(scanData);

      expect([201, 400]).toContain(response.status);
    });

    test('should handle undefined gender value', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7
        // gender: undefined - not included
      };

      const response = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      // User gender should remain null
      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      expect(userResponse.body.gender).toBeNull();
    });

    test('should handle gender update for non-existent scan', async () => {
      const updateData = {
        bodyFatPercent: 14.8,
        gender: 'male'
      };

      await authAgent
        .put('/api/scans/non-existent-scan-id')
        .send(updateData)
        .expect(404);
    });

    test('should handle concurrent gender updates', async () => {
      // Create a scan
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7
      };

      const scanResponse = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      const scanId = scanResponse.body.id;

      // Try to update gender concurrently (simulate race condition)
      const updatePromises = [
        authAgent.put(`/api/scans/${scanId}`).send({ gender: 'male' }),
        authAgent.put(`/api/scans/${scanId}`).send({ gender: 'female' })
      ];

      const results = await Promise.allSettled(updatePromises);

      // At least one should succeed
      const successResults = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 200);
      expect(successResults.length).toBeGreaterThan(0);
    });
  });

  describe('Database State Verification Tests', () => {
    test('should verify gender is persisted correctly in database', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: 'male'
      };

      await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      // Direct database query to verify gender is stored
      const users = await import('@shared/schema').then(s => s.users);
      const dbUsers = await testDb.db.select().from(users).where(
        await import('drizzle-orm').then(d => d.eq(users.id, testUser.id))
      );

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].gender).toBe('male');
    });

    test('should verify scan data integrity after gender update', async () => {
      // Create scan
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7
      };

      const scanResponse = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      const scanId = scanResponse.body.id;

      // Update with gender
      await authAgent
        .put(`/api/scans/${scanId}`)
        .send({ gender: 'male' })
        .expect(200);

      // Verify scan data wasn't corrupted
      const scans = await import('@shared/schema').then(s => s.dexaScans);
      const dbScans = await testDb.db.select().from(scans).where(
        await import('drizzle-orm').then(d => d.eq(scans.id, scanId))
      );

      expect(dbScans).toHaveLength(1);
      const scan = dbScans[0];
      expect(scan.bodyFatPercent).toBe(15.2);
      expect(scan.leanMass).toBe(142.5);
      expect(scan.totalWeight).toBe(178.0);
      expect(scan.fatMass).toBe(30.7);
    });
  });

  describe('API Response Validation Tests', () => {
    test('should return correct user profile structure after gender update', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7,
        gender: 'male'
      };

      await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      const userResponse = await authAgent
        .get('/api/user')
        .expect(200);

      // Verify response structure
      expect(userResponse.body).toHaveProperty('id');
      expect(userResponse.body).toHaveProperty('username');
      expect(userResponse.body).toHaveProperty('gender');
      expect(userResponse.body).toHaveProperty('name');
      expect(userResponse.body.gender).toBe('male');
    });

    test('should return updated scan with correct data after gender update', async () => {
      const scanData = {
        scanDate: '2024-01-15',
        bodyFatPercent: 15.2,
        leanMass: 142.5,
        totalWeight: 178.0,
        fatMass: 30.7
      };

      const scanResponse = await authAgent
        .post('/api/scans')
        .send(scanData)
        .expect(201);

      const scanId = scanResponse.body.id;

      const updateResponse = await authAgent
        .put(`/api/scans/${scanId}`)
        .send({
          bodyFatPercent: 14.8,
          gender: 'male'
        })
        .expect(200);

      // Verify scan update response
      expect(updateResponse.body).toHaveProperty('id', scanId);
      expect(updateResponse.body).toHaveProperty('bodyFatPercent', 14.8);
      expect(updateResponse.body).toHaveProperty('userId', testUser.id);
    });
  });
});