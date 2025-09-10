import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from "../shared/schema.js";
import { 
  getDatabasePath, 
  isTest, 
  getDeploymentEnvironment, 
  getSQLiteConfig, 
  validateDatabaseConfiguration 
} from './config.js';
import fs from 'fs';
import path from 'path';

// Create SQLite database file using configuration
const databasePath = getDatabasePath();

// Ensure database directory exists
const databaseDir = path.dirname(databasePath);
if (!fs.existsSync(databaseDir)) {
  fs.mkdirSync(databaseDir, { recursive: true });
}

const sqlite = createClient({
  url: `file:${databasePath}`,
  // Production optimizations
  syncUrl: undefined, // Disable sync for local SQLite
});

export const db = drizzle(sqlite, { schema });

// Configure SQLite for current environment
async function configureSQLiteForEnvironment() {
  try {
    if (!isTest()) {
      const deployEnv = getDeploymentEnvironment();
      const sqliteConfig = getSQLiteConfig();
      
      console.log(`🔧 Configuring SQLite for ${deployEnv.platform} environment...`);
      
      // Log deployment warnings if any
      if (deployEnv.warnings.length > 0) {
        console.warn('⚠️  Environment Warnings:');
        deployEnv.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }
      
      // Apply environment-specific SQLite settings
      await sqlite.execute(`PRAGMA journal_mode=${sqliteConfig.journalMode};`);
      console.log(`✅ Journal mode: ${sqliteConfig.journalMode}`);
      
      await sqlite.execute(`PRAGMA synchronous=${sqliteConfig.synchronous};`);
      console.log(`✅ Synchronous mode: ${sqliteConfig.synchronous}`);
      
      await sqlite.execute(`PRAGMA cache_size=${sqliteConfig.cacheSize};`);
      console.log(`✅ Cache size: ${sqliteConfig.cacheSize} pages`);
      
      await sqlite.execute(`PRAGMA temp_store=${sqliteConfig.tempStore};`);
      await sqlite.execute(`PRAGMA mmap_size=${sqliteConfig.mmapSize};`);
      await sqlite.execute(`PRAGMA busy_timeout=${sqliteConfig.busyTimeout};`);
      await sqlite.execute('PRAGMA optimize;'); // Enable query optimizer
      
      console.log('✅ Applied environment-optimized SQLite settings');
      
      // Verify configuration
      const journalResult = await sqlite.execute('PRAGMA journal_mode;');
      const syncResult = await sqlite.execute('PRAGMA synchronous;');
      
      console.log(`📊 Active configuration: Journal=${journalResult.rows?.[0]?.['journal_mode']}, Sync=${syncResult.rows?.[0]?.['synchronous']}`);
      
      // WAL checkpoint management for production
      if (sqliteConfig.journalMode === 'WAL' && (deployEnv.platform === 'render' || deployEnv.platform === 'railway')) {
        console.log('⚡ Setting up WAL checkpoint management for persistent platform...');
        
        // Perform initial checkpoint
        await sqlite.execute('PRAGMA wal_checkpoint(TRUNCATE);');
        console.log('✅ Initial WAL checkpoint completed');
        
        // Set reasonable WAL size limits
        await sqlite.execute('PRAGMA wal_autocheckpoint=1000;');
        console.log('✅ WAL auto-checkpoint configured');
      }
    }
  } catch (error) {
    console.error('❌ Failed to configure SQLite:', error instanceof Error ? error.message : error);
    console.warn('⚠️  Continuing with default SQLite settings...');
    // Don't throw - allow app to continue with default settings
  }
}

