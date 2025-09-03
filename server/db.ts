import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from "../shared/schema";
import { getDatabasePath, isTest } from './config';
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
  url: `file:${databasePath}`
});

export const db = drizzle(sqlite, { schema });

// Initialize database tables
export async function initializeDatabase() {
  try {
    if (!isTest()) {
      console.log(`Initializing database at: ${databasePath}`);
    }
    
    // Check if migrations directory exists, if not create tables directly
    const migrationsPath = path.join(process.cwd(), 'migrations');
    
    if (fs.existsSync(migrationsPath) && fs.readdirSync(migrationsPath).length > 0) {
      // Use migrations if available
      console.log('Running database migrations...');
      migrate(db, { migrationsFolder: migrationsPath });
    } else {
      // Create tables directly from schema
      console.log('Creating tables directly from schema...');
      
      // Create tables using raw SQL since Drizzle doesn't auto-create in SQLite
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
          is_final INTEGER DEFAULT 0,
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
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

export { sqlite };