// Test database utilities for isolated testing
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import path from 'path';
import fs from 'fs';

export interface TestDbInstance {
  db: ReturnType<typeof drizzle>;
  sqlite: Database.Database;
  cleanup: () => void;
}

export function createTestDb(): TestDbInstance {
  // Create unique test database for each test
  const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const testDbPath = path.join(process.cwd(), '__tests__', 'data', `${testId}.db`);
  
  // Ensure directory exists
  const testDbDir = path.dirname(testDbPath);
  if (!fs.existsSync(testDbDir)) {
    fs.mkdirSync(testDbDir, { recursive: true });
  }
  
  // Create SQLite instance
  const sqlite = new Database(testDbPath);
  sqlite.pragma('journal_mode = WAL');
  
  // Create Drizzle instance
  const db = drizzle(sqlite, { schema });
  
  // Initialize tables
  initializeTables(sqlite);
  
  return {
    db,
    sqlite,
    cleanup: () => {
      try {
        sqlite.close();
        if (fs.existsSync(testDbPath)) {
          fs.unlinkSync(testDbPath);
        }
      } catch (error) {
        console.warn(`Failed to cleanup test database ${testDbPath}:`, error);
      }
    }
  };
}

function initializeTables(sqlite: Database.Database) {
  // Create tables using the same SQL as the main application
  sqlite.exec(`
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
    );

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
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

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
    );
  `);
}

export async function createTestUser(db: any, userData: Partial<any> = {}) {
  const testUser = {
    id: `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username: `testuser_${Date.now()}`,
    password: 'hashedpassword123',
    name: 'Test User',
    gender: 'male' as const,
    height: '6ft',
    startingWeight: 180,
    targetBodyFatPercent: 15,
    targetLeanMass: 140,
    isActive: true,
    ...userData
  };
  
  const [user] = await db.insert(schema.users).values(testUser).returning();
  return user;
}

export async function createTestDexaScan(db: any, userId: string, scanData: Partial<any> = {}) {
  const testScan = {
    id: `test-scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    scanDate: new Date(),
    bodyFatPercent: 20.5,
    leanMass: 130.0,
    totalWeight: 175.0,
    fatMass: 35.0,
    rmr: 1650,
    isBaseline: false,
    ...scanData
  };
  
  const [scan] = await db.insert(schema.dexaScans).values(testScan).returning();
  return scan;
}