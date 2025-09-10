/**
 * Full Deployment Simulation Tests
 * 
 * End-to-end tests simulating complete deployment scenarios
 * to validate data persistence and safety measures work in practice
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createTestDb, type TestDbInstance, createTestUser, createTestDexaScan } from '../setup/testDb.js';

const execAsync = promisify(exec);

describe('Full Deployment Simulation', () => {
  let originalEnv: typeof process.env;
  let simulationDir: string;
  let stagingDb: TestDbInstance;

  beforeAll(() => {
    originalEnv = { ...process.env };
    
    // Create simulation environment directory
    simulationDir = path.join(process.cwd(), '__tests__', 'deployment-simulation');
    if (!fs.existsSync(simulationDir)) {
      fs.mkdirSync(simulationDir, { recursive: true });
    }
  });

  afterAll(() => {
    process.env = originalEnv;
    
    // Cleanup simulation directory
    if (fs.existsSync(simulationDir)) {
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
      removeDir(simulationDir);
    }
  });

  beforeEach(() => {
    // Create fresh staging database for each test
    stagingDb = createTestDb();
  });

  afterEach(() => {
    if (stagingDb) {
      stagingDb.cleanup();
    }
  });

  describe('Complete Deployment Lifecycle', () => {
    test('should simulate successful deployment with data persistence', async () => {
      // Phase 1: Setup initial production state
      const persistentDbPath = path.join(simulationDir, 'persistent-db.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Add production-like data
      const user1 = await createTestUser(stagingDb.db, { 
        username: 'jackie_restored',
        name: 'Jackie Restored' 
      });
      const user2 = await createTestUser(stagingDb.db, { 
        username: 'production_user',
        name: 'Production User' 
      });
      
      await createTestDexaScan(stagingDb.db, user1.id, { 
        bodyFatPercent: 22.5,
        isBaseline: true 
      });
      await createTestDexaScan(stagingDb.db, user2.id, { 
        bodyFatPercent: 18.0,
        isBaseline: false 
      });

      // Copy updated data back
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Phase 2: Pre-deployment backup verification
      const backupResult = await execAsync(
        `DATABASE_URL="${persistentDbPath}" node scripts/backup-database.cjs create`,
        { cwd: process.cwd() }
      );

      expect(backupResult.stdout).toContain('2 users, 2 scans, 0 scores');
      expect(backupResult.stdout).toContain('[SUCCESS]');

      // Phase 3: Simulate deployment initialization
      const deployEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: persistentDbPath,
        SESSION_SECRET: 'deployment-simulation-secret-64-chars-minimum-for-security'
      };

      const initResult = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            console.log('DEPLOYMENT_INIT_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(initResult.stdout).toContain('Using existing database');
      expect(initResult.stdout).toContain('PRESERVING USER DATA');
      expect(initResult.stdout).toContain('2 users, 2 scans');
      expect(initResult.stdout).toContain('Existing data detected - creating safety backup');
      expect(initResult.stdout).toContain('DEPLOYMENT_INIT_SUCCESS');

      // Phase 4: Post-deployment verification
      const healthResult = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.RENDER = 'true';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
            console.log('HEALTH_CHECK:', JSON.stringify(h.data));
            console.log('PERSISTENCE:', JSON.stringify(h.persistence));
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(healthResult.stdout).toContain('HEALTH_CHECK: {"users":2,"scans":2,"scores":0}');
      expect(healthResult.stdout).toContain('{"isConfiguredForPersistence":true');
      expect(healthResult.stdout).toContain('"persistenceWarnings":[]}');

      // Phase 5: Verify backups were created
      const backupDir = path.join(path.dirname(persistentDbPath), 'backups');
      expect(fs.existsSync(backupDir)).toBe(true);
      
      const backupFiles = fs.readdirSync(backupDir);
      const deploymentBackup = backupFiles.find(f => f.startsWith('deployment_backup_'));
      expect(deploymentBackup).toBeDefined();
    });

    test('should prevent deployment with unsafe configuration', async () => {
      // Setup database with user data
      const unsafeDbPath = path.join(simulationDir, 'unsafe-local.db');
      fs.copyFileSync(stagingDb.sqlite.name, unsafeDbPath);

      const user = await createTestUser(stagingDb.db, { 
        username: 'endangered_user',
        name: 'User At Risk' 
      });
      await createTestDexaScan(stagingDb.db, user.id);

      fs.copyFileSync(stagingDb.sqlite.name, unsafeDbPath);

      // Attempt deployment with unsafe configuration
      const unsafeEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: './unsafe-local.db', // Unsafe local path
        SESSION_SECRET: 'unsafe-deployment-secret-64-chars-minimum-for-security'
      };

      // Should fail startup validation
      const { stdout, stderr } = await execAsync(
        `node scripts/render-start.mjs --check-only`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...unsafeEnv },
          timeout: 10000
        }
      ).catch(error => ({ 
        stdout: error.stdout || '', 
        stderr: error.stderr || error.message 
      }));

      expect(stdout + stderr).toContain('CRITICAL DATA LOSS RISK');
      expect(stdout + stderr).toContain('USER ACCOUNTS AND SCANS WILL BE WIPED');
      expect(stdout + stderr).toContain('Jackie');
      expect(stdout + stderr).toContain('IMMEDIATE FIX REQUIRED');
    });

    test('should handle deployment rollback scenario', async () => {
      // Phase 1: Setup initial state
      const persistentDbPath = path.join(simulationDir, 'rollback-test.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const originalUser = await createTestUser(stagingDb.db, { 
        username: 'original_user',
        name: 'Original User' 
      });
      await createTestDexaScan(stagingDb.db, originalUser.id, { isBaseline: true });

      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Phase 2: Create backup before "bad deployment"
      await execAsync(
        `DATABASE_URL="${persistentDbPath}" node scripts/backup-database.cjs create`,
        { cwd: process.cwd() }
      );

      // Phase 3: Simulate problematic deployment that corrupts data
      fs.writeFileSync(persistentDbPath, 'corrupted database content');

      // Phase 4: Detect corruption and rollback
      const backupDir = path.join(path.dirname(persistentDbPath), 'backups');
      expect(fs.existsSync(backupDir)).toBe(true);

      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .sort()
        .reverse();

      expect(backupFiles.length).toBeGreaterThan(0);

      // Restore from backup
      const latestBackup = path.join(backupDir, backupFiles[0]);
      fs.copyFileSync(latestBackup, persistentDbPath);

      // Verify restoration
      const restoredResult = await execAsync(
        `node -e "
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
            console.log('RESTORED_DATA:', JSON.stringify(h.data));
          });
        "`,
        { cwd: process.cwd() }
      );

      expect(restoredResult.stdout).toContain('RESTORED_DATA: {"users":1,"scans":1,"scores":0}');
    });
  });

  describe('Multi-Deployment Persistence', () => {
    test('should maintain data consistency across multiple deployments', async () => {
      const persistentDbPath = path.join(simulationDir, 'multi-deploy.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const deployEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: persistentDbPath,
        SESSION_SECRET: 'multi-deployment-secret-64-chars-minimum-for-security'
      };

      // Deployment 1: Initial setup
      const user1 = await createTestUser(stagingDb.db, { 
        username: 'persistent_user_1',
        name: 'Persistent User 1' 
      });
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const deploy1Result = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            console.log('DEPLOY_1_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(deploy1Result.stdout).toContain('1 users');
      expect(deploy1Result.stdout).toContain('DEPLOY_1_SUCCESS');

      // Deployment 2: Add more data
      await createTestDexaScan(stagingDb.db, user1.id, { isBaseline: true });
      const user2 = await createTestUser(stagingDb.db, { 
        username: 'persistent_user_2',
        name: 'Persistent User 2' 
      });
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const deploy2Result = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            console.log('DEPLOY_2_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(deploy2Result.stdout).toContain('2 users, 1 scans');
      expect(deploy2Result.stdout).toContain('DEPLOY_2_SUCCESS');

      // Deployment 3: Add final data
      await createTestDexaScan(stagingDb.db, user2.id, { isBaseline: false });
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const deploy3Result = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            console.log('DEPLOY_3_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(deploy3Result.stdout).toContain('2 users, 2 scans');
      expect(deploy3Result.stdout).toContain('DEPLOY_3_SUCCESS');

      // Final verification: All data should be intact
      const finalHealthResult = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
            console.log('FINAL_STATE:', JSON.stringify(h.data));
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(finalHealthResult.stdout).toContain('FINAL_STATE: {"users":2,"scans":2,"scores":0}');
    });

    test('should create progressive backup chain across deployments', async () => {
      const persistentDbPath = path.join(simulationDir, 'backup-chain.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const deployEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: persistentDbPath,
        SESSION_SECRET: 'backup-chain-secret-64-chars-minimum-for-security'
      };

      // Multiple deployments with data additions
      for (let i = 1; i <= 3; i++) {
        // Add data
        const user = await createTestUser(stagingDb.db, { 
          username: `chain_user_${i}`,
          name: `Chain User ${i}` 
        });
        await createTestDexaScan(stagingDb.db, user.id);

        fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

        // Simulate deployment
        await execAsync(
          `node -e "
            process.env.NODE_ENV = 'production';
            process.env.DATABASE_URL = '${persistentDbPath}';
            import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
              console.log('DEPLOYMENT_${i}_SUCCESS');
            });
          "`,
          { 
            cwd: process.cwd(),
            env: { ...originalEnv, ...deployEnv }
          }
        );
      }

      // Verify backup chain
      const backupDir = path.join(path.dirname(persistentDbPath), 'backups');
      expect(fs.existsSync(backupDir)).toBe(true);

      const backupFiles = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('deployment_backup_'))
        .sort();

      expect(backupFiles.length).toBeGreaterThanOrEqual(3);

      // Verify each backup has incremental data
      for (let i = 0; i < Math.min(3, backupFiles.length); i++) {
        const backupPath = path.join(backupDir, backupFiles[i]);
        
        const verifyResult = await execAsync(
          `node scripts/backup-database.cjs verify "${backupPath}"`,
          { cwd: process.cwd() }
        );

        expect(verifyResult.stdout).toContain('Valid: true');
        expect(verifyResult.stdout).toContain('Users:');
      }
    });
  });

  describe('Jackie Incident Prevention Simulation', () => {
    test('should prevent Jackie-type data loss scenario', async () => {
      // Phase 1: Setup database with user data (simulating Jackie's account)
      const persistentDbPath = path.join(simulationDir, 'jackie-prevention.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      const jackieUser = await createTestUser(stagingDb.db, { 
        username: 'jackie_simulation',
        name: 'Jackie Simulation',
        email: 'jackie@test.com'
      });
      const jackieScan = await createTestDexaScan(stagingDb.db, jackieUser.id, { 
        bodyFatPercent: 24.5,
        leanMass: 120.0,
        isBaseline: true,
        scanName: "Jackie's Baseline DEXA"
      });

      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Phase 2: Verify dangerous scripts are archived and inaccessible
      const dangerousScriptPath = path.join(process.cwd(), 'scripts', 'reset-user-scans.sql');
      const archivedScriptPath = path.join(process.cwd(), 'scripts', 'DANGEROUS_ARCHIVE', 'reset-user-scans.sql');

      expect(fs.existsSync(dangerousScriptPath)).toBe(false);
      expect(fs.existsSync(archivedScriptPath)).toBe(true);

      // Verify archived script contains the dangerous operations
      const archivedContent = fs.readFileSync(archivedScriptPath, 'utf8');
      expect(archivedContent).toContain('DELETE FROM dexa_scans');
      expect(archivedContent).toContain('DELETE FROM scoring_data');

      // Phase 3: Simulate deployment with audit logging active
      const deployEnv = {
        NODE_ENV: 'production',
        RENDER: 'true',
        DATABASE_URL: persistentDbPath,
        SESSION_SECRET: 'jackie-prevention-secret-64-chars-minimum-for-security'
      };

      const deployResult = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            // Test audit logging
            import('./server/audit-logger.js').then(audit => {
              audit.auditLogger.logScanCreated('test-scan', 'jackie_simulation', 'jackie_simulation', {
                bodyFatPercent: 24.5,
                scanName: 'Test Prevention'
              });
              console.log('AUDIT_LOGGING_ACTIVE');
            });
            console.log('JACKIE_PREVENTION_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { ...originalEnv, ...deployEnv }
        }
      );

      expect(deployResult.stdout).toContain('1 users, 1 scans');
      expect(deployResult.stdout).toContain('PRESERVING USER DATA');
      expect(deployResult.stdout).toContain('creating safety backup');
      expect(deployResult.stdout).toContain('AUDIT_LOGGING_ACTIVE');
      expect(deployResult.stdout).toContain('JACKIE_PREVENTION_SUCCESS');

      // Phase 4: Verify data survived deployment
      const postDeployHealth = await execAsync(
        `node -e "
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
            console.log('POST_DEPLOY_DATA:', JSON.stringify(h.data));
            if (h.data.users === 1 && h.data.scans === 1) {
              console.log('JACKIE_DATA_PRESERVED');
            }
          });
        "`,
        { cwd: process.cwd() }
      );

      expect(postDeployHealth.stdout).toContain('POST_DEPLOY_DATA: {"users":1,"scans":1,"scores":0}');
      expect(postDeployHealth.stdout).toContain('JACKIE_DATA_PRESERVED');

      // Phase 5: Verify backups contain Jackie's data for recovery
      const backupDir = path.join(path.dirname(persistentDbPath), 'backups');
      const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
      expect(backupFiles.length).toBeGreaterThan(0);

      // Test that backup can be used for recovery
      const latestBackup = path.join(backupDir, backupFiles[backupFiles.length - 1]);
      const backupVerification = await execAsync(
        `node scripts/backup-database.cjs verify "${latestBackup}"`,
        { cwd: process.cwd() }
      );

      expect(backupVerification.stdout).toContain('Valid: true');
      expect(backupVerification.stdout).toContain('Users: 1, Scans: 1');
    });

    test('should maintain incident analysis capabilities', async () => {
      // Test that audit analysis tools work in production environment
      const analysisResult = await execAsync(
        `npm run audit:analyze`,
        { cwd: process.cwd() }
      );

      expect(analysisResult.stdout).toContain('Jackie Data Loss Incident Analysis');
      expect(analysisResult.stdout).toContain('PRIMARY CONCLUSION:');
      expect(analysisResult.stdout).toContain('Jackie\'s data loss occurred BEFORE audit logging was implemented');
      expect(analysisResult.stdout).toContain('SAFETY MEASURES NOW IN PLACE:');
      expect(analysisResult.stdout).toContain('Dangerous scripts moved to DANGEROUS_ARCHIVE');
      expect(analysisResult.stdout).toContain('Comprehensive audit logging implemented');
      expect(analysisResult.stdout).toContain('Automated backup system with verification');
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle deployment with larger datasets efficiently', async () => {
      const persistentDbPath = path.join(simulationDir, 'large-dataset.db');
      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Create substantial dataset
      const users: any[] = [];
      for (let i = 1; i <= 50; i++) {
        const user = await createTestUser(stagingDb.db, { 
          username: `load_test_user_${i}`,
          name: `Load Test User ${i}` 
        });
        users.push(user);

        // Add multiple scans per user
        for (let j = 1; j <= 3; j++) {
          await createTestDexaScan(stagingDb.db, user.id, { 
            bodyFatPercent: 15 + Math.random() * 15,
            isBaseline: j === 1 
          });
        }
      }

      fs.copyFileSync(stagingDb.sqlite.name, persistentDbPath);

      // Test deployment performance with large dataset
      const startTime = Date.now();

      const deployResult = await execAsync(
        `node -e "
          process.env.NODE_ENV = 'production';
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.initializeDatabase()).then(() => {
            console.log('LARGE_DATASET_DEPLOY_SUCCESS');
          });
        "`,
        { 
          cwd: process.cwd(),
          env: { 
            ...originalEnv,
            NODE_ENV: 'production',
            RENDER: 'true',
            DATABASE_URL: persistentDbPath
          }
        }
      );

      const deployTime = Date.now() - startTime;

      expect(deployResult.stdout).toContain('50 users, 150 scans');
      expect(deployResult.stdout).toContain('PRESERVING USER DATA');
      expect(deployResult.stdout).toContain('creating safety backup');
      expect(deployResult.stdout).toContain('LARGE_DATASET_DEPLOY_SUCCESS');

      // Deployment should complete in reasonable time (< 30 seconds)
      expect(deployTime).toBeLessThan(30000);

      // Verify health check works with large dataset
      const healthResult = await execAsync(
        `node -e "
          process.env.DATABASE_URL = '${persistentDbPath}';
          import('./server/db.js').then(m => m.getDatabaseHealthStatus()).then(h => {
            console.log('LARGE_DATASET_HEALTH:', JSON.stringify(h.data));
          });
        "`,
        { cwd: process.cwd() }
      );

      expect(healthResult.stdout).toContain('"users":50,"scans":150');
    });
  });
});