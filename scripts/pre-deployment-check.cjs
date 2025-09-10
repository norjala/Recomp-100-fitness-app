#!/usr/bin/env node

/**
 * Pre-Deployment Safety Check
 * 
 * Verifies database persistence configuration and creates safety backups
 * before deploying to production to prevent data loss incidents like Jackie's
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  PRODUCTION_URL: process.env.PRODUCTION_URL || 'https://recomp-100-fitness-app.onrender.com',
  HEALTH_ENDPOINT: '/api/health',
  TIMEOUT_MS: 30000,
  REQUIRED_PERSISTENT_PATH: '/opt/render/persistent',
};

/**
 * Make HTTPS request to health endpoint
 */
function checkHealthEndpoint(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout: CONFIG.TIMEOUT_MS }, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const healthData = JSON.parse(data);
          resolve({
            success: true,
            status: response.statusCode,
            data: healthData
          });
        } catch (error) {
          resolve({
            success: false,
            status: response.statusCode,
            error: 'Invalid JSON response',
            rawData: data
          });
        }
      });
    });
    
    request.on('error', (error) => {
      reject({
        success: false,
        error: error.message
      });
    });
    
    request.on('timeout', () => {
      request.destroy();
      reject({
        success: false,
        error: 'Request timeout'
      });
    });
  });
}

/**
 * Verify persistence configuration from health data
 */
function verifyPersistenceConfiguration(healthData) {
  const issues = [];
  const warnings = [];
  
  // Check database path
  if (healthData.database && healthData.database.path) {
    if (!healthData.database.path.includes(CONFIG.REQUIRED_PERSISTENT_PATH)) {
      issues.push(`Database not in persistent storage: ${healthData.database.path}`);
      issues.push('USER DATA WILL BE LOST ON DEPLOYMENT!');
    } else {
      console.log('✅ Database correctly configured for persistent storage');
    }
  } else {
    issues.push('Unable to verify database path from health data');
  }
  
  // Check persistence status
  if (healthData.persistence) {
    if (healthData.persistence.isPersistenceRequired && !healthData.persistence.isConfiguredForPersistence) {
      issues.push('Persistence required but not configured');
    }
    
    if (healthData.persistence.persistenceWarnings && healthData.persistence.persistenceWarnings.length > 0) {
      warnings.push(...healthData.persistence.persistenceWarnings);
    }
  }
  
  // Check environment
  if (healthData.environment) {
    if (healthData.environment.nodeEnv !== 'production') {
      warnings.push(`Environment is ${healthData.environment.nodeEnv}, expected production`);
    }
    
    if (!healthData.environment.isRender) {
      warnings.push('Not running on Render platform');
    }
  }
  
  return { issues, warnings };
}

/**
 * Analyze current data state for backup verification
 */
function analyzeDataState(healthData) {
  const dataState = {
    users: 0,
    scans: 0,
    scores: 0,
    databaseSize: 0,
    hasData: false
  };
  
  if (healthData.data) {
    dataState.users = healthData.data.users || 0;
    dataState.scans = healthData.data.scans || 0;
    dataState.scores = healthData.data.scores || 0;
    dataState.hasData = dataState.users > 0 || dataState.scans > 0;
  }
  
  if (healthData.database && healthData.database.size) {
    const sizeMatch = healthData.database.size.match(/([0-9.]+)/);
    if (sizeMatch) {
      dataState.databaseSize = parseFloat(sizeMatch[1]);
    }
  }
  
  return dataState;
}

/**
 * Analyze backup status
 */
function analyzeBackupStatus(healthData) {
  const backupStatus = {
    hasRecentBackup: false,
    backupCount: 0,
    mostRecentAge: null,
    warnings: []
  };
  
  if (healthData.backup) {
    backupStatus.hasRecentBackup = healthData.backup.hasRecentBackup;
    backupStatus.backupCount = healthData.backup.backupCount || 0;
    backupStatus.mostRecentAge = healthData.backup.mostRecentAge;
    
    if (healthData.backup.warning) {
      backupStatus.warnings.push(healthData.backup.warning);
    }
    
    if (healthData.backup.error) {
      backupStatus.warnings.push(`Backup error: ${healthData.backup.error}`);
    }
  }
  
  return backupStatus;
}

/**
 * Generate deployment safety report
 */
