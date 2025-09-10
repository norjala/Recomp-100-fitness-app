#!/usr/bin/env node

/**
 * Automated Database Backup System
 * 
 * Creates timestamped backups of the fitness challenge database
 * Implements safety checks and retention policies
 * Logs all operations for audit trail
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BACKUP_CONFIG = {
  SOURCE_DB: './data/fitness_challenge.db',
  BACKUP_DIR: './data/backups',
  MAX_BACKUPS: 10, // Keep last 10 backups
  VERIFY_BACKUP: true, // Verify backup integrity after creation
  LOG_FILE: './logs/backup.log'
};

/**
 * Log backup operations with timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  // Ensure logs directory exists
  const logDir = path.dirname(BACKUP_CONFIG.LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Append to log file
  fs.appendFileSync(BACKUP_CONFIG.LOG_FILE, logMessage);
}

/**
 * Create backup filename with timestamp
 */
function generateBackupFilename() {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19); // YYYY-MM-DD_HH-MM-SS
  
  return `fitness_challenge_backup_${timestamp}.db`;
}

/**
 * Verify database integrity using SQLite PRAGMA commands
 */
function verifyDatabase(dbPath) {
  try {
    // Check database integrity
    const integrityResult = execSync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`, { encoding: 'utf8' });
    if (!integrityResult.includes('ok')) {
      throw new Error(`Integrity check failed: ${integrityResult}`);
    }
    
    // Get table counts for verification
    const userCount = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM users;"`, { encoding: 'utf8' }).trim();
    const scanCount = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM dexa_scans;"`, { encoding: 'utf8' }).trim();
    const scoreCount = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM scoring_data;"`, { encoding: 'utf8' }).trim();
    
    return {
      valid: true,
      users: parseInt(userCount),
      scans: parseInt(scanCount),
      scores: parseInt(scoreCount)
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Create database backup with verification
 */
function createBackup() {
  try {
    log('Starting database backup...');
    
    // Check if source database exists
    if (!fs.existsSync(BACKUP_CONFIG.SOURCE_DB)) {
      throw new Error(`Source database not found: ${BACKUP_CONFIG.SOURCE_DB}`);
    }
    
    // Verify source database before backup
    const sourceVerification = verifyDatabase(BACKUP_CONFIG.SOURCE_DB);
    if (!sourceVerification.valid) {
      throw new Error(`Source database is corrupted: ${sourceVerification.error}`);
    }
    
    log(`Source database verified: ${sourceVerification.users} users, ${sourceVerification.scans} scans, ${sourceVerification.scores} scores`);
    
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_CONFIG.BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_CONFIG.BACKUP_DIR, { recursive: true });
    }
    
    // Generate backup filename and path
    const backupFilename = generateBackupFilename();
    const backupPath = path.join(BACKUP_CONFIG.BACKUP_DIR, backupFilename);
    
    // Create backup using SQLite dump
    log(`Creating backup: ${backupFilename}`);
    execSync(`sqlite3 "${BACKUP_CONFIG.SOURCE_DB}" ".backup '${backupPath}'"`);
    
    // Verify backup if enabled
    if (BACKUP_CONFIG.VERIFY_BACKUP) {
      const backupVerification = verifyDatabase(backupPath);
      if (!backupVerification.valid) {
        fs.unlinkSync(backupPath); // Delete corrupted backup
        throw new Error(`Backup verification failed: ${backupVerification.error}`);
      }
      
      // Compare counts to ensure data consistency
      if (backupVerification.users !== sourceVerification.users ||
          backupVerification.scans !== sourceVerification.scans ||
          backupVerification.scores !== sourceVerification.scores) {
        fs.unlinkSync(backupPath); // Delete inconsistent backup
        throw new Error(`Backup data mismatch - Source: ${sourceVerification.users}/${sourceVerification.scans}/${sourceVerification.scores}, Backup: ${backupVerification.users}/${backupVerification.scans}/${backupVerification.scores}`);
      }
      
      log(`Backup verified successfully: ${backupVerification.users} users, ${backupVerification.scans} scans, ${backupVerification.scores} scores`);
    }
    
    // Get backup file size
    const stats = fs.statSync(backupPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    log(`Backup completed successfully: ${backupFilename} (${sizeKB} KB)`, 'SUCCESS');
    
    // Clean up old backups
    cleanupOldBackups();
    
    return {
      success: true,
      filename: backupFilename,
      path: backupPath,
      size: sizeKB,
      data: sourceVerification
    };
    
  } catch (error) {
    log(`Backup failed: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up old backups based on retention policy
 */
function cleanupOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_CONFIG.BACKUP_DIR)) {
      return;
    }
    
    // Get all backup files sorted by modification time (newest first)
    const backupFiles = fs.readdirSync(BACKUP_CONFIG.BACKUP_DIR)
      .filter(file => file.startsWith('fitness_challenge_backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_CONFIG.BACKUP_DIR, file),
        mtime: fs.statSync(path.join(BACKUP_CONFIG.BACKUP_DIR, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    // Delete old backups if we have more than the maximum
    if (backupFiles.length > BACKUP_CONFIG.MAX_BACKUPS) {
      const filesToDelete = backupFiles.slice(BACKUP_CONFIG.MAX_BACKUPS);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        log(`Deleted old backup: ${file.name}`);
      });
      
      log(`Cleaned up ${filesToDelete.length} old backup(s)`);
    }
    
  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'WARN');
  }
}

/**
 * List all available backups with details
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_CONFIG.BACKUP_DIR)) {
      console.log('No backup directory found.');
      return [];
    }
    
    const backupFiles = fs.readdirSync(BACKUP_CONFIG.BACKUP_DIR)
      .filter(file => file.startsWith('fitness_challenge_backup_') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_CONFIG.BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const verification = verifyDatabase(filePath);
        
        return {
          filename: file,
          path: filePath,
          created: stats.mtime,
          size: Math.round(stats.size / 1024) + ' KB',
          valid: verification.valid,
          users: verification.users || 'N/A',
          scans: verification.scans || 'N/A',
          scores: verification.scores || 'N/A'
        };
      })
      .sort((a, b) => b.created - a.created);
    
    console.log('\n=== Available Database Backups ===\n');
    backupFiles.forEach(backup => {
      console.log(`📁 ${backup.filename}`);
      console.log(`   📅 Created: ${backup.created.toLocaleString()}`);
      console.log(`   📊 Size: ${backup.size}`);
      console.log(`   👥 Data: ${backup.users} users, ${backup.scans} scans, ${backup.scores} scores`);
      console.log(`   ✅ Valid: ${backup.valid ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    return backupFiles;
    
  } catch (error) {
    console.error(`Failed to list backups: ${error.message}`);
    return [];
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'create':
    createBackup();
    break;
  case 'list':
    listBackups();
    break;
  case 'verify':
    const dbPath = process.argv[3] || BACKUP_CONFIG.SOURCE_DB;
    const result = verifyDatabase(dbPath);
    console.log(`Database verification for ${dbPath}:`);
    console.log(`Valid: ${result.valid}`);
    if (result.valid) {
      console.log(`Users: ${result.users}, Scans: ${result.scans}, Scores: ${result.scores}`);
    } else {
      console.log(`Error: ${result.error}`);
    }
    break;
  default:
    console.log('Database Backup System');
    console.log('');
    console.log('Usage:');
    console.log('  node backup-database.js create   - Create new backup');
    console.log('  node backup-database.js list     - List all backups');
    console.log('  node backup-database.js verify [path] - Verify database integrity');
    console.log('');
    console.log('Configuration:');
    console.log(`  Source DB: ${BACKUP_CONFIG.SOURCE_DB}`);
    console.log(`  Backup Dir: ${BACKUP_CONFIG.BACKUP_DIR}`);
    console.log(`  Max Backups: ${BACKUP_CONFIG.MAX_BACKUPS}`);
    console.log(`  Log File: ${BACKUP_CONFIG.LOG_FILE}`);
}