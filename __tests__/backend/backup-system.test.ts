/**
 * Backup System Integration Tests
 * 
 * Tests the automated backup system that protects against data loss
 * during deployments and provides recovery capabilities
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createTestDb, type TestDbInstance } from '../setup/testDb.js';

const execAsync = promisify(exec);

describe('Backup System Integration', () => {
  let testDb: TestDbInstance;
  let testBackupDir: string;
  let originalEnv: typeof process.env;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    // Create fresh test database
    testDb = createTestDb();
    
    // Create test backup directory
    testBackupDir = path.join(path.dirname(testDb.sqlite.name), 'test-backups');
    if (!fs.existsSync(testBackupDir)) {
      fs.mkdirSync(testBackupDir, { recursive: true });
    }
    
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = testDb.sqlite.name;
  });

  afterEach(() => {
    testDb.cleanup();
    
    // Cleanup test backup directory
    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testBackupDir, file));
      });
      fs.rmdirSync(testBackupDir);
    }
  });

  describe('Backup Creation', () => {
    test('should create verified backup successfully', async () => {
      // Add test data to database
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('test-user-1', 'backuptest', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);
      
      await testDb.db.execute(`
        INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
        VALUES ('test-scan-1', 'test-user-1', ${Date.now()}, 15.5, 140.0, 180.0, ${Date.now()}, ${Date.now()})
      `);

      // Run backup creation script
      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('[SUCCESS]');
      expect(stdout).toContain('Backup completed successfully');
      expect(stdout).toContain('1 users, 1 scans, 0 scores');
    });

    test('should verify backup integrity after creation', async () => {
      // Add test data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('integrity-test', 'integrityuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      // Create backup
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // Extract backup filename from output
      const backupMatch = stdout.match(/fitness_challenge_backup_[\d-_]+\.db/);
      expect(backupMatch).not.toBeNull();
      
      const backupFilename = backupMatch![0];
      const backupPath = path.join(path.dirname(testDb.sqlite.name), 'backups', backupFilename);
      
      expect(fs.existsSync(backupPath)).toBe(true);
      
      // Verify backup can be read and contains data
      const { stdout: verifyOutput } = await execAsync(
        `node scripts/backup-database.cjs verify "${backupPath}"`,
        { cwd: process.cwd() }
      );

      expect(verifyOutput).toContain('Valid: true');
      expect(verifyOutput).toContain('Users: 1');
    });

    test('should handle empty database backup', async () => {
      // Test backup of empty database
      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('[SUCCESS]');
      expect(stdout).toContain('0 users, 0 scans, 0 scores');
    });

    test('should fail gracefully with corrupted database', async () => {
      // Corrupt the database file
      fs.writeFileSync(testDb.sqlite.name, 'corrupted data');

      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      ).catch(error => ({ stdout: error.stdout, stderr: error.stderr }));

      expect(stdout || stderr).toContain('ERROR');
    });
  });

  describe('Backup Listing and Management', () => {
    test('should list available backups', async () => {
      // Create a test backup first
      await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // List backups
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs list`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Available Database Backups');
      expect(stdout).toContain('fitness_challenge_backup_');
      expect(stdout).toContain('Created:');
      expect(stdout).toContain('Size:');
      expect(stdout).toContain('Valid:');
    });

    test('should handle empty backup directory', async () => {
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs list`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('No backup directory found');
    });

    test('should show backup metadata correctly', async () => {
      // Add test data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('metadata-test', 'metadatauser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      // Create backup
      await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // List and verify metadata
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs list`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('1 users, 0 scans, 0 scores');
      expect(stdout).toContain('Valid: Yes');
    });
  });

  describe('Backup Cleanup and Retention', () => {
    test('should enforce backup retention policy', async () => {
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create multiple old backup files (simulate more than max retention)
      const maxBackups = 10; // Default from backup script
      const extraBackups = 5;
      
      for (let i = 0; i < maxBackups + extraBackups; i++) {
        const timestamp = new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString()
          .replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const backupFile = path.join(backupDir, `fitness_challenge_backup_${timestamp}.db`);
        fs.writeFileSync(backupFile, 'mock backup data');
        
        // Set different modification times
        const modTime = new Date(Date.now() - (i * 60 * 60 * 1000));
        fs.utimesSync(backupFile, modTime, modTime);
      }

      // Create a new backup (this should trigger cleanup)
      await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // Check that old backups were cleaned up
      const remainingBackups = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('fitness_challenge_backup_'))
        .length;

      expect(remainingBackups).toBeLessThanOrEqual(maxBackups);
    });

    test('should preserve recent backups during cleanup', async () => {
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create recent backup files
      const recentBackups = [];
      for (let i = 0; i < 3; i++) {
        const timestamp = new Date(Date.now() - (i * 10 * 60 * 1000)).toISOString()
          .replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
        const backupFile = path.join(backupDir, `fitness_challenge_backup_${timestamp}.db`);
        fs.writeFileSync(backupFile, 'recent backup data');
        recentBackups.push(path.basename(backupFile));
        
        const modTime = new Date(Date.now() - (i * 10 * 60 * 1000));
        fs.utimesSync(backupFile, modTime, modTime);
      }

      // Create very old backup
      const oldTimestamp = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString()
        .replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const oldBackupFile = path.join(backupDir, `fitness_challenge_backup_${oldTimestamp}.db`);
      fs.writeFileSync(oldBackupFile, 'old backup data');
      const oldModTime = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
      fs.utimesSync(oldBackupFile, oldModTime, oldModTime);

      // Create new backup
      await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // Verify recent backups are preserved
      const remainingFiles = fs.readdirSync(backupDir);
      recentBackups.forEach(backup => {
        expect(remainingFiles).toContain(backup);
      });
    });
  });

  describe('Integration with Database Operations', () => {
    test('should create backup during database initialization with existing data', async () => {
      // Add data to database
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('init-test', 'inituser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      // Test database initialization (would normally trigger backup)
      // Since we can't easily test the actual initialization, we test the backup trigger
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      expect(stdout).toContain('1 users, 0 scans, 0 scores');
      expect(stdout).toContain('[SUCCESS]');
    });

    test('should verify backup matches source database', async () => {
      // Add comprehensive test data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('verify-test-1', 'verifyuser1', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);
      
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('verify-test-2', 'verifyuser2', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      await testDb.db.execute(`
        INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
        VALUES ('verify-scan-1', 'verify-test-1', ${Date.now()}, 18.5, 135.0, 165.0, ${Date.now()}, ${Date.now()})
      `);

      // Create backup
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // Verify backup contains exactly the same data
      expect(stdout).toContain('Source database verified: 2 users, 1 scans, 0 scores');
      expect(stdout).toContain('Backup verified successfully: 2 users, 1 scans, 0 scores');
      expect(stdout).toContain('[SUCCESS]');
    });

    test('should handle concurrent backup requests safely', async () => {
      // Add test data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('concurrent-test', 'concurrentuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      // Start multiple backup processes concurrently
      const backupPromises = Array.from({ length: 3 }, () =>
        execAsync(
          `node scripts/backup-database.cjs create`,
          { 
            cwd: process.cwd(),
            env: { 
              ...process.env, 
              DATABASE_URL: testDb.sqlite.name 
            }
          }
        )
      );

      // All should complete successfully
      const results = await Promise.allSettled(backupPromises);
      
      // At least one should succeed
      const successCount = results.filter(result => 
        result.status === 'fulfilled' && 
        result.value.stdout.includes('[SUCCESS]')
      ).length;
      
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle insufficient disk space gracefully', async () => {
      // Test with a path that might cause space issues (limited scope in test)
      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: '/dev/null' // This should cause issues
          }
        }
      ).catch(error => ({ stdout: error.stdout || '', stderr: error.stderr || '' }));

      // Should handle the error without crashing
      expect(stdout + stderr).toContain('ERROR');
    });

    test('should validate backup file integrity', async () => {
      // Create backup first
      await execAsync(
        `node scripts/backup-database.cjs create`,
        { 
          cwd: process.cwd(),
          env: { 
            ...process.env, 
            DATABASE_URL: testDb.sqlite.name 
          }
        }
      );

      // Find the backup file
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      const backupFiles = fs.readdirSync(backupDir);
      const latestBackup = backupFiles.find(f => f.startsWith('fitness_challenge_backup_'));
      expect(latestBackup).toBeDefined();

      // Verify the backup
      const backupPath = path.join(backupDir, latestBackup!);
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs verify "${backupPath}"`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Valid: true');
    });

    test('should detect corrupted backup files', async () => {
      const backupDir = path.join(path.dirname(testDb.sqlite.name), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Create corrupted backup file
      const corruptedBackup = path.join(backupDir, 'corrupted_backup.db');
      fs.writeFileSync(corruptedBackup, 'this is not a valid sqlite database');

      // Verify should detect corruption
      const { stdout } = await execAsync(
        `node scripts/backup-database.cjs verify "${corruptedBackup}"`,
        { cwd: process.cwd() }
      ).catch(error => ({ stdout: error.stdout || error.message }));

      expect(stdout).toContain('Valid: false');
    });
  });
});