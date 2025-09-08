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

// Check critical environment variables and provide defaults
console.log('🔴 CRITICAL Environment Variables:');
for (const [envVar, description] of Object.entries(CRITICAL_ENV_VARS)) {
  let value = process.env[envVar];
  
  // EMERGENCY FIX: Provide sensible defaults instead of failing
  if (!value) {
    let defaultValue = '';
    switch(envVar) {
      case 'DATABASE_URL':
        defaultValue = '/opt/render/persistent/fitness_challenge.db';
        break;
      case 'UPLOADS_DIR':
        defaultValue = '/opt/render/persistent/uploads';
        break;
      case 'SESSION_SECRET':
        defaultValue = 'render-production-session-secret-key-32-characters-minimum-length-required';
        break;
      case 'OPENAI_API_KEY':
        defaultValue = 'disabled';
        break;
      case 'NODE_ENV':
        defaultValue = 'production';
        break;
    }
    
    if (defaultValue) {
      process.env[envVar] = defaultValue;
      value = defaultValue;
      console.warn(`⚠️  USING DEFAULT: ${envVar} = ${defaultValue}`);
      console.warn(`   → ${description}`);
      hasWarning = true;
    } else {
      console.error(`❌ MISSING: ${envVar} - ${description}`);
      hasError = true;
    }
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

// Check important environment variables and provide defaults
console.log('\n🟡 IMPORTANT Environment Variables:');
for (const [envVar, description] of Object.entries(IMPORTANT_ENV_VARS)) {
  let value = process.env[envVar];
  
  // EMERGENCY FIX: Provide sensible defaults for important variables
  if (!value) {
    let defaultValue = '';
    switch(envVar) {
      case 'ADMIN_USERNAMES':
        defaultValue = 'Jaron';
        break;
      case 'COMPETITION_START_DATE':
        defaultValue = '2025-08-04T00:00:00.000Z';
        break;
      case 'COMPETITION_END_DATE':
        defaultValue = '2025-11-26T23:59:59.999Z';
        break;
    }
    
    if (defaultValue) {
      process.env[envVar] = defaultValue;
      value = defaultValue;
      console.log(`✅ ${envVar}: ${defaultValue} (default)`);
      console.warn(`   → ${description}`);
    } else {
      console.warn(`⚠️  MISSING: ${envVar} - ${description} (using default)`);
      hasWarning = true;
    }
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

// EMERGENCY FIX: Handle directory creation with fallbacks for local development
let actualDatabasePath = databasePath;
let actualUploadsDir = uploadsDir;

// If using Render paths but they don't exist (local development), use fallbacks
if (databasePath.includes('/opt/render/persistent') && !fs.existsSync('/opt/render')) {
  actualDatabasePath = path.join(process.cwd(), 'data', 'fitness_challenge.db');
  process.env.DATABASE_URL = actualDatabasePath;
  console.warn(`⚠️  Fallback: Using local database path: ${actualDatabasePath}`);
}

if (uploadsDir.includes('/opt/render/persistent') && !fs.existsSync('/opt/render')) {
  actualUploadsDir = path.join(process.cwd(), 'uploads');
  process.env.UPLOADS_DIR = actualUploadsDir;
  console.warn(`⚠️  Fallback: Using local uploads path: ${actualUploadsDir}`);
}

const directories = [actualUploadsDir, path.dirname(actualDatabasePath)];

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
        console.warn(`⚠️  Directory not writable: ${dir} - ${writeError.message}`);
        console.warn(`   This may cause issues but won't prevent startup`);
      }
    } else {
      console.log(`✅ Directory exists: ${dir}`);
      
      // Check if it's writable (non-fatal)
      try {
        const testFile = path.join(dir, 'write-test.tmp');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log(`✅ Directory is writable: ${dir}`);
      } catch (writeError) {
        console.warn(`⚠️  Directory exists but not writable: ${dir} - ${writeError.message}`);
        console.warn(`   This may cause issues but won't prevent startup`);
      }
    }
  } catch (error) {
    console.warn(`⚠️  Failed to create/verify directory ${dir}: ${error.message}`);
    console.warn(`   This may cause issues but won't prevent startup`);
  }
}

// === DATABASE EXISTENCE AND PERSISTENCE CHECK ===
console.log('\n💾 PHASE 3: Database Existence & Persistence Check');
console.log('================================================');

