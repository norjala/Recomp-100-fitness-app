import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

// Default database URL for development
const defaultDatabaseUrl = 'postgresql://localhost:5432/fitness_challenge';

const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Please set up a PostgreSQL database.",
  );
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export const db = drizzle(pool, { schema });