#!/usr/bin/env node

/**
 * Production database migration script for Render deployment
 * Ensures database schema is updated with latest changes
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔄 PHASE: Database Schema Migration');
console.log('=====================================');

// Get database path from environment
const databaseUrl = process.env.DATABASE_URL || './data/fitness_challenge.db';
const dbDir = path.dirname(databaseUrl);

console.log(`📊 Database URL: ${databaseUrl}`);
console.log(`📁 Database directory: ${dbDir}`);

// Ensure database directory exists
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✅ Created database directory: ${dbDir}`);
  } else {
    console.log(`✅ Database directory exists: ${dbDir}`);
  }
} catch (error) {
  console.error(`❌ Failed to create database directory: ${error.message}`);
  process.exit(1);
}

// Check if database file exists
const dbExists = fs.existsSync(databaseUrl);
console.log(`📋 Database exists: ${dbExists ? 'YES' : 'NO'}`);

if (dbExists) {
  const stats = fs.statSync(databaseUrl);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`📊 Database size: ${sizeInMB} MB`);
}

// Run database migration
console.log('\n🚀 Running database schema migration...');
console.log('Command: npm run db:push');

const migrationProcess = spawn('npm', ['run', 'db:push'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  }
});

migrationProcess.on('error', (error) => {
  console.error(`❌ Migration process error: ${error.message}`);
  process.exit(1);
});

migrationProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Database schema migration completed successfully!');
    
    // Verify database after migration
    if (fs.existsSync(databaseUrl)) {
      const postStats = fs.statSync(databaseUrl);
      const postSizeInMB = (postStats.size / (1024 * 1024)).toFixed(2);
      console.log(`📊 Post-migration database size: ${postSizeInMB} MB`);
    }
    
    console.log('🎯 Ready for application startup');
    process.exit(0);
  } else {
    console.error(`❌ Database migration failed with exit code ${code}`);
    process.exit(code);
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('\n📴 Received SIGTERM, terminating migration...');
  migrationProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('\n📴 Received SIGINT, terminating migration...');
  migrationProcess.kill('SIGINT');
});