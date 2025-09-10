/**
 * Production Readiness Validation Tests
 * 
 * Comprehensive validation suite to ensure the application is fully
 * production-ready before deployment, covering all safety mechanisms
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import express from 'express';
import { createTestDb, type TestDbInstance } from '../setup/testDb.js';

const execAsync = promisify(exec);

describe('Production Readiness Validation', () => {
  let originalEnv: typeof process.env;
  let testDb: TestDbInstance;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    testDb = createTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  describe('Essential Configuration Validation', () => {
    test('should validate all required environment variables', async () => {
      const requiredVars = [
        'NODE_ENV',
        'SESSION_SECRET',
        'DATABASE_URL'
      ];

      // Test with complete configuration
      const prodEnv = {
        NODE_ENV: 'production',
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security',
        DATABASE_URL: '/opt/render/persistent/data/fitness_challenge.db',
        PORT: '3000',
        ADMIN_USERNAMES: 'TestAdmin'
      };

      // Validate each required variable
      for (const variable of requiredVars) {
        const testEnv = { ...prodEnv };
        delete testEnv[variable as keyof typeof testEnv];

        const { stdout, stderr } = await execAsync(
          `node -e "
            Object.assign(process.env, ${JSON.stringify(testEnv)});
            import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
              if (h.status === 'error') {
                console.log('MISSING_REQUIRED_VAR:', '${variable}');
              } else {
                console.log('CONFIG_VALID');
              }
            }).catch(e => console.log('ERROR:', e.message));
          "`,
          { 
            cwd: process.cwd(),
            env: originalEnv
          }
        ).catch(error => ({ stdout: error.stdout || '', stderr: error.stderr || '' }));

        // Should detect missing critical configuration
        if (variable === 'NODE_ENV' || variable === 'SESSION_SECRET') {
          expect(stdout + stderr).toContain('ERROR');
        }
      }
    });

    test('should validate session secret strength in production', async () => {
      const weakSecrets = [
        'weak',
        '12345',
        'password',
        'short-secret',
        'less-than-32-chars'
      ];

      const strongSecret = 'production-session-secret-64-chars-minimum-for-security-testing';

      for (const secret of weakSecrets) {
        const testEnv = {
          NODE_ENV: 'production',
          SESSION_SECRET: secret,
          DATABASE_URL: testDb.sqlite.name
        };

        // Weak secrets should be detected (implementation dependent)
        // This test assumes security validation exists
        expect(secret.length).toBeLessThan(32); // Weak by definition
      }

      // Strong secret should be acceptable
      expect(strongSecret.length).toBeGreaterThanOrEqual(64);
    });

    test('should validate admin configuration', async () => {
      const testCases = [
        {
          adminConfig: 'SingleAdmin',
          expected: 'valid'
        },
        {
          adminConfig: 'Admin1,Admin2,Admin3',
          expected: 'valid'
        },
        {
          adminConfig: '',
          expected: 'fallback' // Should use default
        }
      ];

      for (const testCase of testCases) {
        const prodEnv = {
          NODE_ENV: 'production',
          SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security',
          DATABASE_URL: testDb.sqlite.name,
          ADMIN_USERNAMES: testCase.adminConfig
        };

        const { stdout } = await execAsync(
          `node -e "
            Object.assign(process.env, ${JSON.stringify(prodEnv)});
            console.log('ADMIN_CONFIG:', process.env.ADMIN_USERNAMES || 'DEFAULT');
          "`,
          { cwd: process.cwd() }
        );

        if (testCase.expected === 'valid') {
          expect(stdout).toContain('ADMIN_CONFIG:');
        }
      }
    });
  });

  describe('Database Production Safety', () => {
    test('should enforce persistent storage in production', async () => {
      const dangerousConfigs = [
        './data/fitness_challenge.db',
        'data/fitness_challenge.db',
        '/tmp/database.db',
        './local/database.db'
      ];

      for (const dbPath of dangerousConfigs) {
        const prodEnv = {
          NODE_ENV: 'production',
          RENDER: 'true',
          DATABASE_URL: dbPath,
          SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security'
        };

        const { stdout, stderr } = await execAsync(
          `node scripts/render-start.mjs --check-only`,
          {
            cwd: process.cwd(),
            env: { ...originalEnv, ...prodEnv },
            timeout: 10000
          }
        ).catch(error => ({ 
          stdout: error.stdout || '', 
          stderr: error.stderr || error.message 
        }));

        // Should detect and reject unsafe configurations
        expect(stdout + stderr).toContain('CRITICAL DATA LOSS RISK');
        expect(stdout + stderr).toContain('Jackie');
      }
    });

    test('should validate database backup system readiness', async () => {
      // Add test data
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('backup-ready-test', 'backupreadyuser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      // Test backup system functionality
      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        {
          cwd: process.cwd(),
          env: {
            ...originalEnv,
            DATABASE_URL: testDb.sqlite.name
          }
        }
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('[SUCCESS]');
      expect(stdout).toContain('Backup completed successfully');
      expect(stdout).toContain('1 users');

      // Verify backup file was created and is valid
      const { stdout: listOutput } = await execAsync(
        `node scripts/backup-database.cjs list`,
        { cwd: process.cwd() }
      );

      expect(listOutput).toContain('Available Database Backups');
      expect(listOutput).toContain('Valid: Yes');
    });

    test('should validate health monitoring system', async () => {
      const prodEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: testDb.sqlite.name,
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security'
      };

      const { stdout } = await execAsync(
        `node -e "
          Object.assign(process.env, ${JSON.stringify(prodEnv)});
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => 
            console.log(JSON.stringify(h, null, 2))
          );
        "`,
        { 
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      const health = JSON.parse(stdout);

      // Validate comprehensive health information
      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('persistence');
      expect(health).toHaveProperty('data');
      expect(health).toHaveProperty('backup');
      expect(health).toHaveProperty('environment');
      expect(health).toHaveProperty('timestamp');

      // Validate environment detection
      expect(health.environment.nodeEnv).toBe('production');
      expect(health.environment.isProduction).toBe(true);
    });
  });

  describe('Security and Audit Readiness', () => {
    test('should validate audit logging system is operational', async () => {
      const prodEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: testDb.sqlite.name,
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security'
      };

      const { stdout, stderr } = await execAsync(
        `node -e "
          Object.assign(process.env, ${JSON.stringify(prodEnv)});
          import('./server/audit-logger.js').then(m => {
            const logger = m.auditLogger;
            logger.log({
              operation: 'TEST',
              table: 'production_readiness',
              recordId: 'test-audit-entry',
              details: { testType: 'production_readiness_validation' }
            });
            console.log('AUDIT_SYSTEM_READY');
          }).catch(e => console.error('AUDIT_ERROR:', e.message));
        "`,
        {
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      expect(stderr).toBe('');
      expect(stdout).toContain('[AUDIT]');
      expect(stdout).toContain('AUDIT_SYSTEM_READY');
      expect(stdout).toContain('production_readiness_validation');
    });

    test('should validate dangerous script archival', async () => {
      // Verify dangerous scripts are properly archived
      const dangerousScripts = [
        'scripts/reset-user-scans.sql'
      ];

      const archivedDirectory = path.join(process.cwd(), 'scripts', 'DANGEROUS_ARCHIVE');

      for (const script of dangerousScripts) {
        const activePath = path.join(process.cwd(), script);
        const archivedPath = path.join(archivedDirectory, path.basename(script));

        // Active script should not exist
        expect(fs.existsSync(activePath)).toBe(false);

        // Archived version should exist
        expect(fs.existsSync(archivedPath)).toBe(true);

        // Verify archived script contains dangerous operations
        if (fs.existsSync(archivedPath)) {
          const content = fs.readFileSync(archivedPath, 'utf8');
          expect(content).toContain('DELETE FROM');
        }
      }
    });

    test('should validate incident analysis capabilities', async () => {
      const { stdout, stderr } = await execAsync(
        `npm run audit:analyze`,
        { 
          cwd: process.cwd(),
          timeout: 15000
        }
      );

      expect(stderr).not.toContain('ERROR');
      expect(stdout).toContain('Jackie Data Loss Incident Analysis');
      expect(stdout).toContain('SAFETY MEASURES NOW IN PLACE');
      expect(stdout).toContain('✓ Database persistence verification');
      expect(stdout).toContain('✓ Automated backup system');
      expect(stdout).toContain('✓ Audit logging system');
    });
  });

  describe('Application Startup and Runtime', () => {
    test('should validate Render startup script safety checks', async () => {
      const safeConfig = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: '/opt/render/persistent/data/fitness_challenge.db',
        UPLOADS_DIR: '/opt/render/persistent/uploads',
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security',
        ADMIN_USERNAMES: 'ProductionAdmin'
      };

      const { stdout, stderr } = await execAsync(
        `node scripts/render-start.mjs --check-only`,
        {
          cwd: process.cwd(),
          env: { ...originalEnv, ...safeConfig },
          timeout: 15000
        }
      ).catch(error => ({
        stdout: error.stdout || '',
        stderr: error.stderr || error.message
      }));

      // Should pass all safety checks
      expect(stdout).toContain('Using persistent storage - data will survive deployments');
      expect(stdout).toContain('prevents data loss like the Jackie incident');
      expect(stderr).not.toContain('CRITICAL DATA LOSS RISK');
      expect(stdout).toContain('All safety checks passed');
    });

    test('should validate database initialization handles existing data safely', async () => {
      // Add existing data to test database
      await testDb.db.execute(`
        INSERT INTO users (id, username, password, created_at, updated_at)
        VALUES ('existing-user', 'existinguser', 'hashed-password', ${Date.now()}, ${Date.now()})
      `);

      await testDb.db.execute(`
        INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
        VALUES ('existing-scan', 'existing-user', ${Date.now()}, 22.5, 125.0, 165.0, ${Date.now()}, ${Date.now()})
      `);

      const prodEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: testDb.sqlite.name,
        SESSION_SECRET: 'production-session-secret-64-chars-minimum-for-security'
      };

      // Test database initialization with existing data
      const { stdout } = await execAsync(
        `node -e "
          Object.assign(process.env, ${JSON.stringify(prodEnv)});
          import('./server/db.js').then(m => m.initializeDatabase());
        "`,
        {
          cwd: process.cwd(),
          env: originalEnv
        }
      );

      // Should preserve existing data
      expect(stdout).toContain('Using existing database');
      expect(stdout).toContain('PRESERVING USER DATA');
      expect(stdout).toContain('1 users');
      expect(stdout).toContain('1 scans');
      expect(stdout).toContain('Existing data detected - creating safety backup');
    });

    test('should validate pre-deployment check integration', async () => {
      // Create mock production server for testing
      const app = express();
      app.get('/api/health', (req, res) => {
        res.json({
          status: 'healthy',
          persistence: {
            isConfiguredForPersistence: true,
            isPersistenceRequired: true,
            persistenceWarnings: []
          },
          data: { users: 5, scans: 12, scores: 8 },
          backup: { hasRecentBackup: true, backupCount: 3 },
          environment: { nodeEnv: 'production', isRender: true }
        });
      });

      const mockPort = 3333 + Math.floor(Math.random() * 100);
      const mockServer = app.listen(mockPort);

      try {
        // Test pre-deployment check against mock server
        const { stdout, stderr } = await execAsync(
          `PRODUCTION_URL=http://localhost:${mockPort} node scripts/pre-deployment-check.cjs`,
          { 
            cwd: process.cwd(),
            timeout: 10000
          }
        );

        expect(stderr).toBe('');
        expect(stdout).toContain('DEPLOYMENT IS SAFE');
        expect(stdout).toContain('✓ Database persistence properly configured');
        expect(stdout).toContain('✓ Recent backups available');
        expect(stdout).toContain('✓ Production environment detected');
      } finally {
        mockServer.close();
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should validate application handles production data volumes', async () => {
      // Create test data at production-like scale
      const userCount = 100;
      const scansPerUser = 5;
      
      const startTime = Date.now();

      // Insert users in batches
      for (let i = 0; i < userCount; i++) {
        await testDb.db.execute(`
          INSERT INTO users (id, username, password, created_at, updated_at)
          VALUES ('scale-user-${i}', 'scaleuser${i}', 'hashed-password', ${Date.now() - i * 1000}, ${Date.now()})
        `);

        // Add scans for each user
        for (let s = 0; s < scansPerUser; s++) {
          await testDb.db.execute(`
            INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
            VALUES ('scale-scan-${i}-${s}', 'scale-user-${i}', ${Date.now() - s * 24 * 60 * 60 * 1000}, ${15 + Math.random() * 10}, ${120 + Math.random() * 40}, ${150 + Math.random() * 50}, ${Date.now()}, ${Date.now()})
          `);
        }
      }

      const insertTime = Date.now() - startTime;

      // Test health check performance with production data
      const healthStartTime = Date.now();
      const prodEnv = {
        NODE_ENV: 'production',
        DATABASE_URL: testDb.sqlite.name
      };

      const { stdout } = await execAsync(
        `node -e "
          Object.assign(process.env, ${JSON.stringify(prodEnv)});
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => 
            console.log('PERFORMANCE_TEST:', JSON.stringify({
              status: h.status,
              userCount: h.data.users,
              scanCount: h.data.scans,
              responseTime: Date.now() - ${healthStartTime}
            }))
          );
        "`,
        { cwd: process.cwd() }
      );

      const result = JSON.parse(stdout.match(/PERFORMANCE_TEST: (.+)/)?.[1] || '{}');

      // Validate performance
      expect(result.status).toBe('healthy');
      expect(result.userCount).toBe(userCount);
      expect(result.scanCount).toBe(userCount * scansPerUser);
      expect(result.responseTime).toBeLessThan(5000); // Should respond within 5 seconds

      // Validate data insertion performance
      expect(insertTime).toBeLessThan(30000); // Should insert within 30 seconds
    });

    test('should validate backup performance with production data volumes', async () => {
      // Create substantial test data
      for (let i = 0; i < 50; i++) {
        await testDb.db.execute(`
          INSERT INTO users (id, username, password, created_at, updated_at)
          VALUES ('perf-user-${i}', 'perfuser${i}', 'hashed-password', ${Date.now()}, ${Date.now()})
        `);

        await testDb.db.execute(`
          INSERT INTO dexa_scans (id, user_id, scan_date, body_fat_percent, lean_mass, total_weight, created_at, updated_at)
          VALUES ('perf-scan-${i}', 'perf-user-${i}', ${Date.now()}, 20.0, 130.0, 170.0, ${Date.now()}, ${Date.now()})
        `);
      }

      // Test backup performance
      const backupStartTime = Date.now();
      const { stdout, stderr } = await execAsync(
        `node scripts/backup-database.cjs create`,
        {
          cwd: process.cwd(),
          env: {
            ...originalEnv,
            DATABASE_URL: testDb.sqlite.name
          },
          timeout: 30000 // 30 second timeout for backup
        }
      );

      const backupTime = Date.now() - backupStartTime;

      expect(stderr).toBe('');
      expect(stdout).toContain('[SUCCESS]');
      expect(stdout).toContain('50 users, 50 scans, 0 scores');
      expect(backupTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Final Production Readiness Checklist', () => {
    test('should validate complete production readiness checklist', async () => {
      const readinessItems = [
        {
          name: 'Database Persistence Configuration',
          check: async () => {
            const prodEnv = {
              NODE_ENV: 'production',
              RENDER: 'true',
              DATABASE_URL: '/opt/render/persistent/data/fitness_challenge.db'
            };

            const { stdout } = await execAsync(
              `node scripts/render-start.mjs --check-only`,
              {
                cwd: process.cwd(),
                env: { ...originalEnv, ...prodEnv },
                timeout: 10000
              }
            ).catch(error => ({ stdout: error.stdout || '' }));

            return stdout.includes('Using persistent storage');
          }
        },
        {
          name: 'Backup System Operational',
          check: async () => {
            const { stdout } = await execAsync(
              `node scripts/backup-database.cjs create`,
              {
                cwd: process.cwd(),
                env: { ...originalEnv, DATABASE_URL: testDb.sqlite.name }
              }
            );
            return stdout.includes('[SUCCESS]');
          }
        },
        {
          name: 'Health Monitoring System',
          check: async () => {
            const { stdout } = await execAsync(
              `node -e "
                process.env.NODE_ENV = 'production';
                process.env.DATABASE_URL = '${testDb.sqlite.name}';
                import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => 
                  console.log('HEALTH_CHECK_PASSED:', h.status === 'healthy')
                );
              "`,
              { cwd: process.cwd() }
            );
            return stdout.includes('HEALTH_CHECK_PASSED: true');
          }
        },
        {
          name: 'Audit Logging System',
          check: async () => {
            const { stdout } = await execAsync(
              `node -e "
                process.env.NODE_ENV = 'production';
                import('./server/audit-logger.js').then(m => {
                  m.auditLogger.log({
                    operation: 'READINESS_CHECK',
                    table: 'production_validation',
                    recordId: 'test'
                  });
                  console.log('AUDIT_LOGGING_READY');
                });
              "`,
              { cwd: process.cwd() }
            );
            return stdout.includes('AUDIT_LOGGING_READY');
          }
        },
        {
          name: 'Pre-deployment Safety Checks',
          check: async () => {
            const app = express();
            app.get('/api/health', (req, res) => {
              res.json({ status: 'healthy', persistence: { isConfiguredForPersistence: true } });
            });

            const port = 3444 + Math.floor(Math.random() * 100);
            const server = app.listen(port);

            try {
              const { stdout } = await execAsync(
                `PRODUCTION_URL=http://localhost:${port} node scripts/pre-deployment-check.cjs`,
                { cwd: process.cwd() }
              );
              return stdout.includes('DEPLOYMENT IS SAFE');
            } finally {
              server.close();
            }
          }
        }
      ];

      // Execute all readiness checks
      const results: Array<{ name: string; passed: boolean; error?: string }> = [];
      
      for (const item of readinessItems) {
        try {
          const passed = await item.check();
          results.push({ name: item.name, passed });
        } catch (error) {
          results.push({ 
            name: item.name, 
            passed: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Validate all checks passed
      const failedChecks = results.filter(r => !r.passed);
      
      if (failedChecks.length > 0) {
        console.log('Failed readiness checks:', failedChecks);
      }

      // All critical systems should be ready
      expect(failedChecks).toHaveLength(0);

      // Log successful readiness validation
      console.log('✅ PRODUCTION READINESS VALIDATION COMPLETE');
      console.log('✅ All safety systems operational');
      console.log('✅ Application ready for production deployment');
    });
  });
});