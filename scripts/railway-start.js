#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Ensure persistent directories exist on Railway
const directories = [
  process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
  path.dirname(process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'fitness_challenge.db'))
];

console.log('🚀 Railway startup: Creating persistent directories...');

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

// Start the main application using tsx
const { spawn } = require('child_process');
const child = spawn('npm', ['start'], {
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('exit', (code) => {
  process.exit(code);
});