#!/usr/bin/env node

/**
 * Deployment Verification Script for Recomp-100 Fitness App
 * 
 * This script verifies that your deployment environment is properly configured
 * to prevent data loss and ensure user data persists between deployments.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Color formatting for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  check: '🔍',
  fix: '🔧'
};

console.log(`${colors.bold}${colors.blue}🚀 Deployment Verification for Recomp-100 Fitness App${colors.reset}`);
console.log('='.repeat(60));

// Environment Detection
function detectEnvironment() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} Environment Detection${colors.reset}`);
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const platform = detectPlatform();
  
  console.log(`   Environment: ${nodeEnv}`);
  console.log(`   Platform: ${platform.name}`);
  console.log(`   Supports Persistence: ${platform.persistent ? 'Yes' : 'No'}`);
  
  if (!platform.persistent && nodeEnv === 'production') {
    console.log(`${colors.red}${icons.error} WARNING: Production environment on non-persistent platform!${colors.reset}`);
    console.log('   Data will be lost on every deployment.');
  }
  
  return { nodeEnv, platform };
}

function detectPlatform() {
  if (process.env.RENDER) {
    return { 
      name: 'Render', 
      persistent: true, 
      recommendedDbPath: '/opt/render/persistent/data/fitness_challenge.db',
      mountPath: '/opt/render/persistent'
    };
  } else if (process.env.RAILWAY_ENVIRONMENT) {
    return { 
      name: 'Railway', 
      persistent: true, 
      recommendedDbPath: 'PostgreSQL',
      mountPath: null
    };
  } else if (process.env.VERCEL) {
    return { 
      name: 'Vercel', 
      persistent: false, 
      recommendedDbPath: 'External Database',
      mountPath: null
    };
  } else {
    return { 
      name: 'Local/Unknown', 
      persistent: true, 
      recommendedDbPath: './data/fitness_challenge.db',
      mountPath: null
    };
  }
}

// Database Configuration Check
function checkDatabaseConfiguration(platform) {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} Database Configuration${colors.reset}`);
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log(`${colors.red}${icons.error} DATABASE_URL environment variable not set${colors.reset}`);
    return false;
  }
  
  console.log(`   Database URL: ${databaseUrl.substring(0, 50)}${databaseUrl.length > 50 ? '...' : ''}`);
  
  // Check if database path is appropriate for platform
  if (platform.name === 'Render') {
    if (!databaseUrl.includes('/opt/render/persistent/')) {
      console.log(`${colors.red}${icons.error} Database not in persistent storage!${colors.reset}`);
      console.log(`   Current: ${databaseUrl}`);
      console.log(`   Required: ${platform.recommendedDbPath}`);
      console.log(`   ${colors.yellow}FIX: Update DATABASE_URL in Render dashboard${colors.reset}`);
      return false;
    } else {
      console.log(`${colors.green}${icons.success} Database correctly configured for persistent storage${colors.reset}`);
    }
  }
  
  return true;
}

// Environment Variables Check
function checkEnvironmentVariables(platform) {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} Critical Environment Variables${colors.reset}`);
  
  const criticalVars = [
    'NODE_ENV',
    'DATABASE_URL',
    'SESSION_SECRET',
    'ADMIN_USERNAMES',
    'COMPETITION_START_DATE',
    'COMPETITION_END_DATE'
  ];
  
  let allPresent = true;
  
  criticalVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      const displayValue = varName === 'SESSION_SECRET' ? '[HIDDEN]' : 
                          varName === 'DATABASE_URL' ? value.substring(0, 30) + '...' :
                          value;
      console.log(`   ${colors.green}${icons.success} ${varName}: ${displayValue}${colors.reset}`);
    } else {
      console.log(`   ${colors.red}${icons.error} ${varName}: NOT SET${colors.reset}`);
      allPresent = false;
    }
  });
  
  // Platform-specific checks
  if (platform.name === 'Render') {
    const uploadsDir = process.env.UPLOADS_DIR;
    if (!uploadsDir || !uploadsDir.includes('/opt/render/persistent/')) {
      console.log(`   ${colors.yellow}${icons.warning} UPLOADS_DIR should use persistent storage${colors.reset}`);
      console.log(`   Recommended: /opt/render/persistent/uploads`);
    }
  }
  
  return allPresent;
}

// File System Checks
function checkFileSystem(platform) {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} File System & Persistence${colors.reset}`);
  
  const databaseUrl = process.env.DATABASE_URL || './data/fitness_challenge.db';
  
  // Only check file system for SQLite databases
  if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
    console.log(`   ${colors.blue}${icons.info} Using PostgreSQL - file system checks not applicable${colors.reset}`);
    return true;
  }
  
  const dbPath = path.isAbsolute(databaseUrl) ? databaseUrl : path.join(projectRoot, databaseUrl);
  const dbDir = path.dirname(dbPath);
  
  try {
    // Check if database directory exists or can be created
    if (!fs.existsSync(dbDir)) {
      console.log(`   ${colors.yellow}${icons.warning} Database directory doesn't exist: ${dbDir}${colors.reset}`);
      try {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`   ${colors.green}${icons.success} Created database directory${colors.reset}`);
      } catch (error) {
        console.log(`   ${colors.red}${icons.error} Cannot create database directory: ${error.message}${colors.reset}`);
        return false;
      }
    }
    
    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const sizeKB = Math.round(stats.size / 1024);
      const ageHours = Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60));
      
      console.log(`   ${colors.green}${icons.success} Database file exists (${sizeKB} KB, ${ageHours}h old)${colors.reset}`);
      
      if (sizeKB < 10) {
        console.log(`   ${colors.yellow}${icons.warning} Database file is very small - may be empty${colors.reset}`);
      }
    } else {
      console.log(`   ${colors.yellow}${icons.info} Database file doesn't exist - will be created on first run${colors.reset}`);
    }
    
    // Test write permissions
    const testFile = path.join(dbDir, '.write-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      console.log(`   ${colors.green}${icons.success} Directory is writable${colors.reset}`);
    } catch (error) {
      console.log(`   ${colors.red}${icons.error} Directory is not writable: ${error.message}${colors.reset}`);
      return false;
    }
    
    // Check backup directory
    const backupDir = process.env.BACKUP_PATH || path.join(dbDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      console.log(`   ${colors.yellow}${icons.warning} Backup directory doesn't exist: ${backupDir}${colors.reset}`);
    } else {
      console.log(`   ${colors.green}${icons.success} Backup directory exists${colors.reset}`);
    }
    
  } catch (error) {
    console.log(`   ${colors.red}${icons.error} File system check failed: ${error.message}${colors.reset}`);
    return false;
  }
  
  return true;
}

// Configuration File Checks
function checkConfigurationFiles() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} Configuration Files${colors.reset}`);
  
  const configFiles = [
    { name: 'package.json', required: true },
    { name: '.env.production', required: false },
    { name: 'render.yaml', required: false },
    { name: 'railway.toml', required: false }
  ];
  
  configFiles.forEach(({ name, required }) => {
    const filePath = path.join(projectRoot, name);
    if (fs.existsSync(filePath)) {
      console.log(`   ${colors.green}${icons.success} ${name} exists${colors.reset}`);
    } else if (required) {
      console.log(`   ${colors.red}${icons.error} ${name} missing (required)${colors.reset}`);
    } else {
      console.log(`   ${colors.yellow}${icons.info} ${name} not found (optional)${colors.reset}`);
    }
  });
}

// Security Checks
function checkSecurity() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.check} Security Configuration${colors.reset}`);
  
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (!sessionSecret) {
    console.log(`   ${colors.red}${icons.error} SESSION_SECRET not set${colors.reset}`);
    return false;
  }
  
  if (sessionSecret.length < 32) {
    console.log(`   ${colors.yellow}${icons.warning} SESSION_SECRET too short (${sessionSecret.length} chars, need 32+)${colors.reset}`);
  } else {
    console.log(`   ${colors.green}${icons.success} SESSION_SECRET length adequate (${sessionSecret.length} chars)${colors.reset}`);
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FORCE_HTTPS) {
      console.log(`   ${colors.yellow}${icons.warning} FORCE_HTTPS not set in production${colors.reset}`);
    }
  }
  
  return true;
}

// Generate Fix Instructions
function generateFixInstructions(issues) {
  if (issues.length === 0) {
    console.log(`\n${colors.bold}${colors.green}${icons.success} All checks passed! Your deployment should work correctly.${colors.reset}`);
    return;
  }
  
  console.log(`\n${colors.bold}${colors.red}${icons.fix} Issues Found - Fix Instructions${colors.reset}`);
  console.log('='.repeat(50));
  
  console.log(`\n${colors.bold}${colors.cyan}For Render Deployment:${colors.reset}`);
  console.log(`1. Go to Render Dashboard → Your Service → Environment`);
  console.log(`2. Add/Update these environment variables:`);
  console.log(`   DATABASE_URL=/opt/render/persistent/data/fitness_challenge.db`);
  console.log(`   UPLOADS_DIR=/opt/render/persistent/uploads`);
  console.log(`   NODE_ENV=production`);
  console.log(`   SESSION_SECRET=[your-64-char-secret]`);
  console.log(`   ADMIN_USERNAMES=Jaron`);
  console.log(`   COMPETITION_START_DATE=2025-08-04T00:00:00.000Z`);
  console.log(`   COMPETITION_END_DATE=2025-11-26T23:59:59.999Z`);
  
  console.log(`\n3. Verify render.yaml has persistent disk configuration:`);
  console.log(`   disk:`);
  console.log(`     name: fitness-app-storage`);
  console.log(`     mountPath: /opt/render/persistent`);
  console.log(`     sizeGB: 2`);
  
  console.log(`\n${colors.bold}${colors.cyan}After Deployment:${colors.reset}`);
  console.log(`1. Clear browser cookies/localStorage`);
  console.log(`2. Create a new account`);
  console.log(`3. Test creating a scan`);
  console.log(`4. Redeploy and verify data persists`);
  
  console.log(`\n${colors.bold}${colors.cyan}Health Check URLs:${colors.reset}`);
  console.log(`• Basic health: https://your-app.onrender.com/health`);
  console.log(`• Detailed health: https://your-app.onrender.com/api/health`);
}

// Main verification function
async function runVerification() {
  const issues = [];
  
  const { nodeEnv, platform } = detectEnvironment();
  
  if (!checkDatabaseConfiguration(platform)) {
    issues.push('Database configuration');
  }
  
  if (!checkEnvironmentVariables(platform)) {
    issues.push('Environment variables');
  }
  
  if (!checkFileSystem(platform)) {
    issues.push('File system access');
  }
  
  checkConfigurationFiles();
  
  if (!checkSecurity()) {
    issues.push('Security configuration');
  }
  
  console.log(`\n${colors.bold}${colors.cyan}📊 Verification Summary${colors.reset}`);
  console.log('='.repeat(30));
  
  if (issues.length === 0) {
    console.log(`${colors.green}${icons.success} All checks passed!${colors.reset}`);
  } else {
    console.log(`${colors.red}${icons.error} ${issues.length} issue(s) found:${colors.reset}`);
    issues.forEach(issue => console.log(`   • ${issue}`));
  }
  
  generateFixInstructions(issues);
  
  console.log(`\n${colors.blue}${icons.info} Run this script after any deployment changes to verify configuration.${colors.reset}`);
  
  process.exit(issues.length === 0 ? 0 : 1);
}

// Run the verification
runVerification().catch(error => {
  console.error(`${colors.red}${icons.error} Verification failed:${colors.reset}`, error);
  process.exit(1);
});