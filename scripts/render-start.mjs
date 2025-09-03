#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Ensure persistent directories exist on Render
const directories = [
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  path.dirname(process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'fitness_challenge.db'))
];

console.log('🚀 Render startup: Creating persistent directories...');

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

// Start the built application
const child = spawn('node', ['dist/server/index.js'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('exit', (code) => {
  process.exit(code);
});