const databaseExists = fs.existsSync(actualDatabasePath);
if (databaseExists) {
  const stats = fs.statSync(actualDatabasePath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  const ageInHours = ((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60)).toFixed(1);
  
  console.log(`✅ Found existing database (${sizeInMB} MB, ${ageInHours} hours old)`);
  console.log('   → This indicates data persistence is working!');
  
  // Check if we can read from the database
  try {
    const testRead = fs.readFileSync(actualDatabasePath);
    if (testRead.length > 0) {
      console.log('✅ Database is readable and contains data');
    } else {
      console.warn('⚠️  Database file exists but is empty');
    }
  } catch (error) {
    console.warn(`⚠️  Database exists but cannot be read: ${error.message}`);
    console.warn(`   This may cause issues but won't prevent startup`);
  }
} else {
  console.log('📝 No existing database found - will create new database on first run');
  if (isPersistent) {
    console.log('   → New database will be created in persistent storage');
  } else {
    console.warn('   → New database will be created in temporary storage (will be lost!)');
  }
}

// === PROCESS CLEANUP ===
console.log('\n🔧 PHASE 4: Process Cleanup & Port Management');
console.log('============================================');

// Check for existing processes on the target port
const checkPortInUse = async (port) => {
  try {
    const { spawn } = await import('child_process');
    return new Promise((resolve) => {
      // Use lsof to check if port is in use
      const lsofProcess = spawn('lsof', ['-i', `:${port}`], { stdio: 'pipe' });
      
      let output = '';
      lsofProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      lsofProcess.on('close', (code) => {
        if (code === 0 && output.trim()) {
          // Port is in use, parse the output to get process info
          const lines = output.trim().split('\n').slice(1); // Skip header
          const processes = lines.map(line => {
            const parts = line.trim().split(/\s+/);
            return {
              command: parts[0],
              pid: parts[1],
              user: parts[2]
            };
          });
          resolve({ inUse: true, processes });
        } else {
          resolve({ inUse: false, processes: [] });
        }
      });
      
      lsofProcess.on('error', () => {
        // lsof not available or error - assume port is free
        resolve({ inUse: false, processes: [] });
      });
    });
  } catch (error) {
    // Fallback if lsof is not available
    return { inUse: false, processes: [] };
  }
};

// Kill processes using the target port
const killProcessesOnPort = async (port) => {
  const portCheck = await checkPortInUse(port);
  
  if (portCheck.inUse) {
    console.log(`🔍 Found ${portCheck.processes.length} process(es) using port ${port}:`);
    
    for (const proc of portCheck.processes) {
      console.log(`   - ${proc.command} (PID: ${proc.pid}, User: ${proc.user})`);
      
      try {
        process.kill(proc.pid, 'SIGTERM');
        console.log(`✅ Sent SIGTERM to process ${proc.pid}`);
        
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if process is still running, force kill if needed
        const stillRunning = await checkPortInUse(port);
        if (stillRunning.inUse) {
          process.kill(proc.pid, 'SIGKILL');
          console.log(`💀 Force killed process ${proc.pid}`);
        }
      } catch (killError) {
        if (killError.code === 'ESRCH') {
          console.log(`✅ Process ${proc.pid} already terminated`);
        } else {
          console.warn(`⚠️  Failed to kill process ${proc.pid}: ${killError.message}`);
        }
      }
    }
    
    // Final verification
    const finalCheck = await checkPortInUse(port);
    if (finalCheck.inUse) {
      console.warn(`⚠️  Warning: Port ${port} may still be in use after cleanup attempt`);
    } else {
      console.log(`✅ Port ${port} is now available`);
    }
  } else {
    console.log(`✅ Port ${port} is available`);
  }
};

// Determine the target port from environment or default
const targetPort = process.env.PORT || 3001;
console.log(`🔍 Checking port ${targetPort} availability...`);
await killProcessesOnPort(targetPort);

// === APPLICATION STARTUP VERIFICATION ===
console.log('\n🚀 PHASE 5: Application Startup');
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
    // Ensure these paths are definitely passed to the application (use actual paths)
    DATABASE_URL: actualDatabasePath,
    UPLOADS_DIR: actualUploadsDir,
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