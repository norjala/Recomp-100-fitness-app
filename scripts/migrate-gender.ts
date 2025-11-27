#!/usr/bin/env tsx
/**
 * Gender Migration Script - SAFE Production Migration
 *
 * This script safely updates user gender fields in the database with:
 * - Automatic backup before any changes
 * - Dry-run mode to preview changes
 * - Verification of user count
 * - Detailed logging
 * - Rollback capability
 *
 * Gender Assignment Rules:
 * - User "ohho" (Jackie Ho) → female
 * - All other users → male
 *
 * Usage:
 *   npm run migrate:gender -- --dry-run    # Preview changes without modifying database
 *   npm run migrate:gender                  # Execute migration with backup
 *   npm run migrate:gender -- --verify      # Verify migration results
 *
 * Safety Features:
 * - Creates backup before any changes
 * - Only updates NULL gender values
 * - Preserves all other user data
 * - Logs all operations
 * - Can be run multiple times safely (idempotent)
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq, isNull, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getDatabasePath, getConfig } from '../server/config.js';

interface MigrationResult {
  success: boolean;
  usersUpdated: number;
  backupPath?: string;
  errors: string[];
  dryRun: boolean;
}

async function createBackup(): Promise<string> {
  console.log('\n📦 Creating backup before migration...');

  const dbPath = getDatabasePath();
  const backupDir = getConfig().BACKUP_PATH;

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Create timestamped backup
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `fitness_challenge_PRE_GENDER_MIGRATION_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFilename);

  // Copy database file
  fs.copyFileSync(dbPath, backupPath);

  // Also backup WAL and SHM files if they exist
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';

  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, backupPath + '-wal');
  }

  if (fs.existsSync(shmPath)) {
    fs.copyFileSync(shmPath, backupPath + '-shm');
  }

  const stats = fs.statSync(backupPath);
  console.log(`✅ Backup created: ${backupFilename}`);
  console.log(`   Path: ${backupPath}`);
  console.log(`   Size: ${Math.round(stats.size / 1024)}KB\n`);

  return backupPath;
}

async function verifyDatabase(): Promise<{ valid: boolean; userCount: number; errors: string[] }> {
  console.log('🔍 Verifying database state...\n');

  const errors: string[] = [];

  // Check total user count
  const allUsers = await db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    gender: users.gender
  }).from(users);

  console.log(`   Total users in database: ${allUsers.length}`);

  // Find users without gender
  const usersWithoutGender = allUsers.filter(u => !u.gender);
  console.log(`   Users without gender: ${usersWithoutGender.length}`);

  if (usersWithoutGender.length > 0) {
    console.log(`\n   Users needing gender update:`);
    usersWithoutGender.forEach(u => {
      console.log(`   - ${u.username || 'unknown'} (${u.name || 'no name'})`);
    });
  }

  // Find Jackie Ho user
  const jackieHo = allUsers.find(u =>
    u.username === 'ohho' ||
    (u.name && u.name.toLowerCase().includes('jackie'))
  );

  if (jackieHo) {
    console.log(`\n   ✅ Found Jackie Ho: username="${jackieHo.username}", name="${jackieHo.name}", current gender="${jackieHo.gender || 'NULL'}"`);
  } else {
    console.log(`\n   ⚠️  Jackie Ho user not found (will not set female gender)`);
  }

  console.log('');

  return {
    valid: errors.length === 0,
    userCount: allUsers.length,
    errors
  };
}

async function migrateGenderData(dryRun: boolean = false): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    usersUpdated: 0,
    errors: [],
    dryRun
  };

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`   GENDER MIGRATION ${dryRun ? '(DRY RUN - NO CHANGES)' : '(LIVE EXECUTION)'}`);
    console.log(`${'='.repeat(60)}\n`);

    // Verify database state
    const verification = await verifyDatabase();

    if (!verification.valid) {
      result.errors = verification.errors;
      return result;
    }

    // Create backup (only if not dry run)
    if (!dryRun) {
      result.backupPath = await createBackup();
    } else {
      console.log('⚠️  DRY RUN MODE: Skipping backup creation\n');
    }

    // Get all users that need gender updates
    const usersToUpdate = await db.select({
      id: users.id,
      username: users.username,
      name: users.name,
      gender: users.gender
    }).from(users).where(isNull(users.gender));

    if (usersToUpdate.length === 0) {
      console.log('✅ All users already have gender set. No updates needed.\n');
      result.success = true;
      return result;
    }

    console.log(`📝 Planning to update ${usersToUpdate.length} users:\n`);

    // Determine gender for each user
    const updates = usersToUpdate.map(user => {
      const isFemale = user.username === 'ohho' ||
                      (user.name && user.name.toLowerCase().includes('jackie'));
      const gender = isFemale ? 'female' : 'male';

      console.log(`   ${user.username || 'unknown'} (${user.name || 'no name'}) → ${gender}`);

      return {
        userId: user.id,
        gender,
        username: user.username,
        name: user.name
      };
    });

    console.log('');

    if (dryRun) {
      console.log('✅ DRY RUN COMPLETE: Above changes would be applied in live execution\n');
      result.success = true;
      result.usersUpdated = updates.length;
      return result;
    }

    // Execute updates
    console.log('🔄 Applying gender updates...\n');

    for (const update of updates) {
      try {
        await db.update(users)
          .set({
            gender: update.gender as 'male' | 'female',
            updatedAt: new Date()
          })
          .where(eq(users.id, update.userId));

        console.log(`   ✅ Updated ${update.username || update.userId}: ${update.gender}`);
        result.usersUpdated++;
      } catch (error) {
        const errorMsg = `Failed to update ${update.username || update.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`   ❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(`\n✅ Migration completed: ${result.usersUpdated} users updated\n`);
    result.success = true;

    // Verify results
    console.log('🔍 Verifying migration results...\n');
    const postMigrationCheck = await db.select({
      username: users.username,
      name: users.name,
      gender: users.gender
    }).from(users);

    const stillMissing = postMigrationCheck.filter(u => !u.gender);
    if (stillMissing.length > 0) {
      console.log(`⚠️  Warning: ${stillMissing.length} users still have no gender:`);
      stillMissing.forEach(u => {
        console.log(`   - ${u.username || 'unknown'}`);
      });
    } else {
      console.log('✅ All users now have gender set');
    }

    const femaleUsers = postMigrationCheck.filter(u => u.gender === 'female');
    const maleUsers = postMigrationCheck.filter(u => u.gender === 'male');

    console.log(`\n📊 Final gender distribution:`);
    console.log(`   Female: ${femaleUsers.length} users`);
    console.log(`   Male: ${maleUsers.length} users`);
    console.log(`   Total: ${postMigrationCheck.length} users\n`);

    if (femaleUsers.length > 0) {
      console.log(`   Female users:`);
      femaleUsers.forEach(u => {
        console.log(`   - ${u.username || 'unknown'} (${u.name || 'no name'})`);
      });
      console.log('');
    }

  } catch (error) {
    const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`\n❌ ${errorMsg}\n`);
    result.errors.push(errorMsg);
    result.success = false;
  }

  return result;
}

async function verifyMigrationResults(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`   GENDER MIGRATION VERIFICATION`);
  console.log(`${'='.repeat(60)}\n`);

  const allUsers = await db.select({
    username: users.username,
    name: users.name,
    gender: users.gender
  }).from(users);

  console.log(`Total users: ${allUsers.length}\n`);

  const byGender = allUsers.reduce((acc, user) => {
    const g = user.gender || 'null';
    acc[g] = (acc[g] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(byGender).forEach(([gender, count]) => {
    console.log(`${gender}: ${count} users`);
  });

  const usersWithoutGender = allUsers.filter(u => !u.gender);
  if (usersWithoutGender.length > 0) {
    console.log(`\n⚠️  Users still missing gender:`);
    usersWithoutGender.forEach(u => {
      console.log(`   - ${u.username || 'unknown'} (${u.name || 'no name'})`);
    });
  } else {
    console.log(`\n✅ All users have gender set`);
  }

  console.log('');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verify = args.includes('--verify');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Gender Migration Script

Usage:
  npm run migrate:gender -- --dry-run    Preview changes without modifying
  npm run migrate:gender                  Execute migration with backup
  npm run migrate:gender -- --verify      Verify migration results

Options:
  --dry-run    Show what would be changed without modifying database
  --verify     Check current gender distribution in database
  --help, -h   Show this help message

Safety Features:
  ✅ Automatic backup before changes
  ✅ Only updates NULL gender values
  ✅ Preserves all other user data
  ✅ Detailed logging of all operations
  ✅ Can be run multiple times safely
`);
    process.exit(0);
  }

  if (verify) {
    await verifyMigrationResults();
    process.exit(0);
  }

  const result = await migrateGenderData(dryRun);

  if (!result.success) {
    console.error('❌ Migration failed with errors:');
    result.errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  if (result.dryRun) {
    console.log('💡 To execute this migration for real, run: npm run migrate:gender\n');
  } else {
    console.log('📋 Next steps:');
    console.log('   1. Verify results: npm run migrate:gender -- --verify');
    console.log('   2. Recalculate scores: npm run scores:recalculate');
    console.log(`   3. Backup saved to: ${result.backupPath}\n`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
