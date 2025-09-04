#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚂 Railway Platform Startup Script');
console.log('===================================');

// Railway environment detection
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.PLATFORM === 'railway';
const port = process.env.PORT || 3000;

console.log(`📍 Platform: ${isRailway ? 'Railway' : 'Unknown'}`);
console.log(`🔌 Port: ${port}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Check for PostgreSQL database on Railway
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.includes('postgres') || dbUrl.includes('postgresql');

console.log(`💾 Database Type: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);
if (dbUrl) {
  const sanitizedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`📊 Database URL: ${sanitizedUrl.substring(0, 50)}...`);
}

// For Railway with PostgreSQL, we don't need to create local directories
// For local SQLite fallback, ensure directories exist
if (!isPostgres) {
  const directories = [
    process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
    path.dirname(process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'fitness_challenge.db'))
  ];

  console.log('\n📁 Creating local directories for SQLite...');
  
  for (const dir of directories) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      } else {
        console.log(`✅ Directory exists: ${dir}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error.message);
      // Don't exit on Railway - directories might not be needed
      if (!isRailway) {
        process.exit(1);
      }
    }
  }
}

// Check if the built server exists
const serverPath = path.join(process.cwd(), 'dist/server/index.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ Built server not found at dist/server/index.js');
  console.error('   Please run "npm run build" first');
  process.exit(1);
}

console.log('\n🚀 Starting production server...');
console.log(`📍 Server path: ${serverPath}`);

// Start the compiled JavaScript application
const { spawn } = require('child_process');
const child = spawn('node', [serverPath], {
  stdio: 'inherit',
  env: { 
    ...process.env,
    NODE_ENV: 'production',
    PLATFORM: isRailway ? 'railway' : 'local',
    PORT: port
  }
});

child.on('exit', (code) => {
  console.log(`💤 Server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📴 Received SIGINT, shutting down gracefully...');
  child.kill('SIGINT');
});