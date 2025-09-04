import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from "../shared/schema.js";
import { getDatabasePath, isTest } from './config.js';
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

// Configure SQLite for production use
async function configureSQLiteForProduction() {
  try {
    if (!isTest()) {
      console.log('🔧 Configuring SQLite for production...');
      
      // Enable WAL mode for better concurrent access
      await sqlite.execute('PRAGMA journal_mode=WAL;');
      console.log('✅ Enabled WAL mode for better concurrency');
      
      // Set optimized SQLite settings for production
      await sqlite.execute('PRAGMA synchronous=NORMAL;'); // Balance between safety and performance
      await sqlite.execute('PRAGMA cache_size=10000;'); // 10MB cache
      await sqlite.execute('PRAGMA temp_store=memory;'); // Use memory for temp tables
      await sqlite.execute('PRAGMA mmap_size=268435456;'); // 256MB memory mapping
      await sqlite.execute('PRAGMA optimize;'); // Enable query optimizer
      
      console.log('✅ Applied production SQLite optimizations');
      
      // Verify WAL mode is enabled
      const result = await sqlite.execute('PRAGMA journal_mode;');
      if (result.rows && result.rows[0] && result.rows[0]['journal_mode'] === 'wal') {
        console.log('✅ WAL mode confirmed active');
      } else {
        console.warn('⚠️  WAL mode may not be active');
      }
    }
  } catch (error) {
    console.error('❌ Failed to configure SQLite for production:', error);
    // Don't throw - allow app to continue with default settings
  }
}

// Initialize database tables
export async function initializeDatabase() {
  try {
    if (!isTest()) {
      console.log(`Initializing database at: ${databasePath}`);
      
      // Check if database file exists and has content
      if (fs.existsSync(databasePath)) {
        const stats = fs.statSync(databasePath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        if (stats.size > 0) {
          console.log(`✅ Using existing database (${sizeInMB} MB)`);
          
          // Check if tables exist
          try {
            const result = await sqlite.execute(`
              SELECT name FROM sqlite_master 
              WHERE type='table' AND name IN ('users', 'dexa_scans', 'scoring_data')
            `);
            
            if (result.rows && result.rows.length > 0) {
              console.log(`✅ Found existing tables: ${result.rows.map(r => r.name).join(', ')}`);
              
              // Get user count
              const userCount = await sqlite.execute(`SELECT COUNT(*) as count FROM users`);
              const scanCount = await sqlite.execute(`SELECT COUNT(*) as count FROM dexa_scans`);
              console.log(`📊 Database contains ${userCount.rows[0].count} users and ${scanCount.rows[0].count} scans`);
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
    
    // Configure SQLite for production after tables are created
    await configureSQLiteForProduction();
    
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

// Enhanced database health check for monitoring
export async function getDatabaseHealthStatus() {
  try {
    const persistence = await verifyDatabasePersistence();
    const dbPath = getDatabasePath();
    
    return {
      status: persistence.isValid ? 'healthy' : 'unhealthy',
      database: {
        path: dbPath,
        exists: persistence.details.fileExists,
        size: `${persistence.details.sizeInMB} MB`,
        age: `${persistence.details.ageInHours} hours`,
        walMode: persistence.details.walModeEnabled,
        readable: persistence.details.isReadable,
        writable: persistence.details.isWritable,
      },
      data: {
        users: persistence.details.userCount,
        scans: persistence.details.scanCount,
        scores: persistence.details.scoreCount,
      },
      issues: persistence.issues,
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

export { sqlite };