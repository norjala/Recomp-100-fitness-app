// API integration tests - ensuring endpoint reliability and security
import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes.js';
import { createTestDb, type TestDbInstance } from '../setup/testDb.js';
import { hashPassword } from '../../server/auth.js';

describe('API Routes Integration - Endpoint Reliability', () => {
  let app: express.Application;
  let testDb: TestDbInstance;
  let server: any;

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret';
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
  });

  afterEach(() => {
    testDb.cleanup();
  });

  describe('Authentication Endpoints', () => {
    test('should register new user successfully', async () => {
      const userData = {
        username: 'newuser123',
        password: 'securePassword123!'
      };

      const response = await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toBe('Account created successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBe('newuser123');
      expect(response.body.user.password).toBeUndefined(); // Should not return password
    });

    test('should reject duplicate username registration', async () => {
      const userData = {
        username: 'duplicateuser',
        password: 'password123!'
      };

      // Register first user
      await request(app)
        .post('/api/register')
        .send(userData)
        .expect(201);

      // Attempt duplicate registration
      await request(app)
        .post('/api/register')
        .send(userData)
        .expect(400);
    });

    test('should login with valid credentials', async () => {
      // Create user first
      const password = 'loginPassword123!';
      const hashedPassword = await hashPassword(password);
      
      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: 'test-user-login',
        username: 'loginuser',
        password: hashedPassword
      });

      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'loginuser',
          password: password
        })
        .expect(200);

      expect(response.body.username).toBe('loginuser');
      expect(response.body.password).toBeUndefined();
    });

    test('should reject invalid login credentials', async () => {
      await request(app)
        .post('/api/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/logout')
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('User Profile Endpoints', () => {
    let userSession: request.SuperAgentTest;
    let testUserId: string;

    beforeEach(async () => {
      // Create authenticated user session
      const password = 'testPassword123!';
      const hashedPassword = await hashPassword(password);
      
      testUserId = 'test-user-profile';
      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: testUserId,
        username: 'profileuser',
        password: hashedPassword
      });

      userSession = request.agent(app);
      await userSession
        .post('/api/login')
        .send({ username: 'profileuser', password })
        .expect(200);
    });

    test('should get current user profile', async () => {
      const response = await userSession
        .get('/api/user')
        .expect(200);

      expect(response.body.username).toBe('profileuser');
      expect(response.body.id).toBe(testUserId);
    });

    test('should update user target goals', async () => {
      const targetData = {
        targetBodyFatPercent: 15.0,
        targetLeanMass: 140.0
      };

      const response = await userSession
        .put('/api/user/targets')
        .send(targetData)
        .expect(200);

      expect(response.body.targetBodyFatPercent).toBe(15.0);
      expect(response.body.targetLeanMass).toBe(140.0);
    });

    test('should require authentication for protected routes', async () => {
      await request(app)
        .get('/api/user')
        .expect(401);

      await request(app)
        .put('/api/user/targets')
        .send({ targetBodyFatPercent: 15 })
        .expect(401);
    });
  });

  describe('DEXA Scan Endpoints', () => {
    let userSession: request.SuperAgentTest;
    let testUserId: string;

    beforeEach(async () => {
      // Create authenticated user
      const password = 'testPassword123!';
      const hashedPassword = await hashPassword(password);
      
      testUserId = 'test-user-scans';
      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: testUserId,
        username: 'scanuser',
        password: hashedPassword
      });

      userSession = request.agent(app);
      await userSession
        .post('/api/login')
        .send({ username: 'scanuser', password })
        .expect(200);
    });

    test('should create new DEXA scan', async () => {
      const scanData = {
        scanDate: '2025-08-15',
        bodyFatPercent: 18.5,
        leanMass: 135.2,
        totalWeight: 165.8,
        fatMass: 30.6,
        rmr: 1750,
        scanName: 'Test Scan',
        notes: 'Test notes'
      };

      const response = await userSession
        .post('/api/scans')
        .send(scanData)
        .expect(200);

      expect(response.body.bodyFatPercent).toBe(18.5);
      expect(response.body.leanMass).toBe(135.2);
      expect(response.body.userId).toBe(testUserId);
    });

    test('should validate required scan fields', async () => {
      const invalidScanData = {
        scanDate: '2025-08-15'
        // Missing required fields
      };

      await userSession
        .post('/api/scans')
        .send(invalidScanData)
        .expect(500); // Should fail validation
    });

    test('should get user scans', async () => {
      // Create a scan first
      await testDb.db.insert(await import('@shared/schema').then(s => s.dexaScans)).values({
        id: 'test-scan-get',
        userId: testUserId,
        scanDate: new Date('2025-08-15'),
        bodyFatPercent: 20.0,
        leanMass: 130.0,
        totalWeight: 165.0
      });

      const response = await userSession
        .get(`/api/users/${testUserId}/scans`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].bodyFatPercent).toBe(20.0);
    });

    test('should prevent access to other users scans', async () => {
      const otherUserId = 'other-user-id';
      
      await userSession
        .get(`/api/users/${otherUserId}/scans`)
        .expect(403);
    });

    test('should update DEXA scan', async () => {
      // Create scan first
      const scanId = 'test-scan-update';
      await testDb.db.insert(await import('@shared/schema').then(s => s.dexaScans)).values({
        id: scanId,
        userId: testUserId,
        scanDate: new Date('2025-08-15'),
        bodyFatPercent: 20.0,
        leanMass: 130.0,
        totalWeight: 165.0
      });

      const updateData = {
        bodyFatPercent: 19.5,
        notes: 'Updated notes'
      };

      const response = await userSession
        .put(`/api/scans/${scanId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.bodyFatPercent).toBe(19.5);
      expect(response.body.notes).toBe('Updated notes');
    });

    test('should delete DEXA scan', async () => {
      // Create scan first
      const scanId = 'test-scan-delete';
      await testDb.db.insert(await import('@shared/schema').then(s => s.dexaScans)).values({
        id: scanId,
        userId: testUserId,
        scanDate: new Date('2025-08-15'),
        bodyFatPercent: 20.0,
        leanMass: 130.0,
        totalWeight: 165.0
      });

      await userSession
        .delete(`/api/scans/${scanId}`)
        .expect(204);

      // Verify scan is deleted
      await userSession
        .get(`/api/users/${testUserId}/scans`)
        .expect(200)
        .then(response => {
          expect(response.body).toHaveLength(0);
        });
    });
  });

  describe('Competition Data Endpoints', () => {
    beforeEach(async () => {
      // Create test users and data for competition endpoints
      const schemas = await import('@shared/schema');
      
      // Create users
      await testDb.db.insert(schemas.users).values([
        {
          id: 'user1',
          username: 'competitor1',
          password: 'hashedpass1',
          name: 'Competitor One'
        },
        {
          id: 'user2', 
          username: 'competitor2',
          password: 'hashedpass2',
          name: 'Competitor Two'
        }
      ]);

      // Create baseline scans
      await testDb.db.insert(schemas.dexaScans).values([
        {
          id: 'baseline1',
          userId: 'user1',
          scanDate: new Date('2025-08-04'),
          bodyFatPercent: 25.0,
          leanMass: 130.0,
          totalWeight: 175.0,
          isBaseline: true
        },
        {
          id: 'baseline2',
          userId: 'user2',
          scanDate: new Date('2025-08-05'),
          bodyFatPercent: 22.0,
          leanMass: 125.0,
          totalWeight: 165.0,
          isBaseline: true
        }
      ]);

      // Create scoring data
      await testDb.db.insert(schemas.scoringData).values([
        {
          id: 'score1',
          userId: 'user1',
          fatLossScore: 45,
          muscleGainScore: 30,
          totalScore: 75
        },
        {
          id: 'score2',
          userId: 'user2',
          fatLossScore: 50,
          muscleGainScore: 25,
          totalScore: 75
        }
      ]);
    });

    test('should get leaderboard data', async () => {
      const response = await request(app)
        .get('/api/leaderboard')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('user');
      expect(response.body[0]).toHaveProperty('rank');
      expect(response.body[0]).toHaveProperty('totalScore');
    });

    test('should get contestants data', async () => {
      const response = await request(app)
        .get('/api/contestants')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('user');
      expect(response.body[0]).toHaveProperty('baselineScan');
      expect(response.body[0].baselineScan).toHaveProperty('bodyFatPercent');
    });
  });

  describe('Admin Endpoints', () => {
    let adminSession: request.SuperAgentTest;

    beforeEach(async () => {
      // Create admin user
      const password = 'adminPassword123!';
      const hashedPassword = await hashPassword(password);
      
      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: 'admin-user',
        username: 'TestAdmin',
        password: hashedPassword
      });

      adminSession = request.agent(app);
      await adminSession
        .post('/api/login')
        .send({ username: 'TestAdmin', password })
        .expect(200);
    });

    test('should allow admin to view all users', async () => {
      const response = await adminSession
        .get('/api/admin/users')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should allow admin to create new user', async () => {
      const newUserData = {
        username: 'newadminuser',
        password: 'newPassword123!',
        name: 'New Admin User'
      };

      const response = await adminSession
        .post('/api/admin/users')
        .send(newUserData)
        .expect(201);

      expect(response.body.username).toBe('newadminuser');
      expect(response.body.name).toBe('New Admin User');
    });

    test('should reject non-admin access to admin endpoints', async () => {
      // Create regular user
      const password = 'userPassword123!';
      const hashedPassword = await hashPassword(password);
      
      await testDb.db.insert(await import('@shared/schema').then(s => s.users)).values({
        id: 'regular-user',
        username: 'regularuser',
        password: hashedPassword
      });

      const userSession = request.agent(app);
      await userSession
        .post('/api/login')
        .send({ username: 'regularuser', password })
        .expect(200);

      // Should be denied admin access
      await userSession
        .get('/api/admin/users')
        .expect(403);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON requests', async () => {
      await request(app)
        .post('/api/register')
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);
    });

    test('should handle very large payloads', async () => {
      const largeData = {
        username: 'testuser',
        password: 'a'.repeat(1000000) // 1MB password
      };

      const response = await request(app)
        .post('/api/register')
        .send(largeData);

      // Should either accept (if within 50MB limit) or reject gracefully
      expect([201, 400, 413, 500]).toContain(response.status);
    });

    test('should handle concurrent requests safely', async () => {
      const userData = {
        username: 'concurrentuser',
        password: 'password123!'
      };

      // Make multiple concurrent registration requests
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/register')
          .send(userData)
      );

      const responses = await Promise.all(promises);

      // Only one should succeed, others should fail with appropriate errors
      const successes = responses.filter(r => r.status === 201);
      const failures = responses.filter(r => r.status !== 201);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(4);
    });
  });
});