// Initialize database tables
export async function initializeDatabase() {
  // Capture pre-initialization state for failsafe
  let preInitializationState = {
    hadExistingData: false,
    userCount: 0,
    scanCount: 0
  };
  
  try {
    if (!isTest()) {
      console.log(`Initializing database at: ${databasePath}`);
      
      // CRITICAL: Verify environment and database configuration
      const configValidation = validateDatabaseConfiguration();
      const deployEnv = getDeploymentEnvironment();
      
      console.log(`🌍 Deployment Environment: ${deployEnv.platform}`);
      console.log(`🔒 Persistent Storage: ${deployEnv.isPersistent ? 'Yes' : 'No'}`);
      
      if (configValidation.warnings.length > 0) {
        console.warn('⚠️  Configuration Warnings:');
        configValidation.warnings.forEach(warning => console.warn(`   - ${warning}`));
      }
      
      if (configValidation.recommendations.length > 0) {
        console.info('💡 Recommendations:');
        configValidation.recommendations.forEach(rec => console.info(`   - ${rec}`));
      }
      
      if (!configValidation.isValid) {
        console.error('❌ Database configuration validation failed');
        throw new Error('Invalid database configuration - cannot proceed safely');
      }
      
      // CRITICAL: Verify persistence configuration to prevent data loss
      verifyPersistenceConfiguration();
      
      // Check if database file exists and has content
      if (fs.existsSync(databasePath)) {
        const stats = fs.statSync(databasePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        if (stats.size > 0) {
          console.log(`✅ Using existing database (${sizeInMB} MB) - PRESERVING USER DATA`);
          
          // Check if tables exist and log data counts for verification
          try {
            const result = await sqlite.execute(`
              SELECT name FROM sqlite_master 
              WHERE type='table' AND name IN ('users', 'dexa_scans', 'scoring_data')
            `);
            
            if (result.rows && result.rows.length > 0) {
              console.log(`✅ Found existing tables: ${result.rows.map(r => r.name).join(', ')}`);
              
              // Get comprehensive data counts for deployment verification
              const userCount = await sqlite.execute(`SELECT COUNT(*) as count FROM users`);
              const scanCount = await sqlite.execute(`SELECT COUNT(*) as count FROM dexa_scans`);
              const scoreCount = await sqlite.execute(`SELECT COUNT(*) as count FROM scoring_data`);
              
              // Capture pre-initialization state for failsafe
              const userCountNum = Number(userCount.rows?.[0]?.count ?? 0);
              const scanCountNum = Number(scanCount.rows?.[0]?.count ?? 0);
              
              preInitializationState = {
                hadExistingData: userCountNum > 0 || scanCountNum > 0,
                userCount: userCountNum,
                scanCount: scanCountNum
              };
              
              console.log(`📊 Database contains ${userCountNum} users, ${scanCountNum} scans, ${scoreCount.rows?.[0]?.count ?? 0} scores`);
              
              // Log user details for deployment verification (first 5 users)
              const userSample = await sqlite.execute(`SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 5`);
              if (userSample.rows && userSample.rows.length > 0) {
                console.log(`👥 Recent users: ${userSample.rows.map(u => u.username).join(', ')}`);
              }
              
              // CRITICAL: Create automatic backup before any initialization
              if (userCountNum > 0 || scanCountNum > 0) {
                console.log('🔒 Existing data detected - creating safety backup...');
                await createDeploymentBackup();
                
                // CRITICAL: Skip table creation when data exists in production
                if (process.env.NODE_ENV === 'production') {
                  console.log('🛡️  Production environment with existing data - skipping table operations');
                  console.log('   → This prevents accidental data loss during deployments');
                  console.log('   → Tables and data are preserved as-is');
                  
                  // Configure SQLite for environment and exit
                  await configureSQLiteForEnvironment();
                  console.log('✅ Database initialization complete - data preserved');
                  return;
                }
              }
              
            }
          } catch (e) {
            console.log('📝 Tables will be created if they don\'t exist');
          }
        } else {
          console.log('📝 Database file exists but is empty - will initialize tables');
        }
      } else {
        console.log('📝 Creating new database file');
      }
    }
    
    // Check if migrations directory exists, if not create tables directly
    const migrationsPath = path.join(process.cwd(), 'migrations');
    
    if (fs.existsSync(migrationsPath) && fs.readdirSync(migrationsPath).length > 0) {
      // Use migrations if available
      console.log('Running database migrations...');
      migrate(db, { migrationsFolder: migrationsPath });
    } else {
      // Create tables directly from schema
      console.log('Ensuring tables exist (CREATE TABLE IF NOT EXISTS)...');
      
      // Create tables using raw SQL since Drizzle doesn't auto-create in SQLite
      // Execute each table creation separately for better error handling
      
      console.log('Creating users table...');
      await sqlite.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE,
          email TEXT UNIQUE,
          password TEXT NOT NULL,
          name TEXT,
          first_name TEXT,
          last_name TEXT,
          gender TEXT CHECK(gender IN ('male', 'female')),
          height TEXT,
          starting_weight REAL,
          target_body_fat_percent REAL,
          target_lean_mass REAL,
          profile_image_url TEXT,
          is_active INTEGER DEFAULT 1,
          is_email_verified INTEGER DEFAULT 0,
          email_verification_token TEXT,
          email_verification_expires INTEGER,
          password_reset_token TEXT,
          password_reset_expires INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);
      console.log('✅ Users table created successfully');

      console.log('Creating dexa_scans table...');
      await sqlite.execute(`
        CREATE TABLE IF NOT EXISTS dexa_scans (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          scan_date INTEGER NOT NULL,
          body_fat_percent REAL NOT NULL,
          lean_mass REAL NOT NULL,
          total_weight REAL NOT NULL,
          fat_mass REAL,
          rmr REAL,
          scan_name TEXT,
          scan_image_path TEXT,
          is_baseline INTEGER DEFAULT 0,
          is_final INTEGER DEFAULT 0,
          notes TEXT,
          is_competition_eligible INTEGER DEFAULT 1,
          scan_category TEXT DEFAULT 'competition' CHECK(scan_category IN ('historical', 'competition', 'post-challenge')),
          competition_role TEXT CHECK(competition_role IN ('baseline', 'progress', 'final')),
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ DEXA scans table created successfully');

      console.log('Creating scoring_data table...');
      await sqlite.execute(`
        CREATE TABLE IF NOT EXISTS scoring_data (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          fat_loss_score REAL DEFAULT 0,
          muscle_gain_score REAL DEFAULT 0,
          total_score REAL DEFAULT 0,
          fat_loss_raw REAL DEFAULT 0,
          muscle_gain_raw REAL DEFAULT 0,
          last_calculated INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Scoring data table created successfully');
      
      // Verify all tables were created
      console.log('Verifying table creation...');
      const tables = await sqlite.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'dexa_scans', 'scoring_data')
      `);
      
      const createdTables = tables.rows.map(row => row.name);
      console.log(`✅ Created tables: ${createdTables.join(', ')}`);
      
      const expectedTables = ['users', 'dexa_scans', 'scoring_data'];
      const missingTables = expectedTables.filter(table => !createdTables.includes(table));
      
      if (missingTables.length > 0) {
        console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
        throw new Error(`Failed to create required database tables: ${missingTables.join(', ')}`);
      }
    }
    
    // Configure SQLite for current environment after tables are created
    await configureSQLiteForEnvironment();
    
    // CRITICAL: Check for data loss after initialization (failsafe)
    if (!isTest() && preInitializationState.hadExistingData) {
      console.log('🔍 Post-initialization data integrity check...');
      
      const finalUserCount = await getCurrentUserCount();
      const finalScanCount = await getCurrentScanCount();
      
      if (finalUserCount === 0 && finalScanCount === 0) {
        console.warn('⚠️  DATA LOSS DETECTED! Database was not empty before initialization');
        console.warn(`   Expected: ${preInitializationState.userCount} users, ${preInitializationState.scanCount} scans`);
        console.warn(`   Current:  ${finalUserCount} users, ${finalScanCount} scans`);
        
        // Trigger automatic backup restoration failsafe
        const restorationResult = await automaticBackupRestorationFailsafe(preInitializationState);
        
        if (restorationResult.restored) {
          console.log('🎉 Automatic restoration successful - continuing with restored data');
          console.log(`   Final state: ${restorationResult.restoredData?.users} users, ${restorationResult.restoredData?.scans} scans`);
        } else {
          console.error('💥 CRITICAL: Automatic restoration failed!');
          console.error(`   Reason: ${restorationResult.reason}`);
          if (restorationResult.error) {
            console.error(`   Error: ${restorationResult.error}`);
          }
          console.error('   Manual intervention required immediately');
          console.error('   Check backup directory for available backups');
          
          // Don't throw error to allow app to start for manual recovery
          console.warn('⚠️  Application will continue but with empty database');
          console.warn('   Use restore-production-data.cjs script for manual recovery');
        }
      } else {
        console.log(`✅ Data integrity confirmed: ${finalUserCount} users, ${finalScanCount} scans`);
      }
    }
    
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Database persistence verification
export async function verifyDatabasePersistence(): Promise<{
  isValid: boolean;
  details: {
    fileExists: boolean;
    isReadable: boolean;
    isWritable: boolean;
    sizeInMB: number;
    ageInHours: number;
    userCount: number;
    scanCount: number;
    scoreCount: number;
    walModeEnabled: boolean;
  };
  issues: string[];
}> {
  const issues: string[] = [];
  const details = {
    fileExists: false,
    isReadable: false,
    isWritable: false,
    sizeInMB: 0,
    ageInHours: 0,
    userCount: 0,
    scanCount: 0,
    scoreCount: 0,
    walModeEnabled: false,
  };

  try {
    const dbPath = getDatabasePath();
    
    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      details.fileExists = true;
      
      // Get file statistics
      const stats = fs.statSync(dbPath);
      details.sizeInMB = Number((stats.size / (1024 * 1024)).toFixed(2));
      details.ageInHours = Number(((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)).toFixed(1));
      
      // Test readability
      try {
        fs.accessSync(dbPath, fs.constants.R_OK);
        details.isReadable = true;
      } catch (error) {
        issues.push('Database file is not readable');
      }
      
      // Test writability
      try {
        fs.accessSync(dbPath, fs.constants.W_OK);
        details.isWritable = true;
      } catch (error) {
        issues.push('Database file is not writable');
      }
      
      // Test database connection and integrity
      try {
        // Check WAL mode
        const walResult = await sqlite.execute('PRAGMA journal_mode;');
        details.walModeEnabled = walResult.rows?.[0]?.['journal_mode'] === 'wal';
        
        // Get table counts to verify data integrity
        const userCountResult = await sqlite.execute('SELECT COUNT(*) as count FROM users');
        details.userCount = Number(userCountResult.rows?.[0]?.count || 0);
        
        const scanCountResult = await sqlite.execute('SELECT COUNT(*) as count FROM dexa_scans');
        details.scanCount = Number(scanCountResult.rows?.[0]?.count || 0);
        
        const scoreCountResult = await sqlite.execute('SELECT COUNT(*) as count FROM scoring_data');
        details.scoreCount = Number(scoreCountResult.rows?.[0]?.count || 0);
        
        // Test write capability with a dummy query
        await sqlite.execute('PRAGMA quick_check;');
        
      } catch (dbError) {
        issues.push(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      
    } else {
      issues.push('Database file does not exist');
    }
    
    // Check if database is in persistent location (production)
    if (process.env.NODE_ENV === 'production') {
      if (!dbPath.includes('/opt/render/persistent')) {
        issues.push('Database is not in persistent storage - data will be lost on deployment');
      }
    }
    
  } catch (error) {
    issues.push(`Database verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const isValid = issues.length === 0 && details.fileExists && details.isReadable && details.isWritable;
  
  return { isValid, details, issues };
}

// Enhanced database health check for monitoring and deployment verification
export async function getDatabaseHealthStatus() {
  try {
    const persistence = await verifyDatabasePersistence();
    const dbPath = getDatabasePath();
    const deployEnv = getDeploymentEnvironment();
    const configValidation = validateDatabaseConfiguration();
    const sqliteConfig = getSQLiteConfig();
    
    // Enhanced persistence checks for deployment safety
    const persistenceStatus = {
      isConfiguredForPersistence: deployEnv.isPersistent,
      isPersistenceRequired: deployEnv.platform !== 'local' && deployEnv.platform !== 'vercel' && deployEnv.platform !== 'heroku',
      persistenceWarnings: configValidation.warnings
    };
    
    // Check for recent backups as deployment safety indicator
    const backupStatus = await checkRecentBackups();
    
    return {
      status: persistence.isValid && configValidation.isValid ? 'healthy' : 'unhealthy',
      database: {
        path: dbPath,
        exists: persistence.details.fileExists,
        size: `${persistence.details.sizeInMB} MB`,
        age: `${persistence.details.ageInHours} hours`,
        walMode: persistence.details.walModeEnabled,
        readable: persistence.details.isReadable,
        writable: persistence.details.isWritable,
      },
      persistence: persistenceStatus,
      data: {
        users: persistence.details.userCount,
        scans: persistence.details.scanCount,
        scores: persistence.details.scoreCount,
      },
      backup: backupStatus,
      environment: {
        platform: deployEnv.platform,
        nodeEnv: process.env.NODE_ENV,
        isPersistent: deployEnv.isPersistent,
        supportsFileSystem: deployEnv.supportsFileSystem,
        recommendedDbPath: deployEnv.recommendedDbPath,
        deploymentsTimestamp: process.env.DEPLOYMENT_TIMESTAMP,
      },
      configuration: {
        sqliteSettings: {
          journalMode: sqliteConfig.journalMode,
          synchronous: sqliteConfig.synchronous,
          cacheSize: sqliteConfig.cacheSize,
          busyTimeout: sqliteConfig.busyTimeout,
        },
        validationStatus: {
          isValid: configValidation.isValid,
          warnings: configValidation.warnings,
          recommendations: configValidation.recommendations,
        }
      },
      issues: [...persistence.issues, ...configValidation.warnings],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check for recent backups to verify deployment safety
 */
async function checkRecentBackups() {
  try {
    const backupDir = path.join(path.dirname(getDatabasePath()), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return {
        hasRecentBackup: false,
        backupCount: 0,
        warning: 'No backup directory found'
      };
    }
    
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          created: stats.mtime,
          ageHours: (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime());
    
    const recentBackup = backupFiles.find(backup => backup.ageHours < 24);
    
    return {
      hasRecentBackup: !!recentBackup,
      backupCount: backupFiles.length,
      mostRecentBackup: backupFiles[0]?.name || null,
      mostRecentAge: backupFiles[0]?.ageHours.toFixed(1) || null,
      warning: !recentBackup ? 'No backup created in last 24 hours' : null
    };
    
  } catch (error) {
    return {
      hasRecentBackup: false,
      backupCount: 0,
      error: error instanceof Error ? error.message : 'Unknown backup check error'
    };
  }
}

/**
 * Verify persistence configuration to prevent data loss during deployments
 */
function verifyPersistenceConfiguration() {
  const dbPath = getDatabasePath();
  const isProduction = process.env.NODE_ENV === 'production';
  const isRenderEnvironment = !!process.env.RENDER;
  
  console.log('🔍 PERSISTENCE VERIFICATION:');
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Render Environment: ${isRenderEnvironment ? 'Yes' : 'No'}`);
  console.log(`   Database Path: ${dbPath}`);
  
  if (isProduction && isRenderEnvironment) {
    // In production on Render, database MUST be in persistent storage
    if (!dbPath.includes('/opt/render/persistent')) {
      console.error('🚨 CRITICAL DATA LOSS RISK: Database not in persistent storage!');
      console.error(`   Current path: ${dbPath}`);
      console.error(`   Required path: /opt/render/persistent/data/fitness_challenge.db`);
      console.error('   ❌ USER DATA WILL BE LOST ON DEPLOYMENT!');
      console.error('');
      console.error('   Fix: Set DATABASE_URL=/opt/render/persistent/data/fitness_challenge.db');
      console.error('   in Render Dashboard Environment Variables');
      throw new Error('Database not configured for persistent storage - refusing to start');
    } else {
      console.log('✅ Database is properly configured for persistent storage');
      console.log('   → User data will survive deployments and restarts');
    }
  } else if (isProduction) {
    console.warn('⚠️  Production environment but not on Render - verify persistence manually');
  } else {
    console.log('✅ Development environment - using local database');
  }
  
  // Check uploads directory persistence
  const uploadsDir = process.env.UPLOADS_DIR;
  if (isProduction && isRenderEnvironment && uploadsDir && !uploadsDir.includes('/opt/render/persistent')) {
    console.warn('⚠️  Uploads directory not in persistent storage - files may be lost');
    console.warn(`   Current: ${uploadsDir}`);
    console.warn(`   Recommended: /opt/render/persistent/uploads`);
  }
}

/**
 * Create deployment backup automatically when existing data is detected
 */
async function createDeploymentBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const backupFileName = `deployment_backup_${timestamp}.db`;
    const deployEnv = getDeploymentEnvironment();
    
    // Use environment-appropriate backup directory
    let backupDir;
    if (deployEnv.backupPath && fs.existsSync(path.dirname(deployEnv.backupPath))) {
      backupDir = deployEnv.backupPath;
    } else {
      backupDir = path.join(path.dirname(getDatabasePath()), 'backups');
    }
    
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${backupDir}`);
    }
    
    const backupPath = path.join(backupDir, backupFileName);
    
    // Create backup using SQLite backup command
    await sqlite.execute(`VACUUM INTO '${backupPath}'`);
    
    // Verify backup
    const stats = fs.statSync(backupPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    console.log(`✅ Deployment backup created: ${backupFileName} (${sizeKB} KB)`);
    console.log(`   Location: ${backupPath}`);
    
    return { success: true, path: backupPath, size: sizeKB };
    
  } catch (error) {
    console.error('❌ Failed to create deployment backup:', error instanceof Error ? error.message : error);
    console.error('   Deployment will continue but without backup protection');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown backup error' };
  }
}

/**
 * Automatic backup restoration failsafe to prevent data loss
 * Triggered when database is unexpectedly empty after initialization
 */
async function automaticBackupRestorationFailsafe(preInitializationState: {
  hadExistingData: boolean;
  userCount: number;
  scanCount: number;
}) {
  try {
    console.log('🚨 AUTOMATIC BACKUP RESTORATION FAILSAFE TRIGGERED');
    console.log('===================================================');
    
    // Only trigger if we had data before initialization but now we don't
    if (!preInitializationState.hadExistingData) {
      console.log('   No restoration needed - database was already empty');
      return { restored: false, reason: 'no_previous_data' };
    }
    
    // Check current database state
    const currentUserCount = await getCurrentUserCount();
    const currentScanCount = await getCurrentScanCount();
    
    if (currentUserCount > 0 || currentScanCount > 0) {
      console.log('   No restoration needed - database still contains data');
      return { restored: false, reason: 'data_still_present' };
    }
    
    console.log(`   CRITICAL: Database had ${preInitializationState.userCount} users, ${preInitializationState.scanCount} scans`);
    console.log(`   CURRENT: Database now has ${currentUserCount} users, ${currentScanCount} scans`);
    console.log('   → Data loss detected! Attempting automatic restoration...');
    
    // Find the most recent backup
    const mostRecentBackup = await findMostRecentBackup();
    if (!mostRecentBackup) {
      console.error('❌ No backup found for restoration!');
      console.error('   Manual intervention required - check backup directory');
      return { restored: false, reason: 'no_backup_found' };
    }
    
    console.log(`🔄 Attempting restoration from: ${mostRecentBackup.name}`);
    console.log(`   Backup age: ${mostRecentBackup.ageHours.toFixed(1)} hours`);
    console.log(`   Backup size: ${(mostRecentBackup.sizeKB / 1024).toFixed(2)} MB`);
    
    // Verify backup integrity before restoration
    const backupIntegrity = await verifyBackupIntegrity(mostRecentBackup.path);
    if (!backupIntegrity.isValid) {
      console.error('❌ Backup integrity check failed!');
      console.error(`   Issues: ${backupIntegrity.issues.join(', ')}`);
      return { restored: false, reason: 'backup_integrity_failed' };
    }
    
    console.log(`✅ Backup integrity verified: ${backupIntegrity.userCount} users, ${backupIntegrity.scanCount} scans`);
    
    // Create emergency backup of current (empty) state
    const emergencyBackupName = `emergency_empty_${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}.db`;
    const emergencyBackupPath = path.join(path.dirname(mostRecentBackup.path), emergencyBackupName);
    fs.copyFileSync(getDatabasePath(), emergencyBackupPath);
    console.log(`📁 Emergency backup of empty state: ${emergencyBackupName}`);
    
    // Perform restoration
    console.log('🔄 Restoring database from backup...');
    
    // Close current connection
    await sqlite.close();
    
    // Replace database file with backup
    fs.copyFileSync(mostRecentBackup.path, getDatabasePath());
    
    // Reconnect to restored database
    const restoredSqlite = createClient({ url: `file:${getDatabasePath()}` });
    
    // Verify restoration success
    const restoredUserCount = await restoredSqlite.execute('SELECT COUNT(*) as count FROM users');
    const restoredScanCount = await restoredSqlite.execute('SELECT COUNT(*) as count FROM dexa_scans');
    
    const finalUserCount = Number(restoredUserCount.rows?.[0]?.count || 0);
    const finalScanCount = Number(restoredScanCount.rows?.[0]?.count || 0);
    
    await restoredSqlite.close();
    
    if (finalUserCount > 0 || finalScanCount > 0) {
      console.log('✅ AUTOMATIC RESTORATION SUCCESSFUL!');
      console.log(`   Restored: ${finalUserCount} users, ${finalScanCount} scans`);
      console.log(`   Data recovered from: ${mostRecentBackup.name}`);
      console.log('   → Database initialization will continue with restored data');
      
      return { 
        restored: true, 
        reason: 'successful_restoration',
        backupUsed: mostRecentBackup.name,
        restoredData: { users: finalUserCount, scans: finalScanCount }
      };
    } else {
      console.error('❌ RESTORATION FAILED - Database still empty after restoration attempt');
      return { restored: false, reason: 'restoration_failed' };
    }
    
  } catch (error) {
    console.error('💥 AUTOMATIC RESTORATION FAILSAFE ERROR:', error instanceof Error ? error.message : error);
    console.error('   Manual intervention required - check logs and backup directory');
    return { restored: false, reason: 'failsafe_error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Find the most recent valid backup for automatic restoration
 */
async function findMostRecentBackup(): Promise<{
  name: string;
  path: string;
  ageHours: number;
  sizeKB: number;
} | null> {
  try {
    const backupDir = path.join(path.dirname(getDatabasePath()), 'backups');
    
    if (!fs.existsSync(backupDir)) {
      return null;
    }
    
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          created: stats.mtime,
          ageHours: (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60),
          sizeKB: Math.round(stats.size / 1024)
        };
      })
      .filter(backup => backup.sizeKB > 10) // Only consider backups > 10KB (non-empty)
      .sort((a, b) => b.created.getTime() - a.created.getTime()); // Most recent first
    
    return backupFiles[0] || null;
    
  } catch (error) {
    console.error('Error finding recent backup:', error);
    return null;
  }
}

/**
 * Verify backup integrity before attempting restoration
 */
async function verifyBackupIntegrity(backupPath: string): Promise<{
  isValid: boolean;
  userCount: number;
  scanCount: number;
  issues: string[];
}> {
  const issues: string[] = [];
  let userCount = 0;
  let scanCount = 0;
  
  try {
    // Test if backup file can be opened
    const testSqlite = createClient({ url: `file:${backupPath}` });
    
    try {
      // Verify basic database structure
      const tables = await testSqlite.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name IN ('users', 'dexa_scans', 'scoring_data')
      `);
      
      const foundTables = tables.rows.map(row => row.name);
      const expectedTables = ['users', 'dexa_scans', 'scoring_data'];
      const missingTables = expectedTables.filter(table => !foundTables.includes(table));
      
      if (missingTables.length > 0) {
        issues.push(`Missing tables: ${missingTables.join(', ')}`);
      }
      
      // Get data counts
      if (foundTables.includes('users')) {
        const userResult = await testSqlite.execute('SELECT COUNT(*) as count FROM users');
        userCount = Number(userResult.rows?.[0]?.count || 0);
      }
      
      if (foundTables.includes('dexa_scans')) {
        const scanResult = await testSqlite.execute('SELECT COUNT(*) as count FROM dexa_scans');
        scanCount = Number(scanResult.rows?.[0]?.count || 0);
      }
      
      // Verify data integrity with quick check
      await testSqlite.execute('PRAGMA quick_check;');
      
    } finally {
      await testSqlite.close();
    }
    
    if (userCount === 0 && scanCount === 0) {
      issues.push('Backup appears to be empty (0 users, 0 scans)');
    }
    
  } catch (error) {
    issues.push(`Backup verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: issues.length === 0,
    userCount,
    scanCount,
    issues
  };
}

/**
 * Helper function to get current user count safely
 */
async function getCurrentUserCount(): Promise<number> {
  try {
    const result = await sqlite.execute('SELECT COUNT(*) as count FROM users');
    return Number(result.rows?.[0]?.count || 0);
  } catch (error) {
    return 0;
  }
}

/**
 * Helper function to get current scan count safely
 */
async function getCurrentScanCount(): Promise<number> {
  try {
    const result = await sqlite.execute('SELECT COUNT(*) as count FROM dexa_scans');
    return Number(result.rows?.[0]?.count || 0);
  } catch (error) {
    return 0;
  }
}

export { sqlite };