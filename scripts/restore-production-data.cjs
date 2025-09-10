#!/usr/bin/env node

/**
 * Production Data Recovery Script
 * 
 * Safely restores database from backup after data loss incident
 * Use this script to recover from the September 10, 2025 data loss
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const CONFIG = {
  PRODUCTION_URL: process.env.PRODUCTION_URL || 'https://recomp-100-fitness-app.onrender.com',
  BACKUP_FILE: 'fitness_challenge_backup_2025-09-10_00-15-51.db',
  TARGET_DATABASE: '/opt/render/persistent/data/fitness_challenge.db',
  VERIFICATION_ENDPOINT: '/api/health',
  EXPECTED_USERS: 3,
  EXPECTED_SCANS: 2,
};

console.log('🚨 PRODUCTION DATA RECOVERY SCRIPT');
console.log('==================================');
console.log('');
console.log('⚠️  WARNING: This script will replace the current production database');
console.log('⚠️  WARNING: All current data will be lost and replaced with backup data');
console.log('');

// Validation function
async function validateRecoveryPreconditions() {
  console.log('🔍 STEP 1: Validating Recovery Preconditions');
  console.log('============================================');
  
  // Check if running in correct environment
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️  Not running in production environment');
    console.log('   Current NODE_ENV:', process.env.NODE_ENV || 'undefined');
    console.log('   Set NODE_ENV=production to proceed');
  }
  
  // Check backup file exists
  const backupPath = path.join(process.cwd(), 'data', 'backups', CONFIG.BACKUP_FILE);
  console.log(`📂 Checking backup file: ${backupPath}`);
  
  if (!fs.existsSync(backupPath)) {
    console.error('❌ Backup file not found:', backupPath);
    console.error('   Available backups:');
    
    const backupDir = path.dirname(backupPath);
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      files.forEach(file => console.error(`   - ${file}`));
    } else {
      console.error('   No backup directory found');
    }
    
    process.exit(1);
  }
  
  console.log('✅ Backup file found');
  
  // Verify backup integrity
  console.log('🔍 Verifying backup integrity...');
  try {
    const { spawn } = require('child_process');
    const verifyProcess = spawn('node', ['scripts/backup-database.cjs', 'verify', backupPath], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let verifyOutput = '';
    verifyProcess.stdout.on('data', (data) => {
      verifyOutput += data.toString();
    });
    
    await new Promise((resolve, reject) => {
      verifyProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Backup verification successful');
          console.log(`   ${verifyOutput.match(/Users: \\d+, Scans: \\d+, Scores: \\d+/)?.[0] || 'Verification details not parsed'}`);
          resolve();
        } else {
          console.error('❌ Backup verification failed');
          reject(new Error('Backup verification failed'));
        }
      });
    });
    
  } catch (error) {
    console.error('❌ Backup verification error:', error.message);
    process.exit(1);
  }
  
  console.log('✅ All preconditions validated');
  console.log('');
}

// Get current production state
async function getCurrentProductionState() {
  console.log('📊 STEP 2: Checking Current Production State');
  console.log('===========================================');
  
  try {
    const healthUrl = `${CONFIG.PRODUCTION_URL}${CONFIG.VERIFICATION_ENDPOINT}`;
    console.log(`🌐 Fetching: ${healthUrl}`);
    
    const response = await new Promise((resolve, reject) => {
      const request = https.get(healthUrl, { timeout: 30000 }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });
      
      request.on('error', reject);
      request.on('timeout', () => reject(new Error('Request timeout')));
    });
    
    console.log('✅ Production health check successful');
    console.log(`   Status: ${response.status}`);
    
    if (response.database && response.database.data) {
      const data = response.database.data;
      console.log(`   Current Users: ${data.users}`);
      console.log(`   Current Scans: ${data.scans}`);
      console.log(`   Current Scores: ${data.scores}`);
      
      if (data.users === CONFIG.EXPECTED_USERS && data.scans === CONFIG.EXPECTED_SCANS) {
        console.log('⚠️  Database already appears to contain the expected data');
        console.log('   Recovery may not be necessary');
        return { needsRecovery: false, currentData: data };
      } else {
        console.log('🔍 Database needs recovery:');
        console.log(`   Expected: ${CONFIG.EXPECTED_USERS} users, ${CONFIG.EXPECTED_SCANS} scans`);
        console.log(`   Current:  ${data.users} users, ${data.scans} scans`);
        return { needsRecovery: true, currentData: data };
      }
    } else {
      console.log('⚠️  Unable to parse database data from health response');
      return { needsRecovery: true, currentData: null };
    }
    
  } catch (error) {
    console.error('❌ Failed to check production state:', error.message);
    console.log('');
    console.log('🔧 Recovery Options:');
    console.log('1. Check if the production URL is correct');
    console.log('2. Verify the application is running');
    console.log('3. Check network connectivity');
    console.log('4. Proceed with recovery if application is confirmed down');
    
    process.exit(1);
  }
}

// Recovery execution plan
function displayRecoveryPlan(currentState) {
  console.log('');
  console.log('📋 STEP 3: Recovery Execution Plan');
  console.log('==================================');
  console.log('');
  console.log('The following actions will be performed:');
  console.log('');
  console.log('1. 🔒 Create safety backup of current database');
  console.log('2. 🛑 Stop production application (brief downtime)');
  console.log('3. 💾 Replace database with backup data');
  console.log('4. 🚀 Restart production application');
  console.log('5. ✅ Verify restoration success');
  console.log('');
  console.log('📊 Expected Results After Recovery:');
  console.log(`   Users: ${CONFIG.EXPECTED_USERS} (restored accounts)`);
  console.log(`   Scans: ${CONFIG.EXPECTED_SCANS} (historical competition data)`);
  console.log(`   Scores: 0 (will be recalculated)`);
  console.log('');
  console.log('⚠️  Impact:');
  console.log('   - Brief production downtime (2-5 minutes)');
  console.log('   - All users will need to log in again');
  console.log('   - Any accounts created during the incident will be lost');
  console.log('');
  
  if (currentState.currentData) {
    console.log('📋 Current Data That Will Be Replaced:');
    console.log(`   Users: ${currentState.currentData.users}`);
    console.log(`   Scans: ${currentState.currentData.scans}`);
    console.log(`   Scores: ${currentState.currentData.scores}`);
    console.log('');
  }
}

// Interactive confirmation
async function getRecoveryConfirmation() {
  console.log('🔐 STEP 4: Recovery Confirmation');
  console.log('===============================');
  console.log('');
  console.log('⚠️  This operation will replace ALL current production data');
  console.log('⚠️  This action CANNOT be undone without another backup restoration');
  console.log('');
  
  // Since this is a Node.js script without interactive input in this environment,
  // we'll provide instructions for manual execution
  console.log('🚨 MANUAL EXECUTION REQUIRED');
  console.log('');
  console.log('To proceed with recovery, you must:');
  console.log('');
  console.log('1. Connect to your Render service shell:');
  console.log('   Go to Render Dashboard → Your Service → Shell');
  console.log('');
  console.log('2. Execute the following commands:');
  console.log('');
  console.log('   # Create safety backup');
  console.log('   cp /opt/render/persistent/data/fitness_challenge.db /opt/render/persistent/data/pre-recovery-backup.db');
  console.log('');
  console.log('   # Restore from backup');
  console.log(`   cp /opt/render/persistent/backups/${CONFIG.BACKUP_FILE} /opt/render/persistent/data/fitness_challenge.db`);
  console.log('');
  console.log('   # Restart the application');
  console.log('   # (This will happen automatically when you exit the shell)');
  console.log('');
  console.log('3. Verify recovery:');
  console.log(`   curl ${CONFIG.PRODUCTION_URL}${CONFIG.VERIFICATION_ENDPOINT} | jq .database.data`);
  console.log('');
  console.log('Expected verification output:');
  console.log(`   "users": ${CONFIG.EXPECTED_USERS}, "scans": ${CONFIG.EXPECTED_SCANS}, "scores": 0`);
  console.log('');
  
  return false; // Don't proceed with automated recovery
}

// Main recovery process
async function main() {
  try {
    console.log('🎯 Starting Production Data Recovery Process');
    console.log('');
    
    // Step 1: Validate preconditions
    await validateRecoveryPreconditions();
    
    // Step 2: Check current state
    const currentState = await getCurrentProductionState();
    
    if (!currentState.needsRecovery) {
      console.log('✅ No recovery needed - database already contains expected data');
      process.exit(0);
    }
    
    // Step 3: Display recovery plan
    displayRecoveryPlan(currentState);
    
    // Step 4: Get confirmation (manual process)
    const confirmed = await getRecoveryConfirmation();
    
    if (!confirmed) {
      console.log('📋 Recovery process outlined above');
      console.log('   Execute the manual commands when ready to proceed');
      console.log('');
      console.log('📞 After recovery, notify users:');
      console.log('   - Their accounts and data have been restored');
      console.log('   - They should log in with their original credentials');
      console.log('   - Competition standings are preserved');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 Recovery process failed:', error.message);
    console.error('');
    console.error('🆘 Emergency Actions:');
    console.error('1. Check application logs for detailed error information');
    console.error('2. Verify backup file integrity');
    console.error('3. Contact system administrator if issues persist');
    console.error('4. Consider manual database restoration process');
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\\n⚠️  Recovery process interrupted');
  console.log('   No changes have been made to production data');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Unexpected error during recovery:', error.message);
  console.error('   Recovery process aborted for safety');
  process.exit(1);
});

// Execute main function
main().catch(error => {
  console.error('💥 Fatal error:', error.message);
  process.exit(1);
});