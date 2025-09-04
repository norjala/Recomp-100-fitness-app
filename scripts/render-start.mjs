#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Ensure persistent directories exist on Render
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
const databasePath = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'fitness_challenge.db');
const databaseDir = path.dirname(databasePath);

console.log('🚀 Render startup: Initializing persistent storage...');
console.log(`📁 Database path: ${databasePath}`);
console.log(`📁 Uploads path: ${uploadsDir}`);

// Check if we're using persistent storage
const isPersistentStorage = databasePath.includes('/opt/render/persistent');
if (isPersistentStorage) {
  console.log('✅ Using persistent storage - data will survive deployments');
} else {
  console.log('⚠️  Using local storage - data will be lost on deployment');
}

// Create directories if they don't exist
const directories = [uploadsDir, databaseDir];

for (const dir of directories) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    } else {
      console.log(`✅ Directory exists: ${dir}`);
    }
  } catch (error) {
    console.error(`❌ Failed to create directory ${dir}:`, error);
    process.exit(1);
  }
}

// Check if database already exists
const databaseExists = fs.existsSync(databasePath);
if (databaseExists) {
  const stats = fs.statSync(databasePath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`✅ Found existing database (${sizeInMB} MB) - preserving user data`);
  
  // Check if we can read from the database
  try {
    const testRead = fs.readFileSync(databasePath);
    if (testRead.length > 0) {
      console.log('✅ Database is readable and contains data');
    }
  } catch (error) {
    console.error('⚠️  Database exists but may be corrupted:', error.message);
  }
} else {
  console.log('📝 No existing database found - will create new database on first run');
}

console.log('🎯 Starting application...');

// Debug: Check if files exist and show directory structure
console.log('📁 Current working directory:', process.cwd());
console.log('📋 Checking for required files...');

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
    
    // Show current directory contents
    console.log('📂 Contents of current directory:');
    const currentContents = fs.readdirSync(process.cwd());
    currentContents.forEach(item => console.log(`  - ${item}`));
  }
} catch (error) {
  console.error('❌ Error checking files:', error);
}

// Start the built application with proper environment
const child = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit',
  env: { 
    ...process.env, 
    NODE_ENV: 'production',
    // Ensure database path is passed to the application
    DATABASE_URL: databasePath,
    UPLOADS_DIR: uploadsDir
  }
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Application exited with code ${code}`);
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