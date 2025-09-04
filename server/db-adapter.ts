import { getConfig } from './config.js';

let dbInstance: any = null;
let dbType: 'sqlite' | 'postgres' = 'sqlite';

/**
 * Database adapter that automatically selects between SQLite and PostgreSQL
 * based on environment configuration
 */
export async function getDatabase() {
  if (dbInstance) {
    return { db: dbInstance, type: dbType };
  }

  const config = getConfig();
  const databaseUrl = config.DATABASE_URL;
  const platform = process.env.PLATFORM;
  
  // Detect database type from URL or platform
  const isPostgres = 
    (databaseUrl && (databaseUrl.includes('postgres') || databaseUrl.includes('postgresql'))) ||
    platform === 'railway' ||
    process.env.RAILWAY_ENVIRONMENT;

  console.log('🔍 Database Detection:');
  console.log(`   Platform: ${platform || 'not set'}`);
  console.log(`   Database URL pattern: ${databaseUrl ? (isPostgres ? 'PostgreSQL' : 'SQLite') : 'not set'}`);
  console.log(`   Selected: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

  try {
    if (isPostgres) {
      // Use PostgreSQL for Railway
      console.log('🐘 Initializing PostgreSQL connection...');
      const { createPostgresDatabase, initializeDatabase } = await import('./db-postgres.js');
      
      if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for PostgreSQL');
      }
      
      dbInstance = createPostgresDatabase(databaseUrl);
      dbType = 'postgres';
      
      // Initialize database schema if needed
      await initializeDatabase(dbInstance);
      
    } else {
      // Use SQLite for local/Render
      console.log('🗄️ Initializing SQLite connection...');
      const sqliteModule = await import('./db.js');
      
      dbInstance = sqliteModule.db;
      dbType = 'sqlite';
      
      // Initialize SQLite database if needed
      if (sqliteModule.initializeDatabase) {
        await sqliteModule.initializeDatabase();
      }
    }
    
    console.log(`✅ Database adapter initialized (${dbType})`);
    return { db: dbInstance, type: dbType };
    
  } catch (error) {
    console.error('❌ Failed to initialize database adapter:', error);
    
    // Fallback to SQLite if PostgreSQL fails
    if (isPostgres) {
      console.log('⚠️  Falling back to SQLite...');
      try {
        const sqliteModule = await import('./db.js');
        dbInstance = sqliteModule.db;
        dbType = 'sqlite';
        
        if (sqliteModule.initializeDatabase) {
          await sqliteModule.initializeDatabase();
        }
        
        console.log('✅ Fallback to SQLite successful');
        return { db: dbInstance, type: dbType };
      } catch (fallbackError) {
        console.error('❌ SQLite fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

// Export convenience function to get just the database instance
export async function getDb() {
  const { db } = await getDatabase();
  return db;
}

// Export function to get database type
export async function getDatabaseType(): Promise<'sqlite' | 'postgres'> {
  const { type } = await getDatabase();
  return type;
}

// Reset database instance (useful for testing)
export function resetDatabaseInstance() {
  dbInstance = null;
  dbType = 'sqlite';
}