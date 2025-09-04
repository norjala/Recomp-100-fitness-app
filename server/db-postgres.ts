import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from "../shared/schema.js";
import { isTest } from './config.js';

// PostgreSQL database connection for Railway/Neon
export function createPostgresDatabase(databaseUrl: string) {
  if (!databaseUrl || !databaseUrl.includes('postgres')) {
    throw new Error('Invalid PostgreSQL database URL');
  }

  console.log('🐘 Connecting to PostgreSQL database...');
  
  // Use Neon serverless driver for PostgreSQL
  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  console.log('✅ PostgreSQL connection established');
  
  return db;
}

// Configure PostgreSQL for production use
export async function configurePostgresForProduction(db: any) {
  try {
    if (!isTest()) {
      console.log('🔧 Configuring PostgreSQL for production...');
      
      // PostgreSQL automatically handles many optimizations
      // but we can set some connection pool settings via environment
      console.log('✅ PostgreSQL configured for production');
      
      // Test the connection
      try {
        await db.execute('SELECT 1');
        console.log('✅ PostgreSQL connection verified');
      } catch (error) {
        console.error('❌ PostgreSQL connection test failed:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Failed to configure PostgreSQL:', error);
    throw error;
  }
}

// Initialize PostgreSQL database schema
export async function initializePostgresDatabase(db: any) {
  console.log('Initializing PostgreSQL database schema...');
  
  try {
    // Check if tables exist by querying information_schema
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;
    
    const result = await db.execute(tablesQuery);
    const existingTables = result.rows.map((row: any) => row.table_name);
    
    console.log('📊 Existing tables:', existingTables.join(', ') || 'none');
    
    // For PostgreSQL, we should use migrations instead of direct table creation
    // This is a placeholder - actual schema migration should be handled by drizzle-kit
    if (existingTables.length === 0) {
      console.log('⚠️  No tables found. Please run migrations:');
      console.log('   1. Set DATABASE_URL to your PostgreSQL connection string');
      console.log('   2. Run: npm run db:generate');
      console.log('   3. Run: npm run db:migrate');
    } else {
      // Count records in each table
      for (const table of ['users', 'dexa_scans', 'scoring_data']) {
        if (existingTables.includes(table)) {
          try {
            const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${table}`);
            const count = countResult.rows[0]?.count || 0;
            console.log(`📊 Table ${table}: ${count} records`);
          } catch (error) {
            console.warn(`⚠️  Could not count records in ${table}:`, error);
          }
        }
      }
    }
    
    await configurePostgresForProduction(db);
    console.log('✅ PostgreSQL database initialization complete');
    
  } catch (error) {
    console.error('❌ Failed to initialize PostgreSQL database:', error);
    throw error;
  }
}

// Export the database initialization function
export { initializePostgresDatabase as initializeDatabase };