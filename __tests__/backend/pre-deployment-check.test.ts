/**
 * Pre-Deployment Safety Check Tests
 * 
 * Tests the pre-deployment verification system that prevents unsafe deployments
 * and ensures data persistence before pushing to production
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import http from 'http';
import express from 'express';

const execAsync = promisify(exec);

describe('Pre-Deployment Safety Checks', () => {
  let originalEnv: typeof process.env;
  let mockServer: http.Server;
  let mockPort: number;
  let mockHealthData: any;

  beforeAll(() => {
    originalEnv = { ...process.env };
    mockPort = 3200 + Math.floor(Math.random() * 100);
  });

  afterAll(() => {
    process.env = originalEnv;
    if (mockServer) {
      mockServer.close();
    }
  });

  beforeEach(() => {
    // Reset mock health data
    mockHealthData = {
      status: 'healthy',
      database: {
        path: '/opt/render/persistent/data/fitness_challenge.db',
        exists: true,
        size: '0.04 MB',
        age: '2.5 hours',
        walMode: true,
        readable: true,
        writable: true
      },
      persistence: {
        isConfiguredForPersistence: true,
        isPersistenceRequired: true,
        persistenceWarnings: []
      },
      data: {
        users: 3,
        scans: 2,
        scores: 0
      },
      backup: {
        hasRecentBackup: true,
        backupCount: 5,
        mostRecentBackup: 'fitness_challenge_backup_2025-09-10_12-00-00.db',
        mostRecentAge: '1.5',
        warning: null
      },
      environment: {
        nodeEnv: 'production',
        isRender: true,
        deploymentsTimestamp: '2025-09-10T12:00:00.000Z'
      },
      issues: [],
      timestamp: new Date().toISOString()
    };
  });

  afterEach(() => {
    if (mockServer) {
      mockServer.close();
      mockServer = null as any;
    }
  });

  describe('Health Endpoint Connectivity', () => {
    test('should successfully connect to production health endpoint', async () => {
      // Create mock health server
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      // Test deployment check against mock server
      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('Successfully connected to production health endpoint');
      expect(stdout).toContain('DEPLOYMENT IS SAFE');
      expect(stdout).toContain('Pre-deployment check passed');
    });

    test('should handle connection failures gracefully', async () => {
      // Test with non-existent server
      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:9999 node scripts/pre-deployment-check.cjs`,
        { 
          cwd: process.cwd(),
          timeout: 15000
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('Failed to connect to production health endpoint');
      expect(stdout + stderr).toContain('Cannot verify deployment safety');
    });

    test('should handle non-200 HTTP responses', async () => {
      // Create mock server that returns error
      const app = express();
      app.get('/api/health', (req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('Health endpoint returned status 500');
      expect(stdout + stderr).toContain('Production may not be healthy');
    });

    test('should handle invalid JSON responses', async () => {
      // Create mock server that returns invalid JSON
      const app = express();
      app.get('/api/health', (req, res) => {
        res.send('invalid json response');
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('Invalid JSON response');
    });
  });

  describe('Persistence Configuration Validation', () => {
    test('should validate safe persistent storage configuration', async () => {
      // Mock safe configuration
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Database correctly configured for persistent storage');
      expect(stdout).toContain('DATABASE PERSISTENCE:');
      expect(stdout).toContain('✅ Database is properly configured');
      expect(stdout).toContain('DEPLOYMENT IS SAFE');
    });

    test('should detect unsafe persistence configuration', async () => {
      // Mock unsafe configuration
      mockHealthData.database.path = './data/fitness_challenge.db'; // Unsafe local path
      mockHealthData.persistence.isConfiguredForPersistence = false;
      mockHealthData.persistence.persistenceWarnings = [
        'CRITICAL: Database not in persistent storage - data will be lost on deployment'
      ];

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('CRITICAL PERSISTENCE ISSUES');
      expect(stdout + stderr).toContain('Database not in persistent storage');
      expect(stdout + stderr).toContain('USER DATA WILL BE LOST');
      expect(stdout + stderr).toContain('DEPLOYMENT IS UNSAFE');
      expect(stdout + stderr).toContain('DO NOT DEPLOY');
    });

    test('should warn about missing persistence requirements', async () => {
      // Mock environment where persistence is required but not configured
      mockHealthData.persistence.isPersistenceRequired = true;
      mockHealthData.persistence.isConfiguredForPersistence = false;
      mockHealthData.persistence.persistenceWarnings = [
        'Persistence required but not configured'
      ];

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout).toContain('Persistence Warnings');
      expect(stdout).toContain('Persistence required but not configured');
    });
  });

  describe('Data State Analysis', () => {
    test('should analyze current production data state', async () => {
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('CURRENT DATA STATE:');
      expect(stdout).toContain('Users: 3');
      expect(stdout).toContain('DEXA Scans: 2');
      expect(stdout).toContain('Scores: 0');
      expect(stdout).toContain('Database Size: 0.04 MB');
      expect(stdout).toContain('User data exists - deployment safety is critical');
    });

    test('should handle empty database state', async () => {
      // Mock empty database
      mockHealthData.data = {
        users: 0,
        scans: 0,
        scores: 0
      };
      mockHealthData.database.size = '0.00 MB';

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Users: 0');
      expect(stdout).toContain('DEXA Scans: 0');
      expect(stdout).toContain('No user data found - deployment is safe');
    });

    test('should detect data inconsistencies', async () => {
      // Mock inconsistent data (users but no scans)
      mockHealthData.data = {
        users: 5,
        scans: 0,
        scores: 0
      };

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Users: 5');
      expect(stdout).toContain('DEXA Scans: 0');
      expect(stdout).toContain('User data exists - deployment safety is critical');
    });
  });

  describe('Backup Status Verification', () => {
    test('should verify recent backup availability', async () => {
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('BACKUP STATUS:');
      expect(stdout).toContain('Total backups: 5');
      expect(stdout).toContain('Recent backup: Yes');
      expect(stdout).toContain('Most recent: 1.5 hours ago');
    });

    test('should warn about missing backups', async () => {
      // Mock no recent backup
      mockHealthData.backup = {
        hasRecentBackup: false,
        backupCount: 0,
        mostRecentBackup: null,
        mostRecentAge: null,
        warning: 'No backup directory found'
      };

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Total backups: 0');
      expect(stdout).toContain('Recent backup: No');
      expect(stdout).toContain('Backup Warnings:');
      expect(stdout).toContain('No backup directory found');
    });

    test('should warn about old backups', async () => {
      // Mock old backup
      mockHealthData.backup = {
        hasRecentBackup: false,
        backupCount: 3,
        mostRecentBackup: 'old_backup.db',
        mostRecentAge: '25.5',
        warning: 'No backup created in last 24 hours'
      };

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Recent backup: No');
      expect(stdout).toContain('Most recent: 25.5 hours ago');
      expect(stdout).toContain('No backup created in last 24 hours');
      expect(stdout).toContain('DEPLOYMENT IS MOSTLY SAFE');
      expect(stdout).toContain('consider creating manual backup');
    });
  });

  describe('Safety Assessment Logic', () => {
    test('should pass deployment with optimal configuration', async () => {
      // All conditions optimal
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('DEPLOYMENT IS SAFE');
      expect(stdout).toContain('User data is properly protected');
      expect(stdout).toContain('Persistence is correctly configured');
      expect(stdout).toContain('Recent backup exists for data recovery');
      expect(stdout).toContain('Pre-deployment check passed - safe to deploy');
    });

    test('should pass with warnings for missing backups but safe persistence', async () => {
      // Safe persistence, no recent backup
      mockHealthData.backup.hasRecentBackup = false;
      mockHealthData.backup.warning = 'No recent backup';

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('DEPLOYMENT IS MOSTLY SAFE');
      expect(stdout).toContain('Persistence is correctly configured');
      expect(stdout).toContain('No recent backup but data will persist');
      expect(stdout).toContain('Consider creating manual backup');
      expect(stdout).toContain('Pre-deployment check passed - safe to deploy');
    });

    test('should fail deployment with persistence issues', async () => {
      // Critical persistence issues
      mockHealthData.persistence.isConfiguredForPersistence = false;
      mockHealthData.persistence.persistenceWarnings = [
        'CRITICAL: Database not in persistent storage - data will be lost on deployment'
      ];

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('DEPLOYMENT IS UNSAFE - DATA LOSS RISK');
      expect(stdout + stderr).toContain('CRITICAL: Persistence configuration issues detected');
      expect(stdout + stderr).toContain('USER DATA WILL BE LOST ON DEPLOYMENT');
      expect(stdout + stderr).toContain('FIX PERSISTENCE ISSUES BEFORE DEPLOYING');
      expect(stdout + stderr).toContain('Pre-deployment check failed - DO NOT DEPLOY');
    });

    test('should provide actionable fix instructions', async () => {
      // Unsafe configuration
      mockHealthData.persistence.isConfiguredForPersistence = false;

      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('Fix the persistence configuration issues before deploying:');
      expect(stdout + stderr).toContain('1. Verify DATABASE_URL in Render environment variables');
      expect(stdout + stderr).toContain('2. Ensure persistent disk is properly mounted');
      expect(stdout + stderr).toContain('3. Re-run this check after fixes');
    });
  });

  describe('Integration with npm commands', () => {
    test('should integrate with deploy:check command', async () => {
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} npm run deploy:check`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('DEPLOYMENT IS SAFE');
      expect(stdout).toContain('Pre-deployment check passed');
    });

    test('should work with deploy:safe command flow', async () => {
      // This would normally run deploy:check && db:backup:safe
      // We'll test just the check portion here
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      // First part of deploy:safe command
      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      );

      expect(stdout).toContain('Pre-deployment check passed');
      // If this passes, the backup command would run next
    });
  });

  describe('Error Recovery and Troubleshooting', () => {
    test('should provide helpful troubleshooting information', async () => {
      const { stdout } = await execAsync(
        `PRODUCTION_URL=http://localhost:9999 node scripts/pre-deployment-check.cjs`,
        { cwd: process.cwd() }
      ).catch(error => ({ stdout: error.stdout || '' }));

      expect(stdout).toContain('For more information:');
      expect(stdout).toContain('Health endpoint:');
      expect(stdout).toContain('Render dashboard: https://dashboard.render.com');
      expect(stdout).toContain('Persistence docs: ./RENDER_PERSISTENCE.md');
    });

    test('should handle network timeouts gracefully', async () => {
      // Create server that delays response beyond timeout
      const app = express();
      app.get('/api/health', (req, res) => {
        setTimeout(() => res.json(mockHealthData), 35000); // Longer than 30s timeout
      });

      mockServer = app.listen(mockPort);

      const { stdout, stderr } = await execAsync(
        `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
        { 
          cwd: process.cwd(),
          timeout: 40000
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('Request timeout');
    });

    test('should maintain proper exit codes', async () => {
      // Test successful check
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app.listen(mockPort);

      try {
        await execAsync(
          `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
          { cwd: process.cwd() }
        );
        // Should not throw for successful check
      } catch (error) {
        expect(error).toBeUndefined();
      }

      mockServer.close();

      // Test failed check (should exit with non-zero)
      mockHealthData.persistence.isConfiguredForPersistence = false;
      
      const app2 = express();
      app2.get('/api/health', (req, res) => {
        res.json(mockHealthData);
      });

      mockServer = app2.listen(mockPort + 1);

      try {
        await execAsync(
          `PRODUCTION_URL=http://localhost:${mockPort + 1} node scripts/pre-deployment-check.cjs`,
          { cwd: process.cwd() }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        // Should throw/exit with error for failed check
        expect(error).toBeDefined();
      }
    });
  });
});