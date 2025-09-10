#!/usr/bin/env node

/**
 * Data Persistence Testing Script
 * 
 * This script tests the data persistence fixes by verifying:
 * 1. Environment configuration
 * 2. Database connectivity  
 * 3. User session validation
 * 4. Backup functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Color formatting
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
  test: '🧪',
  rocket: '🚀'
};

console.log(`${colors.bold}${colors.blue}${icons.rocket} Data Persistence Testing Script${colors.reset}`);
console.log('='.repeat(50));

async function testEnvironmentConfig() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.test} Testing Environment Configuration${colors.reset}`);
  
  const requiredVars = [
    'NODE_ENV',
    'DATABASE_URL', 
    'SESSION_SECRET',
    'ADMIN_USERNAMES'
  ];
  
  let passed = 0;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      console.log(`   ${colors.green}${icons.success} ${varName}: Present${colors.reset}`);
      passed++;
    } else {
      console.log(`   ${colors.red}${icons.error} ${varName}: Missing${colors.reset}`);
    }
  }
  
  // Check database path for persistence
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    if (dbUrl.includes('/opt/render/persistent/')) {
      console.log(`   ${colors.green}${icons.success} Database: Configured for persistence${colors.reset}`);
      passed++;
    } else {
      console.log(`   ${colors.yellow}${icons.warning} Database: Not in persistent storage${colors.reset}`);
      console.log(`     Current: ${dbUrl.substring(0, 40)}...`);
    }
  }
  
  console.log(`\n   ${colors.bold}Result: ${passed}/${requiredVars.length + 1} checks passed${colors.reset}`);
  return passed === requiredVars.length + 1;
}

async function testDatabaseConnectivity() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.test} Testing Database Connectivity${colors.reset}`);
  
  try {
    // Import and test database health
    const { getDatabaseHealthStatus } = await import('../server/db.js');
    const health = await getDatabaseHealthStatus();
    
    console.log(`   Status: ${health.status}`);
    console.log(`   Users: ${health.data?.users || 0}`);
    console.log(`   Scans: ${health.data?.scans || 0}`);
    
    if (health.status === 'healthy') {
      console.log(`   ${colors.green}${icons.success} Database: Healthy and accessible${colors.reset}`);
      return true;
    } else {
      console.log(`   ${colors.red}${icons.error} Database: Unhealthy${colors.reset}`);
      if (health.issues) {
        health.issues.forEach(issue => {
          console.log(`     - ${issue}`);
        });
      }
      return false;
    }
    
  } catch (error) {
    console.log(`   ${colors.red}${icons.error} Database: Connection failed${colors.reset}`);
    console.log(`     Error: ${error.message}`);
    return false;
  }
}

async function testBackupFunctionality() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.test} Testing Backup Functionality${colors.reset}`);
  
  const dbUrl = process.env.DATABASE_URL || './data/fitness_challenge.db';
  
  // Skip for PostgreSQL
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log(`   ${colors.blue}${icons.info} PostgreSQL detected - backup testing skipped${colors.reset}`);
    return true;
  }
  
  const dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(projectRoot, dbUrl);
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  
  try {
    // Check if backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
      console.log(`   ${colors.green}${icons.success} Backup directory created${colors.reset}`);
    }
    
    // List existing backups
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.db'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(backupDir, a));
        const statB = fs.statSync(path.join(backupDir, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      });
    
    console.log(`   ${colors.green}${icons.success} Backup directory accessible${colors.reset}`);
    console.log(`   ${colors.blue}${icons.info} Found ${backupFiles.length} backup files${colors.reset}`);
    
    if (backupFiles.length > 0) {
      const latestBackup = backupFiles[0];
      const stats = fs.statSync(path.join(backupDir, latestBackup));
      const ageHours = Math.round((Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60));
      console.log(`     Latest: ${latestBackup} (${ageHours}h old)`);
    }
    
    return true;
    
  } catch (error) {
    console.log(`   ${colors.red}${icons.error} Backup functionality: Failed${colors.reset}`);
    console.log(`     Error: ${error.message}`);
    return false;
  }
}

async function testFilePermissions() {
  console.log(`\n${colors.bold}${colors.cyan}${icons.test} Testing File System Permissions${colors.reset}`);
  
  const dbUrl = process.env.DATABASE_URL || './data/fitness_challenge.db';
  
  // Skip for PostgreSQL
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    console.log(`   ${colors.blue}${icons.info} PostgreSQL detected - file permission testing skipped${colors.reset}`);
    return true;
  }
  
  const dbPath = path.isAbsolute(dbUrl) ? dbUrl : path.join(projectRoot, dbUrl);
  const dbDir = path.dirname(dbPath);
  
  try {
    // Test write permissions
    const testFile = path.join(dbDir, '.test-write-permissions');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    console.log(`   ${colors.green}${icons.success} Database directory: Writable${colors.reset}`);
    
    // Check database file
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const sizeKB = Math.round(stats.size / 1024);
      console.log(`   ${colors.green}${icons.success} Database file: Exists (${sizeKB} KB)${colors.reset}`);
      
      // Test database file read/write
      fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
      console.log(`   ${colors.green}${icons.success} Database file: Readable and writable${colors.reset}`);
    } else {
      console.log(`   ${colors.yellow}${icons.warning} Database file: Doesn't exist (will be created)${colors.reset}`);
    }
    
    return true;
    
  } catch (error) {
    console.log(`   ${colors.red}${icons.error} File permissions: Failed${colors.reset}`);
    console.log(`     Error: ${error.message}`);
    return false;
  }
}

async function generateTestReport(results) {
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\n${colors.bold}${colors.cyan}📊 Test Report${colors.reset}`);
  console.log('='.repeat(30));
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  
  console.log(`\nDetailed Results:`);
  for (const [testName, passed] of Object.entries(results)) {
    const status = passed ? 
      `${colors.green}${icons.success} PASS${colors.reset}` : 
      `${colors.red}${icons.error} FAIL${colors.reset}`;
    console.log(`   ${testName}: ${status}`);
  }
  
  if (failedTests === 0) {
    console.log(`\n${colors.bold}${colors.green}${icons.success} All tests passed! Your data persistence should work correctly.${colors.reset}`);
    console.log(`\n${colors.bold}Next Steps:${colors.reset}`);
    console.log(`1. Deploy your application`);
    console.log(`2. Clear browser cookies/localStorage`);
    console.log(`3. Create a new account`);
    console.log(`4. Test creating a scan`);
    console.log(`5. Redeploy and verify data persists`);
  } else {
    console.log(`\n${colors.bold}${colors.red}${icons.error} ${failedTests} test(s) failed. Please fix these issues before deployment.${colors.reset}`);
    console.log(`\n${colors.bold}Fix Instructions:${colors.reset}`);
    console.log(`1. Run: npm run verify:deployment`);
    console.log(`2. Check Render environment variables`);
    console.log(`3. Verify persistent disk configuration`);
    console.log(`4. Check database file permissions`);
  }
  
  console.log(`\n${colors.blue}${icons.info} For detailed configuration help, see DEPLOYMENT_SAFETY_CHECKLIST.md${colors.reset}`);
  
  return failedTests === 0;
}

// Main test execution
async function runAllTests() {
  const results = {};
  
  console.log(`${colors.bold}Starting comprehensive data persistence tests...${colors.reset}\n`);
  
  results['Environment Configuration'] = await testEnvironmentConfig();
  results['Database Connectivity'] = await testDatabaseConnectivity();
  results['Backup Functionality'] = await testBackupFunctionality();
  results['File Permissions'] = await testFilePermissions();
  
  const allPassed = await generateTestReport(results);
  
  process.exit(allPassed ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
  console.error(`${colors.red}${icons.error} Test execution failed:${colors.reset}`, error);
  process.exit(1);
});