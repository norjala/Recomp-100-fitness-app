#!/usr/bin/env tsx
// Database backup script
import fs from 'fs';
import path from 'path';
import { getDatabasePath, getConfig } from '../server/config';

async function backupDatabase() {
  try {
    console.log('🔄 Starting database backup...');
    
    const config = getConfig();
    const sourcePath = getDatabasePath();
    
    // Check if source database exists
    if (!fs.existsSync(sourcePath)) {
      console.error('❌ Source database not found:', sourcePath);
      process.exit(1);
    }
    
    // Create backup directory if it doesn't exist
    const backupDir = config.BACKUP_PATH;
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `fitness_challenge_backup_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);
    
    // Copy database file
    fs.copyFileSync(sourcePath, backupPath);
    
    // Also backup WAL file if it exists
    const walPath = sourcePath + '-wal';
    const backupWalPath = backupPath + '-wal';
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, backupWalPath);
    }
    
    // Also backup SHM file if it exists
    const shmPath = sourcePath + '-shm';
    const backupShmPath = backupPath + '-shm';
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, backupShmPath);
    }
    
    console.log('✅ Database backup created:', backupPath);
    
    // Clean up old backups based on retention policy
    await cleanupOldBackups(backupDir, config.BACKUP_RETENTION_COUNT);
    
    console.log('🎉 Backup completed successfully!');
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

async function cleanupOldBackups(backupDir: string, retentionCount: number) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('fitness_challenge_backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stats: fs.statSync(path.join(backupDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Newest first
    
    if (files.length > retentionCount) {
      const filesToDelete = files.slice(retentionCount);
      console.log(`🗑️  Cleaning up ${filesToDelete.length} old backup(s)...`);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        
        // Also delete associated WAL and SHM files
        const walPath = file.path + '-wal';
        const shmPath = file.path + '-shm';
        
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        
        console.log(`   Deleted: ${file.name}`);
      }
    }
  } catch (error) {
    console.warn('⚠️  Warning: Failed to cleanup old backups:', error);
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backupDatabase();
}