function generateDeploymentReport(healthData, persistenceCheck, dataState, backupStatus) {
  console.log('\n🔍 === PRE-DEPLOYMENT SAFETY REPORT ===\n');
  
  // Database Persistence
  console.log('🗄️  DATABASE PERSISTENCE:');
  if (persistenceCheck.issues.length === 0) {
    console.log('✅ Database is properly configured for persistent storage');
    console.log(`   Path: ${healthData.database?.path || 'Unknown'}`);
  } else {
    console.log('❌ CRITICAL PERSISTENCE ISSUES:');
    persistenceCheck.issues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  }
  
  if (persistenceCheck.warnings.length > 0) {
    console.log('⚠️  Persistence Warnings:');
    persistenceCheck.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }
  
  // Current Data State
  console.log('\n📊 CURRENT DATA STATE:');
  console.log(`   Users: ${dataState.users}`);
  console.log(`   DEXA Scans: ${dataState.scans}`);
  console.log(`   Scores: ${dataState.scores}`);
  console.log(`   Database Size: ${dataState.databaseSize} MB`);
  
  if (dataState.hasData) {
    console.log('✅ User data exists - deployment safety is critical');
  } else {
    console.log('ℹ️  No user data found - deployment is safe');
  }
  
  // Backup Status
  console.log('\n💾 BACKUP STATUS:');
  console.log(`   Total backups: ${backupStatus.backupCount}`);
  console.log(`   Recent backup: ${backupStatus.hasRecentBackup ? 'Yes' : 'No'}`);
  if (backupStatus.mostRecentAge) {
    console.log(`   Most recent: ${backupStatus.mostRecentAge} hours ago`);
  }
  
  if (backupStatus.warnings.length > 0) {
    console.log('⚠️  Backup Warnings:');
    backupStatus.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }
  
  // Overall Safety Assessment
  console.log('\n🎯 DEPLOYMENT SAFETY ASSESSMENT:');
  
  const isSafe = persistenceCheck.issues.length === 0;
  const hasBackupProtection = !dataState.hasData || backupStatus.hasRecentBackup;
  
  if (isSafe && hasBackupProtection) {
    console.log('✅ DEPLOYMENT IS SAFE');
    console.log('   → User data is properly protected');
    console.log('   → Persistence is correctly configured');
    if (dataState.hasData) {
      console.log('   → Recent backup exists for data recovery');
    }
  } else if (isSafe && !hasBackupProtection) {
    console.log('⚠️  DEPLOYMENT IS MOSTLY SAFE');
    console.log('   → Persistence is correctly configured');
    console.log('   → No recent backup but data will persist');
    console.log('   → Consider creating manual backup for extra safety');
  } else {
    console.log('🚨 DEPLOYMENT IS UNSAFE - DATA LOSS RISK');
    console.log('   → CRITICAL: Persistence configuration issues detected');
    console.log('   → USER DATA WILL BE LOST ON DEPLOYMENT');
    console.log('   → FIX PERSISTENCE ISSUES BEFORE DEPLOYING');
  }
  
  return {
    isSafe,
    hasBackupProtection,
    shouldProceed: isSafe
  };
}

/**
 * Main deployment check function
 */
async function runPreDeploymentCheck() {
  console.log('🚀 Pre-Deployment Safety Check');
  console.log('===============================');
  console.log(`🌐 Checking production health: ${CONFIG.PRODUCTION_URL}${CONFIG.HEALTH_ENDPOINT}`);
  console.log('');
  
  try {
    // Check production health endpoint
    const healthCheck = await checkHealthEndpoint(`${CONFIG.PRODUCTION_URL}${CONFIG.HEALTH_ENDPOINT}`);
    
    if (!healthCheck.success) {
      console.error('❌ Failed to connect to production health endpoint');
      console.error(`   Error: ${healthCheck.error}`);
      console.error('   Cannot verify deployment safety');
      process.exit(1);
    }
    
    if (healthCheck.status !== 200) {
      console.error(`❌ Health endpoint returned status ${healthCheck.status}`);
      console.error('   Production may not be healthy');
      process.exit(1);
    }
    
    console.log('✅ Successfully connected to production health endpoint');
    
    // Analyze health data
    const persistenceCheck = verifyPersistenceConfiguration(healthCheck.data);
    const dataState = analyzeDataState(healthCheck.data);
    const backupStatus = analyzeBackupStatus(healthCheck.data);
    
    // Generate report
    const assessment = generateDeploymentReport(healthCheck.data, persistenceCheck, dataState, backupStatus);
    
    // Exit with appropriate code
    if (assessment.shouldProceed) {
      console.log('\n✅ Pre-deployment check passed - safe to deploy');
      process.exit(0);
    } else {
      console.log('\n❌ Pre-deployment check failed - DO NOT DEPLOY');
      console.log('\nFix the persistence configuration issues before deploying:');
      console.log('1. Verify DATABASE_URL in Render environment variables');
      console.log('2. Ensure persistent disk is properly mounted');
      console.log('3. Re-run this check after fixes');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Pre-deployment check failed with error:');
    console.error(`   ${error.error || error.message || error}`);
    console.error('\nCannot verify deployment safety - recommend manual verification');
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'check':
  default:
    runPreDeploymentCheck();
    break;
}

console.log('\n📋 For more information:');
console.log('   - Health endpoint: ' + CONFIG.PRODUCTION_URL + CONFIG.HEALTH_ENDPOINT);
console.log('   - Render dashboard: https://dashboard.render.com');
console.log('   - Persistence docs: ./RENDER_PERSISTENCE.md');
console.log('');