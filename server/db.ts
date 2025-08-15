import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Create SQLite database file
const sqlite = new Database('fitness_challenge.db');

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export const db = drizzle(sqlite, { schema });

// Initialize tables - SQLite will create them automatically with Drizzle
console.log('Database initialized with SQLite');

export { sqlite };