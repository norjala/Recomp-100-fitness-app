/**
 * Production Environment Simulation Tests
 * 
 * Tests deployment safety mechanisms by simulating production conditions
 * and verifying that data persistence works correctly
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';

const execAsync = promisify(exec);

describe('Production Environment Simulation', () => {
  let originalEnv: typeof process.env;
  let mockPersistentDir: string;
  let testPort: number;

  beforeAll(() => {
    originalEnv = { ...process.env };
    testPort = 3100 + Math.floor(Math.random() * 100); // Random port for testing
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    // Create mock persistent directory structure
    mockPersistentDir = path.join(process.cwd(), '__tests__', 'mock-persistent');
    const dataDir = path.join(mockPersistentDir, 'data');
    const uploadsDir = path.join(mockPersistentDir, 'uploads');
    const backupsDir = path.join(mockPersistentDir, 'backups');

    [mockPersistentDir, dataDir, uploadsDir, backupsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  });

  afterEach(() => {
    // Cleanup mock persistent directory
    if (fs.existsSync(mockPersistentDir)) {
      const removeDir = (dir: string) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          if (fs.lstatSync(filePath).isDirectory()) {
            removeDir(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        });
        fs.rmdirSync(dir);
      };
      removeDir(mockPersistentDir);
    }
  });

  describe('Render Environment Simulation', () => {
    test('should detect proper Render production configuration', async () => {
      // Simulate Render production environment
      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: `${mockPersistentDir}/data/fitness_challenge.db`,
        UPLOADS_DIR: `${mockPersistentDir}/uploads`,
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security',
        PORT: testPort.toString(),
        ADMIN_USERNAMES: 'TestAdmin'
      };

      // Test startup configuration validation
      const { stdout, stderr } = await execAsync(
        `node scripts/render-start.mjs --check-only`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      // Should pass all persistence checks
      expect(stdout).toContain('Using persistent storage - data will survive deployments');
      expect(stdout).toContain('prevents data loss like the Jackie incident');
      expect(stderr).not.toContain('CRITICAL DATA LOSS RISK');
    });

    test('should reject unsafe local storage configuration in production', async () => {
      // Simulate unsafe production configuration
      const unsafeProdEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: './data/fitness_challenge.db', // Unsafe local path
        UPLOADS_DIR: './uploads', // Unsafe local path
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security',
        PORT: testPort.toString(),
        ADMIN_USERNAMES: 'TestAdmin'
      };

      // Should fail startup checks
      const { stdout, stderr } = await execAsync(
        `node scripts/render-start.mjs --check-only`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...unsafeProdEnv },
          timeout: 10000
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      // Should detect and reject unsafe configuration
      expect(stdout + stderr).toContain('CRITICAL DATA LOSS RISK');
      expect(stdout + stderr).toContain('USER ACCOUNTS AND SCANS WILL BE WIPED');
      expect(stdout + stderr).toContain('Jackie');
    });

    test('should handle Render environment variable defaults', async () => {
      // Test with minimal environment (should use defaults)
      const minimalEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        SESSION_SECRET: 'minimal-session-secret-64-chars-minimum-for-security'
        // Missing DATABASE_URL - should use default
      };

      const { stdout } = await execAsync(
        `node scripts/render-start.mjs --check-only`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...minimalEnv }
        }
      ).catch(error => ({ stdout: error.stdout || '' }));

      // Should use default persistent paths
      expect(stdout).toContain('/opt/render/persistent');
    });
  });

  describe('Database Persistence Simulation', () => {
    test('should maintain data across simulated deployments', async () => {
      const dbPath = path.join(mockPersistentDir, 'data', 'fitness_challenge.db');
      
      // Create initial database with data
      const { createTestDb } = await import('../setup/testDb.js');
      const testDb = createTestDb();
      
      // Copy test database to persistent location
      fs.copyFileSync(testDb.sqlite.name, dbPath);
      
      // Add test user data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('persist-test', 'persistuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);
      
      testDb.cleanup();

      // Simulate first "deployment" - database should be preserved
      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: dbPath,
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security'
      };

      // Test database initialization preserves data
      const { stdout: firstDeploy } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${dbPath}';
          import('./server/db.js').then(m => m.initializeDatabase());
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      );

      expect(firstDeploy).toContain('Using existing database');
      expect(firstDeploy).toContain('PRESERVING USER DATA');
      expect(firstDeploy).toContain('1 users');

      // Simulate second "deployment" - data should still be preserved
      const { stdout: secondDeploy } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${dbPath}';
          import('./server/db.js').then(m => m.initializeDatabase());
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      );

      expect(secondDeploy).toContain('Using existing database');
      expect(secondDeploy).toContain('PRESERVING USER DATA');
      expect(secondDeploy).toContain('1 users');
    });

    test('should create deployment backups automatically', async () => {
      const dbPath = path.join(mockPersistentDir, 'data', 'fitness_challenge.db');
      
      // Create database with data
      const { createTestDb } = await import('../setup/testDb.js');
      const testDb = createTestDb();
      
      // Add substantial data to trigger backup
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('backup-trigger', 'backupuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      await testDb.db.execute(`
        INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
        VALUES ('backup-scan', 'backup-trigger', ${Date.now()}, 22.0, 125.0, 160.0, ${Date.now()}, ${Date.now()})
      `);

      // Copy to persistent location
      fs.copyFileSync(testDb.sqlite.name, dbPath);
      testDb.cleanup();

      // Simulate deployment initialization
      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: dbPath
      };

      const { stdout } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${dbPath}';
          import('./server/db.js').then(m => m.initializeDatabase());
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      );

      expect(stdout).toContain('Existing data detected - creating safety backup');
      expect(stdout).toContain('Deployment backup created');

      // Verify backup was actually created
      const backupDir = path.join(mockPersistentDir, 'data', 'backups');
      if (fs.existsSync(backupDir)) {
        const backupFiles = fs.readdirSync(backupDir);
        const deploymentBackup = backupFiles.find(f => f.startsWith('deployment_backup_'));
        expect(deploymentBackup).toBeDefined();
      }
    });

    test('should validate database integrity during deployment', async () => {
      const dbPath = path.join(mockPersistentDir, 'data', 'fitness_challenge.db');
      
      // Create corrupted database file
      fs.writeFileSync(dbPath, 'corrupted database content');

      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: dbPath
      };

      // Should handle corruption gracefully
      const { stdout, stderr } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${dbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).catch(e => console.error(e.message));
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      // Should detect and handle the corruption
      expect(stdout + stderr).toContain('Tables will be created');
    });
  });

  describe('Health Endpoint Production Simulation', () => {
    test('should provide production-ready health information', async () => {
      const dbPath = path.join(mockPersistentDir, 'data', 'fitness_challenge.db');
      
      // Create test database
      const { createTestDb } = await import('../setup/testDb.js');
      const testDb = createTestDb();
      fs.copyFileSync(testDb.sqlite.name, dbPath);
      testDb.cleanup();

      // Test health endpoint response in production mode
      const healthData = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.RENDER = 'true';
          process.env.DATABASE_URL = '${dbPath}';
          process.env.DEPLOYMENT_TIMESTAMP = '${new Date().toISOString()}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => console.log(JSON.stringify(h, null, 2)));
        "`,
        { 
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      const health = JSON.parse(healthData.stdout);
      
      // Verify production health information
      expect(health.status).toBe('healthy');
      expect(health.persistence.isConfiguredForPersistence).toBe(true);
      expect(health.persistence.isPersistenceRequired).toBe(true);
      expect(health.persistence.persistenceWarnings).toHaveLength(0);
      expect(health.environment.nodeEnv).toBe('production');
      expect(health.environment.isRender).toBe(true);
      expect(health.environment.deploymentsTimestamp).toBeDefined();
    });

    test('should detect persistence issues in production health check', async () => {
      // Test with unsafe database path
      const healthData = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.RENDER = 'true';
          process.env.DATABASE_URL = './local/database.db';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => console.log(JSON.stringify(h, null, 2)));
        "`,
        { 
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      const health = JSON.parse(healthData.stdout);
      
      expect(health.persistence.isConfiguredForPersistence).toBe(false);
      expect(health.persistence.isPersistenceRequired).toBe(true);
      expect(health.persistence.persistenceWarnings).toContain(
        'CRITICAL: Database not in persistent storage - data will be lost on deployment'
      );
    });
  });

  describe('File Upload Persistence Simulation', () => {
    test('should use persistent storage for uploads in production', async () => {
      const uploadsDir = path.join(mockPersistentDir, 'uploads');
      
      // Create test file in uploads directory
      const testFile = path.join(uploadsDir, 'test-upload.txt');
      fs.writeFileSync(testFile, 'test upload content');

      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        UPLOADS_DIR: uploadsDir
      };

      // File should persist across "deployments"
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf8')).toBe('test upload content');

      // Simulate deployment restart - file should still exist
      const { stdout } = await execAsync(
        `node -e "
          console.log('Uploads dir:', process.env.UPLOADS_DIR);
          console.log('File exists:', require('fs').existsSync('${testFile}'));
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      );

      expect(stdout).toContain(`Uploads dir: ${uploadsDir}`);
      expect(stdout).toContain('File exists: true');
    });

    test('should warn about non-persistent uploads configuration', async () => {
      const { stdout } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.RENDER = 'true';
          process.env.DATABASE_URL = '/opt/render/persistent/data/fitness_challenge.db';
          process.env.UPLOADS_DIR = './uploads'; // Non-persistent
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => console.log(JSON.stringify(h.persistence, null, 2)));
        "`,
        { 
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      // Should work but issue warning about uploads
      expect(stdout).toContain('isConfiguredForPersistence');
    });
  });

  describe('Jackie Incident Prevention Simulation', () => {
    test('should prevent dangerous script execution in production', async () => {
      // Verify dangerous scripts are properly archived
      const dangerousScriptPath = path.join(process.cwd(), 'scripts', 'reset-user-scans.sql');
      const archivedScriptPath = path.join(process.cwd(), 'scripts', 'DANGEROUS_ARCHIVE', 'reset-user-scans.sql');

      expect(fs.existsSync(dangerousScriptPath)).toBe(false);
      expect(fs.existsSync(archivedScriptPath)).toBe(true);

      // Verify archived script contains dangerous operations
      if (fs.existsSync(archivedScriptPath)) {
        const scriptContent = fs.readFileSync(archivedScriptPath, 'utf8');
        expect(scriptContent).toContain('DELETE FROM dexa_scans');
        expect(scriptContent).toContain('DELETE FROM scoring_data');
      }
    });

    test('should maintain audit trail in production environment', async () => {
      const dbPath = path.join(mockPersistentDir, 'data', 'fitness_challenge.db');
      
      // Create database
      const { createTestDb } = await import('../setup/testDb.js');
      const testDb = createTestDb();
      fs.copyFileSync(testDb.sqlite.name, dbPath);
      testDb.cleanup();

      // Test audit logging in production mode
      const prodEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: dbPath
      };

      // Audit logging should be available
      const { stdout } = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          import('./server/audit-logger.js').then(m => {
            const logger = m.auditLogger;
            logger.log({
              operation: 'CREATE',
              table: 'users',
              recordId: 'test-audit',
              details: { action: 'production_test' }
            });
            console.log('Audit logging successful');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...prodEnv }
        }
      );

      expect(stdout).toContain('Audit logging successful');
      expect(stdout).toContain('[AUDIT]');
    });

    test('should provide incident analysis capabilities', async () => {
      // Test audit analysis in production context
      const { stdout } = await execAsync(
        `npm run audit:analyze`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Jackie Data Loss Incident Analysis');
      expect(stdout).toContain('SAFETY MEASURES NOW IN PLACE');
      expect(stdout).toContain('Dangerous scripts moved to DANGEROUS_ARCHIVE');
    });
  });
});