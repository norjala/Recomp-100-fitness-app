#!/usr/bin/env tsx
// Database restore script
import fs from 'fs';
import path from 'path';
import { getDatabasePath, getConfig } from '../server/config';

async function restoreDatabase() {
  try {
    const backupFile = process.argv[2];
    
    if (!backupFile) {
      console.error('❌ Usage: npm run db:restore <backup-file>');
      console.log('\nAvailable backups:');
      await listBackups();
      process.exit(1);
    }
    
    console.log('🔄 Starting database restore...');
    
    const config = getConfig();
    const targetPath = getDatabasePath();
    
    // Resolve backup file path
    let backupPath: string;
    if (path.isAbsolute(backupFile)) {
      backupPath = backupFile;
    } else {
      // Try relative to backup directory first
      backupPath = path.join(config.BACKUP_PATH, backupFile);
      if (!fs.existsSync(backupPath)) {
        // Try relative to current directory
        backupPath = path.resolve(backupFile);
      }
    }
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found:', backupPath);
      await listBackups();
      process.exit(1);
    }
    
    // Confirm restoration (this will overwrite existing database)
    console.log(`⚠️  This will overwrite the current database at: ${targetPath}`);
    console.log(`   Restoring from: ${backupPath}`);
    
    // In production, you might want to add a confirmation prompt here
    const shouldProceed = process.argv.includes('--force') || process.env.NODE_ENV === 'development';
    
    if (!shouldProceed) {
      console.log('❌ Restore cancelled. Use --force flag to proceed without confirmation.');
      process.exit(1);
    }
    
    // Create backup of current database before restore
    if (fs.existsSync(targetPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const preRestoreBackup = targetPath + `.pre-restore-${timestamp}`;
      fs.copyFileSync(targetPath, preRestoreBackup);
      console.log(`📦 Created pre-restore backup: ${preRestoreBackup}`);
    }
    
    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Restore database file
    fs.copyFileSync(backupPath, targetPath);
    
    // Restore WAL file if it exists
    const backupWalPath = backupPath + '-wal';
    const targetWalPath = targetPath + '-wal';
    if (fs.existsSync(backupWalPath)) {
      fs.copyFileSync(backupWalPath, targetWalPath);
    }
    
    // Restore SHM file if it exists
    const backupShmPath = backupPath + '-shm';
    const targetShmPath = targetPath + '-shm';
    if (fs.existsSync(backupShmPath)) {
      fs.copyFileSync(backupShmPath, targetShmPath);
    }
    
    console.log('✅ Database restored from:', backupPath);
    console.log('🎉 Restore completed successfully!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

async function listBackups() {
  try {
    const config = getConfig();
    const backupDir = config.BACKUP_PATH;
    
    if (!fs.existsSync(backupDir)) {
      console.log('   No backups directory found.');
      return;
    }
    
    const backups = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('fitness_challenge_backup_') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => b.created.getTime() - a.created.getTime()); // Newest first
    
    if (backups.length === 0) {
      console.log('   No backup files found.');
      return;
    }
    
    console.log('\n📦 Available backups:');
    backups.forEach(backup => {
      const sizeKB = Math.round(backup.size / 1024);
      console.log(`   ${backup.name} (${sizeKB}KB, ${backup.created.toLocaleString()})`);
    });
    console.log('\nUsage: npm run db:restore <backup-filename>');
    
  } catch (error) {
    console.warn('⚠️  Warning: Could not list backups:', error);
  }
}

// Run restore if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--list') {
    listBackups();
  } else {
    restoreDatabase();
  }
}