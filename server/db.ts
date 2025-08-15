import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Create SQLite database file
const sqlite = new Database('fitness_challenge.db');

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

// Initialize tables if they don't exist
try {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      name TEXT,
      gender TEXT,
      height REAL,
      starting_weight REAL,
      target_body_fat_percent REAL,
      target_lean_mass REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_admin BOOLEAN DEFAULT FALSE
    )
  `);

  // Create dexa_scans table
  db.run(`
    CREATE TABLE IF NOT EXISTS dexa_scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      body_fat_percentage REAL,
      muscle_mass REAL,
      bone_density REAL,
      visceral_fat REAL,
      total_weight REAL,
      image_url TEXT,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Create admin user if it doesn't exist
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('Jaron');
  if (!adminExists) {
    db.prepare(`
      INSERT INTO users (username, password, email, is_admin) 
      VALUES (?, ?, ?, ?)
    `).run('Jaron', 'password123', 'admin@fitness.com', true);
  }

  console.log('Database initialized successfully');
} catch (error) {
  console.error('Database initialization error:', error);
}