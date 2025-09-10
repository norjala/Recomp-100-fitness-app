/**
 * Database Persistence Safety Tests
 * 
 * Tests the database persistence verification and safety mechanisms
 * to prevent data loss incidents like Jackie's during deployments
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { getDatabaseHealthStatus, verifyDatabasePersistence } from '../../server/db.js';
import { createTestDb, type TestDbInstance } from '../setup/testDb.js';
import fs from 'fs';
import path from 'path';

describe('Database Persistence Safety', () => {
  let testDb: TestDbInstance;
  let originalEnv: typeof process.env;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Create fresh test database for each test
    testDb = createTestDb();
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_SECRET = 'test-session-secret-64-chars-minimum-for-security-testing';
  });

  afterEach(() => {
    testDb.cleanup();
    // Reset environment for each test
    delete process.env.DATABASE_URL;
    delete process.env.RENDER;
    delete process.env.UPLOADS_DIR;
    process.env.NODE_ENV = 'test';
  });

  describe('Persistence Configuration Detection', () => {
    test('should detect safe persistent storage configuration', async () => {
      // Simulate Render production environment with persistent storage
      process.env.NODE_ENV = 'production';
      process.env.RENDER = 'true';
      process.env.DATABASE_URL = '/opt/render/persistent/data/fitness_challenge.db';
      process.env.UPLOADS_DIR = '/opt/render/persistent/uploads';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.persistence.isConfiguredForPersistence).toBe(true);
      expect(healthStatus.persistence.isPersistenceRequired).toBe(true);
      expect(healthStatus.persistence.persistenceWarnings).toHaveLength(0);
    });

    test('should detect unsafe local storage configuration in production', async () => {
      // Simulate production environment with unsafe local storage
      process.env.NODE_ENV = 'production';
      process.env.RENDER = 'true';
      process.env.DATABASE_URL = './data/fitness_challenge.db'; // Unsafe local path
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.persistence.isConfiguredForPersistence).toBe(false);
      expect(healthStatus.persistence.isPersistenceRequired).toBe(true);
      expect(healthStatus.persistence.persistenceWarnings).toContain(
        'CRITICAL: Database not in persistent storage - data will be lost on deployment'
      );
    });

    test('should allow local storage in development environment', async () => {
      // Development environment should allow local storage
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = './data/fitness_challenge.db';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.persistence.isPersistenceRequired).toBe(false);
      // No warnings expected in development
      expect(healthStatus.persistence.persistenceWarnings).toHaveLength(0);
    });

    test('should handle missing environment variables gracefully', async () => {
      // Remove all database-related environment variables
      delete process.env.DATABASE_URL;
      delete process.env.UPLOADS_DIR;
      process.env.NODE_ENV = 'production';
      process.env.RENDER = 'true';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      // Should still function but detect unsafe configuration
      expect(healthStatus.persistence.isPersistenceRequired).toBe(true);
      expect(healthStatus.persistence.isConfiguredForPersistence).toBe(false);
    });
  });

  describe('Database Health Monitoring', () => {
    test('should provide comprehensive health status', async () => {
      const healthStatus = await getDatabaseHealthStatus();
      
      // Verify health status structure
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('database');
      expect(healthStatus).toHaveProperty('persistence');
      expect(healthStatus).toHaveProperty('data');
      expect(healthStatus).toHaveProperty('backup');
      expect(healthStatus).toHaveProperty('environment');
      expect(healthStatus).toHaveProperty('timestamp');
      
      // Verify database information
      expect(healthStatus.database).toHaveProperty('path');
      expect(healthStatus.database).toHaveProperty('exists');
      expect(healthStatus.database).toHaveProperty('size');
      expect(healthStatus.database).toHaveProperty('readable');
      expect(healthStatus.database).toHaveProperty('writable');
      
      // Verify data counts
      expect(healthStatus.data).toHaveProperty('users');
      expect(healthStatus.data).toHaveProperty('scans');
      expect(healthStatus.data).toHaveProperty('scores');
      
      // Verify environment detection
      expect(healthStatus.environment).toHaveProperty('nodeEnv');
      expect(healthStatus.environment).toHaveProperty('isRender');
    });

    test('should detect existing data for backup protection', async () => {
      // Create test user data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('test-user-1', 'testuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);
      
      await testDb.db.execute(`
        INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
        VALUES ('test-scan-1', 'test-user-1', ${Date.now()}, 20.5, 130.0, 175.0, ${Date.now()}, ${Date.now()})
      `);
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.data.users).toBeGreaterThan(0);
      expect(healthStatus.data.scans).toBeGreaterThan(0);
      expect(healthStatus.status).toBe('healthy');
    });

    test('should handle database connection errors gracefully', async () => {
      // Simulate database connection error by using invalid path
      process.env.DATABASE_URL = '/invalid/path/to/database.db';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.status).toBe('error');
      expect(healthStatus).toHaveProperty('error');
      expect(healthStatus).toHaveProperty('timestamp');
    });
  });

  describe('Backup Status Verification', () => {
    test('should detect absence of backups', async () => {
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.backup.hasRecentBackup).toBe(false);
      expect(healthStatus.backup.backupCount).toBe(0);
      expect(healthStatus.backup.warning).toBe('No backup directory found');
    });

    test('should detect recent backups when available', async () => {
      // Create mock backup directory and file
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const recentBackupPath = path.join(backupDir, 'test-backup.db');
      fs.writeFileSync(recentBackupPath, 'mock backup data');
      
      try {
        const healthStatus = await getDatabaseHealthStatus();
        
        expect(healthStatus.backup.backupCount).toBeGreaterThan(0);
        expect(healthStatus.backup.mostRecentBackup).toBe('test-backup.db');
        expect(healthStatus.backup.hasRecentBackup).toBe(true);
      } finally {
        // Cleanup
        if (fs.existsSync(recentBackupPath)) {
          fs.unlinkSync(recentBackupPath);
        }
        if (fs.existsSync(backupDir)) {
          fs.rmdirSync(backupDir);
        }
      }
    });

    test('should warn about old backups', async () => {
      // Create mock backup directory with old backup
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const oldBackupPath = path.join(backupDir, 'old-backup.db');
      fs.writeFileSync(oldBackupPath, 'old backup data');
      
      // Set file modification time to 25 hours ago
      const oldTime = new Date(Date.now() - (25 * 60 * 60 * 1000));
      fs.utimesSync(oldBackupPath, oldTime, oldTime);
      
      try {
        const healthStatus = await getDatabaseHealthStatus();
        
        expect(healthStatus.backup.backupCount).toBe(1);
        expect(healthStatus.backup.hasRecentBackup).toBe(false);
        expect(healthStatus.backup.warning).toBe('No backup created in last 24 hours');
      } finally {
        // Cleanup
        if (fs.existsSync(oldBackupPath)) {
          fs.unlinkSync(oldBackupPath);
        }
        if (fs.existsSync(backupDir)) {
          fs.rmdirSync(backupDir);
        }
      }
    });
  });

  describe('Data Loss Prevention', () => {
    test('should identify Jackie-type data loss scenarios', async () => {
      // Simulate scenario where database exists but is empty (like Jackie incident)
      process.env.NODE_ENV = 'production';
      process.env.RENDER = 'true';
      process.env.DATABASE_URL = '/opt/render/persistent/data/fitness_challenge.db';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      // Empty database in production should be detectable
      expect(healthStatus.data.users).toBe(0);
      expect(healthStatus.data.scans).toBe(0);
      
      // Should still be healthy from technical standpoint
      expect(healthStatus.status).toBe('healthy');
      
      // But persistence should be properly configured
      expect(healthStatus.persistence.isConfiguredForPersistence).toBe(true);
      expect(healthStatus.persistence.persistenceWarnings).toHaveLength(0);
    });

    test('should track deployment timestamp for incident analysis', async () => {
      process.env.DEPLOYMENT_TIMESTAMP = '2025-09-10T12:00:00.000Z';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      expect(healthStatus.environment.deploymentsTimestamp).toBe('2025-09-10T12:00:00.000Z');
    });

    test('should maintain database persistence verification across environments', async () => {
      const testCases = [
        {
          nodeEnv: 'development',
          render: undefined,
          databaseUrl: './data/fitness_challenge.db',
          expectedPersistenceRequired: false,
          expectedConfigured: false,
          expectedWarnings: 0
        },
        {
          nodeEnv: 'production',
          render: 'true',
          databaseUrl: '/opt/render/persistent/data/fitness_challenge.db',
          expectedPersistenceRequired: true,
          expectedConfigured: true,
          expectedWarnings: 0
        },
        {
          nodeEnv: 'production',
          render: 'true',
          databaseUrl: './data/fitness_challenge.db',
          expectedPersistenceRequired: true,
          expectedConfigured: false,
          expectedWarnings: 1
        }
      ];

      for (const testCase of testCases) {
        // Reset environment
        process.env.NODE_ENV = testCase.nodeEnv;
        process.env.RENDER = testCase.render;
        process.env.DATABASE_URL = testCase.databaseUrl;
        
        const healthStatus = await getDatabaseHealthStatus();
        
        expect(healthStatus.persistence.isPersistenceRequired).toBe(testCase.expectedPersistenceRequired);
        expect(healthStatus.persistence.isConfiguredForPersistence).toBe(testCase.expectedConfigured);
        expect(healthStatus.persistence.persistenceWarnings).toHaveLength(testCase.expectedWarnings);
        
        // Cleanup for next iteration
        delete process.env.RENDER;
        delete process.env.DATABASE_URL;
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle filesystem permission errors', async () => {
      // Test with a path that would cause permission issues
      process.env.DATABASE_URL = '/root/restricted/database.db';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      // Should return error status but not crash
      expect(healthStatus.status).toBe('error');
      expect(healthStatus.error).toBeDefined();
    });

    test('should provide meaningful error messages for troubleshooting', async () => {
      // Test various error scenarios
      process.env.DATABASE_URL = '/nonexistent/path/database.db';
      
      const healthStatus = await getDatabaseHealthStatus();
      
      if (healthStatus.status === 'error') {
        expect(typeof healthStatus.error).toBe('string');
        expect(healthStatus.error.length).toBeGreaterThan(0);
      }
    });

    test('should maintain service availability during health check failures', async () => {
      // Health check should never throw unhandled exceptions
      const invalidConfigs = [
        { DATABASE_URL: '' },
        { DATABASE_URL: '/invalid/path' },
        { DATABASE_URL: 'not-a-path' },
        { NODE_ENV: 'invalid-env' }
      ];

      for (const config of invalidConfigs) {
        Object.assign(process.env, config);
        
        // Should not throw
        expect(async () => {
          await getDatabaseHealthStatus();
        }).not.toThrow();
        
        // Should always return a response
        const healthStatus = await getDatabaseHealthStatus();
        expect(healthStatus).toBeDefined();
        expect(healthStatus.timestamp).toBeDefined();
      }
    });
  });
});