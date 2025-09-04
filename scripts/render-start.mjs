#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// === ENVIRONMENT VARIABLES VERIFICATION ===
console.log('🔍 PHASE 1: Environment Variables Verification');
console.log('================================================');

// Critical environment variables that MUST be set for production
const CRITICAL_ENV_VARS = {
  'DATABASE_URL': 'Database file location (must use /opt/render/persistent for persistence)',
  'UPLOADS_DIR': 'Upload directory location (must use /opt/render/persistent for persistence)',
  'SESSION_SECRET': 'Session security key (must be 32+ characters)',
  'OPENAI_API_KEY': 'OpenAI API key for DEXA scan extraction',
  'NODE_ENV': 'Environment (should be "production")'
};

// Important but optional environment variables
const IMPORTANT_ENV_VARS = {
  'ADMIN_USERNAMES': 'Admin user access control',
  'COMPETITION_START_DATE': 'Competition start date',
  'COMPETITION_END_DATE': 'Competition end date'
};

let hasError = false;
let hasWarning = false;

// Check critical environment variables
console.log('🔴 CRITICAL Environment Variables:');
for (const [envVar, description] of Object.entries(CRITICAL_ENV_VARS)) {
  const value = process.env[envVar];
  if (!value) {
    console.error(`❌ MISSING: ${envVar} - ${description}`);
    hasError = true;
  } else {
    // Validate specific requirements
    let valid = true;
    let issue = '';
    
    if (envVar === 'DATABASE_URL') {
      if (!value.includes('/opt/render/persistent') && process.env.NODE_ENV === 'production') {
        issue = '⚠️  Not using persistent storage - data will be lost on deployment';
        hasWarning = true;
      }
    } else if (envVar === 'UPLOADS_DIR') {
      if (!value.includes('/opt/render/persistent') && process.env.NODE_ENV === 'production') {
        issue = '⚠️  Not using persistent storage - uploads will be lost on deployment';
        hasWarning = true;
      }
    } else if (envVar === 'SESSION_SECRET') {
      if (value.length < 32) {
        issue = '❌ Too short (must be 32+ characters for security)';
        valid = false;
        hasError = true;
      }
    }
    
    if (valid) {
      console.log(`✅ ${envVar}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      if (issue) console.warn(`   ${issue}`);
    } else {
      console.error(`❌ ${envVar}: ${issue}`);
    }
  }
}

// Check important environment variables
console.log('\n🟡 IMPORTANT Environment Variables:');
for (const [envVar, description] of Object.entries(IMPORTANT_ENV_VARS)) {
  const value = process.env[envVar];
  if (!value) {
    console.warn(`⚠️  MISSING: ${envVar} - ${description} (using default)`);
    hasWarning = true;
  } else {
    console.log(`✅ ${envVar}: ${value}`);
  }
}

// Persistence check
console.log('\n📁 PERSISTENCE VERIFICATION:');
const databasePath = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'fitness_challenge.db');
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

const isPersistent = databasePath.includes('/opt/render/persistent') && uploadsDir.includes('/opt/render/persistent');
if (isPersistent) {
  console.log('✅ Using persistent storage - data will survive deployments');
} else {
  console.warn('⚠️  Using local storage - data will be lost on deployment');
  hasWarning = true;
}

console.log(`📊 Database path: ${databasePath}`);
console.log(`📁 Uploads path: ${uploadsDir}`);

// Exit with error if critical issues found
if (hasError) {
  console.error('\n🚨 CRITICAL ERRORS FOUND - Cannot start application');
  console.error('Please fix the above issues in your Render environment variables.');
  console.error('Go to: Render Dashboard → Your Service → Environment tab');
  process.exit(1);
}

if (hasWarning) {
  console.warn('\n⚠️  WARNINGS FOUND - Application will start but may have issues');
}

console.log('\n✅ Environment verification completed successfully!');

// === DIRECTORY CREATION WITH ENHANCED ERROR HANDLING ===
console.log('\n🏗️  PHASE 2: Directory Creation & Permissions');
console.log('===============================================');

const directories = [uploadsDir, path.dirname(databasePath)];

for (const dir of directories) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      console.log(`✅ Created directory: ${dir}`);
      
      // Verify directory is writable
      const testFile = path.join(dir, 'write-test.tmp');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Directory is writable: ${dir}`);
      } catch (writeError) {
        console.error(`❌ Directory not writable: ${dir}`, writeError.message);
        process.exit(1);
      }
    } else {
      console.log(`✅ Directory exists: ${dir}`);
      
      // Check if it's writable
      try {
        const testFile = path.join(dir, 'write-test.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Directory is writable: ${dir}`);
      } catch (writeError) {
        console.error(`❌ Directory exists but not writable: ${dir}`, writeError.message);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create/verify directory ${dir}:`, error.message);
    process.exit(1);
  }
}

// === DATABASE EXISTENCE AND PERSISTENCE CHECK ===
console.log('\n💾 PHASE 3: Database Existence & Persistence Check');
console.log('================================================');

const databaseExists = fs.existsSync(databasePath);
if (databaseExists) {
  const stats = fs.statSync(databasePath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  const ageInHours = ((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)).toFixed(1);
  
  console.log(`✅ Found existing database (${sizeInMB} MB, ${ageInHours} hours old)`);
  console.log('   → This indicates data persistence is working!');
  
  // Check if we can read from the database
  try {
    const testRead = fs.readFileSync(databasePath);
    if (testRead.length > 0) {
      console.log('✅ Database is readable and contains data');
    } else {
      console.warn('⚠️  Database file exists but is empty');
    }
  } catch (error) {
    console.error('❌ Database exists but cannot be read:', error.message);
    process.exit(1);
  }
} else {
  console.log('📝 No existing database found - will create new database on first run');
  if (isPersistent) {
    console.log('   → New database will be created in persistent storage');
  } else {
    console.warn('   → New database will be created in temporary storage (will be lost!)');
  }
}

// === APPLICATION STARTUP VERIFICATION ===
console.log('\n🚀 PHASE 4: Application Startup');
console.log('===============================');

console.log('📁 Current working directory:', process.cwd());

const serverFile = path.join(process.cwd(), 'dist/server/index.js');
console.log('🔍 Looking for server file at:', serverFile);

try {
  if (fs.existsSync(serverFile)) {
    console.log('✅ Server file found');
  } else {
    console.log('❌ Server file NOT found');
    
    // Show what's actually in the dist directory
    const distDir = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      console.log('📂 Contents of dist directory:');
      const distContents = fs.readdirSync(distDir, { recursive: true });
      distContents.forEach(item => console.log(`  - ${item}`));
    } else {
      console.log('❌ dist directory does not exist at all');
    }
    
    console.error('🚨 Cannot start application - server file not found');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error checking server file:', error);
  process.exit(1);
}

console.log('\n🎯 Starting application with enhanced configuration...');

// Start the built application with comprehensive environment
const child = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env, 
    NODE_ENV: 'production',
    // Ensure these paths are definitely passed to the application
    DATABASE_URL: databasePath,
    UPLOADS_DIR: uploadsDir,
    // Add timestamp for deployment tracking
    DEPLOYMENT_TIMESTAMP: new Date().toISOString()
  }
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Application exited with code ${code}`);
  } else {
    console.log('✅ Application exited gracefully');
  }
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

// Handle unhandled errors in startup script
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception in startup script:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection in startup script:', reason);
  process.exit(1);
});